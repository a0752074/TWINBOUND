"""Package this entire project; no generated caches or dependencies."""
from pathlib import Path
import hashlib
import zipfile

root=Path(__file__).resolve().parents[1]
target=root.parent/'TWINBOUND_v10.3.1_GitHub_Pages_Local_Leaderboard.zip'
excluded={'__pycache__','node_modules','.git','.openai','research-sources','dist','.env'}
files=[p for p in root.rglob('*') if p.is_file() and not excluded.intersection(p.relative_to(root).parts) and p.suffix not in {'.pyc','.zip','.db','.sqlite','.sqlite3'} and not p.name.endswith(('-wal','-shm'))]
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for path in sorted(files):
        archive.write(path,Path(root.name)/path.relative_to(root))
with zipfile.ZipFile(target) as archive:
    bad=archive.testzip()
    if bad:
        raise SystemExit('Archive integrity failed: '+bad)
print(f'{target}\n{len(files)} files, {target.stat().st_size:,} bytes\nSHA256 {hashlib.sha256(target.read_bytes()).hexdigest()}')
