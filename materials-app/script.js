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
const K = { est: 'rq.mat.est', fav: 'rq.mat.fav', cfg: 'rq.mat.cfg', th: 'rq.mat.theme' };
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const COL = ['#6FE3C4', '#E3B26F', '#8AA2FF', '#E36F9A', '#B58AFF', '#7FD1E8'];
const S = { tab: 'cat', q: '', cat: '', edit: false, admin: false, est: ld(K.est, []), fav: ld(K.fav, []), cfg: ld(K.cfg, { waste: 5, labor: 0 }), back: null, brand: '', bot: 'irarchitps_bot', start: 'materials', curP: '' };
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
  const T = [['cat', 'کاتالوگ برندها', fa(D.companies.length)], ['est', 'برآورد پروژه', fa(S.est.length)], ['fav', 'ذخیره‌شده‌ها', fa(S.fav.length)]];
  $('#index').innerHTML = T.map((t, i) => `<button type="button" class="tile ${S.tab === t[0] ? 'on' : ''}" data-tab="${t[0]}" role="tab" aria-selected="${S.tab === t[0]}"><b>${t[2]}</b>${t[1]}</button>`).join('');
  $('#filters').hidden = S.tab !== 'cat';
  $('#editBtn').hidden = !S.admin; $('#editBtn').setAttribute('aria-pressed', S.edit);
}
function render() {
  tabs();
  const L = $('#list');
  if (S.tab === 'est') L.innerHTML = estView(); else if (S.tab === 'fav') L.innerHTML = favView(); else L.innerHTML = catView();
  if (S.tab === 'cat') { const cats = [...new Set(D.companies.map(c => c.cat).filter(Boolean))]; $('#chips').innerHTML = cats.map(c => `<button type="button" class="chip ${S.cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join(''); $('#logos').innerHTML = [...D.companies].sort((a, b) => (!!b.sponsor) - (!!a.sponsor)).map(c => `<button type="button" class="lgo ${S.brand === c.id ? 'on' : ''}" data-logo="${c.id}" aria-pressed="${S.brand === c.id}">${logoBox(c, 'lgb')}<small>${esc(c.name)}</small>${c.sponsor ? '<i class="spd" title="حامی رواق"></i>' : ''}</button>`).join(''); observe(); }
  if (S.tab === 'est') paint();
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
  return `<div class="pr2" data-prod="${p.id}" tabindex="0" role="button">${thumb(c, p)}<h4>${esc(p.name)}</h4>${p.desc ? `<small>${esc(p.desc)}</small>` : ''}${price}${(p.features || []).length ? `<div class="fch">${p.features.slice(0, 2).map(f => `<b>${esc(f)}</b>`).join('')}</div>` : ''}${warn}<div class="bt"><button type="button" class="sq pl" data-add="${p.id}" aria-label="افزودن به برآورد">＋</button><button type="button" class="sq ${on ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${on}" aria-label="ذخیره">${I.heart}</button>${safe(p.catalog) ? `<a class="sq" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener" aria-label="کاتالوگ محصول">${I.pdf.replace('<svg', '<svg width="17" height="17"')}</a>` : ''}${S.edit ? `<button type="button" class="sq" data-ep="${p.id}">✎</button><button type="button" class="sq dg" data-dp="${p.id}">✕</button>` : ''}</div></div>`;
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
  sheet(`<div class="sd-head"><button type="button" class="act" data-a="tobrand">‹ ${esc(c.name)}</button></div>${gal}<h3 style="margin:0 0 4px;font-size:18px;color:var(--ink)">${esc(p.name)}</h3>${p.desc ? `<p style="color:var(--ink-dim);font-size:13px;margin:0 0 8px">${esc(p.desc)}</p>` : ''}${price}${feats}<div class="grp">مشخصات فنی</div>${specs}${trace}
  ${S.edit ? `<div class="ft"><button type="button" class="act act-primary" data-a="upimg" data-id="${c.id}" data-pid="${p.id}">📷 افزودن عکس از ربات (${fa(imgs.length)}/۶)</button><button type="button" class="sq" data-ep="${p.id}">✎</button></div>` : ''}
  <div class="sd-bar" style="margin-top:12px"><button type="button" class="act act-primary" data-add="${p.id}">＋ برآورد</button><button type="button" class="act" data-fav="${p.id}" aria-pressed="${on}">${on ? '♥ ذخیره‌شده' : '♡ ذخیره'}</button><button type="button" class="act" data-a="shareprod" data-pid="${p.id}">اشتراک</button>${safe(p.catalog) ? `<a class="act" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener">${I.pdf}<span>کاتالوگ</span></a>` : ''}</div>`);
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
const PF = [['name', 'نام محصول'], ['group', 'گروه'], ['desc', 'توضیح', 'area'], ['unit', 'واحد (عدد، کیسه، م²…)'], ['price', 'قیمت روز (تومان)'], ['mode', 'نوع محاسبه', 'sel', [['count', 'تعدادی'], ['area', 'بر اساس متراژ'], ['vol', 'حجمی (متراژ × ضخامت)']]], ['perM2', 'مصرف هر م²'], ['def', 'ضخامت پیش‌فرض (cm)'], ['catalog', 'لینک کاتالوگ محصول'], ['availability', 'قابل تهیه در ایران؟', 'sel', [['', 'نامشخص'], ['داخلی', 'تولید داخل'], ['وارداتی', 'وارداتی'], ['معادل ایرانی', 'معادل ایرانی دارد']]], ['confidence', 'نشان اطمینان', 'sel', [['', 'انتخاب کن'], ['datasheet', 'تأییدشده با دیتاشیت'], ['field', 'تجربه‌ی اجرایی'], ['review', 'نیازمند بررسی']]], ['source', 'منبع (مثلاً دیتاشیت شرکت، نسخه)'], ['lastVerified', 'آخرین بررسی (مثلاً ۱۴۰۵/۰۷/۰۱)'], ['featuresT', 'ویژگی‌ها — هر خط یک ویژگی (از کاتالوگ)', 'area'], ['specsT', 'مشخصات فنی — هر خط «عنوان: مقدار»', 'area']];
function form(title, F, v, ok, back, val) {
  sheet(`<h3 style="margin:4px 0 10px;color:var(--ink)">${title}</h3><div class="rw">${F.map(([k, l, t, o]) => `<label class="fl" style="min-width:${t === 'area' ? '100%' : '140px'}"><span>${l}</span>${t === 'area' ? `<textarea data-f="${k}" rows="2">${esc(v[k])}</textarea>` : t === 'sel' ? `<select data-f="${k}">${o.map(x => `<option value="${x[0]}" ${v[k] === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select>` : t === 'chk' ? `<input type="checkbox" data-f="${k}" ${v[k] ? 'checked' : ''} style="width:24px;height:24px">` : `<input data-f="${k}" value="${esc(v[k])}">`}</label>`).join('')}</div><div class="sd-bar" style="margin-top:14px"><button type="button" class="act act-primary" data-a="fok">ذخیره</button><button type="button" class="act" data-a="fno">انصراف</button></div>`, back);
  S.ok = ok; S.val = val || null;
}
const readForm = () => { const o = {}; document.querySelectorAll('#sdPanel [data-f]').forEach(e => o[e.dataset.f] = e.type === 'checkbox' ? e.checked : e.value.trim()); return o; };
const cleanP = o => { const r = { ...o, price: num(o.price) || null, perM2: num(o.perM2) || null, def: num(o.def) || null, catalog: safe(o.catalog), specs: parseSpecs(o.specsT), features: String(o.featuresT || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 20) }; delete r.specsT; delete r.featuresT; return r; };
const valP = o => (parseSpecs(o.specsT).length || String(o.featuresT || '').trim() || num(o.price)) && !(o.source && o.confidence) ? 'برای قیمت یا مشخصات، «منبع» و «نشان اطمینان» را وارد کن' : '';

/* ---------- رویدادها ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('a[data-stop]')) return;
  const t = e.target.closest('[data-logo],[data-prod],[data-rmimg],[data-tab],[data-cat],[data-brand],[data-add],[data-fav],[data-pack],[data-st],[data-rm],[data-ep],[data-dp],[data-a],#sdScrim,#themeBtn,#editBtn,#searchClear,#toTop');
  if (!t) return; const d = t.dataset, id = t.id;
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