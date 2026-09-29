import json, http.server, threading, base64, io, sys
from playwright.sync_api import sync_playwright
DATA=json.load(open('materials.json',encoding='utf-8'))
# داده‌ی آزمایشی: قیمت/امتیاز فقط برای تست منطق (در فایل‌های تحویلی نیست)
import copy
T=copy.deepcopy(DATA)
for c in T['companies']:
    for p in c['products']:
        if p['id']=='m6': p.update(price=1000000,speed=4,durability=3,confidence='datasheet',source='تست',availability='داخلی')
        if p['id']=='m7': p.update(price=600000,speed=3,durability=2,confidence='field',source='تست',availability='وارداتی',specs=[{'k':'وزن','v':'2 kg'}])
        if p['id']=='m8': p.update(price=1800000,speed=5,durability=5,confidence='datasheet',source='تست',availability='داخلی',specs=[{'k':'وزن','v':'3 kg'}])
        if p['id']=='leca3': p['specs']=[{'k':'چگالی','v':'450 kg/m³'}]; p['source']='تست'; p['confidence']='datasheet'
posts=[]
def run():
  with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844}); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and 'font' not in m.text.lower() and errs.append(m.text))
    def route(r):
        u=r.request.url
        if '/materials/api/data' in u: return r.fulfill(json=dict(data=T,admin=False,bot='testbot',start='materials'))
        if '/materials/api/sheet' in u: posts.append(json.loads(r.request.post_data)); return r.fulfill(json=dict(ok=True))
        if '/materials/base.css' in u: return r.fulfill(path='base.css',content_type='text/css')
        if '/materials/mat.css' in u: return r.fulfill(path='mat.css',content_type='text/css')
        if '/materials/script.js' in u: return r.fulfill(path='script.js',content_type='text/javascript')
        if '/materials' in u and u.rstrip('/').endswith('/materials'): return r.fulfill(path='index.html',content_type='text/html')
        if 'telegram.org' in u: return r.fulfill(body='window.Telegram={WebApp:{initData:"x=1",ready(){},expand(){},close(){window.__closed=1},HapticFeedback:{impactOccurred(){}},openTelegramLink(){}}}',content_type='text/javascript')
        return r.abort()
    pg.route('**/*',route)
    pg.goto('http://t.local/materials'); pg.wait_for_selector('.tile')
    out={}
    # ---- تب‌ها
    out['tiles']=pg.locator('.tile').count()
    pg.click('[data-tab=room]'); pg.click('[data-x=radd]')
    for k,v in dict(L='4',W='5',H='2.8',dn='1',dw='0.9',dh='2.1',wn='1',ww='1.2',wh='1.2').items(): pg.fill(f'[data-i=room][data-k={k}]',v)
    out['geo']=[pg.inner_text(f'.gm span:nth-child({i}) b') for i in range(1,6)]
    # افزودن مصالح: شیرآلات (تعدادی)، لیکا کف (حجمی)، پانل (متراژی)
    def add(name):
        pg.click('[data-x=iadd]'); pg.wait_for_selector('.pkr'); pg.fill('[data-i=ps]',name); pg.click('.pkr >> nth=0')
    add('شیرآلات اسمارت'); add('کف‌سازی'); add('پانل')
    pg.fill('[data-i=item][data-k=th]','8')       # ضخامت ۸cm
    pg.fill('[data-g=waste]','5')
    out['iq']=pg.locator('[data-iq]').all_inner_texts()
    pg.fill('[data-i=px][data-pid=m6]','1000000'); 
    out['scn']=pg.locator('.sc').all_inner_texts()
    pg.click('[data-x=rn][data-d="1"]'); out['n2']=pg.inner_text('.rm-h b')  # اتاق ×۲
    out['geo2']=pg.inner_text('.gm span:nth-child(1) b')
    pg.click('[data-x=rn][data-d="-1"]')
    # سناریو: m6 → alts m7/m8 قیمت دارند؟ قیمت seed ندارد -> از ‌T
    out['scn2']=pg.locator('.sc').all_inner_texts()
    pg.click('[data-x=scs]'); pg.wait_for_selector('[data-i=sk]'); pg.select_option('[data-i=sk][data-t=lux]', 'm8'); pg.click('[data-x=scok]')
    # PDF
    pg.click('[data-x=xsh]'); pg.click('[data-x=xgo][data-t=mid]'); pg.wait_for_selector('text=برگه ارسال شد',timeout=20000)
    out['posts']=len(posts); out['pages']=len(posts[0]['pages']) if posts else 0
    pg.click('[data-x=tgclose]'); out['closed']=pg.evaluate('window.__closed'); pg.click('[data-x=scok]'); pg.wait_for_timeout(400)
    # انتقال به برآورد
    pg.click('[data-x=toest]'); out['estcnt']=pg.inner_text('[data-tab=est] b')
    # ---- مقایسه
    pg.click('[data-tab=cat]'); pg.click('[data-brand=markiz]'); pg.wait_for_selector('.pr2')
    pg.locator('.pr2 [data-x=cmp][data-pid=m6]').click(); pg.locator('.pr2 [data-x=cmp][data-pid=m7]').click(); pg.locator('.pr2 [data-x=cmp][data-pid=m8]').click()
    pg.click('#sdScrim',position={'x':5,'y':5}); pg.click('[data-tab=cmp]')
    out['cmpscore']=pg.locator('.scr td').all_inner_texts()
    pg.fill('[data-i=w][data-k=price]','0'); pg.fill('[data-i=w][data-k=dur]','5') if False else None
    pg.evaluate("()=>{const i=document.querySelector('[data-i=w][data-k=dur]');i.value=5;i.dispatchEvent(new Event('input',{bubbles:true}))}")
    pg.click('[data-x=dir][data-k="وزن"]'); pg.click('[data-x=dir][data-k="وزن"]')   # hi -> lo
    out['winrows']=pg.locator('.cmp td.win').count()
    out['scoreobj']=pg.evaluate("()=>{const S=RQ.S;const ps=['m6','m7','m8'].map(id=>{for(const c of window.__D||[]){}return id});return 1}")
    # ---- ماشین‌حساب
    pg.click('[data-tab=calc]')
    def F(k,v): pg.fill(f'[data-i=calc][data-k={k}]',v)
    F('A','20');F('T','8');F('dl','500');F('dt','1800');F('w','5')
    out['floor']=pg.locator('#cOut .co').all_inner_texts()
    pg.click('[data-x=cadd][data-o="0"]'); pg.wait_for_selector('.pkr'); pg.click('.pkr >> nth=0'); out['calcadd']=pg.inner_text('#toast')
    pg.click('[data-x=cc][data-k=block]')
    F('A','30');F('o','3');F('bl','40');F('bh','20');F('bt','10');F('w','5')
    out['block']=pg.locator('#cOut .co').all_inner_texts()
    pg.click('[data-x=cc][data-k=gyp]')
    F('A','50');F('t','10');F('ref','12');F('bag','30');F('Ap','40');F('pw','1.2');F('ph','2.4');F('po','4');F('w','5')
    out['gyp']=pg.locator('#cOut .co').all_inner_texts()
    # چگالی از شناسنامه
    pg.click('[data-x=cc][data-k=floor]'); out['dens']=pg.locator('[data-x=cfill]').count()
    pg.screenshot(path='shot_calc.png')
    # عکس صفحه‌ی PDF
    for i,p in enumerate(posts[0]['pages']): open(f'page{i}.jpg','wb').write(base64.b64decode(p.split(',')[1]))
    pg.click('[data-tab=room]'); pg.screenshot(path='shot_room.png',full_page=True)
    pg.click('[data-tab=cmp]'); pg.screenshot(path='shot_cmp.png',full_page=True)
    print(json.dumps(out,ensure_ascii=False,indent=1)); print('ERRORS',errs)
    b.close()
run()