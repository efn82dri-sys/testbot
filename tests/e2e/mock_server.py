from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import json, re
ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'materials-app'
SEED = json.loads((APP/'data/materials.json').read_text(encoding='utf-8'))
MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json; charset=utf-8'}
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def send(self, status, body, content_type='application/json; charset=utf-8'):
        if isinstance(body,str): body=body.encode()
        self.send_response(status); self.send_header('Content-Type',content_type); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path=self.path.split('?',1)[0]
        if path=='/materials': return self.send(200,(APP/'index.html').read_bytes(),'text/html; charset=utf-8')
        if path.startswith('/materials/api/'):
            endpoint=path.rsplit('/',1)[-1]
            if endpoint=='data': return self.send(200,json.dumps({'ok':True,'data':SEED,'admin':True,'bot':'ravaq_test_bot','start':'materials','mediaBase':''},ensure_ascii=False))
            if endpoint=='projects': return self.send(200,'{"ok":true,"projects":[]}')
            if endpoint=='preferences': return self.send(200,'{"ok":true,"preferences":{"mode":"simple"}}')
            if endpoint=='community': return self.send(200,'{"ok":true,"items":[]}')
            if endpoint=='community-admin': return self.send(200,'{"ok":true,"items":[]}')
            if endpoint=='market-dashboard': return self.send(200,'{"ok":true,"events":0,"quotes":0,"popularProducts":[],"searchGaps":[],"eventTypes":[]}')
            if endpoint=='sponsor-dashboard': return self.send(200,'{"ok":true,"events":0,"quotes":0,"byCompany":[],"byEvent":[],"byProduct":[]}')
            if endpoint=='license-export': return self.send(200,'{"schemaVersion":1,"products":{},"companies":{}}')
            return self.send(200,'{"ok":true}')
        rel=path.removeprefix('/materials/').lstrip('/')
        target=APP/rel
        if not target.is_file():
            m=re.fullmatch(r'(base|mat|script|calc-core)\.([0-9a-f]{12})\.(css|js)',Path(rel).name)
            if m: target=APP/f'{m.group(1)}.{m.group(3)}'
        if not target.is_file() or APP.resolve() not in target.resolve().parents: return self.send(404,'not found','text/plain')
        self.send(200,target.read_bytes(),MIME.get(target.suffix,'application/octet-stream'))
    def do_POST(self):
        path=self.path.split('?',1)[0]
        n=int(self.headers.get('Content-Length','0'))
        body=self.rfile.read(n) if n else b'{}'
        try: payload=json.loads(body or b'{}')
        except Exception: payload={}
        if path.endswith('/review'):
            action=payload.get('action')
            if action=='verify-product':
                from sys import path as sys_path
                sys_path.insert(0,str(ROOT))
                from materials_catalog_rules import verification_is_valid
                if not verification_is_valid(payload): return self.send(400,'{"ok":false,"error":"verification fields required"}')
            return self.send(200,json.dumps({'ok':True,'data':SEED},ensure_ascii=False))
        if path.endswith('/preferences'): return self.send(200,'{"ok":true,"preferences":{"mode":"pro"}}')
        if path.endswith('/save'): return self.send(200,'{"ok":true}')
        if path.endswith('/projects'): return self.send(200,'{"ok":true,"projects":[]}')
        return self.send(200,'{"ok":true}')
if __name__=='__main__':
    ThreadingHTTPServer(('127.0.0.1',4173),Handler).serve_forever()
