"""Build the complete standalone GitHub Pages game (Python standard library)."""
from pathlib import Path
import argparse
import shutil

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(ROOT / 'dist'))
args = parser.parse_args()
target = Path(args.output).resolve()
if target == ROOT or target in ROOT.parents or (ROOT in target.parents and target != ROOT / 'dist'):
    raise SystemExit('Use the project dist directory or an external output directory.')
target.mkdir(parents=True, exist_ok=True)
for name in ('index.html', 'LICENSE', 'assets', 'src', 'data', 'docs'):
    source = ROOT / name
    if source.is_dir():
        if (target / name).exists():
            shutil.rmtree(target / name)
        shutil.copytree(source, target / name)
    else:
        shutil.copy2(source, target / name)
# Remove the configuration left by older builds; nothing contacts a score API.
(target / 'runtime-config.js').unlink(missing_ok=True)
(target / '.nojekyll').touch()
print('Complete static game built at', target)
print('Player profiles and flight records are saved in each browser.')
