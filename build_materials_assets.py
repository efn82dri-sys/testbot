#!/usr/bin/env python3
"""Stdlib-only content-hash build for root assets and lazily loaded ES modules."""
from pathlib import Path
import hashlib,re,json
ROOT=Path(__file__).resolve().parent/'materials-app'; index=(ROOT/'index.html').read_text(encoding='utf-8'); manifest={}
# Clean previous generated assets.
for old in ROOT.iterdir():
 if old.is_file() and re.fullmatch(r'(?:base|mat|script|calc-core)\.[0-9a-f]{12}\.(?:css|js)',old.name): old.unlink()
moddir=ROOT/'modules'; module_files={}
if moddir.exists():
 for old in moddir.iterdir():
  if old.is_file() and re.fullmatch(r'[A-Za-z0-9_-]+\.[0-9a-f]{12}\.js',old.name): old.unlink()
 for source in sorted(moddir.glob('*.js')):
  digest=hashlib.sha256(source.read_bytes()).hexdigest()[:12]; target=moddir/f'{source.stem}.{digest}.js'; target.write_bytes(source.read_bytes()); module_files[source.stem]=target.name; manifest[f'modules/{source.stem}']={'file':f'modules/{target.name}','sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
script=ROOT/'script.js'; js=script.read_text(encoding='utf-8')
for stem,filename in module_files.items():
 js=js.replace(f'{stem}.__HASH__.js',filename)
 js=re.sub(rf'/materials/modules/{re.escape(stem)}(?:\.[0-9a-f]{{12}})?\.js',f'/materials/modules/{filename}',js)
script.write_text(js,encoding='utf-8')
for stem,ext in [('base','css'),('mat','css'),('calc-core','js'),('script','js')]:
 source=ROOT/f'{stem}.{ext}'; digest=hashlib.sha256(source.read_bytes()).hexdigest()[:12]; target=ROOT/f'{stem}.{digest}.{ext}'; target.write_bytes(source.read_bytes()); manifest[stem]={'file':target.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
 pattern=rf'/materials/{stem}(?:\.[0-9a-f]{{12}})?\.{ext}(?:\?[^"\']*)?'
 index=re.sub(pattern,f'/materials/{target.name}',index)
(ROOT/'index.html').write_text(index,encoding='utf-8'); (ROOT/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Hashed assets and manifest:')
for name,item in manifest.items(): print(f"{name}: {item['file']} ({item['sha256'][:12]})")
