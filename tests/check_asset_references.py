#!/usr/bin/env python3
"""Check that first-party HTML/CSS asset references resolve to existing allowed files."""
from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1];APP=ROOT/"materials-app"; html=(APP/"index.html").read_text(encoding="utf-8")
refs=re.findall(r"(?:src|href)=\"/materials/([^\"]+)\"",html)
errors=[]
for ref in refs:
 if ref.startswith(('http:','https:','data:')): continue
 name=ref.split('?',1)[0]
 if not (APP/name).is_file(): errors.append(name)

for js in APP.glob('*.js'):
 text=js.read_text(encoding='utf-8')
 for name in re.findall(r"import\(['\"](/materials/[^'\"]+\.js)['\"]\)",text):
  rel=name.removeprefix('/materials/')
  if not (APP/rel).is_file(): errors.append(rel)
print('References checked:',len(refs))
if errors: print('Missing references:',*errors,sep='\n - ');sys.exit(1)
print('PASS: no broken first-party HTML references')
