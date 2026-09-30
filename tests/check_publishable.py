#!/usr/bin/env python3
"""Report publishability without changing catalog data."""
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from materials_catalog_rules import product_is_publishable
data=json.loads((ROOT/"materials-app/data/materials.json").read_text(encoding="utf-8"))
allp=[]
for co in data.get("companies",[]):
 for p in co.get("products",[]):
  imgs=p.get("images") or []
  real_image=bool(p.get("cdnImageUrl") or p.get("sourceImageUrl") or any(isinstance(x,dict) and (x.get("key") or x.get("fid")) for x in imgs))
  lic=p.get("mediaLicense") or {}
  v=p.get("verification") or {}
  verified=p.get("confidence")=="verified" and all(v.get(k) for k in ("datasheetUrl","page","reviewedAt","reviewer"))
  approved=lic.get("status")=="approved" and all(lic.get(k) for k in ("source","rightsHolder","approvedAt"))
  ready=real_image and approved and verified and product_is_publishable(p)
  allp.append((co.get("id"),p.get("id"),ready,real_image,approved,verified))
ready=[x for x in allp if x[2]]
published=[x for x in allp if next((p.get("publicationStatus")=="published" for c in data.get("companies",[]) if c.get("id")==x[0] for p in c.get("products",[]) if p.get("id")==x[1]),False)]
print(f"Products total: {len(allp)}")
print(f"Publishable (real image + approved license + verified): {len(ready)}")
print(f"Source JSON publicationStatus=published flags (before runtime sanitation): {len(published)}")
print(f"Published meeting all criteria: {sum(1 for x in published if x[2])}")
print("10/10 DATA GATE:", "PASS" if len(published)>0 and all(x[2] for x in published) else "NOT READY")
if ready: print("Ready IDs:", ", ".join(x[1] for x in ready))
