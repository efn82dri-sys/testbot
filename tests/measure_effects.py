#!/usr/bin/env python3
"""List effect declarations by selector and assert <=3 active effect-bearing elements per primary view."""
from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
FILES=[ROOT/"materials-app/base.css",ROOT/"materials-app/mat.css"]
# This is a focused CSS declaration scanner (not a full standards-compliant CSS parser).
blocks=[]
for path in FILES:
 text=path.read_text(encoding="utf-8")
 text=re.sub(r"/\*.*?\*/","",text,flags=re.S)
 for m in re.finditer(r"([^{}]+)\{([^{}]*)\}",text):
  selectors=m.group(1).strip(); body=m.group(2)
  effects=re.findall(r"(?i)(-webkit-backdrop-filter|backdrop-filter|filter)\s*:\s*([^;]+)",body)
  effects=[(k,v.strip()) for k,v in effects if ("blur(" in v.lower() or "backdrop-filter" in k.lower()) and "none" not in v.lower()]
  if effects: blocks.append((path.name,selectors,effects))
print("Effect-bearing selectors (non-none declarations):")
if not blocks: print("  none — all backdrop-filter and blur effects disabled/removed")
for file,sel,eff in blocks: print(f"  {file}: {sel} => {eff}")
# The current stylesheet has no active blur declarations. Budget is per view and counts active selectors.
views={"catalog": [".app-bar",".bottom-nav",".sd-panel"],"tools":[".app-bar",".bottom-nav",".sd-panel"],"projects":[".app-bar",".bottom-nav",".sd-panel"],"community":[".app-bar",".bottom-nav",".sd-panel"],"profile":[".app-bar",".bottom-nav",".sd-panel"]}
for view,selectors in views.items():
 count=sum(1 for _,sel,_ in blocks if any(x in sel for x in selectors))
 print(f"{view}: {count}/3")
 if count>3: sys.exit(1)
print("PASS: effect budget is within 3 per primary view")
