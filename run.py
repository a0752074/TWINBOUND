"""Serve the complete local game. Python 3.10+, standard library only."""
from __future__ import annotations
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent

class GameHandler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404, 'File not found')
        return None


def main():
    parser = argparse.ArgumentParser(description='TWINBOUND v10.3.1 — GitHub Pages & Local Leaderboard Edition')
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '8765')))
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--strictPort', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    handler = partial(GameHandler, directory=str(ROOT))
    server = None
    for port in range(args.port, args.port + (1 if args.strictPort else 20)):
        try:
            server = ThreadingHTTPServer((args.host, port), handler)
            break
        except OSError:
            continue
    if server is None:
        raise SystemExit('No available port. Try: python run.py --port 9000')
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'TWINBOUND v10.3.1\nLocal: {url}\nFlight records stay in this browser.\nKeep this window open. Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        threading.Timer(.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nGood flight!')
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
