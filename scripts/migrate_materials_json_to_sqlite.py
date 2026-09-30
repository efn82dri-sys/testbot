#!/usr/bin/env python3
"""One-way JSON -> SQLite snapshot migration. Creates a timestamped backup before writing."""
from pathlib import Path
from datetime import datetime, timezone
import argparse, json, sqlite3, zipfile, shutil
def migrate(source:Path,target:Path):
 data=json.loads(source.read_text(encoding='utf-8'))
 if not isinstance(data,dict) or not isinstance(data.get('companies'),list): raise ValueError('Invalid catalog JSON')
 target.parent.mkdir(parents=True,exist_ok=True)
 stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 backup=source.with_suffix(source.suffix+'.pre-migration-'+stamp+'.bak')
 shutil.copy2(source,backup)
 if target.exists(): shutil.copy2(target,target.with_suffix(target.suffix+'.pre-migration-'+stamp+'.bak'))
 before_companies=len(data.get('companies',[])); before_products=sum(len(c.get('products',[])) for c in data.get('companies',[]) if isinstance(c,dict)); payload=json.dumps(data,ensure_ascii=False,separators=(',',':'))
 with sqlite3.connect(target) as conn:
  conn.execute('PRAGMA journal_mode=WAL')
  conn.execute('CREATE TABLE IF NOT EXISTS materials_snapshot (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)')
  conn.execute('INSERT INTO materials_snapshot(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',(payload,datetime.now(timezone.utc).isoformat()))
  row=conn.execute('SELECT payload FROM materials_snapshot WHERE id=1').fetchone(); check=json.loads(row[0])
  after_companies=len(check.get('companies',[])); after_products=sum(len(c.get('products',[])) for c in check.get('companies',[]) if isinstance(c,dict))
  if (before_companies,before_products)!=(after_companies,after_products): raise RuntimeError('Row count validation failed')
 print(f'Backup: {backup}')
 print(f'Companies: {before_companies}; products: {before_products}; round-trip validated')
 return check
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('target',type=Path);a=p.parse_args();migrate(a.source,a.target)
