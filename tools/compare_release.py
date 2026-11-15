"""Record real file differences against an extracted v10.2 baseline."""
from pathlib import Path
import argparse
import difflib
import hashlib
import json

parser = argparse.ArgumentParser()
parser.add_argument('baseline', help='Directory containing the original v10.2 index.html')
args = parser.parse_args()
baseline = Path(args.baseline).resolve()
root = Path(__file__).resolve().parents[1]
if not (baseline / 'index.html').is_file():
    raise SystemExit('Not an extracted project directory.')
excluded = {'__pycache__', 'node_modules', '.git', '.openai', 'dist'}
skip = {'data/validation/changes-v103.json'}
def files(folder):
    return {str(p.relative_to(folder)).replace('\\', '/'): p for p in folder.rglob('*') if p.is_file() and not excluded.intersection(p.relative_to(folder).parts) and p.suffix not in {'.pyc', '.zip'} and str(p.relative_to(folder)).replace('\\', '/') not in skip}
old, new = files(baseline), files(root)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rows = []
patch = []
for name in sorted(set(old) | set(new)):
    a, b = old.get(name), new.get(name)
    ah, bh = sha(a) if a else None, sha(b) if b else None
    status = 'unchanged' if ah == bh else 'added' if not a else 'removed' if not b else 'modified'
    rows.append({'file': name, 'status': status, 'v102_sha256': ah, 'v103_sha256': bh})
    if status != 'unchanged' and (Path(name).suffix in {'.js', '.mjs', '.py', '.html', '.css', '.yml'} or name in {'package.json', '.gitignore', '.dockerignore'}):
        patch.extend(difflib.unified_diff(a.read_text(encoding='utf-8').splitlines(True) if a else [], b.read_text(encoding='utf-8').splitlines(True) if b else [], fromfile='a/' + name if a else '/dev/null', tofile='b/' + name if b else '/dev/null'))
patch_path = root / 'docs/DIFF_v10.2.0_to_v10.3.0.patch'
patch_path.write_text(''.join(patch), encoding='utf-8')
# Recompute the diff-file hash after writing it. The manifest excludes itself.
rows = [r for r in rows if r['file'] != str(patch_path.relative_to(root))]
rows.append({'file': str(patch_path.relative_to(root)), 'status': 'added', 'v102_sha256': None, 'v103_sha256': sha(patch_path)})
report = {'baseline': 'TWINBOUND v10.2.0 supplied project', 'release': 'TWINBOUND v10.3.0 Final Mission Edition', 'selfExcluded': 'data/validation/changes-v103.json', 'counts': {s: sum(r['status'] == s for r in rows) for s in ['unchanged', 'modified', 'added', 'removed']}, 'files': sorted(rows, key=lambda r: r['file'])}
(root / 'data/validation/changes-v103.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report['counts']))
