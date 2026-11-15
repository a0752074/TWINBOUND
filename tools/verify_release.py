"""Verify bundled sources, text localization, local links, and JavaScript syntax."""
from pathlib import Path
from html.parser import HTMLParser
import gzip
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = 0

def check(condition, message):
    global checks
    checks += 1
    if not condition:
        errors.append(message)

manifest = json.loads((ROOT/'data/horizons_v10/manifest.json').read_text())
for body in manifest['bodies']:
    for key, hashkey in [('file','binary_sha256'),('raw_file','raw_sha256')]:
        p = ROOT/'data/horizons_v10'/body[key]
        payload = gzip.decompress(p.read_bytes()) if key == 'raw_file' else p.read_bytes()
        check(hashlib.sha256(payload).hexdigest() == body[hashkey], f'Hash mismatch: {p.name}')
    check((ROOT/'data/horizons_v10'/body['file']).stat().st_size == body['samples']*6*8, f'Wrong sample count: {body["name"]}')
    with gzip.open(ROOT/'data/horizons_v10'/body['raw_file'], 'rt') as stream:
        raw = json.load(stream)
    check(raw.get('signature',{}).get('source') == 'NASA/JPL Horizons API', f'Unexpected API signature: {body["name"]}')

photos = json.loads((ROOT/'data/photos.json').read_text())
if isinstance(photos,dict):
    photos = photos.get('photos',[])
for photo in photos:
    check(hashlib.sha256((ROOT/photo['local_url']).read_bytes()).hexdigest() == photo['sha256'], f'Photo hash mismatch: {photo["id"]}')

text_suffixes = {'.js','.mjs','.json','.md','.py','.html','.css','.bat','.command','.tap','.txt','.log'}
for path in sorted(ROOT.rglob('*')):
    if not path.is_file() or path.suffix not in text_suffixes or '__pycache__' in path.parts:
        continue
    text = path.read_text(encoding='utf-8')
    check(re.search(r'[\u3400-\u9fff]',text) is None, f'Untranslated text: {path.relative_to(ROOT)}')
    if path.suffix == '.mjs' and not shutil.which('node'):
        errors.append('Node.js is required for analysis syntax checks.')
    if path.suffix in {'.js','.mjs'}:
        node = shutil.which('node')
        if not node:
            errors.append('Node.js is required for source syntax checks, not for playing the game.')
            break
        result = subprocess.run([node,'--check',str(path)], capture_output=True, text=True)
        check(result.returncode == 0, f'JavaScript syntax: {path.relative_to(ROOT)}\n{result.stderr}')
        for target in re.findall(r'\bfrom\s+[\'\"](\.[^\'\"]+)[\'\"]',text):
            check((path.parent/target).is_file(), f'Missing module: {path.name} -> {target}')

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for name,value in attrs:
            if name not in {'src','href'} or not value or value.startswith(('http:','https:','#','data:')):
                continue
            check((ROOT/value.split('?')[0]).exists(), f'Missing local HTML asset: {value}')

Links().feed((ROOT/'index.html').read_text())
check('<html lang="en">' in (ROOT/'index.html').read_text(), 'HTML language must be English')
resources = json.loads((ROOT/'data/nasa-resources.json').read_text())
for resource in resources['resources']:
    for filename in resource.get('files',[]):
        check((ROOT/filename).is_file(), f'Missing resource implementation: {filename}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {checks} release checks. Source hashes, English text, local links, and JavaScript syntax verified.')
