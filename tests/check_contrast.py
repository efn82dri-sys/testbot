#!/usr/bin/env python3
"""Check text tokens against page background using WCAG relative luminance; reports below 4.5:1."""
from pathlib import Path
import re,sys
CSS=(Path(__file__).resolve().parents[1]/'materials-app/base.css').read_text(encoding='utf-8')
def block(pattern):
 m=re.search(pattern,CSS,re.S); return m.group(0) if m else ''
def vars_for(text): return dict(re.findall(r'--([\w-]+):\s*(#[0-9A-Fa-f]{6})',text))
def lum(h):
 rgb=[int(h[i:i+2],16)/255 for i in (1,3,5)]; rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]; return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]
def ratio(a,b):
 x,y=sorted((lum(a),lum(b)),reverse=True);return (x+.05)/(y+.05)
root=vars_for(block(r':root\s*\{[^{}]*\}'))
light=vars_for(block(r':root\[data-theme="light"\]\s*\{[^{}]*\}'))
for mode,vals in [('dark',root),('light',light)]:
 bg=vals.get('bg',root.get('bg')); print(mode, 'background',bg)
 for token in ('ink','ink-dim','ink-faint'):
  fg=vals.get(token,root.get(token))
  r=ratio(fg,bg); print(f'  --{token}: {fg} contrast={r:.2f}:1')
  if r<4.5: print('  FAIL contrast below 4.5:1');sys.exit(1)
print('PASS: checked text tokens meet 4.5:1 against the base background; component-level combinations need visual audit.')
