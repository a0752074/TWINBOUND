"""Create a consistent SQLite backup while the mission server is running."""
import argparse
from pathlib import Path
import sqlite3
parser = argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('destination')
args = parser.parse_args()
source, destination = Path(args.source).expanduser().resolve(), Path(args.destination).expanduser().resolve()
if source == destination or not source.is_file() or destination.exists():
    raise SystemExit('Use an existing source and a new, distinct backup path.')
destination.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src, sqlite3.connect(destination) as dst:
    src.backup(dst)
print('Backup created:', destination)
