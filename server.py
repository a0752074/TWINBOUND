"""Shared immutable flight records; Python 3.10 standard library only.

Player IDs are public nicknames, not authenticated accounts. Validation checks
composition and bounds, not whether an untrusted browser truly flew a mission.
"""
from __future__ import annotations
from collections import defaultdict, deque
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
import hashlib
import json
import math
import re
import sqlite3
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parent
MAX_BODY = 262144
RULES = json.loads((ROOT / 'data/mission-score-rules.json').read_text(encoding='utf-8')) if (ROOT / 'data/mission-score-rules.json').exists() else None


class APIError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def player_id(value):
    if not isinstance(value, str):
        raise APIError('Enter a Player ID.')
    value = value.strip().lower()
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{1,19}', value):
        raise APIError('Use 2-20 letters, numbers, underscores or hyphens; start with a letter or number.')
    return value


def bounded(value, name, low=0, high=1e9, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high or (integer and not isinstance(value, int)):
        raise APIError('Invalid ' + name)
    return value


def inspect_json(value, depth=0):
    if depth > 16:
        raise APIError('Record is too deeply nested.')
    if isinstance(value, dict):
        if len(value) > 180:
            raise APIError('Record has too many fields.')
        for k, v in value.items():
            if len(k) > 100:
                raise APIError('Invalid field name.')
            inspect_json(v, depth + 1)
    elif isinstance(value, list):
        if len(value) > 1024:
            raise APIError('Record has too many samples.')
        for v in value:
            inspect_json(v, depth + 1)
    elif isinstance(value, str):
        if len(value) > 4000:
            raise APIError('Record text is too long.')
    elif isinstance(value, (float, int)) and not isinstance(value, bool):
        bounded(value, 'numeric field', -1e20, 1e20)


def encode(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'), allow_nan=False)


def validate_flight(record):
    """Recompute NASA score using versioned rules and measured report inputs."""
    if not isinstance(record, dict):
        raise APIError('A flight record object is required.')
    inspect_json(record)
    if record.get('gameVersion') != RULES['gameVersion'] or record.get('scoreVersion') != RULES['scoreVersion']:
        raise APIError('This server accepts v10.3 scoring records only.')
    r = json.loads(encode(record))
    r['playerId'] = player_id(r.get('playerId'))
    try:
        ident = uuid.UUID(r.get('flightId', ''))
        if ident.version != 4 or str(ident) != r['flightId']:
            raise ValueError()
        datetime.fromisoformat(r['date'].replace('Z', '+00:00'))
    except (ValueError, TypeError, KeyError, AttributeError):
        raise APIError('Invalid flight ID or date.') from None
    level = r.get('level')
    if level not in RULES['levels'] or r.get('status') not in ('arrived', 'failed', 'aborted'):
        raise APIError('Invalid destination or mission result.')
    launch = r.get('launch', {})
    bounded(launch.get('heading'), 'heading', 0, 360)
    bounded(launch.get('pitch'), 'out-of-plane angle', -45, 45)
    bounded(launch.get('speed'), 'injection speed', RULES['levels'][level]['range'][0], RULES['levels'][level]['range'][1])
    try:
        launch_date = datetime.strptime(launch['launchDate'], '%Y-%m-%d').date().isoformat()
        if launch_date != launch['launchDate'] or not '2025-01-01' <= launch_date <= '2030-12-31':
            raise ValueError()
    except (KeyError, ValueError, TypeError):
        raise APIError('Invalid launch date.') from None
    t = bounded(r.get('time'), 'flight duration', 0, 21600)
    arcade = bounded(r.get('arcadeScore'), 'arcade score', 0, 50000000, True)
    if r.get('score') != arcade or r.get('baseScore', -1) + r.get('threeDBonus', -1) != arcade:
        raise APIError('Arcade score components do not agree.')
    bounded(r.get('baseScore'), 'base score', 0, 50000000, True)
    bounded(r.get('threeDBonus'), '3D bonus', 0, 12500000, True)
    bounded(r.get('threeDSeconds'), '3D duration', 0, t + 1e-6)
    if r['threeDBonus'] > math.ceil(r['baseScore'] * .25) + 1:
        raise APIError('3D bonus exceeds its earned-points limit.')
    kit = r.get('kit', {})
    if not isinstance(kit, dict) or set(kit) != {'engine', 'hull', 'power'}:
        raise APIError('Invalid equipment kit.')
    parts = {}
    for key in ('engine', 'hull', 'power'):
        index = bounded(kit[key], 'equipment tier', 0, 2, True)
        parts[key] = RULES['equipment'][key]['items'][index]
    s = r.get('science')
    if not isinstance(s, dict) or not isinstance(s.get('selection'), dict):
        raise APIError('Science results are required.')
    selection = s['selection']
    try:
        if selection['objective'] not in RULES['levels'][level]['objectives']:
            raise KeyError()
        instrument = RULES['instruments'][selection['instrument']]
        radio = RULES['radios'][selection['radio']]
        launcher = RULES['launchers'][selection['launcher']]
        budget = RULES['budgets'][selection['budget']]
        objective = RULES['objectives'][selection['objective']]
    except (KeyError, TypeError):
        raise APIError('Invalid science equipment selection.') from None
    dry = 65 + sum(p['mass'] for p in parts.values()) + instrument['mass'] + radio['mass']
    max_fuel, max_energy = parts['engine']['fuel'], parts['power']['battery']
    price = 120000 + sum(p['price'] for p in parts.values()) + instrument['price'] + radio['price'] + launcher['extraCost']
    multiplier = 1 + sum(p['bonus'] for p in parts.values())
    if abs(r.get('price', -1) - price) > .01 or abs(r.get('multiplier', -1) - multiplier) > 1e-8:
        raise APIError('Equipment price or score multiplier does not agree.')
    fuel = bounded(r.get('fuel'), 'remaining fuel', 0, max_fuel + 1e-6)
    energy = bounded(r.get('energy'), 'remaining energy', 0, max_energy + 1e-6)
    bounded(r.get('fuelUsed'), 'fuel used', 0, 1e6)
    bounded(r.get('stability'), 'route stability', 0, 100)
    for key in ('hits', 'collected', 'nearMisses', 'maxCombo', 'blackholesEscaped'):
        bounded(r.get(key), key, 0, 100000, True)
    max_arcade = (13 * t + 4 * 180 + 250 * r['collected'] + 90 * r['nearMisses'] + 700 * r['blackholesEscaped'] + (2000 if r['status'] == 'arrived' else 0)) * RULES['levels'][level]['multiplier'] * multiplier * 1.42 * 1.25
    if arcade > max_arcade + 3:
        raise APIError('Arcade score exceeds the reported gameplay awards.')
    ledger = r.get('arcadeLedger')
    if not isinstance(ledger, dict) or not set(ledger).issubset({'survival', 'phase', 'escape', 'near', 'arrival', 'comet', 'pickup'}):
        raise APIError('Invalid arcade award ledger.')
    sums = {'base': 0.0, 'threeD': 0.0}
    for entry in ledger.values():
        if not isinstance(entry, dict) or set(entry) != set(sums):
            raise APIError('Invalid arcade award components.')
        for k in sums:
            sums[k] += bounded(entry[k], 'award value', 0, 50000000)
        if entry['threeD'] > entry['base'] * .25 + 1e-6:
            raise APIError('Invalid 3D award.')
    if abs(sums['base'] - r['baseScore']) > .50001 or abs(sums['base'] + sums['threeD'] - arcade) > .50001:
        raise APIError('Arcade ledger does not match the reported score.')
    telemetry, nav = r.get('telemetry', {}), r.get('navigation', {})
    minimum = bounded(telemetry.get('minEnergy'), 'lowest battery reserve', 0, energy + 1e-6)
    progress = bounded(telemetry.get('maxProgress'), 'maximum physical progress', 0, 1)
    bounded(nav.get('progress'), 'current physical progress', 0, progress + 1e-6)
    days = bounded(nav.get('simulatedDays'), 'physical duration', 0, 100000)
    if r['status'] == 'arrived' and progress < 1 - 1e-6:
        raise APIError('Arrival requires completed navigation progress.')
    for key in ('generatedMB', 'storedMB', 'transmittedMB', 'receivedMB', 'inTransitMB', 'droppedMB', 'exposureControlSeconds'):
        bounded(s.get(key), key, 0, 100000)
    g, stored, sent, received, dropped = (s[k] for k in ('generatedMB', 'storedMB', 'transmittedMB', 'receivedMB', 'droppedMB'))
    if abs(g - stored - sent - dropped) > 1e-5 or stored > instrument['storageMB'] + 1e-6 or received > sent + 1e-6 or abs(s['inTransitMB'] - (sent - received)) > 1e-5 or s['exposureControlSeconds'] > t + 1e-6 or g > instrument['dataMBps'] * t + 1e-5:
        raise APIError('Science data balance does not agree.')
    if abs(s.get('requiredMB', -1) - objective['requiredMB']) > 1e-9:
        raise APIError('Science target does not match this objective.')
    compatible = selection['instrument'] == objective['instrument']
    checks = [compatible, dry + max_fuel <= launcher['capacityKg'], price <= budget, days <= RULES['levels'][level]['maxDays']]
    R = sum(checks) / len(checks)
    unit = lambda x: max(0, min(1, x))
    bh, fh, integrity = unit(minimum / (max_energy * .2)), unit(fuel / (max_fuel * .2)), unit(1 - dropped / g) if g > 0 else 0
    E = .4 * bh + .35 * fh + .25 * integrity
    credited = (stored + sent if level == 'proxima' else received) if compatible and g > 0 and s['exposureControlSeconds'] > 0 else 0
    D = unit(credited / objective['requiredMB'])
    F = int(r['status'] == 'arrived' and all(checks) and credited + 1e-9 >= objective['requiredMB'])
    expected_checks = dict(zip(('instrument', 'mass', 'budget', 'lifetime', 'arrival', 'science'), [*checks, r['status'] == 'arrived', credited + 1e-9 >= objective['requiredMB']]))
    given_checks = {c.get('id'): c.get('pass') for c in s.get('checks', []) if isinstance(c, dict)}
    if given_checks != expected_checks or s.get('complete') is not bool(F) or abs(s.get('sciencePercent', -1) - D * 100) > 1e-6:
        raise APIError('Mission requirements do not agree with the science results.')
    baseline = RULES['costBenchmarks'][level + ':' + selection['objective']]
    den = baseline['referenceCost'] - baseline['minimumValidCost']
    C = unit((baseline['referenceCost'] - price) / den) if F and den > 0 else 0
    q = unit(.15 * progress * R + .20 * progress * E + .60 * D + .05 * F * C)
    cap = RULES['bonusCaps'][level]
    bonus = math.floor(cap * q + .5)
    grade = ('A' if q >= .9 else 'B' if q >= .75 else 'C') if F else 'Partial' if D > 0 else 'No return'
    bounded(r.get('missionBonus'), 'mission bonus', 0, cap, True)
    bounded(r.get('totalScore'), 'total score', 0, 50000000 + cap, True)
    if r.get('missionBonus') != bonus or r.get('totalScore') != arcade + bonus or r.get('missionGrade') != grade or r.get('missionComplete') is not bool(F):
        raise APIError('Mission score components do not agree with this scoring version.')
    ms = r.get('missionScore', {})
    for key, value in {'p': progress, 'R': R, 'E': E, 'D': D, 'F': F, 'C': C, 'quality': q, 'cap': cap, 'creditedMB': credited, 'batteryHealth': bh, 'fuelHealth': fh, 'dataIntegrity': integrity}.items():
        if not isinstance(ms.get(key), (int, float)) or abs(ms[key] - value) > 1e-7:
            raise APIError('Invalid mission score metric: ' + key)
    r['spacecraft'] = {'kit': kit, 'engine': parts['engine']['name'], 'hull': parts['hull']['name'], 'power': parts['power']['name'], 'instrument': instrument['name'], 'radio': radio['name'], 'launcher': launcher['name'], 'mission': selection, 'budget': budget, 'totalCost': price, 'multiplier': multiplier, 'maxFuel': max_fuel, 'maxEnergy': max_energy, 'wetMass': dry + max_fuel}
    return r


class FlightStore:
    def __init__(self, path):
        self.path = Path(path).expanduser().resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as c:
            c.execute('PRAGMA journal_mode=WAL')
            c.executescript('''
                CREATE TABLE IF NOT EXISTS players (player_id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS flights (
                  flight_id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(player_id),
                  level TEXT NOT NULL, score_version TEXT NOT NULL, total_score INTEGER NOT NULL,
                  mission_bonus INTEGER NOT NULL, mission_grade TEXT NOT NULL, status TEXT NOT NULL,
                  flight_date TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL, fingerprint TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS flights_board ON flights(level,score_version,total_score DESC,mission_bonus DESC,created_at,flight_id);
                CREATE INDEX IF NOT EXISTS flights_player ON flights(player_id,created_at DESC,flight_id);
                PRAGMA user_version=1;
            ''')

    @contextmanager
    def connect(self):
        c = sqlite3.connect(str(self.path), timeout=10)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA foreign_keys=ON')
        c.execute('PRAGMA busy_timeout=10000')
        try:
            with c:
                yield c
        finally:
            c.close()

    def player(self, value):
        ident = player_id(value)
        with self.connect() as c:
            c.execute('INSERT OR IGNORE INTO players VALUES (?,?)', (ident, datetime.now(timezone.utc).isoformat()))
        return {'playerId': ident}

    def add(self, record):
        r = validate_flight(record)
        payload = encode(r)
        digest = hashlib.sha256(payload.encode()).hexdigest()
        with self.connect() as c:
            c.execute('BEGIN IMMEDIATE')
            old = c.execute('SELECT fingerprint FROM flights WHERE flight_id=?', (r['flightId'],)).fetchone()
            if old:
                if old['fingerprint'] != digest:
                    raise APIError('This Flight ID already belongs to an immutable record.', 409)
                return {'flightId': r['flightId'], 'duplicate': True, 'synced': True}
            now = datetime.now(timezone.utc).isoformat()
            c.execute('INSERT OR IGNORE INTO players VALUES (?,?)', (r['playerId'], now))
            c.execute('INSERT INTO flights VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', (r['flightId'], r['playerId'], r['level'], r['scoreVersion'], r['totalScore'], r['missionBonus'], r['missionGrade'], r['status'], r['date'], now, payload, digest))
        return {'flightId': r['flightId'], 'duplicate': False, 'synced': True}

    @staticmethod
    def summary(row):
        return {k: row[k] for k in row.keys() if k not in ('payload', 'fingerprint', 'own_row')}

    def flight(self, ident):
        with self.connect() as c:
            row = c.execute('SELECT payload FROM flights WHERE flight_id=?', (ident,)).fetchone()
        if not row:
            raise APIError('Flight not found.', 404)
        return json.loads(row['payload'])

    def history(self, ident, limit=50, offset=0):
        ident = player_id(ident)
        with self.connect() as c:
            total = c.execute('SELECT COUNT(*) FROM flights WHERE player_id=?', (ident,)).fetchone()[0]
            rows = c.execute('SELECT flight_id,player_id,level,total_score,mission_bonus,mission_grade,status,flight_date,score_version FROM flights WHERE player_id=? ORDER BY created_at DESC,flight_id LIMIT ? OFFSET ?', (ident, limit, offset)).fetchall()
        return {'rows': [self.summary(r) for r in rows], 'total': total, 'limit': limit, 'offset': offset}

    def leaderboard(self, level, own=None, limit=50, offset=0):
        if level not in RULES['levels']:
            raise APIError('Unknown destination.')
        if own:
            own = player_id(own)
        base = '''WITH best AS (
            SELECT *,ROW_NUMBER() OVER(PARTITION BY player_id ORDER BY total_score DESC,mission_bonus DESC,created_at,flight_id) AS own_row
            FROM flights WHERE level=? AND score_version=?), ranked AS (
            SELECT flight_id,player_id,level,total_score,mission_bonus,mission_grade,status,flight_date,
            ROW_NUMBER() OVER(ORDER BY total_score DESC,mission_bonus DESC,created_at,flight_id) AS rank FROM best WHERE own_row=1) '''
        args = (level, RULES['scoreVersion'])
        with self.connect() as c:
            rows = c.execute(base + 'SELECT * FROM ranked ORDER BY rank LIMIT ? OFFSET ?', (*args, limit, offset)).fetchall()
            total = c.execute(base + 'SELECT COUNT(*) FROM ranked', args).fetchone()[0]
            best = c.execute(base + 'SELECT * FROM ranked WHERE player_id=?', (*args, own)).fetchone() if own else None
        return {'rows': [self.summary(r) for r in rows], 'total': total, 'ownBest': self.summary(best) if best else None, 'limit': limit, 'offset': offset, 'scoreVersion': RULES['scoreVersion']}


class RateLimiter:
    def __init__(self):
        self.clients = defaultdict(deque)
        self.lock = threading.Lock()

    def accept(self, client, write):
        with self.lock:
            now = time.monotonic()
            key = (client, write)
            if len(self.clients) > 10000:
                self.clients = defaultdict(deque, {k: q for k, q in self.clients.items() if q and q[-1] > now - 60})
                if len(self.clients) > 10000:
                    return False
            q = self.clients[key]
            while q and q[0] < now - 60:
                q.popleft()
            if len(q) >= (180 if write else 1800):
                return False
            q.append(now)
            return True


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.bin': 'application/octet-stream'}

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        origin = self.headers.get('Origin')
        if origin in self.server.allowed_origins:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        super().end_headers()

    def json_response(self, value, status=200):
        data = encode(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        if status == 429:
            self.send_header('Retry-After', '60')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        origin = self.headers.get('Origin')
        if origin not in self.server.allowed_origins:
            return self.json_response({'error': 'Origin is not allowed.'}, 403)
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '600')
        self.end_headers()

    def list_directory(self, path):
        self.send_error(403, 'Directory listing is disabled.')

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith('/api/'):
            return self.api()
        target = Path(self.translate_path(path)).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            return self.send_error(403)
        if target == self.server.store.path or any(p.startswith('.') for p in target.relative_to(ROOT).parts) or target.suffix in ('.db', '.sqlite', '.sqlite3') or target.name.endswith(('-wal', '-shm')):
            return self.send_error(404)
        super().do_GET()

    def do_HEAD(self):
        try:
            path = Path(self.translate_path(urlsplit(self.path).path)).resolve()
            if path == self.server.store.path or path.suffix in ('.db', '.sqlite', '.sqlite3') or path.name.endswith(('-wal', '-shm')) or any(p.startswith('.') for p in path.relative_to(ROOT).parts):
                return self.send_error(404)
            super().do_HEAD()
        except ValueError:
            self.send_error(403)

    def do_POST(self):
        if not urlsplit(self.path).path.startswith('/api/'):
            return self.json_response({'error': 'Unknown endpoint.'}, 404)
        self.api(write=True)

    def body(self):
        if self.headers.get('Transfer-Encoding') or 'application/json' not in self.headers.get('Content-Type', ''):
            raise APIError('Use an application/json request with Content-Length.', 415)
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise APIError('Invalid Content-Length.') from None
        if not 0 < size <= MAX_BODY:
            raise APIError('Request body must be 1-262144 bytes.', 413)
        def constant(value):
            raise ValueError('Non-finite JSON number')
        def pairs(items):
            result = {}
            for key, value in items:
                if key in result:
                    raise ValueError('Duplicate JSON field')
                result[key] = value
            return result
        try:
            raw = self.rfile.read(size)
            if len(raw) != size:
                raise ValueError()
            value = json.loads(raw, parse_constant=constant, object_pairs_hook=pairs)
            if not isinstance(value, dict):
                raise ValueError()
            return value
        except (ValueError, UnicodeDecodeError, RecursionError):
            raise APIError('Invalid JSON object.') from None

    def api(self, write=False):
        try:
            if not self.server.limiter.accept(self.client_address[0], write):
                raise APIError('Too many requests. Try again shortly.', 429)
            origin = self.headers.get('Origin')
            own = urlsplit(origin or '')
            same = own.scheme in ('http', 'https') and own.netloc == self.headers.get('Host')
            if write and origin and origin not in self.server.allowed_origins and not same:
                raise APIError('Origin is not allowed.', 403)
            parsed = urlsplit(self.path)
            path = unquote(parsed.path)
            query = parse_qs(parsed.query)
            def page(name, default, maximum):
                try:
                    v = int(query.get(name, [str(default)])[0])
                except ValueError:
                    raise APIError('Invalid pagination.') from None
                if v < (1 if name == 'limit' else 0) or v > maximum:
                    raise APIError('Invalid pagination.')
                return v
            store = self.server.store
            if not write and path == '/api/health':
                return self.json_response({'status': 'ok', 'gameVersion': RULES['gameVersion'], 'scoreVersion': RULES['scoreVersion']})
            if write:
                data = self.body()
                if path == '/api/players':
                    return self.json_response(store.player(data.get('playerId')))
                if path == '/api/flights':
                    result = store.add(data)
                    return self.json_response(result, 200 if result['duplicate'] else 201)
            elif path == '/api/leaderboard':
                return self.json_response(store.leaderboard(query.get('level', ['moon'])[0], query.get('playerId', [None])[0], page('limit', 50, 50), page('offset', 0, 1000000)))
            elif re.fullmatch(r'/api/players/[^/]+/flights', path):
                return self.json_response(store.history(path.split('/')[3], page('limit', 50, 50), page('offset', 0, 1000000)))
            elif re.fullmatch(r'/api/flights/[a-f0-9-]{36}', path):
                return self.json_response(store.flight(path.split('/')[3]))
            raise APIError('Unknown endpoint.', 404)
        except APIError as error:
            self.json_response({'error': str(error)}, error.status)
        except (TypeError, KeyError, AttributeError, OverflowError):
            self.json_response({'error': 'Malformed flight record.'}, 400)
        except sqlite3.Error:
            self.json_response({'error': 'Record service is temporarily unavailable. Your flight can be retried.'}, 503)


def make_server(host, port, db_path, allowed_origins=()):
    if RULES is None:
        raise RuntimeError('Missing data/mission-score-rules.json; run node tools/export_score_rules.mjs.')
    store = FlightStore(db_path)
    server = ThreadingHTTPServer((host, port), partial(Handler, directory=str(ROOT)))
    server.store = store
    server.allowed_origins = set(allowed_origins)
    server.limiter = RateLimiter()
    return server
