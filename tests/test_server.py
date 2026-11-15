"""Live HTTP + SQLite tests with genuine records from the JavaScript engine."""
import copy
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import APIError, FlightStore, RateLimiter, make_server, player_id, validate_flight


class SharedFlightsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = tempfile.TemporaryDirectory()
        output = Path(cls.fixtures.name) / 'flights.json'
        result = subprocess.run(['node', 'tools/api_fixture.mjs', str(output)], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        cls.records = json.loads(output.read_text())

    @classmethod
    def tearDownClass(cls):
        cls.fixtures.cleanup()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / 'persist' / 'missions.sqlite3'
        self.start()

    def start(self):
        self.server = make_server('127.0.0.1', 0, self.db, ['https://demo.github.io'])
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def tearDown(self):
        self.stop()
        self.tmp.cleanup()

    def request(self, path, data=None, method=None, headers=None):
        headers = {'Content-Type': 'application/json', **(headers or {})}
        body = json.dumps(data).encode() if data is not None and not isinstance(data, bytes) else data
        req = urllib.request.Request(self.base + path, data=body, method=method, headers=headers)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            response = opener.open(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            try:
                value = json.loads(raw)
            except ValueError:
                value = raw.decode(errors='replace')
            return response.status, value, dict(response.headers)

    def record(self, player='alice', index=0):
        r = copy.deepcopy(self.records[index])
        r['playerId'] = player
        r['flightId'] = str(uuid.uuid4())
        return r

    def test_player_normalization_and_invalid_ids(self):
        self.assertEqual(self.request('/api/players', {'playerId': ' Alice '})[1]['playerId'], 'alice')
        self.assertEqual(self.request('/api/players', {'playerId': 'ALICE'})[1]['playerId'], 'alice')
        self.assertEqual(self.request('/api/players', {'playerId': 'bob'})[0], 200)
        for bad in ['', 'a', '<script>', 'x' * 21, "'; DROP TABLE players; --", ['bad']]:
            self.assertEqual(self.request('/api/players', {'playerId': bad})[0], 400)

    def test_all_real_records_and_cross_language_scoring(self):
        for i in range(len(self.records)):
            r = self.record('alice', i)
            self.assertEqual(self.request('/api/flights', r)[0], 201)
            detail = self.request('/api/flights/' + r['flightId'])[1]
            self.assertEqual(detail['totalScore'], r['totalScore'])
            self.assertEqual(detail['score'], r['arcadeScore'])
            self.assertIn('trajectoryAnalysis', detail)
        self.assertEqual(self.request('/api/players/alice/flights')[1]['total'], len(self.records))

    def test_best_per_player_ties_details_and_independent_clients(self):
        low, high = self.record('alice', 0), self.record('alice', 1)
        bob = self.record('bob', 1)
        for r in [low, high, bob]:
            self.assertEqual(self.request('/api/flights', r)[0], 201)
        a = self.request('/api/leaderboard?level=moon&playerId=alice')[1]
        b = self.request('/api/leaderboard?level=moon&playerId=bob')[1]
        self.assertEqual(len(a['rows']), 2)
        self.assertEqual(a['rows'], b['rows'])
        self.assertEqual(a['rows'][0]['player_id'], 'alice')
        self.assertEqual(a['ownBest']['flight_id'], high['flightId'])
        self.assertEqual(self.request('/api/flights/' + high['flightId'])[1]['science'], high['science'])
        self.assertEqual(self.request('/api/leaderboard?level=mars')[1]['total'], 0)

    def test_immutable_idempotent_submission_under_concurrency(self):
        r = self.record()
        with ThreadPoolExecutor(max_workers=8) as pool:
            codes = list(pool.map(lambda _: self.request('/api/flights', r)[0], range(8)))
        self.assertEqual(codes.count(201), 1)
        self.assertEqual(codes.count(200), 7)
        r['playerId'] = 'bob'
        self.assertEqual(self.request('/api/flights', r)[0], 409)
        self.assertEqual(self.request('/api/players/alice/flights')[1]['total'], 1)

    def test_restart_retains_records(self):
        r = self.record()
        self.request('/api/flights', r)
        self.stop()
        self.start()
        self.assertEqual(self.request('/api/flights/' + r['flightId'])[1]['flightId'], r['flightId'])
        self.assertEqual(self.request('/api/leaderboard?level=moon')[1]['total'], 1)

    def test_score_tampering_negative_nonfinite_and_legacy_rejected(self):
        changes = [('scoreVersion', '10.2'), ('arcadeScore', -1), ('totalScore', 10**12), ('totalScore', float('nan')), ('missionBonus', -5), ('gameVersion', '10.2.0'), ('playerId', 'bad id')]
        for k, v in changes:
            r = self.record()
            r[k] = v
            self.assertEqual(self.request('/api/flights', r)[0], 400, k)
        r = self.record();r['telemetry']['minEnergy'] = -1
        self.assertEqual(self.request('/api/flights', r)[0], 400)
        r = self.record(index=2);r['science']['receivedMB'] += 50
        self.assertEqual(self.request('/api/flights', r)[0], 400)
        r = self.record();r['arcadeLedger']['survival']['base'] += 2
        self.assertEqual(self.request('/api/flights', r)[0], 400)

    def test_cors_size_json_pagination_and_static_service(self):
        status, _, h = self.request('/api/health', headers={'Origin': 'https://demo.github.io'})
        self.assertEqual(status, 200);self.assertEqual(h.get('Access-Control-Allow-Origin'), 'https://demo.github.io')
        self.assertEqual(self.request('/api/players', {'playerId': 'alice'}, headers={'Origin': 'https://wrong.example'})[0], 403)
        self.assertEqual(self.request('/api/players', method='OPTIONS', headers={'Origin': 'https://demo.github.io'})[0], 204)
        self.assertEqual(self.request('/api/players', b'{' + b' ' * 262144)[0], 413)
        self.assertEqual(self.request('/api/players', b'{"playerId":"alice","playerId":"bob"}')[0], 400)
        self.assertEqual(self.request('/api/leaderboard?limit=500')[0], 400)
        self.assertEqual(self.request('/api/players/alice/flights?offset=-1')[0], 400)
        self.assertEqual(self.request('/')[0], 200)
        self.assertEqual(self.request('/.gitignore')[0], 404)
        self.assertEqual(self.request('/data/')[0], 403)

    def test_paginated_history_and_large_best_query(self):
        store = self.server.store
        records = [self.record(f'player-{i:04d}', i % 3) for i in range(160)]
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(store.add, records))
        board = self.request('/api/leaderboard?level=moon&offset=50&limit=50')[1]
        self.assertEqual(board['total'], 160);self.assertEqual(len(board['rows']), 50)
        self.assertEqual(board['rows'][0]['rank'], 51)
        for _ in range(55):
            store.add(self.record('history', 0))
        page = self.request('/api/players/history/flights?offset=50&limit=50')[1]
        self.assertEqual(page['total'], 55);self.assertEqual(len(page['rows']), 5)

    def test_request_limit(self):
        limiter = RateLimiter()
        self.assertTrue(all(limiter.accept('test-client', True) for _ in range(180)))
        self.assertFalse(limiter.accept('test-client', True))
        self.assertTrue(limiter.accept('another-client', True))


if __name__ == '__main__':
    unittest.main()
