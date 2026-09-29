(() => {
'use strict';
const TG = window.Telegram && Telegram.WebApp;
try { TG && (TG.ready(), TG.expand()); } catch (e) {}
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fa = n => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: 2 });
const num = v => parseFloat(String(v == null ? '' : v).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬،]/g, '').replace('٫', '.')) || 0;
const uid = () => Math.random().toString(36).slice(2, 9);
const safe = u => /^https?:\/\//i.test(u || '') ? u : '';
const hp = t => { try { TG.HapticFeedback.impactOccurred(t || 'light'); } catch (e) {} };
const K = { est: 'rq.mat.est', fav: 'rq.mat.fav', cfg: 'rq.mat.cfg', th: 'rq.mat.theme', rooms: 'rq.mat.rooms', scn: 'rq.mat.scn', px: 'rq.mat.px', cmp: 'rq.mat.cmp', w: 'rq.mat.w', dir: 'rq.mat.dir', proj: 'rq.mat.proj', cc: 'rq.mat.cc' };
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const COL = ['#6FE3C4', '#E3B26F', '#8AA2FF', '#E36F9A', '#B58AFF', '#7FD1E8'];
const S = { tab: 'cat', q: '', cat: '', edit: false, admin: false, est: ld(K.est, []), fav: ld(K.fav, []), cfg: ld(K.cfg, { waste: 5, labor: 0 }), back: null, brand: '', bot: 'irarchitps_bot', start: 'materials', curP: '', rooms: ld(K.rooms, []), scn: ld(K.scn, {}), px: ld(K.px, {}), cmp: ld(K.cmp, []), w: ld(K.w, { price: 3, dur: 3, spd: 3, av: 3 }), dir: ld(K.dir, {}), proj: ld(K.proj, { name: '', client: '' }), cc: ld(K.cc, { k: 'floor', v: { floor: { w: 5 }, block: { j: 10, w: 5 }, gyp: { w: 5 } } }), pick: null, cres: [] };
let D = { companies: [], packs: [] };

/* ---------- ابزارها ---------- */
let tt; const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 1800); };
const api = (p, o = {}) => fetch('/materials/api/' + p, { ...o, headers: { 'Content-Type': 'application/json', 'X-Init-Data': TG ? TG.initData : '' } }).then(r => r.json());
const find = id => { for (const c of D.companies) for (const p of c.products) if (p.id === id) return [c, p]; return []; };
const persist = () => { sv(K.est, S.est); sv(K.fav, S.fav); sv(K.cfg, S.cfg); };
const qty = l => l.mode === 'area' ? l.q * l.per * (1 + S.cfg.waste / 100) : l.mode === 'vol' ? l.q * l.th / 100 * (1 + S.cfg.waste / 100) : l.q;
const saveData = async () => { try { const r = await api('save', { method: 'POST', body: JSON.stringify(D) }); toast(r.ok ? 'ذخیره شد ✓' + (noImg() ? ` — ${fa(noImg())} محصول هنوز بدون تصویر` : '') : (r.error ? 'ذخیره نشد: ' + r.error : 'ذخیره نشد')); } catch (e) { toast('خطا در ارتباط'); } };
const I = { heart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>', calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>' };

/* ---------- رسانه و شناسنامه ---------- */
const CONF = { datasheet: 'تأییدشده با دیتاشیت', field: 'تجربه‌ی اجرایی', review: 'نیازمند بررسی' };
const mUrl = (m, z) => '/materials/m/' + m.key + '?s=' + z;
const letter = c => esc((c.en || c.name || '').trim()[0] || '؟');
const logoBox = (c, cls) => c.logo && c.logo.key ? `<div class="${cls} has-logo"><img src="${mUrl(c.logo, 'g')}" alt="${esc(c.name)}" decoding="async"></div>` : `<div class="${cls}">${letter(c)}</div>`;
const thumb = (c, p) => { const m = (p.images || [])[0]; return m ? `<div class="im"><img src="${mUrl(m, 't')}" alt="${esc(p.name)}" decoding="async"></div>` : `<div class="im ph"><b>${letter(c)}</b><small>در حال تکمیل</small></div>`; };
const specsText = a => (a || []).map(x => x.k + ': ' + x.v).join('\n');
const parseSpecs = t => String(t || '').split('\n').map(l => { const i = l.search(/[:：]/); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : null; }).filter(x => x && x.k && x.v);
const noImg = () => D.companies.reduce((n, c) => n + c.products.filter(p => !(p.images || []).length).length, 0);
const link = id => S.bot ? `https://t.me/${S.bot}?start=mat_${id}` : '';
const reload = () => api('data').then(r => { D = r.data; S.admin = !!r.admin; S.bot = r.bot || 'irarchitps_bot'; S.start = r.start || 'materials'; });
const reqUpload = async (kind, co, pid) => { try { const r = await api('upload-request', { method: 'POST', body: JSON.stringify({ kind, co, pid: pid || '' }) }); if (r.ok) { toast('عکس را در چت ربات بفرست'); setTimeout(() => { try { TG.close(); } catch (e) {} }, 900); } else toast('ناموفق: ' + (r.error || '')); } catch (e) { toast('خطا در ارتباط'); } };
const rmMedia = async (co, pid, key) => { try { const r = await api('media-remove', { method: 'POST', body: JSON.stringify({ co, pid, key }) }); if (!r.ok) toast('حذف نشد'); await reload(); render(); } catch (e) { toast('خطا در ارتباط'); } };

/* ---------- شیت ---------- */
const sheet = (html, back) => { $('#sdPanel').innerHTML = '<div class="sd-grab"></div><div class="sd-scroll">' + html + '</div>'; const sd = $('#sd'); sd.hidden = false; document.body.classList.add('locked'); requestAnimationFrame(() => sd.classList.add('open')); S.back = back || null; };
const closeSheet = () => { const sd = $('#sd'); sd.classList.remove('open'); document.body.classList.remove('locked'); S.back = null; setTimeout(() => { if (!sd.classList.contains('open')) { sd.hidden = true; $('#sdPanel').innerHTML = ''; } }, 300); };

/* ---------- نما ---------- */
function tabs() {
  const T = [['cat', 'کاتالوگ برندها', fa(D.companies.length)], ['room', 'متره‌ی اتاق‌محور', fa(S.rooms.length)], ['cmp', 'مقایسه‌گر', fa(S.cmp.length)], ['calc', 'ماشین‌حساب', fa(3)], ['est', 'برآورد پروژه', fa(S.est.length)], ['fav', 'ذخیره‌شده‌ها', fa(S.fav.length)]];
  $('#index').innerHTML = T.map((t, i) => `<button type="button" class="tile ${S.tab === t[0] ? 'on' : ''}" data-tab="${t[0]}" role="tab" aria-selected="${S.tab === t[0]}"><b>${t[2]}</b>${t[1]}</button>`).join('');
  $('#filters').hidden = S.tab !== 'cat';
  $('#editBtn').hidden = !S.admin; $('#editBtn').setAttribute('aria-pressed', S.edit);
}
function render() {
  tabs();
  const L = $('#list');
  L.innerHTML = ({ est: estView, fav: favView, room: roomView, cmp: cmpView, calc: calcView }[S.tab] || catView)();
  if (S.tab === 'cat') { const cats = [...new Set(D.companies.map(c => c.cat).filter(Boolean))]; $('#chips').innerHTML = cats.map(c => `<button type="button" class="chip ${S.cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join(''); $('#logos').innerHTML = [...D.companies].sort((a, b) => (!!b.sponsor) - (!!a.sponsor)).map(c => `<button type="button" class="lgo ${S.brand === c.id ? 'on' : ''}" data-logo="${c.id}" aria-pressed="${S.brand === c.id}">${logoBox(c, 'lgb')}<small>${esc(c.name)}</small>${c.sponsor ? '<i class="spd" title="حامی رواق"></i>' : ''}</button>`).join(''); observe(); }
  if (S.tab === 'est') paint(); else if (S.tab === 'room') paintRoom(); else if (S.tab === 'cmp') paintCmp(); else if (S.tab === 'calc') paintCalc();
}
let io; function observe() { const cs = document.querySelectorAll('.mc'); if (!('IntersectionObserver' in window)) return cs.forEach(c => c.classList.add('in-view')); io && io.disconnect(); io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.transitionDelay = (Number(e.target.dataset.i) % 4) * 50 + 'ms'; e.target.classList.add('in-view'); io.unobserve(e.target); } }), { threshold: .05 }); cs.forEach(c => io.observe(c)); }

function catView() {
  const q = S.q.trim();
  const list = D.companies.filter(c => (!S.cat || c.cat === S.cat) && (!S.brand || c.id === S.brand) && (!q || (c.name + ' ' + c.en + ' ' + c.cat + ' ' + c.desc + ' ' + c.products.map(p => p.name + p.group + (p.features || []).join(' ')).join(' ')).includes(q)));
  const add = S.edit ? '<button type="button" class="act act-primary" data-a="addco" style="margin-top:12px">+ برند جدید</button>' : '';
  if (!list.length) return add + '<div class="empty"><div class="empty-icon">🔍</div><p>موردی پیدا نشد</p></div>';
  return add + '<div class="grid">' + list.map((c, i) => `<article class="mc" data-brand="${c.id}" data-i="${i}" tabindex="0" role="button"><div style="display:flex;gap:10px;align-items:center">${logoBox(c, 'mono')}<div><h3>${esc(c.name)}</h3><div class="meta"><span>${esc(c.cat)}</span></div></div></div><p>${esc(c.desc)}</p><div class="meta"><span>${fa(c.products.length)} محصول</span>${safe(c.catalog) ? '<span class="sp">کاتالوگ</span>' : ''}${c.sponsor ? '<span class="sp">حامی رواق</span>' : ''}</div></article>`).join('') + '</div>';
}
function prodRow(c, p) {
  const price = p.price ? `<div class="pc">${fa(p.price)} تومان <small>/ ${esc(p.unit)}</small></div>` : `<div class="pc no">قیمت روز: استعلام <small>(${esc(p.unit)})</small></div>`;
  const on = S.fav.includes(p.id);
  const warn = S.edit && !(p.images || []).length ? '<small class="wr">⚠ بدون تصویر؛ از داخل محصول عکس اضافه کن</small>' : '';
  return `<div class="pr2" data-prod="${p.id}" tabindex="0" role="button">${thumb(c, p)}<h4>${esc(p.name)}</h4>${p.desc ? `<small>${esc(p.desc)}</small>` : ''}${price}${(p.features || []).length ? `<div class="fch">${p.features.slice(0, 2).map(f => `<b>${esc(f)}</b>`).join('')}</div>` : ''}${warn}<div class="bt"><button type="button" class="sq pl" data-add="${p.id}" aria-label="افزودن به برآورد">＋</button><button type="button" class="sq ${on ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${on}" aria-label="ذخیره">${I.heart}</button><button type="button" class="sq ${S.cmp.includes(p.id) ? 'on' : ''}" data-x="cmp" data-pid="${p.id}" aria-label="مقایسه">⇄</button>${safe(p.catalog) ? `<a class="sq" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener" aria-label="کاتالوگ محصول">${I.pdf.replace('<svg', '<svg width="17" height="17"')}</a>` : ''}${S.edit ? `<button type="button" class="sq" data-ep="${p.id}">✎</button><button type="button" class="sq dg" data-dp="${p.id}">✕</button>` : ''}</div></div>`;
}
function openBrand(id) {
  const c = D.companies.find(x => x.id === id); if (!c) return;
  const gs = {}; c.products.forEach(p => (gs[p.group || 'سایر'] = gs[p.group || 'سایر'] || []).push(p));
  const cat = safe(c.catalog);
  sheet(`<div class="sd-head">${logoBox(c, 'mono')}<div><h3 style="margin:0;font-size:18px;color:var(--ink)">${esc(c.name)}${c.en ? ` <small style="color:var(--ink-faint)">${esc(c.en)}</small>` : ''}</h3><div class="meta" style="margin-top:4px"><span>${esc(c.cat)}</span>${c.sponsor ? '<span class="sp">حامی رواق</span>' : ''}</div></div></div>
  <p style="color:var(--ink-dim);font-size:13px;margin:6px 0 4px">${esc(c.desc)}</p>
  ${S.edit ? `<div class="ft"><button type="button" class="act" data-a="editco" data-id="${c.id}">✎ ویرایش برند</button><button type="button" class="act act-primary" data-a="addp" data-id="${c.id}">+ محصول</button><button type="button" class="act" data-a="uplogo" data-id="${c.id}">🖼 لوگو از ربات</button>${c.logo ? `<button type="button" class="act" data-a="rmlogo" data-id="${c.id}" style="color:var(--danger)">حذف لوگو</button>` : ''}<button type="button" class="act" data-a="delco" data-id="${c.id}" style="color:var(--danger)">حذف برند</button></div>` : ''}
  ${Object.entries(gs).map(([g, ps]) => `<div class="grp">${esc(g)}</div>${ps.map(p => prodRow(c, p)).join('')}`).join('') || '<div class="empty"><p>هنوز محصولی ثبت نشده</p></div>'}
  <div class="sd-bar" style="margin-top:12px">${cat ? `<a class="act act-primary" href="${esc(cat)}" target="_blank" rel="noopener">${I.pdf}<span>کاتالوگ شرکت</span></a>` : ''}<button type="button" class="act" data-a="goest">${I.calc}<span>برآورد (${fa(S.est.length)})</span></button></div>`, () => openBrand(id));
  S.cur = id;
}
const ratings = p => (p.speed || p.durability) ? `<div class="grp">امتیازهای رواق</div><table class="spt">${p.durability ? `<tr><td>دوام</td><td>${fa(p.durability)} از ۵</td></tr>` : ''}${p.speed ? `<tr><td>سرعت اجرا</td><td>${fa(p.speed)} از ۵</td></tr>` : ''}</table>` : '';
function openProd(pid) {
  const [c, p] = find(pid); if (!p) return;
  S.cur = c.id; S.curP = pid;
  const imgs = p.images || [];
  const gal = imgs.length ? `<div class="gal"><div class="gal-track" id="galT">${imgs.map((m, k) => `<div class="gal-s im"><img src="${mUrl(m, 'l')}" alt="${esc(p.name)}" decoding="async">${S.edit ? `<button type="button" class="sq dg gal-x" data-rmimg="${m.key}" aria-label="حذف عکس">✕</button>` : ''}</div>`).join('')}</div>${imgs.length > 1 ? `<div class="dots" id="galD">${imgs.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>` : `<div class="im ph big"><b>${letter(c)}</b><small>تصویر این محصول در حال تکمیل است</small></div>`;
  const price = p.price ? `<div class="pc">${fa(p.price)} تومان <small>/ ${esc(p.unit)}</small></div>` : `<div class="pc no">قیمت روز: استعلام <small>(${esc(p.unit)})</small></div>`;
  const specs = (p.specs || []).length ? `<table class="spt">${p.specs.map(x => `<tr><td>${esc(x.k)}</td><td>${esc(x.v)}</td></tr>`).join('')}</table>` : '<div class="pc no">مشخصات فنی: استعلام</div>';
  const trace = (p.confidence || p.source || p.lastVerified || p.availability) ? `<div class="tr">${p.confidence ? `<span class="cf ${esc(p.confidence)}">${esc(CONF[p.confidence] || '')}</span> ` : ''}${p.availability ? `<div>قابل تهیه در ایران: ${esc(p.availability)}</div>` : ''}${p.source ? `<div>منبع: ${esc(p.source)}</div>` : ''}${p.lastVerified ? `<div>آخرین بررسی: ${esc(p.lastVerified)}</div>` : ''}</div>` : '<div class="tr">منبع و تاریخ بررسی برای این محصول هنوز ثبت نشده است.</div>';
  const feats = (p.features || []).length ? `<div class="grp">ویژگی‌ها</div><ul class="fts">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const on = S.fav.includes(p.id);
  sheet(`<div class="sd-head"><button type="button" class="act" data-a="tobrand">‹ ${esc(c.name)}</button></div>${gal}<h3 style="margin:0 0 4px;font-size:18px;color:var(--ink)">${esc(p.name)}</h3>${p.desc ? `<p style="color:var(--ink-dim);font-size:13px;margin:0 0 8px">${esc(p.desc)}</p>` : ''}${price}${feats}<div class="grp">مشخصات فنی</div>${specs}${ratings(p)}${trace}
  ${S.edit ? `<div class="ft"><button type="button" class="act act-primary" data-a="upimg" data-id="${c.id}" data-pid="${p.id}">📷 افزودن عکس از ربات (${fa(imgs.length)}/۶)</button><button type="button" class="sq" data-ep="${p.id}">✎</button></div>` : ''}
  <div class="sd-bar" style="margin-top:12px"><button type="button" class="act act-primary" data-add="${p.id}">＋ برآورد</button><button type="button" class="act" data-fav="${p.id}" aria-pressed="${on}">${on ? '♥ ذخیره‌شده' : '♡ ذخیره'}</button><button type="button" class="act" data-x="cmp" data-pid="${p.id}">⇄ مقایسه</button><button type="button" class="act" data-a="shareprod" data-pid="${p.id}">اشتراک</button>${safe(p.catalog) ? `<a class="act" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener">${I.pdf}<span>کاتالوگ</span></a>` : ''}</div>`);
  const tr = $('#galT'); if (tr) tr.addEventListener('scroll', () => { const k = Math.round(Math.abs(tr.scrollLeft) / tr.clientWidth); document.querySelectorAll('#galD i').forEach((d, n) => d.classList.toggle('on', n === k)); }, { passive: true });
}
function favView() {
  const items = S.fav.map(find).filter(x => x[1]);
  return items.length ? '<div style="margin-top:14px">' + items.map(([c, p]) => `<div class="grp">${esc(c.name)}</div>` + prodRow(c, p)).join('') + '</div>' : '<div class="empty"><div class="empty-icon">♡</div><p>هنوز محصولی ذخیره نکرده‌ای.<br>روی قلب کنار هر محصول بزن.</p></div>';
}
function estView() {
  const packs = (D.packs || []).length ? `<div class="grp">پکیج‌های آماده (با یک لمس اضافه می‌شود)</div><div class="packs">${D.packs.map(k => `<button type="button" class="pk" data-pack="${k.id}"><b>${esc(k.title)}</b><span>${esc(k.desc)}</span><br><i>+ افزودن ${fa(k.items.length)} قلم</i></button>`).join('')}</div>` : '';
  if (!S.est.length) return packs + '<div class="empty"><div class="empty-icon">🧮</div><p>برآورد خالی است.<br>یک پکیج آماده بزن یا از کاتالوگ محصول اضافه کن.</p></div>';
  const lines = S.est.map(l => {
    const m = l.mode;
    const ctl = m === 'count'
      ? `<div class="fl"><span>تعداد</span><div class="stp"><button type="button" class="sq" data-st="${l.id}" data-d="-1">−</button><b>${fa(l.q)}</b><button type="button" class="sq pl" data-st="${l.id}" data-d="1">＋</button></div></div>`
      : `<label class="fl"><span>متراژ (م²)</span><input inputmode="decimal" data-l="${l.id}" data-k="q" value="${l.q}"></label>` + (m === 'area' ? `<label class="fl"><span>مصرف هر م²</span><input inputmode="decimal" data-l="${l.id}" data-k="per" value="${l.per}"></label>` : `<label class="fl"><span>ضخامت (cm)</span><input inputmode="decimal" data-l="${l.id}" data-k="th" value="${l.th}"></label>`);
    return `<div class="ln"><h4><span>${esc(l.name)}</span><em>${esc(l.co)}</em></h4><div class="rw">${ctl}<label class="fl"><span>قیمت هر ${esc(l.unit)} (تومان)</span><input inputmode="decimal" data-l="${l.id}" data-k="price" value="${l.price || ''}" placeholder="وارد کن"></label></div><div class="lt"><small data-lq="${l.id}"></small><span data-lt="${l.id}"></span></div><div class="wr" data-lw="${l.id}" hidden>قیمت این قلم ثبت نشده؛ قیمت روز را وارد کن.</div><button type="button" class="act" data-rm="${l.id}" style="margin-top:8px;color:var(--danger)">حذف</button></div>`;
  }).join('');
  return packs + `<div class="grp">اقلام برآورد</div>${lines}<div class="tot"><div class="rw" style="margin:0 0 8px"><label class="fl"><span>ضایعات (٪)</span><input inputmode="decimal" data-g="waste" value="${S.cfg.waste}"></label><label class="fl"><span>اجرت و متفرقه (٪)</span><input inputmode="decimal" data-g="labor" value="${S.cfg.labor}"></label></div><div class="r"><span>جمع مصالح</span><b id="tSum"></b></div><div class="r"><span>اجرت و متفرقه</span><b id="tLab"></b></div><div class="g"><span>برآورد نهایی</span><span id="tAll"></span></div><div class="bar2" id="tBar"></div><div class="lg" id="tLg"></div><div class="wr" id="tWr" hidden></div></div><div class="ft"><button type="button" class="act act-primary" data-a="share">ارسال در تلگرام</button><button type="button" class="act" data-a="clear" style="color:var(--danger)">پاک‌کردن همه</button></div>`;
}
function paint() {
  let sum = 0, miss = 0; const by = {};
  S.est.forEach(l => { const n = qty(l), t = n * (l.price || 0); sum += t; by[l.co] = (by[l.co] || 0) + t; if (!l.price) miss++;
    const a = document.querySelector(`[data-lt="${l.id}"]`); if (!a) return;
    a.textContent = l.price ? fa(t) + ' تومان' : '—'; document.querySelector(`[data-lq="${l.id}"]`).textContent = 'مقدار: ' + fa(n) + ' ' + l.unit + (l.mode !== 'count' ? ` (با ${fa(S.cfg.waste)}٪ ضایعات)` : ''); document.querySelector(`[data-lw="${l.id}"]`).hidden = !!l.price; });
  const lab = sum * S.cfg.labor / 100, set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('tSum', fa(sum) + ' تومان'); set('tLab', fa(lab) + ' تومان'); set('tAll', fa(sum + lab) + ' تومان');
  const ks = Object.keys(by).filter(k => by[k] > 0), bar = document.getElementById('tBar'), lg = document.getElementById('tLg');
  if (bar) { bar.hidden = lg.hidden = !ks.length; bar.innerHTML = ks.map((k, i) => `<i style="width:${by[k] / sum * 100}%;background:${COL[i % 6]}"></i>`).join(''); lg.innerHTML = ks.map((k, i) => `<span><i style="background:${COL[i % 6]}"></i>${esc(k)} ${fa(Math.round(by[k] / sum * 100))}٪</span>`).join(''); }
  const w = document.getElementById('tWr'); if (w) { w.hidden = !miss; w.textContent = miss ? `${fa(miss)} قلم بدون قیمت است و در جمع نیامده.` : ''; }
  const b = document.querySelector('[data-tab="est"] b'); if (b) b.textContent = fa(S.est.length);
  S.total = sum * (1 + S.cfg.labor / 100);
}
function addLine(p, c, q) { const ex = S.est.find(l => l.pid === p.id); if (ex && p.mode === 'count') { ex.q += q || 1; } else S.est.push({ id: uid(), pid: p.id, name: p.name, co: c.name, unit: p.unit, mode: p.mode || 'count', price: p.price || 0, q: q || 1, per: p.perM2 || 1, th: p.def || 5 }); persist(); }
function summary() {
  const R = '\u200F', by = {}; let sum = 0, miss = 0;
  S.est.forEach(l => { (by[l.co] = by[l.co] || []).push(l); sum += qty(l) * (l.price || 0); if (!l.price) miss++; });
  const lab = sum * S.cfg.labor / 100, out = [R + '🧱 برآورد مصالح — رواق'];
  Object.entries(by).forEach(([co, ls]) => {
    out.push('', R + '🏷 ' + co);
    ls.forEach(l => { const n = qty(l); out.push(R + '▫️ ' + l.name, R + '    ' + fa(n) + ' ' + l.unit + (l.mode !== 'count' ? ' (با ' + fa(S.cfg.waste) + '٪ ضایعات)' : '') + (l.price ? ' × ' + fa(l.price) + ' = ' + fa(Math.round(n * l.price)) + ' تومان' : ' — قیمت: استعلام')); });
  });
  out.push('', R + '━━━━━━━━━━', R + 'جمع مصالح: ' + fa(Math.round(sum)) + ' تومان');
  if (S.cfg.labor) out.push(R + 'اجرت و متفرقه (' + fa(S.cfg.labor) + '٪): ' + fa(Math.round(lab)) + ' تومان');
  out.push(R + '✅ برآورد نهایی: ' + fa(Math.round(sum + lab)) + ' تومان');
  if (miss) out.push('', R + '⚠️ ' + fa(miss) + ' قلم بدون قیمت در جمع نیامده.');
  out.push('', R + 'برآورد تقریبی است و جایگزین استعلام رسمی نیست.', R + '🤖 @' + S.bot);
  return out.join('\n');
}

/* ---------- فرم ادمین ---------- */
const CF = [['name', 'نام برند'], ['en', 'نام لاتین'], ['cat', 'دسته‌بندی'], ['desc', 'توضیح کوتاه', 'area'], ['catalog', 'لینک کاتالوگ (https://…)'], ['sponsor', 'حامی رواق', 'chk']];
const PF = [['name', 'نام محصول'], ['group', 'گروه'], ['desc', 'توضیح', 'area'], ['unit', 'واحد (عدد، کیسه، م²…)'], ['price', 'قیمت روز (تومان)'], ['mode', 'نوع محاسبه', 'sel', [['count', 'تعدادی'], ['area', 'بر اساس متراژ'], ['vol', 'حجمی (متراژ × ضخامت)']]], ['perM2', 'مصرف هر م²'], ['def', 'ضخامت پیش‌فرض (cm)'], ['catalog', 'لینک کاتالوگ محصول'], ['availability', 'قابل تهیه در ایران؟', 'sel', [['', 'نامشخص'], ['داخلی', 'تولید داخل'], ['وارداتی', 'وارداتی'], ['معادل ایرانی', 'معادل ایرانی دارد']]], ['confidence', 'نشان اطمینان', 'sel', [['', 'انتخاب کن'], ['datasheet', 'تأییدشده با دیتاشیت'], ['field', 'تجربه‌ی اجرایی'], ['review', 'نیازمند بررسی']]], ['source', 'منبع (مثلاً دیتاشیت شرکت، نسخه)'], ['lastVerified', 'آخرین بررسی (مثلاً ۱۴۰۵/۰۷/۰۱)'], ['surf', 'سطح پیش‌فرض در متره', 'sel', [['', 'خودکار'], ['floor', 'کف'], ['wall', 'دیوار'], ['ceiling', 'سقف']]], ['tier', 'رده برای سناریو', 'sel', [['', 'بدون رده (بر اساس قیمت)'], ['eco', 'اقتصادی'], ['mid', 'متوسط'], ['lux', 'لوکس']]], ['speed', 'سرعت اجرا (۱ تا ۵؛ ۵ = سریع‌ترین)'], ['durability', 'دوام (۱ تا ۵؛ ۵ = بادوام‌ترین)'], ['featuresT', 'ویژگی‌ها — هر خط یک ویژگی (از کاتالوگ)', 'area'], ['specsT', 'مشخصات فنی — هر خط «عنوان: مقدار»', 'area']];
function form(title, F, v, ok, back, val) {
  sheet(`<h3 style="margin:4px 0 10px;color:var(--ink)">${title}</h3><div class="rw">${F.map(([k, l, t, o]) => `<label class="fl" style="min-width:${t === 'area' ? '100%' : '140px'}"><span>${l}</span>${t === 'area' ? `<textarea data-f="${k}" rows="2">${esc(v[k])}</textarea>` : t === 'sel' ? `<select data-f="${k}">${o.map(x => `<option value="${x[0]}" ${v[k] === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select>` : t === 'chk' ? `<input type="checkbox" data-f="${k}" ${v[k] ? 'checked' : ''} style="width:24px;height:24px">` : `<input data-f="${k}" value="${esc(v[k])}">`}</label>`).join('')}</div><div class="sd-bar" style="margin-top:14px"><button type="button" class="act act-primary" data-a="fok">ذخیره</button><button type="button" class="act" data-a="fno">انصراف</button></div>`, back);
  S.ok = ok; S.val = val || null;
}
const readForm = () => { const o = {}; document.querySelectorAll('#sdPanel [data-f]').forEach(e => o[e.dataset.f] = e.type === 'checkbox' ? e.checked : e.value.trim()); return o; };
const rate = v => { const n = Math.round(num(v)); return n >= 1 && n <= 5 ? n : null; };
const cleanP = o => { const r = { ...o, speed: rate(o.speed), durability: rate(o.durability), price: num(o.price) || null, perM2: num(o.perM2) || null, def: num(o.def) || null, catalog: safe(o.catalog), specs: parseSpecs(o.specsT), features: String(o.featuresT || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 20) }; delete r.specsT; delete r.featuresT; return r; };
const valP = o => (parseSpecs(o.specsT).length || String(o.featuresT || '').trim() || num(o.price) || rate(o.speed) || rate(o.durability)) && !(o.source && o.confidence) ? 'برای قیمت یا مشخصات، «منبع» و «نشان اطمینان» را وارد کن' : '';

/* ================================================================
   فاز ۲ — متره‌ی اتاق‌محور، سه سناریو، مقایسه‌گر، ماشین‌حساب‌ها، برگه‌ی پیشنهاد
   اصل: هیچ عدد فنی/قیمتی ساخته نمی‌شود؛ هر عدد یا از داده‌ی ثبت‌شده می‌آید یا کاربر وارد می‌کند.
   ================================================================ */
const P = v => Math.max(0, num(v));
const R2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const nf = v => fa(R2(v));
const SURF = { floor: 'کف', wall: 'دیوار (خالص)', ceiling: 'سقف' };
const AV = { 'داخلی': 3, 'معادل ایرانی': 2, 'وارداتی': 1 };
const TIERS = [['eco', 'اقتصادی'], ['mid', 'متوسط'], ['lux', 'لوکس']];
const priceOf = p => (S.px[p.id] > 0 ? S.px[p.id] : p.price) || 0;
const defSurf = p => (SURF[p.surf] ? p.surf : p.mode === 'vol' ? 'floor' : 'wall');
const newRoom = n => ({ id: uid(), name: 'اتاق ' + fa(n), n: 1, L: '', W: '', H: '', dn: '', dw: '', dh: '', wn: '', ww: '', wh: '', items: [] });
const $$ = s => document.querySelectorAll(s);

/* ---------- هسته‌ی محاسبه (خالص و قابل‌تست) ---------- */
function geom(r) {
  const L = P(r.L), W = P(r.W), H = P(r.H), per = 2 * (L + W), gross = per * H;
  const open = P(r.dn) * P(r.dw) * P(r.dh) + P(r.wn) * P(r.ww) * P(r.wh);
  return { floor: L * W, ceiling: L * W, wall: Math.max(0, gross - open), gross, open, per, vol: L * W * H, over: open > gross && gross > 0 };
}
function itemQty(r, it, p, base) {
  const g = geom(r), n = Math.max(1, P(r.n) || 1), w = 1 + P(S.cfg.waste) / 100;
  const on = base && SURF[it.on] ? it.on : defSurf(p);
  if (p.mode === 'area') return g[on] * n * ((base ? P(it.per) : 0) || P(p.perM2) || 1) * w;
  if (p.mode === 'vol') return g[on] * n * ((base ? P(it.th) : 0) || P(p.def) || 5) / 100 * w;
  return (it.q == null ? 1 : P(it.q)) * n;
}
function alts(p) {
  const c = find(p.id)[0]; if (!c) return [p];
  return c.products.filter(x => x.id === p.id || (x.group === p.group && x.unit === p.unit && (x.mode || 'count') === (p.mode || 'count')));
}
function tierPick(p, t) {
  if (t === 'mid') return p;
  const a = alts(p), tg = a.find(x => x.tier === t && x.id !== p.id); if (tg) return tg;
  const pr = a.filter(x => priceOf(x) > 0).sort((x, y) => priceOf(x) - priceOf(y)), b = priceOf(p);
  if (!pr.length || !(b > 0)) return p;
  return t === 'eco' ? (priceOf(pr[0]) < b ? pr[0] : p) : (priceOf(pr[pr.length - 1]) > b ? pr[pr.length - 1] : p);
}
function pickFor(it, p, t) { const o = (S.scn[it.id] || {})[t]; if (o) { const q = find(o)[1]; if (q) return q; } return tierPick(p, t); }
function takeoff(t) {
  const map = {}; let swaps = 0;
  S.rooms.forEach(r => r.items.forEach(it => {
    const p0 = find(it.pid)[1]; if (!p0) return;
    const p = pickFor(it, p0, t); if (p.id !== p0.id) swaps++;
    const m = map[p.id] || (map[p.id] = { p, c: find(p.id)[0], q: 0 }); m.q += itemQty(r, it, p, p.id === p0.id);
  }));
  const lines = Object.values(map).map(m => ({ ...m, price: priceOf(m.p), cost: m.q * priceOf(m.p) }));
  const sum = lines.reduce((a, l) => a + l.cost, 0), miss = lines.filter(l => !l.price).length;
  const sp = lines.filter(l => l.p.speed > 0), spn = sp.length, spd = spn ? sp.reduce((a, l) => a + l.p.speed, 0) / spn : 0;
  const lab = sum * P(S.cfg.labor) / 100;
  return { lines, sum, lab, tot: sum + lab, miss, swaps, spn, sp: spd };
}
function scoreCmp(ps) {
  const val = { price: p => (priceOf(p) > 0 ? priceOf(p) : null), dur: p => p.durability || null, spd: p => p.speed || null, av: p => AV[p.availability] || null };
  const sameUnit = ps.every(p => p.unit === ps[0].unit), out = { crit: {}, score: ps.map(() => 0), used: [], skipped: [] }; let sw = 0;
  Object.keys(val).forEach(k => {
    const vs = ps.map(val[k]); const ok = vs.every(v => v != null) && (k !== 'price' || sameUnit);
    if (!ok) return out.skipped.push(k);
    if (!S.w[k]) return;
    const mn = Math.min(...vs), norm = vs.map(v => k === 'price' ? mn / v : v / (k === 'av' ? 3 : 5));
    out.used.push(k); sw += S.w[k]; norm.forEach((n, i) => (out.score[i] += n * S.w[k]));
  });
  out.score = sw ? out.score.map(s => s / sw * 100) : null; return out;
}
const specNum = s => { const m = String(s == null ? '' : s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace('٫', '.').replace(/[,٬،]/g, '').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
/* ماشین‌حساب‌ها */
const CDEF = {
  floor: { t: 'کف سبک و بار مرده', f: [['A', 'مساحت کف (م²)'], ['T', 'ضخامت لایه (cm)'], ['dl', 'چگالی سبکدانه — kg/m³ (از دیتاشیت)'], ['dt', 'چگالی مصالح سنتی — kg/m³ (مقایسه)'], ['bag', 'حجم هر کیسه (لیتر) — اختیاری'], ['w', 'ضایعات (٪)']] },
  block: { t: 'بلوک و ملات', f: [['A', 'مساحت دیوار (م²)'], ['o', 'بازشو (م²)'], ['bl', 'طول بلوک (cm)'], ['bh', 'ارتفاع بلوک (cm)'], ['bt', 'ضخامت بلوک (cm)'], ['j', 'ضخامت ملات (mm) — فرض قابل‌ویرایش'], ['w', 'ضایعات (٪)']] },
  gyp: { t: 'گچ و پانل', f: [['A', 'مساحت سطح گچ‌کاری (م²)'], ['t', 'ضخامت متوسط (mm)'], ['ref', 'مصرف مرجع — kg بر م² به‌ازای هر ۱cm (دیتاشیت)'], ['bag', 'وزن هر کیسه (kg)'], ['Ap', 'مساحت دیوار پانلی (م²)'], ['pw', 'عرض پانل (م)'], ['ph', 'ارتفاع پانل (م)'], ['po', 'بازشو (م²)'], ['w', 'ضایعات (٪)']] }
};
function calcRun(k, v) {
  const w = 1 + P(v.w) / 100, o = [];
  if (k === 'floor') {
    const A = P(v.A), T = P(v.T), vol = A * T / 100, volW = vol * w;
    if (A && T) { o.push({ l: 'حجم سبکدانه (با ضایعات)', v: volW, u: 'متر مکعب', add: 1 }); if (P(v.bag)) o.push({ l: 'تعداد کیسه', v: Math.ceil(volW * 1000 / P(v.bag)), u: 'کیسه', add: 1 }); }
    if (A && T && P(v.dl)) {
      const wl = vol * P(v.dl); o.push({ l: 'وزن لایه‌ی سبک', v: wl, u: 'کیلوگرم' }, { l: 'بار مرده‌ی سبک', v: T / 100 * P(v.dl), u: 'kg/m²' });
      if (P(v.dt)) { const wt = vol * P(v.dt); o.push({ l: 'وزن با مصالح سنتی', v: wt, u: 'کیلوگرم' }, { l: 'کاهش بار مرده', v: wt - wl, u: 'کیلوگرم' }, { l: 'کاهش نسبی', v: (wt - wl) / wt * 100, u: '٪' }, { l: 'کاهش بار روی سطح', v: (wt - wl) / A * 9.80665 / 1000, u: 'kN/m²' }); }
    }
  } else if (k === 'block') {
    const net = Math.max(0, P(v.A) - P(v.o)), j = P(v.j) / 10, bl = P(v.bl), bh = P(v.bh), bt = P(v.bt);
    if (net && bl && bh) {
      const n0 = net / (((bl + j) / 100) * ((bh + j) / 100)); o.push({ l: 'مساحت خالص دیوار', v: net, u: 'متر مربع' }, { l: 'تعداد بلوک (با ضایعات)', v: Math.ceil(n0 * w), u: 'عدد', add: 1 }, { l: 'بلوک در هر م²', v: n0 / net, u: 'عدد' });
      if (bt) { const mv = Math.max(0, net * bt / 100 - n0 * bl * bh * bt / 1e6) * w; o.push({ l: 'حجم ملات (با ضایعات)', v: mv, u: 'متر مکعب', add: 1 }, { l: 'حجم ملات', v: mv * 1000, u: 'لیتر' }); }
    }
  } else {
    if (P(v.A) && P(v.t) && P(v.ref)) { const kg = P(v.A) * P(v.t) / 10 * P(v.ref) * w; o.push({ l: 'وزن گچ (با ضایعات)', v: kg, u: 'کیلوگرم' }); if (P(v.bag)) o.push({ l: 'تعداد کیسه', v: Math.ceil(kg / P(v.bag)), u: 'کیسه', add: 1 }); }
    if (P(v.Ap) && P(v.pw) && P(v.ph)) { const net = Math.max(0, P(v.Ap) - P(v.po)), n = Math.ceil(net / (P(v.pw) * P(v.ph)) * w); o.push({ l: 'تعداد پانل', v: n, u: 'عدد', add: 1 }, { l: 'مساحت پانل (با ضایعات)', v: net * w, u: 'متر مربع', add: 1 }); }
  }
  return o;
}
window.RQ = { geom, itemQty, calcRun, scoreCmp, takeoff, specNum, S };

/* ---------- انتخابگر محصول (شیت) ---------- */
function pickList() {
  const q = S.pick.q.trim(), f = S.pick.filter;
  const h = D.companies.map(c => { const ps = c.products.filter(p => f(p, c) && (!q || (p.name + c.name + (p.group || '')).includes(q))); return ps.length ? `<div class="grp">${esc(c.name)}</div>` + ps.map(p => `<button type="button" class="pkr" data-x="pk" data-pid="${p.id}">${thumb(c, p)}<span><b>${esc(p.name)}</b><small>${esc(p.group || '')} · ${esc(p.unit)}</small></span></button>`).join('') : ''; }).join('');
  return h || '<div class="empty"><p>محصولی پیدا نشد</p></div>';
}
function pick(title, filter, cb, note) {
  S.pick = { q: '', filter, cb };
  sheet(`<h3 style="margin:4px 0 8px;color:var(--ink)">${title}</h3>${note ? `<p class="hint">${note}</p>` : ''}<div class="fl" style="margin-bottom:8px"><input type="search" data-i="ps" placeholder="جست‌وجو…" autocomplete="off"></div><div id="pkL">${pickList()}</div>`);
}

/* ---------- متره ---------- */
function roomCard(r) {
  const F = (k, l) => `<label class="fl"><span>${l}</span><input inputmode="decimal" data-i="room" data-rid="${r.id}" data-k="${k}" value="${esc(r[k])}"></label>`;
  const G = (k, l) => `<span>${l} <b data-g="${r.id}:${k}"></b></span>`;
  return `<div class="rm"><div class="rm-h"><input class="rm-n" data-i="room" data-rid="${r.id}" data-k="name" value="${esc(r.name)}" aria-label="نام فضا"><div class="stp"><button type="button" class="sq" data-x="rn" data-rid="${r.id}" data-d="-1" aria-label="کمتر">−</button><b>${fa(r.n)}×</b><button type="button" class="sq pl" data-x="rn" data-rid="${r.id}" data-d="1" aria-label="بیشتر">＋</button></div></div>
  <div class="rw">${F('L', 'طول (م)')}${F('W', 'عرض (م)')}${F('H', 'ارتفاع (م)')}</div>
  <div class="grp sm">بازشوها — از دیوار کسر می‌شود</div>
  <div class="rw">${F('dn', 'تعداد در')}${F('dw', 'عرض در (م)')}${F('dh', 'ارتفاع در (م)')}</div>
  <div class="rw">${F('wn', 'تعداد پنجره')}${F('ww', 'عرض پنجره (م)')}${F('wh', 'ارتفاع پنجره (م)')}</div>
  <div class="gm">${G('floor', 'کف')}${G('wall', 'دیوار خالص')}${G('ceiling', 'سقف')}${G('vol', 'حجم')}${G('per', 'محیط')}</div><div class="wr" data-gw="${r.id}" hidden></div>
  <div class="grp sm">مصالح این اتاق</div>${r.items.map(i => itemRow(r, i)).join('') || '<div class="hint">هنوز مصالحی اختصاص داده نشده.</div>'}
  <div class="ft"><button type="button" class="act act-primary" data-x="iadd" data-rid="${r.id}">＋ مصالح</button><button type="button" class="act" data-x="rpk" data-rid="${r.id}">پکیج آماده</button><button type="button" class="act" data-x="rdup" data-rid="${r.id}">کپی اتاق</button><button type="button" class="act" data-x="rdel" data-rid="${r.id}" style="color:var(--danger)">حذف</button></div></div>`;
}
function itemRow(r, i) {
  const [c, p] = find(i.pid); if (!p) return '';
  const a = `data-i="item" data-rid="${r.id}" data-iid="${i.id}"`; let ctl;
  if (p.mode === 'count') ctl = `<div class="fl"><span>تعداد در هر اتاق</span><div class="stp"><button type="button" class="sq" data-x="iq" data-rid="${r.id}" data-iid="${i.id}" data-d="-1">−</button><b>${fa(i.q)}</b><button type="button" class="sq pl" data-x="iq" data-rid="${r.id}" data-iid="${i.id}" data-d="1">＋</button></div></div>`;
  else ctl = `<label class="fl"><span>سطح اجرا</span><select ${a} data-k="on">${Object.entries(SURF).map(([k, l]) => `<option value="${k}" ${(i.on || defSurf(p)) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` + (p.mode === 'area' ? `<label class="fl"><span>مصرف هر م²</span><input inputmode="decimal" ${a} data-k="per" value="${esc(i.per)}" placeholder="${fa(p.perM2 || 1)}"></label>` : `<label class="fl"><span>ضخامت (cm)</span><input inputmode="decimal" ${a} data-k="th" value="${esc(i.th)}" placeholder="${fa(p.def || 5)}"></label>`);
  return `<div class="it"><div class="it-t"><b>${esc(p.name)}</b><em>${esc(c.name)}</em><button type="button" class="sq dg" data-x="irm" data-rid="${r.id}" data-iid="${i.id}" aria-label="حذف">✕</button></div><div class="rw">${ctl}</div><small class="iq" data-iq="${i.id}"></small></div>`;
}
function matList() {
  const T = takeoff('mid'); if (!T.lines.length) return '';
  return `<div class="grp">فهرست مصالح (سناریوی متوسط)</div>` + T.lines.map(l => `<div class="ln"><h4><span>${esc(l.p.name)}</span><em>${esc(l.c.name)}</em></h4><div class="rw"><label class="fl"><span>قیمت هر ${esc(l.p.unit)} (تومان)${l.p.price && !(S.px[l.p.id] > 0) ? ' — ثبت‌شده' : ''}</span><input inputmode="decimal" data-i="px" data-pid="${l.p.id}" value="${S.px[l.p.id] > 0 ? S.px[l.p.id] : ''}" placeholder="${l.p.price ? fa(l.p.price) : 'وارد کن'}"></label></div><div class="lt"><small data-mq="${l.p.id}"></small><span data-mc="${l.p.id}"></span></div></div>`).join('');
}
function roomView() {
  const head = `<div class="rw proj"><label class="fl"><span>نام پروژه</span><input data-i="pj" data-k="name" value="${esc(S.proj.name)}" placeholder="مثلاً آپارتمان ۱۲۰ متری"></label><label class="fl"><span>کارفرما</span><input data-i="pj" data-k="client" value="${esc(S.proj.client)}"></label></div>`;
  const add = `<div class="ft"><button type="button" class="act act-primary" data-x="radd">＋ اتاق جدید</button></div>`;
  if (!S.rooms.length) return head + '<div class="empty"><div class="empty-icon">📐</div><p>ابعاد اتاق را بده تا کف، دیوار خالص و سقف حساب شود؛ بعد مصالح را به سطوح اختصاص بده.</p></div>' + add;
  return head + S.rooms.map(roomCard).join('') + add + matList() + `<div class="tot" id="rmTot"><div class="rw" style="margin:0 0 8px"><label class="fl"><span>ضایعات (٪)</span><input inputmode="decimal" data-g="waste" value="${S.cfg.waste}"></label><label class="fl"><span>اجرت و متفرقه (٪)</span><input inputmode="decimal" data-g="labor" value="${S.cfg.labor}"></label></div><div class="r"><span>جمع مصالح</span><b id="rSum"></b></div><div class="r"><span>اجرت و متفرقه</span><b id="rLab"></b></div><div class="g"><span>برآورد (متوسط)</span><span id="rAll"></span></div><div class="wr" id="rWr" hidden></div></div><div id="rmScn"></div><div class="ft"><button type="button" class="act" data-x="scs">شخصی‌سازی جایگزین‌ها</button><button type="button" class="act" data-x="toest">انتقال به برآورد</button><button type="button" class="act act-primary" data-x="xsh">${I.pdf}<span>برگه‌ی پیشنهاد (PDF)</span></button></div>`;
}
function scnCards() {
  const R = TIERS.map(([k, l]) => ({ k, l, ...takeoff(k) })), mid = R[1];
  const cards = R.map(s => {
    const d = s.k !== 'mid' && s.sum > 0 && mid.sum > 0 ? s.tot - mid.tot : null;
    const diff = s.k === 'mid' ? '<i>مبنا</i>' : d === null ? '<i>قیمت کافی نیست</i>' : `<i class="${d < 0 ? 'dn' : d > 0 ? 'up' : ''}">${fa(Math.round(Math.abs(d)))} ${d < 0 ? 'کمتر' : d > 0 ? 'بیشتر' : 'برابر'} (${fa(Math.round(Math.abs(d / mid.tot * 100)))}٪)</i>`;
    return `<div class="sc ${s.k}"><h5>${s.l}</h5><b>${s.sum > 0 ? fa(Math.round(s.tot)) : '—'}</b><small>تومان</small>${diff}<em>سرعت اجرا: ${s.spn ? fa(R2(s.sp)) + ' از ۵' : 'ثبت‌نشده'}</em><em>${fa(s.swaps)} قلم جایگزین</em></div>`;
  }).join('');
  return `<div class="grp">سه سناریو کنار هم</div><div class="scn">${cards}</div><p class="hint">اقتصادی و لوکس: اگر ادمین رده تعیین کرده باشد همان؛ وگرنه ارزان‌ترین/گران‌ترین جایگزینِ هم‌گروه که قیمت دارد. سرعت اجرا فقط از امتیازهای ثبت‌شده‌ی رواق میانگین می‌شود. برای هر قلم می‌توانی دستی عوض کنی.</p>`;
}
function paintRoom() {
  const setT = (sel, v) => { const e = document.querySelector(sel); if (e) e.textContent = v; };
  S.rooms.forEach(r => {
    const g = geom(r), n = Math.max(1, P(r.n) || 1);
    setT(`[data-g="${r.id}:floor"]`, nf(g.floor * n) + ' م²'); setT(`[data-g="${r.id}:wall"]`, nf(g.wall * n) + ' م²'); setT(`[data-g="${r.id}:ceiling"]`, nf(g.ceiling * n) + ' م²'); setT(`[data-g="${r.id}:vol"]`, nf(g.vol * n) + ' م³'); setT(`[data-g="${r.id}:per"]`, nf(g.per) + ' م');
    const w = document.querySelector(`[data-gw="${r.id}"]`); if (w) { w.hidden = !g.over; w.textContent = g.over ? 'مساحت بازشوها از سطح دیوار بیشتر است؛ ابعاد را بررسی کن.' : ''; }
    r.items.forEach(i => { const p = find(i.pid)[1]; if (p) setT(`[data-iq="${i.id}"]`, 'مقدار: ' + nf(itemQty(r, i, p, true)) + ' ' + p.unit + (p.mode !== 'count' ? ` (با ${fa(P(S.cfg.waste))}٪ ضایعات)` : '')); });
  });
  const T = takeoff('mid');
  T.lines.forEach(l => { setT(`[data-mq="${l.p.id}"]`, 'مقدار کل: ' + nf(l.q) + ' ' + l.p.unit); setT(`[data-mc="${l.p.id}"]`, l.price ? fa(Math.round(l.cost)) + ' تومان' : 'استعلام'); });
  setT('#rSum', fa(Math.round(T.sum)) + ' تومان'); setT('#rLab', fa(Math.round(T.lab)) + ' تومان'); setT('#rAll', fa(Math.round(T.tot)) + ' تومان');
  const wr = $('#rWr'); if (wr) { wr.hidden = !T.miss; wr.textContent = T.miss ? `${fa(T.miss)} قلم بدون قیمت است و در جمع نیامده.` : ''; }
  const sc = $('#rmScn'); if (sc) sc.innerHTML = scnCards();
  const b = document.querySelector('[data-tab="room"] b'); if (b) b.textContent = fa(S.rooms.length);
}
function scnSheet() {
  const rows = []; S.rooms.forEach(r => r.items.forEach(i => { const p = find(i.pid)[1]; if (p) rows.push([r, i, p]); }));
  if (!rows.length) return toast('ابتدا مصالحی به اتاق‌ها اضافه کن');
  sheet(`<h3 style="margin:4px 0 6px;color:var(--ink)">جایگزین‌ها در هر سناریو</h3><p class="hint">جایگزین‌ها از همان گروه و همان واحد محصول‌اند.</p>` + rows.map(([r, i, p]) => { const a = alts(p); return `<div class="ln"><h4><span>${esc(p.name)}</span><em>${esc(r.name)}</em></h4>${TIERS.map(([k, l]) => { const cur = pickFor(i, p, k); return `<label class="fl" style="margin-top:6px"><span>${l}</span><select data-i="sk" data-iid="${i.id}" data-t="${k}">${a.map(x => `<option value="${x.id}" ${x.id === cur.id ? 'selected' : ''}>${esc(x.name)}${priceOf(x) ? ' — ' + fa(priceOf(x)) : ''}</option>`).join('')}</select></label>`; }).join('')}</div>`; }).join('') + `<div class="sd-bar"><button type="button" class="act" data-x="scr">بازنشانی به خودکار</button><button type="button" class="act act-primary" data-x="scok">تمام</button></div>`);
}

/* ---------- مقایسه‌گر ---------- */
function cmpView() {
  const W = [['price', 'قیمت'], ['dur', 'دوام'], ['spd', 'سرعت اجرا'], ['av', 'دسترسی']];
  return `<div class="grp">وزن معیارها (۰ = نادیده)</div><div class="wts">${W.map(([k, l]) => `<label class="wt"><span>${l} <b data-wv="${k}">${fa(S.w[k])}</b></span><input type="range" min="0" max="5" step="1" value="${S.w[k]}" data-i="w" data-k="${k}"></label>`).join('')}</div><div id="cmpT"></div>`;
}
function paintCmp() {
  const box = $('#cmpT'); if (!box) return;
  const it = S.cmp.map(find).filter(x => x[1]), ps = it.map(x => x[1]);
  const add = ps.length < 3 ? `<button type="button" class="act act-primary" data-x="cmpadd">＋ افزودن محصول</button>` : '';
  if (ps.length < 2) { box.innerHTML = `<div class="empty"><div class="empty-icon">⇄</div><p>دو تا سه محصول انتخاب کن تا کنار هم مقایسه شوند.<br>روی ⇄ کنار هر محصول هم می‌توانی بزنی.</p>${ps.length ? `<p><b>${esc(ps[0].name)}</b> انتخاب شده</p>` : ''}${add}</div>`; return; }
  const sc = scoreCmp(ps), win = (vals, dir) => { const ok = vals.filter(v => v != null); if (ok.length < 2) return []; const best = dir === 'lo' ? Math.min(...ok) : Math.max(...ok); const w = vals.map((v, i) => v === best ? i : -1).filter(i => i >= 0); return w.length === ps.length ? [] : w; };
  const row = (lab, cells, w, extra) => `<tr><th scope="row">${lab}</th>${cells.map((c, i) => `<td class="${w.includes(i) ? 'win' : ''}">${c}</td>`).join('')}</tr>${extra || ''}`;
  const sameU = ps.every(p => p.unit === ps[0].unit), pv = ps.map(p => priceOf(p) > 0 ? priceOf(p) : null);
  let h = `<div class="cmpw"><table class="cmp"><thead><tr><th></th>${it.map(([c, p]) => `<th>${logoBox(c, 'mono sm')}<b>${esc(p.name)}</b><small>${esc(c.name)}</small><button type="button" class="sq dg" data-x="cmp" data-pid="${p.id}" aria-label="حذف از مقایسه">✕</button></th>`).join('')}</tr></thead><tbody>`;
  if (sc.score) { const mx = Math.max(...sc.score); h += `<tr class="scr"><th>امتیاز وزنی</th>${sc.score.map(s => `<td class="${s === mx ? 'win' : ''}"><b>${fa(Math.round(s))}</b><div class="bar2"><i style="width:${Math.round(s)}%;background:var(--accent)"></i></div>${s === mx ? '👑' : ''}</td>`).join('')}</tr>`; }
  h += row('قیمت', ps.map((p, i) => pv[i] ? fa(pv[i]) + ' <small>/ ' + esc(p.unit) + '</small>' : 'استعلام'), sameU ? win(pv, 'lo') : []);
  h += row('دوام', ps.map(p => p.durability ? fa(p.durability) + ' از ۵' : 'ثبت‌نشده'), win(ps.map(p => p.durability || null), 'hi'));
  h += row('سرعت اجرا', ps.map(p => p.speed ? fa(p.speed) + ' از ۵' : 'ثبت‌نشده'), win(ps.map(p => p.speed || null), 'hi'));
  h += row('دسترسی', ps.map(p => esc(p.availability || 'نامشخص')), win(ps.map(p => AV[p.availability] || null), 'hi'));
  const keys = []; ps.forEach(p => (p.specs || []).forEach(s => { if (!keys.includes(s.k)) keys.push(s.k); }));
  keys.forEach(k => { const vs = ps.map(p => { const s = (p.specs || []).find(x => x.k === k); return s ? s.v : null; }), dir = S.dir[k] || '', nums = vs.map(v => v == null ? null : specNum(v)); h += row(`${esc(k)}<button type="button" class="dirb ${dir}" data-x="dir" data-k="${esc(k)}" aria-label="جهت برتری">${dir === 'hi' ? '▲ بیشتر بهتر' : dir === 'lo' ? '▼ کمتر بهتر' : '± جهت؟'}</button>`, vs.map(v => v == null ? '—' : esc(v)), dir ? win(nums, dir) : []); });
  h += row('نشان اطمینان', ps.map(p => p.confidence ? `<span class="cf ${esc(p.confidence)}">${esc(CONF[p.confidence] || '')}</span>` : '<span class="cf">ثبت‌نشده</span>'), []);
  h += row('منبع / بررسی', ps.map(p => (p.source ? esc(p.source) : '—') + (p.lastVerified ? `<small> · ${esc(p.lastVerified)}</small>` : '')), []);
  h += `</tbody></table></div>`;
  const nm = { price: 'قیمت', dur: 'دوام', spd: 'سرعت', av: 'دسترسی' };
  const notes = [];
  if (sc.skipped.length) notes.push('در امتیاز نیامد (داده یا واحد یکسان ندارند): ' + sc.skipped.map(k => nm[k]).join('، '));
  if (!sc.score) notes.push('امتیازی محاسبه نشد؛ داده‌ی کافی برای معیارهای با وزن مثبت نیست.');
  notes.push('برنده‌ی ردیف‌های مشخصات فنی فقط بعد از انتخاب جهت برتری (▲/▼) نشان داده می‌شود؛ واحد اعداد را خودت هم بررسی کن.');
  box.innerHTML = h + `<p class="hint">${notes.join('<br>')}</p><div class="ft">${add}<button type="button" class="act" data-x="cmpclr" style="color:var(--danger)">پاک‌کردن مقایسه</button></div>`;
}

/* ---------- ماشین‌حساب‌ها ---------- */
function densHint() {
  for (const c of D.companies) for (const p of c.products) for (const s of (p.specs || [])) if (/چگالی|دانسیته|وزن مخصوص/.test(s.k) && /kg|کیلو/i.test(s.v) && specNum(s.v) != null) return { p, v: specNum(s.v), src: p.source };
  return null;
}
function calcView() {
  const k = S.cc.k, d = CDEF[k], v = S.cc.v[k], dh = k === 'floor' ? densHint() : null;
  return `<div class="chips" style="margin:14px 0 6px">${Object.entries(CDEF).map(([id, x]) => `<button type="button" class="chip ${id === k ? 'active' : ''}" data-x="cc" data-k="${id}">${x.t}</button>`).join('')}</div><p class="hint">اعداد فنی (چگالی، مصرف مرجع، ابعاد) را از دیتاشیت وارد کن؛ رواق عدد فنی از خودش نمی‌گذارد. خروجی‌ها خالی‌اند تا ورودی‌ها کامل شود.</p><div class="rw">${d.f.map(([f, l]) => `<label class="fl" style="min-width:${l.length > 28 ? '100%' : '140px'}"><span>${l}</span><input inputmode="decimal" data-i="calc" data-k="${f}" value="${esc(v[f])}"></label>`).join('')}</div>${dh ? `<button type="button" class="act" data-x="cfill" style="margin-top:8px">برداشتن چگالی «${esc(dh.p.name)}» از شناسنامه (${fa(dh.v)})${dh.src ? ' — ' + esc(dh.src) : ''}</button>` : ''}<div class="tot" id="cOut"></div>`;
}
function paintCalc() {
  const b = $('#cOut'); if (!b) return; S.cres = calcRun(S.cc.k, S.cc.v[S.cc.k]);
  b.innerHTML = S.cres.length ? S.cres.map((o, i) => `<div class="co"><span>${o.l}</span><b>${nf(o.v)} ${o.u}</b>${o.add ? `<button type="button" class="sq pl" data-x="cadd" data-o="${i}" aria-label="افزودن به برآورد">＋</button>` : ''}</div>`).join('') : '<div class="hint" style="margin:0">ورودی‌ها را کامل کن تا نتیجه نمایش داده شود.</div>';
}

/* ---------- برگه‌ی پیشنهاد (بوم → JPEG → PDF روی سرور با Pillow) ---------- */
const loadImg = u => new Promise(res => { const i = new Image(); const t = setTimeout(() => res(null), 6000); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); res(null); }; i.src = u; });
async function makeSheet(tk) {
  const WD = 1240, HT = 1754, M = 72, IN = WD - 2 * M, F = "'Vazirmatn',Tahoma,sans-serif", INK = '#1A1714', DIM = '#5A5347', AC = '#0B8468', LN = '#DAD3C7';
  try { await document.fonts.load('700 28px Vazirmatn'); await document.fonts.load('400 22px Vazirmatn'); } catch (e) {}
  const T = takeoff(tk), all = TIERS.map(([k, l]) => ({ k, l, ...takeoff(k) })), pages = []; let cv, x, y;
  const imgs = {}; await Promise.all(T.lines.map(async l => { const m = (l.p.images || [])[0]; imgs[l.p.id] = m ? await loadImg(mUrl(m, 't')) : null; }));
  const tx = (s, xr, yy, sz, wt, col, al, mw) => { x.font = `${wt || 400} ${sz}px ${F}`; x.fillStyle = col || INK; x.textAlign = al || 'right'; x.direction = 'rtl'; let t = String(s); if (mw) while (x.measureText(t).width > mw && t.length > 3) t = t.slice(0, -2); x.fillText(t === String(s) ? t : t + '…', xr, yy); };
  const wrap = (s, mw, sz, wt) => { x.font = `${wt || 400} ${sz}px ${F}`; const ws = String(s).split(/\s+/), out = []; let cur = ''; ws.forEach(w => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > mw && cur) { out.push(cur); cur = w; } else cur = t; }); if (cur) out.push(cur); return out; };
  const rr = (a, b, w, h, r, fill, stroke) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); } };
  const sec = (t) => { rr(WD - M - 8, y, 8, 34, 4, AC); tx(t, WD - M - 24, y + 28, 30, 800, INK); y += 92; };
  const newPage = first => {
    cv = document.createElement('canvas'); cv.width = WD; cv.height = HT; x = cv.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, WD, HT); pages.push(cv);
    if (first) {
      rr(0, 0, WD, 210, 0, AC); x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.arc(150, 20, 190, 0, 7); x.fill();
      rr(WD - M - 84, 52, 84, 84, 24, '#FFFFFF'); tx('ر', WD - M - 42, 112, 58, 900, AC, 'center');
      tx('برگه‌ی پیشنهاد مصالح', WD - M - 108, 96, 50, 800, '#FFFFFF'); tx('رواق — مرجع فایل‌های معماری و عمران', WD - M - 108, 138, 22, 500, 'rgba(255,255,255,.85)');
      tx(new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long' }).format(new Date()), M, 96, 24, 600, '#FFFFFF', 'left');
      y = 262; tx('پروژه: ' + (S.proj.name || '—'), WD - M, y, 28, 700, INK); tx('کارفرما: ' + (S.proj.client || '—'), M, y, 28, 500, DIM, 'left'); y += 30; x.fillStyle = LN; x.fillRect(M, y, IN, 2); y += 46;
    } else y = 90;
  };
  const room = () => { if (y > HT - 260) newPage(false); };
  newPage(true);
  sec('خلاصه‌ی فضاها');
  const cw = [IN - 3 * 170 - 230, 170, 170, 230, 170], hd = ['فضا', 'تعداد', 'کف (م²)', 'دیوار خالص (م²)', 'سقف (م²)'];
  const trow = (cells, bold, bg) => { room(); if (bg) rr(M, y - 34, IN, 52, 10, bg); let xr = WD - M; cells.forEach((c, i) => { tx(c, xr - 14, y, 22, bold ? 800 : 500, bold ? INK : DIM, 'right', cw[i] - 24); xr -= cw[i]; }); y += 54; };
  trow(hd, 1, '#F2EEE8'); S.rooms.forEach(r => { const g = geom(r), n = Math.max(1, P(r.n) || 1); trow([r.name, fa(n), nf(g.floor * n), nf(g.wall * n), nf(g.ceiling * n)]); });
  y += 24; room(); sec('مقایسه‌ی سه سناریو');
  const bw = (IN - 40) / 3; all.forEach((s, i) => { const bx = WD - M - bw - i * (bw + 20), on = s.k === tk; rr(bx, y, bw, 196, 22, on ? '#E8F5F1' : '#F7F4EE', on ? AC : LN); tx(s.l + (s.k === 'mid' ? ' (مبنا)' : ''), bx + bw - 22, y + 44, 26, 800, on ? AC : INK);
    tx(s.sum > 0 ? fa(Math.round(s.tot)) : '—', bx + bw - 22, y + 100, 38, 900, INK); tx('تومان', bx + 22, y + 100, 20, 500, DIM, 'left');
    const d = s.k !== 'mid' && s.sum > 0 && all[1].sum > 0 ? s.tot - all[1].tot : null; tx(s.k === 'mid' ? 'مبنای مقایسه' : d === null ? 'قیمت کافی نیست' : fa(Math.round(Math.abs(d))) + (d < 0 ? ' ارزان‌تر از متوسط' : d > 0 ? ' گران‌تر از متوسط' : ' برابر متوسط'), bx + bw - 22, y + 138, 21, 700, d === null || s.k === 'mid' ? DIM : d < 0 ? AC : '#C93C3C');
    tx('سرعت اجرا: ' + (s.spn ? fa(R2(s.sp)) + ' از ۵' : 'ثبت‌نشده'), bx + bw - 22, y + 172, 20, 500, DIM); }); y += 236;
  room(); sec('فهرست مصالح — سناریوی ' + TIERS.find(t => t[0] === tk)[1]);
  const mw = [130, IN - 130 - 190 - 200 - 220, 190, 200, 220], mh = ['', 'محصول', 'مقدار', 'قیمت واحد', 'هزینه'];
  { let xr = WD - M; rr(M, y - 34, IN, 52, 10, '#F2EEE8'); mh.forEach((c, i) => { tx(c, xr - 14, y, 22, 800, INK, 'right'); xr -= mw[i]; }); y += 64; }
  T.lines.forEach(l => {
    if (y > HT - 330) newPage(false);
    let xr = WD - M; const im = imgs[l.p.id];
    rr(xr - 118, y - 30, 108, 84, 14, '#F2EEE8', LN); if (im) { x.save(); rr(xr - 118, y - 30, 108, 84, 14); x.clip(); const k = Math.max(108 / im.width, 84 / im.height); x.drawImage(im, xr - 118 + (108 - im.width * k) / 2, y - 30 + (84 - im.height * k) / 2, im.width * k, im.height * k); x.restore(); } else tx((l.c.en || l.c.name || '؟')[0], xr - 64, y + 26, 40, 900, AC, 'center');
    xr -= mw[0]; tx(l.p.name, xr - 14, y, 25, 800, INK, 'right', mw[1] - 26); tx(l.c.name, xr - 14, y + 30, 20, 500, DIM, 'right', mw[1] - 26);
    tx((l.p.confidence ? CONF[l.p.confidence] : 'منبع ثبت نشده') + (l.p.source ? ' · ' + l.p.source : ''), xr - 14, y + 58, 17, 500, l.p.confidence === 'review' || !l.p.confidence ? '#C93C3C' : AC, 'right', mw[1] - 26);
    xr -= mw[1]; tx(nf(l.q) + ' ' + l.p.unit, xr - 14, y + 12, 22, 600, INK, 'right', mw[2] - 20); xr -= mw[2];
    tx(l.price ? fa(l.price) : 'استعلام', xr - 14, y + 12, 22, 600, l.price ? INK : '#C93C3C', 'right', mw[3] - 20); tx(S.px[l.p.id] > 0 ? 'قیمت واردشده' : l.price ? 'قیمت ثبت‌شده' : '', xr - 14, y + 42, 16, 500, DIM, 'right'); xr -= mw[3];
    tx(l.price ? fa(Math.round(l.cost)) : '—', xr - 14, y + 12, 24, 800, INK, 'right', mw[4] - 20);
    y += 100; x.fillStyle = LN; x.fillRect(M, y - 24, IN, 1);
  });
  y += 10; if (y > HT - 330) newPage(false);
  rr(M, y, IN, T.lab > 0 ? 200 : 150, 22, '#F7F4EE', LN); let ty = y + 52;
  const tl = (a, b, bold) => { tx(a, WD - M - 26, ty, bold ? 30 : 24, bold ? 900 : 500, bold ? INK : DIM); tx(b, M + 26, ty, bold ? 34 : 24, bold ? 900 : 600, bold ? AC : INK, 'left'); ty += bold ? 0 : 44; };
  tl('جمع مصالح', fa(Math.round(T.sum)) + ' تومان'); if (T.lab > 0) tl('اجرت و متفرقه (' + fa(P(S.cfg.labor)) + '٪)', fa(Math.round(T.lab)) + ' تومان'); ty += 6; tl('برآورد نهایی', fa(Math.round(T.tot)) + ' تومان', 1); y += (T.lab > 0 ? 200 : 150) + 30;
  if (T.miss) { if (y > HT - 170) newPage(false); wrap(`⚠ ${fa(T.miss)} قلم بدون قیمت است و در جمع نیامده (استعلام).`, IN, 22, 600).forEach(t => { tx(t, WD - M, y, 22, 600, '#C93C3C'); y += 34; }); }
  pages.forEach((c, i) => { x = c.getContext('2d'); x.fillStyle = LN; x.fillRect(M, HT - 110, IN, 2);
    wrap('برآورد تقریبی است و جایگزین استعلام رسمی نیست. مقدارها با ضایعات ' + fa(P(S.cfg.waste)) + '٪ محاسبه شده‌اند؛ هر قیمت یا مشخصات، منبع و نشان اطمینان دارد و مقدار ثبت‌نشده «استعلام» است.', IN - 240, 18, 400).slice(0, 2).forEach((t, k) => tx(t, WD - M, HT - 72 + k * 26, 18, 400, DIM)); tx('صفحه ' + fa(i + 1) + ' از ' + fa(pages.length), M, HT - 70, 20, 700, AC, 'left'); tx('@' + S.bot, M, HT - 40, 20, 600, DIM, 'left'); });
  return pages;
}
async function sendSheet(tk) {
  if (!S.rooms.some(r => r.items.length)) return toast('ابتدا اتاق و مصالح اضافه کن');
  toast('در حال ساخت برگه…');
  try {
    const pages = await makeSheet(tk), jp = pages.map(c => c.toDataURL('image/jpeg', .88));
    if (!TG || !TG.initData) { const a = document.createElement('a'); a.href = jp[0]; a.download = 'ravaq-sheet.jpg'; a.click(); return toast('خارج از تلگرام: صفحه‌ی اول دانلود شد'); }
    const r = await api('sheet', { method: 'POST', body: JSON.stringify({ title: S.proj.name, pages: jp }) });
    if (r.ok) { hp('medium'); sheet(`<div class="empty"><div class="empty-icon">✅</div><h3>برگه ارسال شد</h3><p>فایل PDF (${fa(pages.length)} صفحه) داخل چت ربات فرستاده شد.</p></div><div class="sd-bar"><button type="button" class="act" data-x="scok">ادامه</button><button type="button" class="act act-primary" data-x="tgclose">دیدن برگه در چت</button></div>`); } else toast('ارسال نشد: ' + (r.error || ''));
  } catch (e) { toast('خطا در ساخت یا ارسال برگه'); }
}

/* ---------- رویدادهای فاز ۲ ---------- */
const persist2 = () => { sv(K.rooms, S.rooms); sv(K.scn, S.scn); sv(K.px, S.px); sv(K.cmp, S.cmp); sv(K.w, S.w); sv(K.dir, S.dir); sv(K.proj, S.proj); sv(K.cc, S.cc); };
const rm = id => S.rooms.find(r => r.id === id), itm = (r, id) => r && r.items.find(i => i.id === id);
function addItem(r, p, q) { r.items.push({ id: uid(), pid: p.id, q: q || 1, on: defSurf(p) }); }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-x]'); if (!t) return; const d = t.dataset, r = rm(d.rid);
  switch (d.x) {
    case 'radd': S.rooms.push(newRoom(S.rooms.length + 1)); break;
    case 'rn': if (r) r.n = Math.max(1, (P(r.n) || 1) + Number(d.d)); break;
    case 'rdup': if (r) { const c = JSON.parse(JSON.stringify(r)); c.id = uid(); c.name = r.name + ' (کپی)'; c.items.forEach(i => (i.id = uid())); S.rooms.splice(S.rooms.indexOf(r) + 1, 0, c); } break;
    case 'rdel': if (r && confirm('این اتاق حذف شود؟')) S.rooms = S.rooms.filter(x => x !== r); else return; break;
    case 'iadd': return pick('افزودن مصالح به «' + esc(r.name) + '»', () => true, (p) => { addItem(r, p); persist2(); closeSheet(); render(); toast('اضافه شد'); });
    case 'rpk': if (!(D.packs || []).length) return toast('پکیجی ثبت نشده'); return sheet(`<h3 style="margin:4px 0 8px;color:var(--ink)">پکیج آماده برای «${esc(r.name)}»</h3><p class="hint">اقلام تعدادی با همان تعداد می‌آیند؛ اقلام متراژی/حجمی از سطح اتاق محاسبه می‌شوند.</p>${D.packs.map(k => `<button type="button" class="pk" style="width:100%;margin-bottom:8px" data-x="pkgo" data-rid="${r.id}" data-pk="${k.id}"><b>${esc(k.title)}</b><span>${esc(k.desc)}</span></button>`).join('')}`);
    case 'pkgo': { const k = D.packs.find(x => x.id === d.pk); let n = 0; k && r && k.items.forEach(it => { const p = find(it.p)[1]; if (p) { addItem(r, p, p.mode === 'count' ? it.q : 1); n++; } }); persist2(); closeSheet(); render(); return toast(fa(n) + ' قلم به اتاق اضافه شد'); }
    case 'iq': { const i = itm(r, d.iid); if (i) i.q = Math.max(1, P(i.q) + Number(d.d)); break; }
    case 'irm': if (r) r.items = r.items.filter(i => i.id !== d.iid); break;
    case 'scs': return scnSheet();
    case 'scr': S.scn = {}; persist2(); scnSheet(); return paintRoom();
    case 'scok': closeSheet(); return;
    case 'toest': { const T = takeoff('mid'); T.lines.forEach(l => addLine({ ...l.p, mode: 'count', price: priceOf(l.p) }, l.c, R2(l.q))); persist(); toast(fa(T.lines.length) + ' قلم به برآورد منتقل شد'); return tabs(); }
    case 'xsh': return sheet(`<div class="empty" style="padding-bottom:6px"><div class="empty-icon">📄</div><h3>برگه‌ی پیشنهاد مصالح</h3><p>PDF برندشده‌ی رواق با خلاصه‌ی فضاها، مقایسه‌ی سه سناریو و فهرست مصالح (با عکس، منبع و نشان اطمینان) داخل چت ربات ارسال می‌شود. کدام سناریو با جزئیات چاپ شود؟</p></div><div class="sd-bar" style="flex-wrap:wrap">${TIERS.map(([k, l]) => `<button type="button" class="act ${k === 'mid' ? 'act-primary' : ''}" data-x="xgo" data-t="${k}">${l}</button>`).join('')}</div>`);
    case 'xgo': closeSheet(); sendSheet(d.t); return;
    case 'tgclose': try { TG.close(); } catch (x) {} return;
    case 'pk': { const p = find(d.pid)[1], cb = S.pick && S.pick.cb; if (p && cb) cb(p, find(d.pid)[0]); return; }
    case 'cmp': { const i = S.cmp.indexOf(d.pid); if (i >= 0) S.cmp.splice(i, 1); else if (S.cmp.length >= 3) return toast('حداکثر ۳ محصول را می‌شود مقایسه کرد'); else S.cmp.push(d.pid); persist2(); hp(); if (t.classList.contains('sq') && S.tab !== 'cmp') t.classList.toggle('on', i < 0); if (S.tab === 'cmp') paintCmp(); tabs(); return toast(i >= 0 ? 'از مقایسه برداشته شد' : 'به مقایسه اضافه شد'); }
    case 'cmpadd': return pick('افزودن به مقایسه', p => !S.cmp.includes(p.id), p => { if (S.cmp.length < 3) S.cmp.push(p.id); persist2(); closeSheet(); paintCmp(); tabs(); });
    case 'cmpclr': S.cmp = []; persist2(); paintCmp(); return tabs();
    case 'dir': S.dir[d.k] = S.dir[d.k] === 'hi' ? 'lo' : S.dir[d.k] === 'lo' ? '' : 'hi'; persist2(); return paintCmp();
    case 'cc': S.cc.k = d.k; persist2(); return render();
    case 'cfill': { const h = densHint(); if (h) { S.cc.v.floor.dl = String(h.v); persist2(); render(); toast('چگالی از شناسنامه برداشته شد'); } return; }
    case 'cadd': { const o = S.cres[Number(d.o)]; if (!o) return; return pick('افزودن «' + esc(o.l) + '» به برآورد', p => p.unit === o.u, (p, c) => { addLine({ ...p, mode: 'count', price: priceOf(p) }, c, R2(o.v)); persist(); closeSheet(); toast('به برآورد اضافه شد'); tabs(); }, `مقدار ${nf(o.v)} ${o.u}؛ فقط محصولاتی با واحد «${o.u}» نشان داده می‌شوند.`); }
    default: return;
  }
  persist2(); render();
});
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset, k = d.i;
  if (t.dataset.g && S.tab === 'room') return paintRoom();
  if (t.dataset.g && S.tab === 'calc') return paintCalc();
  if (!k) return;
  if (k === 'ps') { S.pick.q = t.value; $('#pkL').innerHTML = pickList(); return; }
  if (k === 'pj') { S.proj[d.k] = t.value; return persist2(); }
  if (k === 'room') { const r = rm(d.rid); if (r) r[d.k] = t.value; persist2(); return paintRoom(); }
  if (k === 'item') { const i = itm(rm(d.rid), d.iid); if (i) i[d.k] = t.value; persist2(); return paintRoom(); }
  if (k === 'px') { const v = num(t.value); if (v > 0) S.px[d.pid] = v; else delete S.px[d.pid]; persist2(); return paintRoom(); }
  if (k === 'sk') { (S.scn[d.iid] = S.scn[d.iid] || {})[d.t] = t.value; persist2(); return paintRoom(); }
  if (k === 'w') { S.w[d.k] = Number(t.value); const b = document.querySelector(`[data-wv="${d.k}"]`); if (b) b.textContent = fa(S.w[d.k]); persist2(); return paintCmp(); }
  if (k === 'calc') { S.cc.v[S.cc.k][d.k] = t.value; persist2(); return paintCalc(); }
});

/* ---------- رویدادها ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('a[data-stop]')) return;
  const t = e.target.closest('[data-x],[data-logo],[data-prod],[data-rmimg],[data-tab],[data-cat],[data-brand],[data-add],[data-fav],[data-pack],[data-st],[data-rm],[data-ep],[data-dp],[data-a],#sdScrim,#themeBtn,#editBtn,#searchClear,#toTop');
  if (!t || t.dataset.x) return; const d = t.dataset, id = t.id;
  if (id === 'sdScrim') return closeSheet();
  if (id === 'themeBtn') { const r = document.documentElement, cur = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'), nx = cur === 'light' ? 'dark' : 'light'; r.setAttribute('data-theme', nx); try { localStorage.setItem(K.th, nx); } catch (x) {} return hp(); }
  if (id === 'editBtn') { S.edit = !S.edit; toast(S.edit ? 'حالت ویرایش روشن شد' : 'حالت ویرایش خاموش شد'); return render(); }
  if (id === 'searchClear') { $('#search').value = ''; S.q = ''; t.hidden = true; return render(); }
  if (id === 'toTop') return scrollTo({ top: 0, behavior: 'smooth' });
  if (d.logo) { S.brand = S.brand === d.logo ? '' : d.logo; hp(); return render(); }
  if (d.prod) { hp(); return openProd(d.prod); }
  if (d.tab) { S.tab = d.tab; hp(); render(); return scrollTo({ top: 0 }); }
  if (d.cat) { S.cat = S.cat === d.cat ? '' : d.cat; hp(); return render(); }
  if (d.brand) { hp(); return openBrand(d.brand); }
  if (d.add) { const [c, p] = find(d.add); addLine(p, c); hp('medium'); toast(`«${p.name}» به برآورد اضافه شد`); return tabs(); }
  if (d.fav) { const i = S.fav.indexOf(d.fav); i < 0 ? S.fav.push(d.fav) : S.fav.splice(i, 1); persist(); hp(); t.classList.toggle('on', i < 0); t.setAttribute('aria-pressed', i < 0); tabs(); if (S.tab === 'fav') render(); return; }
  if (d.pack) { const k = D.packs.find(x => x.id === d.pack); let n = 0; k.items.forEach(it => { const [c, p] = find(it.p); if (p) { addLine(p, c, it.q); n++; } }); hp('medium'); toast(`${fa(n)} قلم اضافه شد`); return render(); }
  if (d.st) { const l = S.est.find(x => x.id === d.st); l.q = Math.max(1, l.q + Number(d.d)); persist(); hp(); return render(); }
  if (d.rm) { S.est = S.est.filter(l => l.id !== d.rm); persist(); return render(); }
  if (d.rmimg) { if (confirm('این عکس حذف شود؟')) rmMedia(S.cur, S.curP, d.rmimg).then(() => openProd(S.curP)); return; }
  const c = D.companies.find(x => x.id === (d.id || S.cur));
  if (d.ep) { const p = c.products.find(x => x.id === d.ep); return form('ویرایش محصول', PF, { ...p, specsT: specsText(p.specs), featuresT: (p.features || []).join('\n') }, o => { Object.assign(p, cleanP(o)); saveData(); }, () => openBrand(c.id), valP); }
  if (d.dp) { if (confirm('این محصول حذف شود؟')) { c.products = c.products.filter(x => x.id !== d.dp); S.fav = S.fav.filter(x => x !== d.dp); saveData(); persist(); openBrand(c.id); } return; }
  switch (d.a) {
    case 'tobrand': return openBrand(S.cur);
    case 'uplogo': return reqUpload('logo', c.id);
    case 'upimg': return reqUpload('image', c.id, t.dataset.pid);
    case 'rmlogo': if (confirm('لوگو حذف شود؟')) rmMedia(c.id, '', c.logo && c.logo.key).then(() => openBrand(c.id)); return;
    case 'shareprod': { const pp = find(t.dataset.pid)[1]; const u = 'https://t.me/share/url?url=' + encodeURIComponent(link(t.dataset.pid)) + '&text=' + encodeURIComponent(pp ? pp.name : ''); TG && TG.openTelegramLink ? TG.openTelegramLink(u) : window.open(u, '_blank'); return; }
    case 'goest': closeSheet(); S.tab = 'est'; render(); return scrollTo({ top: 0 });
    case 'clear': if (confirm('همه‌ی اقلام برآورد پاک شود؟')) { S.est = []; persist(); render(); } return;
    case 'share': { const u = 'https://t.me/share/url?url=' + encodeURIComponent(`https://t.me/${S.bot}?start=${S.start}`) + '&text=' + encodeURIComponent(summary()); TG && TG.openTelegramLink ? TG.openTelegramLink(u) : window.open(u, '_blank'); return; }
    case 'addco': return form('برند جدید', CF, { sponsor: false }, o => { const n = { id: uid(), products: [], ...o, catalog: safe(o.catalog) }; D.companies.push(n); saveData(); render(); });
    case 'editco': return form('ویرایش برند', CF, c, o => { Object.assign(c, o, { catalog: safe(o.catalog) }); saveData(); render(); }, () => openBrand(c.id));
    case 'delco': if (confirm('این برند و همه‌ی محصولاتش حذف شود؟')) { D.companies = D.companies.filter(x => x !== c); saveData(); closeSheet(); render(); } return;
    case 'addp': return form('محصول جدید', PF, { mode: 'count' }, o => { c.products.push({ id: uid(), ...cleanP(o) }); saveData(); }, () => openBrand(c.id), valP);
    case 'fok': { const o = readForm(); if (!o.name) return toast('نام را وارد کن'); const er = S.val && S.val(o); if (er) return toast(er); const b = S.back, ok = S.ok; ok(o); if (b) b(); else closeSheet(); return render(); }
    case 'fno': return S.back ? S.back() : closeSheet();
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'search') { S.q = t.value; $('#searchClear').hidden = !t.value; clearTimeout(S.dt); S.dt = setTimeout(render, 160); return; }
  if (t.dataset.l) { const l = S.est.find(x => x.id === t.dataset.l); l[t.dataset.k] = num(t.value); persist(); return paint(); }
  if (t.dataset.g) { S.cfg[t.dataset.g] = num(t.value); persist(); paint(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('mc')) { e.preventDefault(); openBrand(e.target.dataset.brand); } if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pr2')) { e.preventDefault(); openProd(e.target.dataset.prod); } });
addEventListener('scroll', () => { $('#toTop').hidden = scrollY < 500; }, { passive: true });
try { const th = localStorage.getItem(K.th); th && document.documentElement.setAttribute('data-theme', th); } catch (e) {}

/* ---------- شروع ---------- */
render();
const deep = () => { try { const p = new URLSearchParams(location.search).get('p'); if (p && find(p)[1]) openProd(p); } catch (e) {} };
addEventListener('error', e => { const i = e.target; if (!i || i.tagName !== 'IMG') return; if (!i.dataset.r) { i.dataset.r = '1'; i.src = i.src + (i.src.includes('?') ? '&' : '?') + 'r=' + Date.now(); } else { i.style.display = 'none'; i.parentElement && i.parentElement.classList.add('bad'); } }, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' || !S.admin) return; const cp = S.curP, open = !$('#sd').hidden; reload().then(() => { render(); if (open && cp && find(cp)[1]) openProd(cp); }).catch(() => {}); });
api('data').then(r => { D = r.data; S.admin = !!r.admin; S.bot = r.bot || 'irarchitps_bot'; S.start = r.start || 'materials'; render(); deep(); }).catch(() => fetch('/materials/data/materials.json').then(r => r.json()).then(d => { D = d; render(); deep(); }));
})();