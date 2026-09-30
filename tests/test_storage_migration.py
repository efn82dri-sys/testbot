import importlib.util, json, sqlite3
from pathlib import Path
SCRIPT=Path(__file__).resolve().parents[1]/'scripts/migrate_materials_json_to_sqlite.py'
spec=importlib.util.spec_from_file_location('migration',SCRIPT); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
def test_json_to_sqlite_migration_preserves_counts_and_backup(tmp_path):
 src=tmp_path/'materials.json'; db=tmp_path/'materials.sqlite3'
 sample={'v':2,'companies':[{'id':'x','products':[{'id':'p1'},{'id':'p2'}]}],'packs':[]}
 src.write_text(json.dumps(sample),encoding='utf-8')
 got=mod.migrate(src,db)
 assert len(got['companies'])==1 and len(got['companies'][0]['products'])==2
 assert list(tmp_path.glob('materials.json.pre-migration-*.bak'))
 with sqlite3.connect(db) as conn: assert conn.execute('select count(*) from materials_snapshot').fetchone()[0]==1
def test_migration_rejects_invalid_json_shape(tmp_path):
 src=tmp_path/'bad.json'; src.write_text('{"oops":[]}',encoding='utf-8')
 try: mod.migrate(src,tmp_path/'db.sqlite3')
 except ValueError: pass
 else: raise AssertionError('invalid catalog should fail')
