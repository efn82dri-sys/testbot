"""Measure first-party JS gzip size for all JS referenced by index.html and report lazy modules separately."""
from pathlib import Path
import gzip,hashlib,re,sys
ROOT=Path(__file__).resolve().parents[1]; APP=ROOT/"materials-app"
html=(APP/"index.html").read_text(encoding="utf-8")
refs=re.findall(r"(?:src|href)=\"/materials/([^\"]+\.(?:js|css))\"",html)
js=[]
for ref in refs:
 if ref.endswith('.js'):
  p=APP/ref
  if not p.exists(): print('BROKEN JS REFERENCE:',ref);sys.exit(1)
  b=p.read_bytes();js.append((ref,len(b),len(gzip.compress(b,compresslevel=9))))
print('Initial first-party JS referenced by index.html (gzip level 9):')
for n,r,g in js:print(f'{n}: raw={r}; gzip={g}')
print(f'Total initial raw={sum(x[1] for x in js)}; gzip={sum(x[2] for x in js)}')
mods=sorted(p for p in (APP/'modules').glob('*.js') if not re.fullmatch(r'[A-Za-z0-9_-]+\.[0-9a-f]{12}\.js',p.name)) if (APP/'modules').exists() else []
print('Lazy feature modules (not loaded by index.html):')
for p in mods: print(f'{p.relative_to(APP)}: raw={p.stat().st_size}; gzip={len(gzip.compress(p.read_bytes(),compresslevel=9))}')
print('Architecture note: script.js remains the compatibility entry; feature module files are scaffolding, not yet full extraction.')
print('LCP: not measured here; run Playwright E2E with Slow-4G.')
