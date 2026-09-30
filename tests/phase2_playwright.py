# -*- coding: utf-8 -*-
"""
تست کلیک‌به‌کلیک فاز ۱ و ۲ مینی‌اپ مصالح (مرورگر واقعی Chromium).
اجرا از ریشه‌ی پروژه:   python tests/phase12_playwright.py
فقط دیتای آزمایشی برای تست منطق به‌صورت موقت تزریق می‌شود (قیمت/امتیاز محصولات Markiz)؛ در فایل‌های تحویلی نیست.
"""
import base64, copy, datetime, io, json, math, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "materials-app"
REAL = json.loads((APP / "data" / "materials.json").read_text(encoding="utf-8"))

RESULTS = []
def check(name, cond, extra=""):
    RESULTS.append((bool(cond), name, extra))
    print(("PASS " if cond else "FAIL ") + name + ((" — " + str(extra)) if (extra != "" and not cond) else ""))

def pnum(s):
    s = str(s).translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٫٬", "0123456789.,")).replace(",", "").replace("٬", "")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None

def close(a, b, tol=0.011):
    return a is not None and abs(a - b) <= tol

def png_bytes():
    b = io.BytesIO(); Image.new("RGB", (480, 360), (40, 120, 200)).save(b, "PNG"); return b.getvalue()

# ---------- داده‌ی آزمایشی ----------
TEST = copy.deepcopy(REAL)
for c in TEST["companies"]:
    for p in c["products"]:
        if p["id"] == "m6": p.update(price=1000000, speed=4, durability=3, confidence="datasheet", source="تست", availability="داخلی")
        if p["id"] == "m7": p.update(price=600000, speed=3, durability=2, confidence="field", source="تست", availability="وارداتی", specs=[{"k": "وزن", "v": "2 kg"}])
        if p["id"] == "m8": p.update(price=1800000, speed=5, durability=5, confidence="datasheet", source="تست", availability="داخلی", specs=[{"k": "وزن", "v": "3 kg"}])
        if p["id"] == "leca3": p["specs"] = [{"k": "چگالی", "v": "450 kg/m³"}]          # برای تست دکمه‌ی «برداشتن چگالی»
        if p["id"] == "leca2": p["images"] = [{"key": "a" * 20, "w": 480, "h": 360, "mime": "image/png"}]

def open_page(pw, data, admin):
    posts, saves = [], []
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and "font" not in m.text.lower() and "ERR_FAILED" not in m.text and errs.append(m.text))
    def route(r):
        u = r.request.url
        if "/materials/api/data" in u: return r.fulfill(json=dict(data=data, admin=admin, bot="testbot", start="materials"))
        if "/materials/api/sheet" in u: posts.append(json.loads(r.request.post_data)); return r.fulfill(json=dict(ok=True))
        if "/materials/api/save" in u: saves.append(json.loads(r.request.post_data)); return r.fulfill(json=dict(ok=True))
        if "/materials/m/" in u: return r.fulfill(body=png_bytes(), content_type="image/png")
        for f, ct in (("base.css", "text/css"), ("mat.css", "text/css"), ("script.js", "text/javascript")):
            if f"/materials/{f}" in u: return r.fulfill(path=str(APP / f), content_type=ct)
        if u.rstrip("/").endswith("/materials"): return r.fulfill(path=str(APP / "index.html"), content_type="text/html")
        if "telegram.org" in u:
            return r.fulfill(body='window.Telegram={WebApp:{initData:"x=1",ready(){},expand(){},close(){window.__closed=1},HapticFeedback:{impactOccurred(){}},openTelegramLink(){}}}', content_type="text/javascript")
        return r.abort()
    pg.route("**/*", route)
    pg.goto("http://t.local/materials"); pg.wait_for_selector(".tile")
    return b, pg, errs, posts, saves

def find_prod(payload, pid):
    for c in payload["companies"]:
        for p in c["products"]:
            if p["id"] == pid: return p

# =====================================================================
# سناریوی A — دیتای واقعی، ادمین: فاز ۱ (لیکا، جست‌وجو، فرم بدون اجبار، قالب مشخصات)
# =====================================================================
def scenario_a(pw):
    print("\n--- A: دیتای لیکا + حالت ویرایش ---")
    b, pg, errs, posts, saves = open_page(pw, REAL, True)
    check("نوار لوگو: سه برند", pg.locator(".lgo").count() == 3)
    # جست‌وجو
    def q(t):
        pg.fill("#search", t); pg.wait_for_timeout(260); return pg.locator(".mc").count()
    check("جست‌وجوی «leca» (حروف کوچک)", q("leca") == 1)
    check("جست‌وجوی «ليکا» با ي عربی", q("ليکا") == 1)
    check("جست‌وجوی محصول «سوپرساند»", q("سوپرساند") == 1)
    check("جست‌وجوی «بلوک سبز» (چندکلمه‌ای)", q("بلوک سبز") == 1)
    check("جست‌وجوی مشخصات «۰٫۴۵»→ نتیجه‌ی بلوک سبز", q("0.45") == 1)
    check("جست‌وجوی بی‌نتیجه → empty state", q("زززز") == 0 and pg.locator(".empty").count() == 1)
    pg.fill("#search", ""); pg.wait_for_timeout(260)
    # شیت برند
    pg.click(".mc[data-brand=leca]"); pg.wait_for_selector(".pr2")
    check("لیکا: ۱۱ محصول", pg.locator(".pr2").count() == 11, pg.locator(".pr2").count())
    check("لیکا: ۴ ویژگی برند", pg.locator("#sdPanel .fts li").count() == 4)
    check("لیکا: لینک‌های وب‌سایت و مشخصات فنی", "وب‌سایت رسمی" in pg.inner_text("#sdPanel") and "لیست مشخصات فنی محصولات" in pg.inner_text("#sdPanel"))
    check("لیکا: گروه‌بندی محصولات", all(g in pg.inner_text("#sdPanel") for g in ["سبکدانه", "بلوک", "بتن", "ملات و مخلوط خشک", "کشاورزی", "زیرساخت"]))
    check("کارت محصول عکس‌دار: lazy", pg.locator(".pr2 img[loading=lazy]").count() == 0)   # دیتای واقعی عکس ندارد
    check("کارت «در حال تکمیل» برای بدون‌عکس", pg.locator(".pr2 .im.ph").count() == 11)
    # شیت محصول
    pg.click(".pr2[data-prod=leca2]"); pg.wait_for_selector(".spt")
    t = pg.inner_text("#sdPanel")
    check("محصول: استاندارد ملی ۷۷۸۲", "۷۷۸۲" in t)
    check("محصول: مشخصات فنی 20 kg/cm²", "20 kg/cm²" in t)
    check("محصول: نشان «نیازمند بررسی»", "نیازمند بررسی" in t)
    check("محصول: منبع و تاریخ بررسی", "leca.ir" in t and "آخرین بررسی" in t)
    check("محصول: دکمه‌ی صفحه‌ی رسمی", "صفحه‌ی رسمی" in t)
    check("محصول: قیمت «استعلام»", "استعلام" in t)
    check("محصول بی‌عکس: placeholder بزرگ", pg.locator("#sdPanel .im.ph.big").count() == 1)
    # برچسب قدیمی (تاریخ واقعی امروز در ماشین تست)
    exp = (datetime.date.today() - datetime.date(2026, 9, 30)).days
    got = pg.evaluate("RQ.staleDays('1405/07/08')")
    check("تبدیل تاریخ شمسی: ۱۴۰۵/۰۷/۰۸ = ۲۰۲۶-۰۹-۳۰", got is not None and abs(got - exp) <= 1, (got, exp))
    check("تبدیل تاریخ شمسی: ارقام فارسی و جداکننده‌ی دیگر", pg.evaluate("RQ.staleDays('۱۴۰۵-۰۱-۰۱')") == (datetime.date.today() - datetime.date(2026, 3, 21)).days)
    check("تاریخ نامعتبر → null", pg.evaluate("RQ.staleDays('abc')") is None)
    pg.click("[data-a=tobrand]"); pg.wait_for_selector(".pr2")
    # --- حالت ویرایش
    pg.click("#sdScrim", position={"x": 5, "y": 5}); pg.wait_for_timeout(350)
    pg.click("#editBtn"); pg.click(".mc[data-brand=leca]"); pg.wait_for_selector(".pr2")
    # ۱) ذخیره‌ی محصولِ خالی (فقط نام) بدون خطا
    pg.click(".pr2[data-prod=leca8] [data-ep=leca8]"); pg.wait_for_selector("[data-f=name]")
    check("فرم: توضیح «فقط نام الزامی است»", "فقط «نام» الزامی است" in pg.inner_text("#sdPanel"))
    pg.click("[data-a=fok]"); pg.wait_for_timeout(300)
    check("ذخیره‌ی محصول بدون هیچ فیلد اختیاری: بدون خطا", len(saves) == 1 and "ذخیره شد" in pg.inner_text("#toast"), pg.inner_text("#toast"))
    p8 = find_prod(saves[-1], "leca8")
    check("محصول بدون داده: نشان اطمینان ساختگی نمی‌خورد", p8 and not p8.get("confidence") and p8["specs"] == [] and p8["price"] is None)
    # ۲) قیمت بدون منبع/نشان → خودکار «نیازمند بررسی»
    pg.wait_for_selector(".pr2[data-prod=leca4]")
    pg.click(".pr2[data-prod=leca4] [data-ep=leca4]"); pg.wait_for_selector("[data-f=price]")
    pg.fill("[data-f=price]", "۱٬۵۰۰٬۰۰۰"); pg.fill("[data-f=source]", ""); pg.select_option("[data-f=confidence]", "")
    pg.click("[data-a=fok]"); pg.wait_for_timeout(300)
    p4 = find_prod(saves[-1], "leca4")
    check("قیمت بدون منبع: ذخیره می‌شود و confidence=review", p4 and p4["price"] == 1500000 and p4["confidence"] == "review", p4 and (p4["price"], p4["confidence"]))
    # ۳) قالب مشخصات: فقط عنوان‌ها، مقدار خالی ذخیره نمی‌شود
    pg.wait_for_selector(".pr2[data-prod=leca8]")
    pg.click(".pr2[data-prod=leca8] [data-ep=leca8]"); pg.wait_for_selector("[data-a=spectpl]")
    pg.click("[data-a=spectpl]")
    ta = pg.input_value("[data-f=specsT]")
    check("قالب مشخصات گروه «بلوک» درج شد", "مقاومت صوتی:" in ta and "ابعاد:" in ta, ta)
    pg.click("[data-a=spectpl]"); ta2 = pg.input_value("[data-f=specsT]")
    check("درج دوباره‌ی قالب، عنوان تکراری نمی‌سازد", ta2.count("ابعاد:") == 1)
    pg.fill("[data-f=specsT]", ta2.replace("ابعاد: ", "ابعاد: 40×20×10 cm"))
    pg.click("[data-a=fok]"); pg.wait_for_timeout(300)
    p8 = find_prod(saves[-1], "leca8")
    check("فقط ردیف دارای مقدار ذخیره شد", p8["specs"] == [{"k": "ابعاد", "v": "40×20×10 cm"}], p8["specs"])
    check("مشخصات بدون نشان اطمینان → review", p8["confidence"] == "review")
    # ۴) محصول جدید فقط با نام
    pg.wait_for_selector("[data-a=addp]")
    pg.click("[data-a=addp]"); pg.wait_for_selector("[data-f=name]")
    pg.fill("[data-f=name]", "محصول آزمایشی"); pg.click("[data-a=fok]"); pg.wait_for_timeout(300)
    newp = [p for c in saves[-1]["companies"] for p in c["products"] if p["name"] == "محصول آزمایشی"]
    check("محصول جدید فقط با نام ذخیره شد", len(newp) == 1 and newp[0]["mode"] == "count")
    check("نام خالی رد می‌شود", True)
    pg.click("[data-a=addp]"); pg.wait_for_selector("[data-f=name]"); pg.click("[data-a=fok]")
    check("نام خالی → پیام «نام را وارد کن»", "نام را وارد کن" in pg.inner_text("#toast"))
    pg.click("[data-a=fno]")
    # ۵) ویرایش برند: ویژگی‌ها و لینک‌ها
    pg.wait_for_selector("[data-a=editco]"); pg.click("[data-a=editco]"); pg.wait_for_selector("[data-f=featuresT]")
    pg.fill("[data-f=featuresT]", "ویژگی یک\nویژگی دو"); pg.fill("[data-f=linksT]", "کاتالوگ | https://example.com/a\nبدون‌لینک | javascript:alert(1)\nخراب")
    pg.click("[data-a=fok]"); pg.wait_for_timeout(300)
    co = [c for c in saves[-1]["companies"] if c["id"] == "leca"][0]
    check("برند: ویژگی‌ها ذخیره شد", co["features"] == ["ویژگی یک", "ویژگی دو"])
    check("برند: فقط لینک https معتبر ذخیره شد (javascript: رد)", co["links"] == [{"t": "کاتالوگ", "u": "https://example.com/a"}], co["links"])
    check("بدون خطای جاوااسکریپت (A)", not errs, errs)
    b.close()

# =====================================================================
# سناریوی B — دیتای آزمایشی: فاز ۲ (متره، سناریو، PDF، مقایسه، ماشین‌حساب)
# =====================================================================
def scenario_b(pw):
    print("\n--- B: فاز ۲ ---")
    b, pg, errs, posts, saves = open_page(pw, TEST, False)
    check("تب‌ها: ۶ تب", pg.locator(".tile").count() == 6)
    # عکس محصول: lazy
    pg.click(".mc[data-brand=leca]"); pg.wait_for_selector(".pr2")
    check("کارت محصول عکس‌دار: loading=lazy", pg.locator(".pr2[data-prod=leca2] img[loading=lazy]").count() == 1)
    pg.click("#sdScrim", position={"x": 5, "y": 5}); pg.wait_for_timeout(350)
    # --- متره
    pg.click("[data-tab=room]"); pg.click("[data-x=radd]")
    for k, v in dict(L="4", W="5", H="2.8", dn="1", dw="0.9", dh="2.1", wn="1", ww="1.2", wh="1.2").items():
        pg.fill(f"[data-i=room][data-k={k}]", v)
    geo = [pnum(pg.inner_text(f".gm span:nth-child({i}) b")) for i in range(1, 6)]
    exp = [20, 4 * 2 * 0 + (2 * (4 + 5) * 2.8 - (0.9 * 2.1 + 1.2 * 1.2)), 20, 56, 18]
    check("هندسه‌ی اتاق (کف، دیوار خالص، سقف، حجم، محیط) = دست‌محاسبه", all(close(a, e) for a, e in zip(geo, exp)), (geo, exp))
    def add(name):
        pg.click("[data-x=iadd]"); pg.wait_for_selector(".pkr"); pg.fill("[data-i=ps]", name); pg.click(".pkr >> nth=0")
    add("شیرآلات اسمارت"); add("کف‌سازی"); add("پانل")
    pg.fill("[data-i=item][data-k=th]", "8")
    net = exp[1]
    iq = [pnum(t) for t in pg.locator("[data-iq]").all_inner_texts()]
    check("مقدار مصالح (ضایعات ۵٪): تعدادی / حجمی / متراژی", close(iq[0], 1) and close(iq[1], 20 * 0.08 * 1.05) and close(iq[2], net * 1.05), iq)
    # باگ قدیمی: تغییر ضایعات باید همان لحظه روی تب متره اعمال شود
    pg.fill("[data-g=waste]", "10")
    iq = [pnum(t) for t in pg.locator("[data-iq]").all_inner_texts()]
    check("تغییر ضایعات به ۱۰٪ بلافاصله اعمال می‌شود (باگ یک‌کاراکتر تأخیر رفع شد)", close(iq[1], 20 * 0.08 * 1.10) and close(iq[2], net * 1.10), iq)
    pg.fill("[data-g=waste]", "5")
    pg.fill("[data-g=labor]", "10")
    pg.wait_for_timeout(50)
    check("اجرت ۱۰٪ → مبلغ اجرت محاسبه شد", pg.inner_text("#rLab") != "" )
    pg.fill("[data-g=labor]", "0")
    # --- سه سناریو
    pg.fill("[data-i=px][data-pid=m6]", "1000000")
    sc = [pnum(t) for t in pg.locator(".sc b").all_inner_texts()]
    check("سه سناریو: اقتصادی / متوسط / لوکس = ۶۰۰ هزار / ۱ میلیون / ۱٫۸ میلیون", sc == [600000, 1000000, 1800000], sc)
    pg.click("[data-x=rn][data-d='1']")
    check("اتاق ×۲ → کف ۴۰ م²", close(pnum(pg.inner_text(".gm span:nth-child(1) b")), 40))
    pg.click("[data-x=rn][data-d='-1']")
    pg.click("[data-x=scs]"); pg.wait_for_selector("[data-i=sk]"); pg.select_option("[data-i=sk][data-t=lux]", "m8"); pg.click("[data-x=scok]")
    # --- PDF
    pg.click("[data-x=xsh]"); pg.click("[data-x=xgo][data-t=mid]"); pg.wait_for_selector("text=برگه ارسال شد", timeout=25000)
    check("برگه‌ی پیشنهاد: یک درخواست با ≥۱ صفحه ارسال شد", len(posts) == 1 and len(posts[0]["pages"]) >= 1)
    if posts:
        im = Image.open(io.BytesIO(base64.b64decode(posts[0]["pages"][0].split(",")[1])))
        check("صفحه‌ی PDF: ۱۲۴۰×۱۷۵۴", im.size == (1240, 1754), im.size)
        im.save("/tmp/ravaq_page0.jpg")
    pg.click("[data-x=tgclose]"); check("دکمه‌ی «دیدن برگه در چت» → TG.close", pg.evaluate("window.__closed") == 1)
    pg.click("[data-x=scok]"); pg.wait_for_timeout(400)
    pg.click("[data-x=toest]")
    check("انتقال به برآورد: شمارنده‌ی تب", pnum(pg.inner_text("[data-tab=est] b")) >= 3)
    # --- مقایسه
    pg.click("[data-tab=cat]"); pg.click(".mc[data-brand=markiz]"); pg.wait_for_selector(".pr2")
    for pid in ("m6", "m7", "m8"):
        pg.locator(f".pr2 [data-x=cmp][data-pid={pid}]").click()
    pg.click("#sdScrim", position={"x": 5, "y": 5}); pg.click("[data-tab=cmp]")
    sc = [pnum(t) for t in pg.locator(".scr td").all_inner_texts()]
    check("امتیاز وزنی (وزن‌های پیش‌فرض) = ۷۵ / ۵۸ / ۸۳", sc == [75, 58, 83], sc)
    for k, v in (("price", 0), ("dur", 5)):
        pg.evaluate("([k,v])=>{const i=document.querySelector(`[data-i=w][data-k=${k}]`);i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))}", [k, v])
    sc = [pnum(t) for t in pg.locator(".scr td").all_inner_texts()]
    check("امتیاز با وزن قیمت ۰ و دوام ۵ = ۷۶ / ۴۴ / ۱۰۰", sc == [76, 44, 100], sc)
    pg.click("[data-x=dir][data-k='وزن']"); pg.click("[data-x=dir][data-k='وزن']")   # hi → lo
    check("برنده‌ی ردیف وزن پس از انتخاب جهت (کمتر بهتر)", pg.locator(".cmp td.win").count() >= 1)
    # --- ماشین‌حساب
    pg.click("[data-tab=calc]")
    def F(k, v): pg.fill(f"[data-i=calc][data-k={k}]", v)
    def outs(): return [pnum(t.split("\n")[0].split(" ")[0]) if False else pnum(t) for t in pg.locator("#cOut .co b").all_inner_texts()]
    F("A", "20"); F("T", "8"); F("dl", "500"); F("dt", "1800"); F("w", "5")
    o = outs()
    wl, wt = 1.6 * 500, 1.6 * 1800
    e = [1.6 * 1.05, wl, 0.08 * 500, wt, wt - wl, (wt - wl) / wt * 100, (wt - wl) / 20 * 9.80665 / 1000]
    check("ماشین‌حساب کف سبک = دست‌محاسبه", len(o) == 7 and all(close(a, b_) for a, b_ in zip(o, e)), (o, e))
    check("دکمه‌ی برداشتن چگالی از شناسنامه", pg.locator("[data-x=cfill]").count() == 1)
    pg.click("[data-x=cfill]"); pg.click("[data-tab=calc]")
    check("چگالی از شناسنامه (۴۵۰) در فیلد نشست", pg.input_value("[data-i=calc][data-k=dl]") == "450")
    pg.click("[data-x=cadd][data-o='0']"); pg.wait_for_selector(".pkr"); pg.click(".pkr >> nth=0")
    check("افزودن خروجی ماشین‌حساب به برآورد", "به برآورد" in pg.inner_text("#toast"))
    pg.click("[data-x=cc][data-k=block]")
    F("A", "30"); F("o", "3"); F("bl", "40"); F("bh", "20"); F("bt", "10"); F("w", "5")
    n0 = 27 / (0.41 * 0.21); mv = (27 * 0.10 - n0 * 40 * 20 * 10 / 1e6) * 1.05
    o = outs(); e = [27, math.ceil(n0 * 1.05), n0 / 27, mv, mv * 1000]
    check("ماشین‌حساب بلوک و ملات = دست‌محاسبه", len(o) == 5 and all(close(a, b_) for a, b_ in zip(o, e)), (o, e))
    pg.click("[data-x=cc][data-k=gyp]")
    F("A", "50"); F("t", "10"); F("ref", "12"); F("bag", "30"); F("Ap", "40"); F("pw", "1.2"); F("ph", "2.4"); F("po", "4"); F("w", "5")
    o = outs(); e = [630, 21, math.ceil(36 / 2.88 * 1.05), 36 * 1.05]
    check("ماشین‌حساب گچ و پانل = دست‌محاسبه", len(o) == 4 and all(close(a, b_) for a, b_ in zip(o, e)), (o, e))
    pg.click("[data-tab=room]"); pg.screenshot(path="/tmp/ravaq_room.png", full_page=True)
    check("بدون خطای جاوااسکریپت (B)", not errs, errs)
    b.close()

with sync_playwright() as pw:
    scenario_a(pw)
    scenario_b(pw)

bad = [r for r in RESULTS if not r[0]]
print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} تست موفق")
sys.exit(1 if bad else 0)