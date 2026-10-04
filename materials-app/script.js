(() => {
'use strict';
const TG = window.Telegram && Telegram.WebApp;
try { TG && (TG.ready(), TG.expand()); } catch (e) {}
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* مقدار فنی لاتین‌دار (مثل «0.45 W/m²·K») در متن راست‌به‌چپ وارونه دیده نشود */
const ltrv = v => { const t = String(v == null ? '' : v); return /^[\d.,\s–\-]+\s*[A-Za-z][\w\/²³·°%\s]*$/.test(t) ? `<bdi dir="ltr">${esc(t)}</bdi>` : esc(t); };
const fa = n => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: 2 });
const num = v => parseFloat(String(v == null ? '' : v).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬،]/g, '').replace('٫', '.')) || 0;
const uid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('rq-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
/* نرمال‌سازی جست‌وجو: ي/ك عربی، اعداد فارسی/عربی، نیم‌فاصله، حروف بزرگ و کوچک */
const nz = s => String(s == null ? '' : s).toLowerCase().replace(/[يئ]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u200c\u200f\u064b-\u065f]/g, '').replace(/\s+/g, ' ');
/* تاریخ شمسی (۱۴۰۵/۰۷/۰۱) → تعداد روز از آن تاریخ؛ اگر قابل‌تشخیص نبود null */
const staleDays = js => {
  try {
    const raw = String(js == null ? '' : js).trim();
    /* Accept ISO Gregorian dates and Persian-calendar dates without passing Jalali text to Date(). */
    if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) {
      const t = Date.parse(raw.length === 10 ? raw + 'T00:00:00Z' : raw);
      if (!Number.isFinite(t)) return null;
      return Math.floor((Date.now() - t) / 864e5);
    }
    const m = nz(raw).match(/(1[34]\d\d)\D+(\d{1,2})\D+(\d{1,2})/); if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3]; if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    const f = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
    const base = Date.UTC(jy + 621, 2, 21) + Math.round(((jm - 1) * 30.44 + jd - 1) * 864e5);
    for (let k = -6; k <= 6; k++) {
      const t = base + k * 864e5, p = {}; f.formatToParts(new Date(t)).forEach(x => { p[x.type] = x.value; });
      if (+(p.relatedYear || p.year) === jy && +p.month === jm && +p.day === jd) return Math.floor((Date.now() - t) / 864e5);
    }
  } catch (e) {}
  return null;
};
const safe = u => /^https?:\/\//i.test(u || '') ? u : '';
const hp = t => { try { TG.HapticFeedback.impactOccurred(t || 'light'); } catch (e) {} };
const K = { est: 'rq.mat.est', fav: 'rq.mat.fav', cfg: 'rq.mat.cfg', th: 'rq.mat.theme', rooms: 'rq.mat.rooms', scn: 'rq.mat.scn', px: 'rq.mat.px', cmp: 'rq.mat.cmp', w: 'rq.mat.w', dir: 'rq.mat.dir', proj: 'rq.mat.proj', cc: 'rq.mat.cc' };
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { try { toast('فضای ذخیره‌سازی پر است؛ داده‌ها فقط در همین نشست باقی می‌مانند'); } catch (_) {} return false; } };
const COL = ['#6FE3C4', '#E3B26F', '#8AA2FF', '#E36F9A', '#B58AFF', '#7FD1E8'];
const TG_USER = (() => { try { return (TG && TG.initDataUnsafe && TG.initDataUnsafe.user) || {}; } catch (_) { return {}; } })();
const PROFILE_KEY = 'rq.mat.profile';
const profileSaved = ld(PROFILE_KEY, {});
const accountName = [TG_USER.first_name, TG_USER.last_name].filter(Boolean).join(' ').trim() || TG_USER.username || 'کاربر پاکار';
const displayName = () => String(profileSaved.displayName || accountName).slice(0, 80);
const profilePhoto = () => safe(profileSaved.photoUrl || TG_USER.photo_url || '');
const initials = name => (String(name || 'ر').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('') || 'ر');
const S = { tab: 'cat', q: '', cat: '', edit: false, admin: false, est: ld(K.est, []), fav: ld(K.fav, []), cfg: ld(K.cfg, { waste: 5, labor: 0 }), back: null, brand: '', catalogView: 'products', catalogSort: 'name', guideQ: '', guideCat: '', communityType: 'all', communityQ: '', experienceFeatured: '', bot: 'irarchitps_bot', start: 'materials', curP: '', rooms: ld(K.rooms, []), scn: ld(K.scn, {}), px: ld(K.px, {}), cmp: ld(K.cmp, []), w: ld(K.w, { price: 3, dur: 3, spd: 3, av: 3 }), dir: ld(K.dir, {}), proj: ld(K.proj, { name: '', client: '' }), cc: ld(K.cc, { k: 'floor', v: { floor: { w: 5 }, block: { j: 10, w: 5 }, gyp: { w: 5 } } }), pick: null, cres: [], projects: [], sponsorData: null, communityData: null, marketData: null, wizard: {problem:'basement_moisture', climate:'mixed', budget:'mid', method:'standard'} };
let D = { companies: [], packs: [] };

/* ---------- ابزارها ---------- */
let tt; const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 1800); };
const api = async (p, o = {}) => { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000); try { const r = await fetch('/materials/api/' + p, { cache: 'no-store', ...o, signal: o.signal || controller.signal, headers: { 'Content-Type': 'application/json', 'X-Init-Data': TG ? TG.initData : '', ...(o.headers||{}) } }); const raw = await r.text(); let data; try { data = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error('پاسخ سرور قابل خواندن نیست'); } if (!r.ok && !data.error) data.error = 'خطای سرور (' + r.status + ')'; return data; } finally { clearTimeout(timer); } };
function normalizeCatalog(data) {
  /* Structural normalization only. Never rewrite product evidence/status/price during read:
     D is later submitted as a whole by the legacy API, so read-time cleanup would become destructive. */
  const source = data && typeof data === 'object' ? data : {};
  const out = JSON.parse(JSON.stringify(source));
  out.companies = Array.isArray(out.companies) ? out.companies : [];
  out.companies.forEach(c => { if (!c || typeof c !== 'object') return; c.products = Array.isArray(c.products) ? c.products : []; });
  out.packs = Array.isArray(out.packs) ? out.packs : []; return out;
}
const validPrice = p => {
  if (!p || p.price == null || String(p.price).trim() === '') return null;
  const raw = String(p.price).trim()
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[٬،,\s]/g, '').replace(/[٫]/g, '.').replace(/تومان|ریال/g, '');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const validEvidenceDate = p => { if (!p || !['verified','datasheet'].includes(p.confidence) || typeof p.lastVerified !== 'string') return ''; const v = nz(p.lastVerified).trim(); return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v) ? v.replace(/\//g, '-') : ''; };
const displayConfidence = p => ['verified','datasheet','field','experience','review'].includes(p && p.confidence) ? p.confidence : 'review';
const find = id => { for (const c of D.companies) for (const p of c.products) if (p.id === id) return [c, p]; return []; };
const persist = () => { sv(K.est, S.est); sv(K.fav, S.fav); sv(K.cfg, S.cfg); };
const qty = l => l.mode === 'area' ? l.q * l.per * (1 + S.cfg.waste / 100) : l.mode === 'vol' ? l.q * l.th / 100 * (1 + S.cfg.waste / 100) : l.q;
const saveData = async (quiet = false) => { try { const r = await api('save', { method: 'POST', body: JSON.stringify(D) }); if (!quiet) toast(r.ok ? 'ذخیره شد ✓' + (noImg() ? ` — ${fa(noImg())} محصول هنوز بدون تصویر` : '') : (r.error ? 'ذخیره نشد: ' + r.error : 'ذخیره نشد')); return !!r.ok; } catch (e) { if (!quiet) toast('خطا در ارتباط'); return false; } };
const I = { heart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>', calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>' };

const uiIcon = name => {
  const a = 'viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const m = {
    check:`<svg ${a}><path d="m5 12 4 4L19 6"/></svg>`,
    warn:`<svg ${a}><path d="M12 3 21 20H3L12 3Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
    tip:`<svg ${a}><path d="M9 18h6M10 21h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.7-1.5 1.5-1.7 2.5h-3.6c-.2-1-.8-1.8-1.7-2.5Z"/></svg>`,
    question:`<svg ${a}><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.3 1.5c-.8.8-2 1.1-2 2.5M12 16.5h.01"/></svg>`,
    book:`<svg ${a}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/><path d="M8 7h8M8 10h6"/></svg>`,
    shield:`<svg ${a}><path d="M12 3 19 6v5c0 4.7-3 8-7 10-4-2-7-5.3-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
    layers:`<svg ${a}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>`,
    file:`<svg ${a}><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`,
    search:`<svg ${a}><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.3 4.3"/></svg>`
  };
  return m[name] || m.file;
};

/* ---------- رسانه و شناسنامه ---------- */
const CONF = { datasheet: 'تأییدشده با دیتاشیت', field: 'تجربه‌ی اجرایی', review: 'نیازمند بررسی' };
const mUrl = (m, z) => '/materials/m/' + m.key + '?s=' + z;
const letter = c => esc((c.en || c.name || '').trim()[0] || '؟');
const logoBox = (c, cls) => c.logo && c.logo.key ? `<div class="${cls} has-logo"><img src="${mUrl(c.logo, 'g')}" alt="${esc(c.name)}" decoding="async"></div>` : `<div class="${cls}">${letter(c)}</div>`;
const externalProductImage = p => { const u=String(p && p.sourceImageUrl || '').trim(); return (/^https?:\/\//i.test(u) || /^\/materials\/images\/[a-z0-9._-]+\.(?:webp|png|jpe?g)$/i.test(u)) ? u : ''; };
const thumb = (c, p) => { const m = (p.images || [])[0]; const ext = externalProductImage(p); return m ? `<div class="im"><img src="${mUrl(m, 't')}" alt="${esc(p.name)}" loading="lazy" decoding="async"></div>` : ext ? `<div class="im"><img src="${esc(ext)}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('ph');this.remove()"></div>` : `<div class="im ph"><b>${letter(c)}</b><small>در حال تکمیل</small></div>`; };
const specsText = a => (a || []).map(x => x.k + ': ' + x.v).join('\n');
const parseSpecs = t => String(t || '').split('\n').map(l => { const i = l.search(/[:：]/); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : null; }).filter(x => x && x.k && x.v);
const standardsText = a => (a || []).map(x => x.code + (x.verified ? ' | ' + x.verified : '')).join('\n');
const parseStandards = t => String(t || '').split('\n').map(l => {
  const parts = l.split('|').map(x => x.trim());
  return parts[0] ? { code: parts[0].slice(0, 80), verified: (parts[1] || '').slice(0, 30) } : null;
}).filter(Boolean).slice(0, 10);
const noImg = () => D.companies.reduce((n, c) => n + c.products.filter(p => !(p.images || []).length && !externalProductImage(p)).length, 0);
const link = id => S.bot ? `https://t.me/${S.bot}?start=mat_${id}` : '';
const reload = () => api('data').then(r => { if (!r || !r.data) throw new Error('داده در دسترس نیست'); D = r.data; sv('rq.mat.catalog.cache', D); S.admin = !!r.admin; S.bot = r.bot || 'irarchitps_bot'; S.start = r.start || 'materials'; });
const reqUpload = async (kind, co, pid, extra = {}) => { try { const r = await api('upload-request', { method: 'POST', body: JSON.stringify({ kind, co, pid: pid || '', ...extra }) }); if (r.ok) { toast(kind === 'file' ? 'فایل را در چت ربات بفرست' : kind === 'catalog' ? 'فایل JSON را در چت ربات بفرست' : 'عکس را در چت ربات بفرست'); setTimeout(() => { try { TG.close(); } catch (e) {} }, 900); } else toast('ناموفق: ' + (r.error || '')); } catch (e) { toast('خطا در ارتباط'); } };
const rmMedia = async (co, pid, key) => { try { const r = await api('media-remove', { method: 'POST', body: JSON.stringify({ co, pid, key }) }); if (!r.ok) toast('حذف نشد'); await reload(); render(); } catch (e) { toast('خطا در ارتباط'); } };

/* ---------- شیت ---------- */
const sheet = (html, back) => { $('#sdPanel').innerHTML = '<div class="sd-grab"></div><div class="sd-scroll">' + html + '</div>'; const sd = $('#sd'); sd.hidden = false; document.body.classList.add('locked'); requestAnimationFrame(() => sd.classList.add('open')); S.back = back || null; };
const closeSheet = () => { const sd = $('#sd'); sd.classList.remove('open'); document.body.classList.remove('locked'); S.back = null; setTimeout(() => { if (!sd.classList.contains('open')) { sd.hidden = true; $('#sdPanel').innerHTML = ''; } }, 300); };

/* ---------- نما ---------- */
function updateNavNeon() {
 const nav = $('#bottomNav'); if (!nav) return;
 let indicator = nav.querySelector('.nav-neon');
 if (!indicator) { indicator = document.createElement('span'); indicator.className = 'nav-neon'; indicator.setAttribute('aria-hidden','true'); nav.prepend(indicator); }
 const items = [...nav.querySelectorAll('.bottom-item:not([hidden])')];
 const active = items.find(b => b.dataset.tab === S.tab) || items[0]; if (!active) return;
 const colors = {cat:'#6FE3C4',projects:'#E3B26F',tools:'#8AA2FF',education:'#E36F9A',community:'#B58AFF',manage:'#7FD1E8',profile:'#F0C878'};
 const color = colors[active.dataset.tab] || '#6FE3C4';
 const previous = nav.dataset.neonColor || color;
 indicator.style.width = Math.max(34, Math.min(54, active.clientWidth * .62)) + 'px';
 indicator.style.left = (active.offsetLeft + (active.offsetWidth - Math.max(34, Math.min(54, active.clientWidth * .62))) / 2) + 'px';
 indicator.style.setProperty('--neon-from', previous); indicator.style.setProperty('--neon-to', color);
 nav.style.setProperty('--active-tab-color', color); nav.dataset.neonColor = color;
 nav.querySelectorAll('.bottom-item').forEach(b => b.style.setProperty('--item-color', colors[b.dataset.tab] || color));
}
function tabs() {
  // معماری اطلاعات ساده‌تر: پنج مقصد اصلی؛ ابزارهای تخصصی در یک صفحه‌ی منظم گروه‌بندی شده‌اند.
  const T = [['cat', 'کاتالوگ', fa(D.companies.length)], ['projects', 'پروژه‌های من', fa(S.projects.length)], ['tools', 'ابزارها', '۱۰'], ['education', 'راهنمای اجرا', 'آموزش'], ['community', 'تجربه‌ها', 'جامعه']];
  if (S.admin) T.push(['manage', 'مدیریت', 'ادمین']); else T.push(['profile', 'پروفایل', 'حساب']);
  $('#index').innerHTML = T.map(t => `<button type="button" class="tile ${S.tab === t[0] ? 'on' : ''}" data-tab="${t[0]}" role="tab" aria-selected="${S.tab === t[0]}"><b>${t[2]}</b>${t[1]}</button>`).join('');
  document.querySelectorAll('#bottomNav [data-tab]').forEach(b => { const active = b.dataset.tab === S.tab; b.classList.toggle('active', active); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); b.hidden = (b.dataset.tab === 'manage' && !S.admin) || (b.dataset.tab === 'profile' && S.admin); });
  updateNavNeon();
  $('#filters').hidden = S.tab !== 'cat';
  $('#editBtn').hidden = !S.admin; $('#editBtn').setAttribute('aria-pressed', S.edit);
  const hero = document.querySelector('.hero'); if (hero) hero.classList.toggle('compact', S.tab !== 'cat');
}
function toolsView() {
 // میز نقشه‌کشی پاکار: هر ابزار فقط یک بار، با آیکن و رنگ اختصاصی؛ «پروژه‌های من» در ناوبری پایین است و اینجا تکرار نمی‌شود.
 const ic = {
  room: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  wizard: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  est: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  cmp: '<path d="M12 4v16M6 20h12M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  calc: '<path d="M4 20V4l16 16Z"/><path d="M8 15.5V11l4.5 4.5Z"/>',
  prices: '<path d="M3 20h18"/><path d="m4 15 5-5 4 3 7-8"/><path d="M15 5h5v5"/>',
  library: '<path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  dealers: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  fav: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  recent: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
 };
 const recentN = (ld('rq.mat.recent', []) || []).length;
 const badge = { room: S.rooms.length ? fa(S.rooms.length) + ' فضا' : '', est: S.est.length ? fa(S.est.length) + ' قلم' : '', cmp: S.cmp.length ? fa(S.cmp.length) + ' مورد' : '', fav: S.fav.length ? fa(S.fav.length) + ' محصول' : '', recent: recentN ? fa(recentN) + ' مورد' : '' };
 const T = {
  room: ['room', 'متره‌ی فضا', 'کف، دیوار و سقف را اندازه بگیر؛ مقدار مصالح خودش حساب می‌شود', '#6FE3C4'],
  wizard: ['wizard', 'راهنمای انتخاب', 'از مشکل پروژه شروع کن؛ مصالح مناسب را پیشنهاد می‌گیری', '#8D7CFF'],
  est: ['est', 'برآورد هزینه', 'مصالح و هزینه‌های پروژه را جمع ببند', '#E3B26F'],
  cmp: ['cmp', 'مقایسه‌ی مصالح', 'مشخصات را کنار هم ببین', '#8AA2FF'],
  calc: ['calc', 'محاسبات تخصصی', 'ماشین‌حساب‌های اجرایی', '#E36F9A'],
  prices: ['prices', 'تاریخچه‌ی قیمت', 'منبع و تاریخ ثبت', '#F0C878'],
  library: ['library', 'فایل‌های اجرایی', 'DWG، PDF، BIM و دفترچه‌ها', '#7FD1E8'],
  dealers: ['dealers', 'نمایندگی و استعلام', 'راه تماس را پیدا کن', '#B58AFF'],
  fav: ['fav', 'ذخیره‌شده‌ها', 'محصولات نشان‌شده', '#E36F9A'],
  recent: ['recent', 'اخیراً دیده‌شده', 'بازگشت سریع به شناسنامه‌ها', '#70F5D0']
 };
 let n = 0;
 const card = (k, cls) => { const [id, title, desc, tc] = T[k]; n++; return `<button type="button" class="tb-card ${cls || ''}" data-tab="${id}" style="--tc:${tc};--i:${n}"><span class="tb-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ic[id]}</svg></span><span class="tb-txt"><strong>${title}</strong><small>${desc}</small></span>${badge[id] ? `<em class="tb-badge">${badge[id]}</em>` : ''}<span class="tb-go" aria-hidden="true">←</span></button>`; };
 const sheet = (code, title, sub, keys, cls) => `<section class="tb-sheet"><header class="tb-sheet-h"><span class="tb-code">${code}</span><span class="tb-sheet-t"><strong>${title}</strong><small>${sub}</small></span></header><div class="tb-grid ${cls || ''}">${keys.map((k, i) => card(k, cls === 'tb-hero-grid' && i === 0 ? 'tb-wide' : '')).join('')}</div></section>`;
 return `<div class="tb-hero"><span class="eyebrow">میز نقشه‌کشی پاکار</span><h2>ابزارهایت را روی میز بچین.</h2><p>از اندازه‌گیری فضا تا برآورد هزینه؛ هر ابزار فقط یک بار و در جای درست خودش.</p><div class="tb-rule" aria-hidden="true"><i></i></div></div>`
  + sheet('A-01', 'شروع پروژه', 'اندازه بگیر، انتخاب کن، برآورد بزن', ['room', 'wizard', 'est'], 'tb-hero-grid')
  + sheet('A-02', 'بسنج و تصمیم بگیر', 'مقایسه، محاسبه و قیمت', ['cmp', 'calc', 'prices'])
  + sheet('A-03', 'مرجع و پیگیری', 'فایل‌ها، تماس‌ها و ذخیره‌ها', ['library', 'dealers', 'fav', 'recent']);
}
function recentView() {
 const ids = ld('rq.mat.recent', []); const rows = ids.map(id=>{const [c,p]=find(id);return c&&p?{c,p}:null}).filter(Boolean);
 return rows.length ? `<div class="tools-intro"><h2>اخیراً دیده‌شده</h2><p>آخرین شناسنامه‌هایی که باز کرده‌ای.</p></div>${rows.map(({c,p})=>`<div class="ln"><h4><span>${esc(p.name)}</span><em>${esc(c.name)}</em></h4><button class="act act-primary" data-prod="${esc(p.id)}">بازکردن شناسنامه</button></div>`).join('')}` : '<div class="empty"><h3>هنوز محصولی باز نکرده‌ای</h3><p>وقتی شناسنامه‌ای را باز کنی، برای دسترسی سریع اینجا ذخیره می‌شود.</p><button class="act act-primary" data-tab="cat">رفتن به کاتالوگ</button></div>';
}
function profileView() {
 const name = displayName(); const photo = profilePhoto(); const uname = TG_USER.username ? '@' + TG_USER.username : 'نام کاربری تلگرام ثبت نشده';
 return `<section class="profile-card"><div class="profile-head"><div class="profile-avatar">${photo ? `<img src="${esc(photo)}" alt="تصویر پروفایل" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='&lt;span&gt;ر&lt;/span&gt;'">` : `<span>${esc(initials(name))}</span>`}</div><div class="profile-identity"><span class="eyebrow">حساب کاربری</span><h2>${esc(name)}</h2><p>${esc(uname)}</p><small>${TG_USER.id ? 'متصل به حساب تلگرام' : 'پروفایل محلی؛ برای امکانات اجتماعی از داخل تلگرام باز کن'}</small></div></div><button class="act act-primary" data-x="profile-edit">ویرایش نام نمایشی و تصویر</button></section>
 <div class="grp">فضای شخصی</div><div class="profile-links"><button class="profile-link" data-tab="projects"><b>پروژه‌های من</b><span>برآوردها و کارهای ذخیره‌شده ←</span></button><button class="profile-link" data-tab="community"><b>تجربه‌های من</b><span>ارسال‌ها و وضعیت بررسی ←</span></button><button class="profile-link" data-tab="tools"><b>ابزارهای معماری</b><span>متره، مقایسه و محاسبات ←</span></button></div>
 <p class="hint profile-note">نام نمایشی و تصویر انتخابی فقط برای شخصی‌سازی همین دستگاه است. تجربه‌های اجرایی با هویت تأییدشدهٔ حساب تلگرام ثبت می‌شوند تا تغییر نام نمایشی باعث جعل هویت نشود.</p>`;
}
function manageView() {
 if (!S.admin) return '<div class="empty"><p>این بخش فقط برای مدیران پاکار است.</p></div>';
 const products=[]; D.companies.forEach(c=>(c.products||[]).forEach(p=>products.push({c,p})));
 const missingImage=products.filter(x=>!(x.p.images||[]).length && !externalProductImage(x.p)); const needsWork=products.filter(x=>(!(x.p.images||[]).length && !externalProductImage(x.p)) || (!x.p.source && !(x.p.specs||[]).length)); const pending=(S.communityData&&S.communityData.items||[]).filter(x=>x.status==='pending').length;
 return `<div class="admin-welcome"><span class="eyebrow">میزکار مدیر</span><h2>مدیریت محتوا، بدون گشتن در منوها</h2><p>کارهای مهم را از اینجا شروع کن. تغییرات فقط پس از ذخیره روی کاتالوگ اعمال می‌شوند.</p><div class="admin-metrics"><div><b>${fa(D.companies.length)}</b><small>برند</small></div><div><b>${fa(products.length)}</b><small>محصول</small></div><div><b>${fa(missingImage.length)}</b><small>بدون تصویر</small></div><div><b>${S.communityData ? fa(pending) : '—'}</b><small>تجربه‌ی در انتظار</small></div></div></div>
 <div class="admin-actions"><button class="admin-action admin-action-primary" data-x="catalog-upload"><b>آپلود کاتالوگ از فایل</b><small>ارسال فایل JSON در چت ربات و افزودن گروهی محصولات بدون دیپلوی مجدد</small><span>انتخاب فایل از طریق چت ربات ←</span></button><button class="admin-action" data-x="quick-products"><b>افزودن سریع چند محصول</b><small>ثبت چند محصول در یک فرم کوتاه؛ بدون بازکردن فرم بلند برای هرکدام</small><span>شروع افزودن سریع ←</span></button><button class="admin-action" data-x="admin-catalog"><b>۱. ویرایش برندها و محصولات</b><small>افزودن محصول، تصویر، مشخصات و فایل</small><span>ورود به کاتالوگ ←</span></button><button class="admin-action" data-x="community-admin"><b>۲. بررسی تجربه‌های کاربران</b><small>تأیید، رد یا مدیریت نشان کارشناسی</small><span>بررسی ارسال‌ها ←</span></button><button class="admin-action" data-tab="market"><b>۳. شاخص بازار</b><small>بازدیدها، جست‌وجوهای بی‌نتیجه و استعلام‌ها</small><span>مشاهده گزارش ←</span></button><button class="admin-action" data-tab="sponsor"><b>۴. گزارش حامیان</b><small>رویدادهای ثبت‌شده برای برندهای حامی</small><span>مشاهده گزارش ←</span></button></div>
 <div class="grp">موارد نیازمند تکمیل</div>${needsWork.length?needsWork.slice(0,10).map(({c,p})=>`<div class="ln admin-missing"><h4><span>${esc(p.name)}</span><em>${esc(c.name)}</em></h4><div class="meta"><span>تصویر ندارد</span>${!p.source&&!(p.specs||[]).length?'<span>منبع/مشخصات ناقص</span>':''}</div><div class="ft"><button class="act act-primary" data-prod="${esc(p.id)}">بازکردن محصول</button><button class="act" data-x="admin-edit-product" data-id="${esc(c.id)}" data-pid="${esc(p.id)}">ویرایش اطلاعات</button></div></div>`).join(''):'<div class="empty"><p>همه‌ی محصولات تصویر دارند. برای انتشار، منبع و مشخصات فنی را هم بررسی کن.</p></div>'}
 <div class="ft"><button class="act act-primary" data-x="admin-save">ذخیره‌ی تغییرات</button><button class="act" data-x="admin-refresh">بازخوانی از سرور</button></div>`;
}
function render() {
  tabs();
  const L = $('#list');
  L.innerHTML = ({ est: estView, fav: favView, room: roomView, cmp: cmpView, calc: calcView, library: libraryView, projects: projectsView, prices: pricesView, dealers: dealersView, sponsor: sponsorView, wizard: wizardView, education: educationView, community: communityView, market: marketView, tools: toolsView, recent: recentView, manage: manageView, profile: profileView }[S.tab] || catView)();
  if (S.tab === 'cat') { const cats = [...new Set(D.companies.map(c => c.cat).filter(Boolean))]; $('#chips').innerHTML = `<button type="button" class="chip ${!S.cat ? 'active' : ''}" data-cat="">همه دسته‌ها</button>` + cats.map(c => `<button type="button" class="chip ${S.cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)} <small>${fa(D.companies.filter(x=>x.cat===c).reduce((n,x)=>n+x.products.length,0))}</small></button>`).join(''); $('#logos').innerHTML = [...D.companies].sort((a, b) => (!!b.sponsor) - (!!a.sponsor)).map(c => `<button type="button" class="lgo ${S.brand === c.id ? 'on' : ''}" data-logo="${c.id}" aria-pressed="${S.brand === c.id}">${logoBox(c, 'lgb')}<small>${esc(c.name)}</small>${c.sponsor ? '<i class="spd" title="حامی پاکار"></i>' : ''}</button>`).join(''); observe(); }
  if (S.tab === 'est') paint(); else if (S.tab === 'room') paintRoom(); else if (S.tab === 'cmp') paintCmp(); else if (S.tab === 'calc') paintCalc();
}
let io; function observe() { const cs = document.querySelectorAll('.mc'); if (!('IntersectionObserver' in window)) return cs.forEach(c => c.classList.add('in-view')); io && io.disconnect(); io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.transitionDelay = (Number(e.target.dataset.i) % 4) * 50 + 'ms'; e.target.classList.add('in-view'); io.unobserve(e.target); } }), { threshold: .05 }); cs.forEach(c => io.observe(c)); }

function catView() {
  const q = nz(S.q.trim()), words = q.split(' ').filter(Boolean);
  const matches = [];
  D.companies.forEach(c => (c.products||[]).forEach(p => {
    const hay = nz([c.name,c.en,c.cat,c.desc,p.name,p.group,p.desc,(p.features||[]).join(' '),(p.specs||[]).map(x=>x.k+' '+x.v).join(' ')].join(' '));
    if ((!S.cat || c.cat===S.cat) && (!S.brand || c.id===S.brand) && (!words.length || words.every(w=>hay.includes(w)))) matches.push({c,p});
  }));
  const companies = D.companies.filter(c => { const h=nz([c.name,c.en,c.cat,c.desc,...c.products.map(p=>p.name+' '+(p.group||''))].join(' ')); return (!S.cat || c.cat===S.cat) && (!S.brand || c.id===S.brand) && (!words.length || words.every(w=>h.includes(w))); });
  const pricedCount = matches.filter(({p}) => validPrice(p) !== null).length;
  const datedCount = matches.filter(({p}) => validEvidenceDate(p) && staleDays(validEvidenceDate(p)) !== null).length;
  if (S.catalogSort==='price' && pricedCount) matches.sort((a,b)=>(validPrice(a.p) ?? Infinity)-(validPrice(b.p) ?? Infinity));
  else if (S.catalogSort==='fresh' && datedCount) matches.sort((a,b)=>(validEvidenceDate(b.p)||'').localeCompare(validEvidenceDate(a.p)||''));
  else { S.catalogSort='name'; matches.sort((a,b)=>a.p.name.localeCompare(b.p.name,'fa')); }
  const toolbar = `<div class="catalog-toolbar glass-panel"><div><strong>${fa(S.catalogView==='products'?matches.length:companies.length)}</strong><span>${S.catalogView==='products'?'محصول قابل بررسی':'برند'}</span></div><div class="catalog-controls"><button type="button" class="chip ${S.catalogView==='products'?'active':''}" data-cview="products">محصولات</button><button type="button" class="chip ${S.catalogView==='brands'?'active':''}" data-cview="brands">برندها</button>${S.catalogView==='products'?`<select aria-label="مرتب‌سازی محصولات" data-csort><option value="name" ${S.catalogSort==='name'?'selected':''}>مرتب‌سازی: نام</option>${pricedCount?`<option value="price" ${S.catalogSort==='price'?'selected':''}>قیمت ثبت‌شده</option>`:''}${datedCount?`<option value="fresh" ${S.catalogSort==='fresh'?'selected':''}>تازه‌ترین بررسی</option>`:''}</select>`:''}</div></div>`;
  const add = S.edit ? '<button type="button" class="act act-primary" data-a="addco" style="margin-top:12px">+ برند جدید</button>' : '';
  if (S.catalogView==='brands') return add + toolbar + (companies.length ? '<div class="grid">' + companies.map((c,i)=>`<article class="mc" data-brand="${c.id}" data-i="${i}" tabindex="0" role="button"><div style="display:flex;gap:10px;align-items:center">${logoBox(c,'mono')}<div><h3>${esc(c.name)}</h3><div class="meta"><span>${esc(c.cat)}</span></div></div></div><p>${esc(c.desc||'')}</p><div class="meta"><span>${fa(c.products.length)} محصول</span>${safe(c.catalog)?'<span class="sp">کاتالوگ</span>':''}${c.sponsor?'<span class="sp">حامی پاکار</span>':''}</div></article>`).join('')+'</div>' : '<div class="empty"><p>برندی با این فیلتر پیدا نشد.</p></div>');
  if (!matches.length) { if (S.q.trim()) { const sk=nz(S.q).slice(0,100); if(S.lastNoResult!==sk){S.lastNoResult=sk;phase4Track('search_no_result','','',{query:sk});} } else S.lastNoResult=''; return add+toolbar+'<div class="empty"><div class="empty-icon">⌕</div><p>محصولی با این مشخصات پیدا نشد.</p><small>فیلترها را تغییر بده یا عبارت دیگری جست‌وجو کن.</small></div>'; }
  S.lastNoResult='';
  const packsStrip=(D.packs||[]).length?`<section class="catalog-packs"><div class="catalog-packs-head"><b>پکیج‌های آماده‌ی کارگاه</b><small>برای شروع برآورد</small></div><div class="catalog-packs-row">${D.packs.slice(0,5).map(k=>`<button type="button" class="catalog-pack" data-pack="${esc(k.id)}"><b>${esc(k.title)}</b><small>${esc(k.desc||'اقلام پیشنهادی برای شروع')}</small><span>افزودن پکیج ←</span></button>`).join('')}</div></section>`:'';
  const compareTray=S.cmp.length?`<div class="compare-tray glass-panel"><span>مقایسه‌ی انتخابی <b>${fa(S.cmp.length)}/۳</b></span><div>${S.cmp.map(id=>{const [co,pr]=find(id);return co&&pr?`<small>${esc(pr.name)} <button data-x="cmp" data-pid="${esc(id)}" aria-label="حذف از مقایسه">×</button></small>`:''}).join('')}</div><button class="act act-primary" data-tab="cmp">مقایسه‌ی مشخصات ↗</button></div>`:'';
  return add + toolbar + packsStrip + compareTray + '<div class="product-results">' + matches.map(({c,p})=>{ const date=validEvidenceDate(p); const age=date?staleDays(date):null; const freshness=age===null||!Number.isFinite(age)?'<span class="fresh unknown">تاریخ تأیید ثبت نشده</span>':`<span class="fresh ${age<=30?'recent':age<=90?'aging':'stale'}">${age<=30?'تأیید تازه':age<=90?'نیازمند بازبینی':'تأیید قدیمی'} · ${fa(age)} روز</span>`; const conf=displayConfidence(p); const confidence=conf==='verified'||conf==='datasheet'?'تأییدشده / دیتاشیت':conf==='experience'?'تجربه کارگاهی':conf==='field'?'گزارش میدانی':'نیازمند بررسی'; const spec=(p.specs||[]).slice(0,2).map(x=>`<b>${esc(x.k)}: ${esc(x.v)}</b>`).join(''); return `<div class="catalog-product"><div class="catalog-product-main" data-prod="${esc(p.id)}" role="button" tabindex="0">${thumb(c,p)}<div class="catalog-product-info"><h4>${esc(p.name)}</h4><small>${esc(c.name)} · ${esc(p.group||c.cat||'مصالح')}</small><div class="catalog-price">${validPrice(p)!==null?`${fa(validPrice(p))} تومان <small>/ ${esc(p.unit||'واحد')}</small>`:`استعلام قیمت <small>/ ${esc(p.unit||'واحد')}</small>`}</div><div class="catalog-badges"><span class="confidence">${confidence}</span>${freshness}${spec}</div></div></div><div class="catalog-product-actions"><button type="button" class="sq" data-add="${esc(p.id)}" aria-label="افزودن به برآورد">＋</button><button type="button" class="sq ${S.fav.includes(p.id)?'on':''}" data-fav="${esc(p.id)}" aria-label="ذخیره">${I.heart}</button><button type="button" class="sq ${S.cmp.includes(p.id)?'on':''}" data-x="cmp" data-pid="${esc(p.id)}" aria-label="مقایسه">⇄</button></div></div>`; }).join('')+'</div>';
}
function prodRow(c, p) {
  const price = validPrice(p)!==null ? `<div class="pc">${fa(validPrice(p))} تومان <small>/ ${esc(p.unit)}</small></div>` : `<div class="pc no">قیمت روز: استعلام <small>(${esc(p.unit)})</small></div>`;
  const on = S.fav.includes(p.id);
  const warn = S.edit && !(p.images || []).length && !externalProductImage(p) ? '<small class="wr">⚠ بدون تصویر؛ از داخل محصول عکس اضافه کن</small>' : ''; 
  return `<div class="pr2" data-prod="${p.id}" tabindex="0" role="button">${thumb(c, p)}<h4>${esc(p.name)}</h4>${p.desc ? `<small>${esc(p.desc)}</small>` : ''}${price}${(p.features || []).length ? `<div class="fch">${p.features.slice(0, 2).map(f => `<b>${esc(f)}</b>`).join('')}</div>` : ''}${warn}<div class="bt"><button type="button" class="sq pl" data-add="${p.id}" aria-label="افزودن به برآورد">＋</button><button type="button" class="sq ${on ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${on}" aria-label="ذخیره">${I.heart}</button><button type="button" class="sq ${S.cmp.includes(p.id) ? 'on' : ''}" data-x="cmp" data-pid="${p.id}" aria-label="مقایسه">⇄</button>${safe(p.catalog) ? `<a class="sq" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener" aria-label="کاتالوگ محصول">${I.pdf.replace('<svg', '<svg width="17" height="17"')}</a>` : ''}${S.edit ? `<button type="button" class="sq" data-ep="${p.id}">✎</button><button type="button" class="sq dg" data-dp="${p.id}">✕</button>` : ''}</div></div>`;
}
function openBrand(id) {
  const c = D.companies.find(x => x.id === id); if (!c) return;
  const gs = {}; c.products.forEach(p => (gs[p.group || 'سایر'] = gs[p.group || 'سایر'] || []).push(p));
  const cat = safe(c.catalog);
  sheet(`<div class="sd-head">${logoBox(c, 'mono')}<div><h3 style="margin:0;font-size:18px;color:var(--ink)">${esc(c.name)}${c.en ? ` <small style="color:var(--ink-faint)">${esc(c.en)}</small>` : ''}</h3><div class="meta" style="margin-top:4px"><span>${esc(c.cat)}</span>${c.sponsor ? '<span class="sp">حامی پاکار</span>' : ''}</div></div></div>
  <p style="color:var(--ink-dim);font-size:13px;margin:6px 0 4px">${esc(c.desc)}</p>
  ${(c.features || []).length ? `<ul class="fts" style="margin:8px 0">${c.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
  ${(safe(c.site) || (c.links || []).some(x => safe(x.u))) ? `<div class="ft" style="margin:8px 0">${safe(c.site) ? `<a class="act" data-stop href="${esc(safe(c.site))}" target="_blank" rel="noopener">وب‌سایت رسمی</a>` : ''}${(c.links || []).filter(x => safe(x.u)).map(x => `<a class="act" data-stop href="${esc(safe(x.u))}" target="_blank" rel="noopener">${esc(x.t)}</a>`).join('')}</div>` : ''}
  ${S.edit ? `<div class="ft"><button type="button" class="act" data-a="editco" data-id="${c.id}">✎ ویرایش برند</button><button type="button" class="act act-primary" data-a="addp" data-id="${c.id}">+ محصول</button><button type="button" class="act" data-a="uplogo" data-id="${c.id}">🖼 لوگو از ربات</button><button type="button" class="act" data-a="dealers-edit" data-id="${c.id}">⌖ مدیریت نمایندگی‌ها</button>${c.logo ? `<button type="button" class="act" data-a="rmlogo" data-id="${c.id}" style="color:var(--danger)">حذف لوگو</button>` : ''}<button type="button" class="act" data-a="delco" data-id="${c.id}" style="color:var(--danger)">حذف برند</button></div>` : ''}
  ${Object.entries(gs).map(([g, ps]) => `<div class="grp">${esc(g)}</div>${ps.map(p => prodRow(c, p)).join('')}`).join('') || '<div class="empty"><p>هنوز محصولی ثبت نشده</p></div>'}
  <div class="sd-bar" style="margin-top:12px">${cat ? `<a class="act act-primary" href="${esc(cat)}" target="_blank" rel="noopener">${I.pdf}<span>کاتالوگ شرکت</span></a>` : ''}<button type="button" class="act" data-a="goest">${I.calc}<span>برآورد (${fa(S.est.length)})</span></button></div>`, () => openBrand(id));
  S.cur = id;
}
const ratings = p => (p.speed || p.durability) ? `<div class="grp">امتیازهای پاکار</div><table class="spt">${p.durability ? `<tr><td>دوام</td><td>${fa(p.durability)} از ۵</td></tr>` : ''}${p.speed ? `<tr><td>سرعت اجرا</td><td>${fa(p.speed)} از ۵</td></tr>` : ''}</table>` : '';

function openProd(pid) {
  const [c, p] = find(pid); if (!p) return;
  const recent = ld('rq.mat.recent', []).filter(x => x !== pid); recent.unshift(pid); sv('rq.mat.recent', recent.slice(0, 8));
  S.cur = c.id; S.curP = pid;
  phase3Track('view', c.name, p.name);
  const imgs = p.images || [];
  const extImage = externalProductImage(p);
  const gal = imgs.length ? `<div class="gal"><div class="gal-track" id="galT">${imgs.map((m, k) => `<div class="gal-s im"><img src="${mUrl(m, 'l')}" alt="${esc(p.name)}" ${k ? 'loading="lazy" ' : ''}decoding="async">${S.edit ? `<button type="button" class="sq dg gal-x" data-rmimg="${m.key}" aria-label="حذف عکس">✕</button>` : ''}</div>`).join('')}</div>${imgs.length > 1 ? `<div class="dots" id="galD">${imgs.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>` : extImage ? `<div class="im big"><img src="${esc(extImage)}" alt="${esc(p.name)}" decoding="async" loading="lazy" onerror="this.parentNode.classList.add('ph');this.remove()"></div>` : `<div class="im ph big"><b>${letter(c)}</b><small>تصویر این محصول در حال تکمیل است</small></div>`;
  const price = validPrice(p)!==null ? `<div class="pc">${fa(validPrice(p))} تومان <small>/ ${esc(p.unit)}</small></div>` : `<div class="pc no">قیمت روز: استعلام <small>(${esc(p.unit)})</small></div>`;
  const specs = (p.specs || []).length ? `<table class="spt">${p.specs.map(x => `<tr><td>${esc(x.k)}</td><td>${ltrv(x.v)}</td></tr>`).join('')}</table>` : '<div class="pc no">مشخصات فنی: استعلام</div>';

  /* --- استانداردهای ملی --- */
  const stds = (p.standards || []).filter(x => x && x.code);
  const stdsHtml = stds.length
    ? `<div class="grp">استانداردهای ملی</div><table class="spt">${stds.map(x => `<tr><td>${esc(x.code)}</td><td>${x.verified ? 'آخرین بررسی: ' + esc(x.verified) : '<span class="src-note">تاریخ ثبت نشده</span>'}</td></tr>`).join('')}</table>`
    : '';

  /* --- گواهی فنی مرکز تحقیقات راه، مسکن و شهرسازی --- */
  const tc = p.techCert || {};
  const tcHtml = (tc.no || tc.until)
    ? `<div class="grp">گواهی فنی (مرکز تحقیقات راه، مسکن و شهرسازی)</div><table class="spt">${tc.no ? `<tr><td>شماره‌ی گواهی</td><td>${esc(tc.no)}</td></tr>` : ''}${tc.until ? `<tr><td>اعتبار تا</td><td>${esc(tc.until)}</td></tr>` : ''}</table>`
    : '';

  /* --- ردیف فهرست بها --- */
  const feHtml = p.feHesab
    ? `<div class="grp">فهرست بها</div><table class="spt"><tr><td>ردیف مرتبط</td><td>${esc(p.feHesab)}</td></tr></table>`
    : '';

  const sd = p.lastVerified ? staleDays(p.lastVerified) : null;
  const trace = (p.confidence || p.source || p.lastVerified || p.availability) ? `<div class="tr">${p.confidence ? `<span class="cf ${esc(p.confidence)}">${esc(CONF[p.confidence] || '')}</span> ` : ''}${sd != null && sd > 90 ? '<span class="cf review">بررسی قدیمی؛ دوباره تأیید شود</span> ' : ''}${p.availability ? `<div>قابل تهیه در ایران: ${esc(p.availability)}</div>` : ''}${p.source ? `<div>منبع: ${esc(p.source)}</div>` : ''}${p.lastVerified ? `<div>آخرین بررسی: ${esc(p.lastVerified)}</div>` : ''}${p.catalogVer ? `<div>نسخه‌ی کاتالوگ: ${esc(p.catalogVer)}</div>` : ''}</div>` : '<div class="tr">منبع و تاریخ بررسی برای این محصول هنوز ثبت نشده است.</div>';
  const feats = (p.features || []).length ? `<div class="grp">ویژگی‌ها</div><ul class="fts">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const on = S.fav.includes(p.id);
  const docs = (p.docs||[]).filter(x=>x&&x.fid);
  const docsHtml = `<div class="grp">کتابخانه‌ی فایل‌های اجرایی</div>${docs.length ? docs.map(d=>`<div class="ln"><h4><span>${esc(d.title||d.file_name||'فایل اجرایی')}</span><em>${esc((d.type||'document').toUpperCase())}</em></h4><small>${esc(d.version||'')} ${esc(d.date||'')}</small><button type="button" class="act act-primary" data-x="sendfile" data-docid="${esc(d.id)}">ارسال فایل به چت</button></div>`).join('') : '<p class="hint">فایل اجرایی هنوز ثبت نشده است.</p>'}${S.edit ? `<button type="button" class="act" data-a="upfile" data-id="${esc(c.id)}" data-pid="${esc(p.id)}">＋ افزودن فایل CAD/BIM/Texture/PDF از ربات</button>` : ''}`;
  const hist = (p.priceLog||[]).slice(-8).reverse();
  const histHtml = `<div class="grp">تاریخچه‌ی قیمت</div>${hist.length?`<table class="spt">${hist.map(x=>`<tr><td>${esc(x.date||'—')}</td><td>${x.price?fa(x.price)+' تومان':'استعلام'}</td><td>${esc(x.source||'منبع ثبت نشده')}</td></tr>`).join('')}</table>`:'<p class="hint">هنوز تاریخچه‌ی قیمت ثبت نشده است.</p>'}`;
  const modelUrl = safe(typeof p.model3d === 'string' ? p.model3d : (p.model3d && p.model3d.url) || '');
  const modelHtml = modelUrl ? `<div class="grp">پیش‌نمایش سه‌بعدی</div><model-viewer src="${esc(modelUrl)}" alt="مدل سه‌بعدی ${esc(p.name)}" camera-controls auto-rotate shadow-intensity="0.7" style="width:100%;height:280px;background:var(--surface-2);border-radius:16px"></model-viewer><p class="hint">مدل صرفاً برای مشاهده‌ی ظاهری است؛ ابعاد و قابلیت اجرا باید از نقشه و دیتاشیت تأیید شود.</p>` : (S.edit ? `<div class="hint">برای افزودن مدل سه‌بعدی، فیلد model3d.url با لینک عمومی فایل GLB/GLTF معتبر تکمیل شود.</div>` : '');
  if(modelUrl) phase4Track('model3d',c.name,p.name);
  const installHtml = p.install && ((p.install.steps||[]).length || (p.install.mistakes||[]).length) ? `<div class="grp">راهنمای اجرا</div><button class="act" data-tab="education">مشاهده آموزش‌های اجرا</button>` : '';
  sheet(`<div class="sd-head"><button type="button" class="act" data-a="tobrand">‹ ${esc(c.name)}</button></div><div class="product-tabbar"><button type="button" data-product-jump="مشخصات فنی">مشخصات</button><button type="button" data-product-jump="راهنمای اجرا">اجرا</button><button type="button" data-product-jump="تجربه‌های مرتبط">تجربه‌ها</button></div><div class="product-summary"><span>${esc(c.name)}</span><b>${validPrice(p)!==null?fa(validPrice(p))+' تومان':'قیمت: استعلام'}</b><small>${(p.specs||[]).length?fa(p.specs.length)+' مشخصه‌ی فنی':'مشخصات فنی ثبت‌نشده'} · ${(p.install&&p.install.steps||[]).length?fa(p.install.steps.length)+' مرحله‌ی اجرا':'راهنمای اجرا ثبت‌نشده'}</small></div>${gal}${modelHtml}<h3 style="margin:0 0 4px;font-size:18px;color:var(--ink)">${esc(p.name)}</h3>${p.desc ? `<p style="color:var(--ink-dim);font-size:13px;margin:0 0 8px">${esc(p.desc)}</p>` : ''}${price}${feats}${installHtml}<div class="grp">مشخصات فنی</div>${specs}${stdsHtml}${tcHtml}${feHtml}${ratings(p)}${trace}<div class="grp">تجربه‌های مرتبط</div><div class="related-experience-note">برای دیدن تجربه‌های تأییدشده‌ی این محصول، بخش تجربه‌ها را باز کن و نام مصالح را جست‌وجو کن. تعداد تجربه‌ی مرتبط فقط در صورت دریافت داده از سرور نمایش داده می‌شود.</div><button class="act" data-tab="community">رفتن به تجربه‌ها</button>${p.productionStages&&p.productionStages.length?`<div class="grp">شناسنامه‌ی تولید</div><div class="production-journey">${p.productionStages.map((st,i)=>`<div class="production-stage"><b>${fa(i+1)}</b><span>${esc(st.title||st.name||'مرحله')}</span>${st.source?`<small>منبع: ${esc(st.source)}</small>`:''}${st.details?`<p>${esc(st.details)}</p>`:''}</div>`).join('')}</div>`:''}${histHtml}${docsHtml}
  ${S.edit ? `<div class="ft"><button type="button" class="act act-primary" data-a="upimg" data-id="${c.id}" data-pid="${p.id}">📷 افزودن عکس از ربات (${fa(imgs.length)}/۶)</button><button type="button" class="sq" data-ep="${p.id}">✎</button></div>` : ''}
  <div class="sd-bar" style="margin-top:12px;flex-wrap:wrap"><button type="button" class="act act-primary" data-add="${p.id}">＋ برآورد</button><button type="button" class="act" data-fav="${p.id}" aria-pressed="${on}">${on ? '♥ ذخیره‌شده' : '♡ ذخیره'}</button><button type="button" class="act" data-x="cmp" data-pid="${p.id}">⇄ مقایسه</button><button type="button" class="act" data-a="shareprod" data-pid="${p.id}">اشتراک</button><button type="button" class="act" data-x="quote-open" data-co="${esc(c.id)}" data-pid="${esc(p.id)}">استعلام قیمت</button>${safe(p.catalog) ? `<a class="act" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener">${I.pdf}<span>کاتالوگ</span></a>` : ''}${safe(p.page) ? `<a class="act" data-stop href="${esc(safe(p.page))}" target="_blank" rel="noopener">صفحه‌ی رسمی</a>` : ''}</div>`);
  if(modelUrl && !customElements.get('model-viewer')) { const ms=document.createElement('script'); ms.type='module'; ms.src='https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js'; document.head.appendChild(ms); }
  const tr = $('#galT'); if (tr) tr.addEventListener('scroll', () => { const k = Math.round(Math.abs(tr.scrollLeft) / tr.clientWidth); document.querySelectorAll('#galD i').forEach((d, n) => d.classList.toggle('on', n === k)); }, { passive: true });
}
function phase3Track(event, c, p) { phase4Track(event,c,p); }
function libraryView() {
  const rows=[];
  D.companies.forEach(c=>(c.products||[]).forEach(p=>(p.docs||[]).forEach(d=>rows.push({c,p,d}))));
  if (!rows.length) return `<div class="empty"><div class="empty-icon">📚</div><h3>کتابخانه‌ی فایل‌های اجرایی</h3><p>دیتیل DWG/PDF، فمیلی رویت، فایل اسکچاپ، تکسچر و دفترچه‌ی محصول پس از ثبت ادمین اینجا نمایش داده می‌شود.</p></div>`;
  return `<div class="grp">${fa(rows.length)} فایل ثبت‌شده</div>`+rows.map(({c,p,d})=>`<div class="ln"><h4><span>${esc(d.title||d.file_name||'فایل اجرایی')}</span><em>${esc((d.type||'document').toUpperCase())}</em></h4><small>${esc(c.name)} · ${esc(p.name)}</small><div class="meta">${d.version?`<span>نسخه ${esc(d.version)}</span>`:''}${d.date?`<span>${esc(d.date)}</span>`:''}${d.size?`<span>${fa(Math.round(d.size/1024))} KB</span>`:''}</div><div class="ft"><button type="button" class="act act-primary" data-x="sendfile" data-docid="${esc(d.id)}">ارسال فایل به چت ربات</button><button type="button" class="act" data-prod="${esc(p.id)}">مشاهده محصول</button></div></div>`).join('');
}
const liveWorkshop = `<section class="rw-live" aria-label="کارگاه زنده پاکار">
      <div class="rw-live-head">
        <div>
          <span class="rw-kicker"><i></i> کارگاه زنده</span>
          <strong>مصالح، قبل از انتخاب؛ در حال زندگی‌اند.</strong>
        </div>
        <span class="rw-live-state"><b></b> LIVE</span>
      </div>

      <div class="rw-stage" aria-hidden="true">
        <svg class="rw-scene-art" viewBox="0 -34 640 360" role="presentation" focusable="false" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="rw-concrete-top" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e4ddd0"/><stop offset=".52" stop-color="#bcb3a4"/><stop offset="1" stop-color="#8b8275"/></linearGradient>
            <linearGradient id="rw-concrete-front" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b5ab9b"/><stop offset="1" stop-color="#72695e"/></linearGradient>
            <linearGradient id="rw-concrete-side" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a39a8b"/><stop offset="1" stop-color="#514d47"/></linearGradient>
            <linearGradient id="rw-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b7ddd6"/><stop offset=".42" stop-color="#477b77"/><stop offset="1" stop-color="#1a3334"/></linearGradient>
            <linearGradient id="rw-steel" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#b9c5c2"/><stop offset=".45" stop-color="#596563"/><stop offset="1" stop-color="#252e30"/></linearGradient>
            <linearGradient id="rw-yellow" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffdc83"/><stop offset=".5" stop-color="#e5a83e"/><stop offset="1" stop-color="#9e6529"/></linearGradient>
            <linearGradient id="rw-rust" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ed9b7a"/><stop offset=".48" stop-color="#c4674d"/><stop offset="1" stop-color="#7e3d30"/></linearGradient>
            <linearGradient id="rw-fork" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7cd73"/><stop offset=".65" stop-color="#d18b30"/><stop offset="1" stop-color="#8e5924"/></linearGradient>
            <linearGradient id="rw-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bd9668"/><stop offset="1" stop-color="#68482f"/></linearGradient>
            <radialGradient id="rw-ground-glow"><stop stop-color="#9ed7c7" stop-opacity=".17"/><stop offset="1" stop-color="#9ed7c7" stop-opacity="0"/></radialGradient>
            <pattern id="rw-brick-pattern" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill="#b65d46"/><path d="M0 0H20M0 5H20M10 0V5M0 5V10" stroke="#e49a7e" stroke-opacity=".58" stroke-width=".8"/></pattern>
            <pattern id="rw-mesh" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0L8 8M8 0L0 8" stroke="#c2d0cb" stroke-opacity=".26" stroke-width=".7"/></pattern>
            <filter id="rw-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
          </defs>
          <!-- atmospheric blueprint backdrop -->
          <ellipse cx="344" cy="250" rx="260" ry="110" fill="url(#rw-ground-glow)"/>
          <g fill="none" stroke="#d5e2dc" stroke-opacity=".12" stroke-width=".8">
            <path d="M28 230L320 72L612 230L320 320Z" stroke-dasharray="3 6"/>
            <path d="M70 235L320 100L570 235M118 260L320 150L522 260M168 285L320 203L472 285"/>
            <path d="M320 70V318M80 205L560 205M130 178L510 178" stroke-dasharray="2 7"/>
          </g>
          <!-- site shadow and raised foundation -->
          <ellipse cx="335" cy="278" rx="238" ry="29" fill="#000" opacity=".32" filter="url(#rw-shadow)"/>
          <path d="M70 258L316 127L575 258L327 329Z" fill="#13191a" opacity=".65"/>
          <path d="M72 247L318 116L574 247L328 318Z" fill="#323b3a" stroke="#a9b9b1" stroke-opacity=".32" stroke-width="1.2"/>
          <path d="M72 247L328 318V329L72 258Z" fill="#202827"/>
          <path d="M328 318L574 247V258L328 329Z" fill="#171e1f"/>
          <path d="M88 247L318 130L558 247L328 310Z" fill="none" stroke="#d9e1db" stroke-opacity=".18" stroke-width="1"/>
          <!-- tower crane: triangulated mast and jib -->
          <g class="rw-svg-crane">
            <path d="M242 253L252 253L260 76L250 76Z" fill="url(#rw-yellow)" stroke="#594329" stroke-width="1"/>
            <path d="M247 91L258 108L246 124L257 141L245 158L256 175L244 192L255 209L243 226L252 253" fill="none" stroke="#4d3c28" stroke-width="2"/>
            <path d="M257 91L246 108L258 124L247 141L259 158L248 175L260 192L249 209L261 226" fill="none" stroke="#f5c766" stroke-width="1.5"/>
            <path d="M250 78L210 70L205 74L250 86L292 76L296 71Z" fill="#d69b3c" stroke="#694d2a" stroke-width="1"/>
            <path d="M252 78L430 58L437 63L257 87Z" fill="url(#rw-yellow)" stroke="#604729" stroke-width="1"/>
            <path d="M269 78L287 84L304 72L323 81L342 68L360 77L378 65L396 72L416 60" fill="none" stroke="#614824" stroke-width="1.5"/>
            <path d="M266 78L286 64L306 76L326 62L346 74L366 60L386 71L407 57" fill="none" stroke="#f4c15e" stroke-width="1.2"/>
            <path d="M252 82L210 70L207 65L215 64L251 74" fill="#e8b451" stroke="#594329" stroke-width="1"/>
            <rect x="242" y="67" width="20" height="17" rx="2" fill="#e3aa49" stroke="#4b3b28" stroke-width="1.2"/>
            <path d="M250 66L250 59L257 59L257 67" fill="none" stroke="#e3aa49" stroke-width="2"/>
            <g class="rw-svg-hoist">
              <path d="M388 63V125" stroke="#d8d8cb" stroke-width="1.6"/>
              <path d="M384 125Q388 133 393 125" fill="none" stroke="#d8d8cb" stroke-width="2"/>
              <g class="rw-svg-load">
                <path d="M378 128L397 128L402 140L373 140Z" fill="#8e4d3c" stroke="#f4c1a7" stroke-opacity=".65" stroke-width="1"/>
                <path d="M378 128L397 128L397 136L378 136Z" fill="url(#rw-rust)"/>
                <path d="M373 140L402 140L397 145L378 145Z" fill="#61392f"/>
              </g>
            </g>
          </g>
          <!-- building core: slab, columns, exposed structure -->
          <g class="rw-svg-building">
            <path d="M286 134L390 81L475 122L369 177Z" fill="#101516" opacity=".6"/>
            <path d="M282 128L386 75L467 114L363 169Z" fill="url(#rw-concrete-top)" stroke="#e8e1d4" stroke-opacity=".62" stroke-width="1.1"/>
            <path d="M282 128L363 169V265L282 223Z" fill="url(#rw-concrete-front)" stroke="#d9d0c0" stroke-opacity=".5" stroke-width="1"/>
            <path d="M363 169L467 114V211L363 265Z" fill="url(#rw-concrete-side)" stroke="#c8bfb0" stroke-opacity=".38" stroke-width="1"/>
            <!-- floor slab edges -->
            <path d="M282 160L363 201L467 146L467 154L363 209L282 168Z" fill="#d4cbbc" stroke="#6d675e" stroke-width=".8"/>
            <path d="M282 192L363 233L467 178L467 186L363 241L282 200Z" fill="#b6ad9e" stroke="#5c5952" stroke-width=".8"/>
            <!-- structural columns and open bays -->
            <g fill="#d0c7b8" stroke="#615d55" stroke-width="1">
              <path d="M294 133L301 136V222L294 218Z"/><path d="M326 149L333 152V238L326 234Z"/><path d="M356 164L363 168V263L356 259Z"/>
              <path d="M376 119L382 116V207L376 211Z"/><path d="M409 102L415 99V190L409 194Z"/><path d="M440 88L446 85V176L440 179Z"/>
            </g>
            <!-- glazed bays and shadowed interior -->
            <g stroke="#d7e7df" stroke-opacity=".48" stroke-width="1">
              <path d="M302 142L322 152V179L302 169Z" fill="url(#rw-glass)"/><path d="M334 158L351 166V193L334 184Z" fill="url(#rw-glass)"/>
              <path d="M302 175L322 185V211L302 201Z" fill="#263b3a"/><path d="M334 191L351 200V226L334 217Z" fill="url(#rw-glass)"/>
              <path d="M384 124L402 114V139L384 149Z" fill="url(#rw-glass)"/><path d="M416 107L434 97V122L416 132Z" fill="url(#rw-glass)"/>
              <path d="M384 157L402 147V172L384 182Z" fill="#243d3b"/><path d="M416 140L434 130V155L416 165Z" fill="url(#rw-glass)"/>
            </g>
            <!-- unfinished facade / rebar -->
            <path d="M285 128L386 75L467 114L363 169Z" fill="url(#rw-mesh)" opacity=".6"/>
            <g stroke="#b9c8c1" stroke-width="1.2" stroke-linecap="round" opacity=".82">
              <path d="M291 122L291 107M299 118L299 103M307 114L307 99M315 110L315 95M323 106L323 91M331 102L331 87M339 98L339 83M347 94L347 79M355 90L355 75M363 86L363 71M371 82L371 67"/>
            </g>
            <!-- side scaffold with diagonal bracing -->
            <g fill="none" stroke="#c4cfca" stroke-width="1.6" stroke-linecap="round" opacity=".92">
              <path d="M470 114L492 125V225L470 213M492 125L506 117V216L492 225M470 146L506 158M470 180L506 192M470 114L506 126M470 213L506 216"/>
              <path d="M470 114L506 158M506 126L470 180M470 146L506 192M506 158L470 213M470 180L506 216" stroke="#81918b" stroke-width="1.1"/>
            </g>
            <path d="M467 114L492 125L506 117L481 106Z" fill="#d4cbbb" stroke="#6e6a61" stroke-width=".8"/>
          </g>
          <!-- small workers: high-vis PPE, purposeful poses -->
          <g class="rw-svg-worker rw-worker-one" transform="translate(278 228)">
            <ellipse cx="0" cy="21" rx="11" ry="3.5" fill="#000" opacity=".32"/>
            <path d="M-5 10L-7 20L-3 21L1 12M3 11L5 20L9 19L7 9" fill="#252c2d" stroke="#171c1d" stroke-width="1"/>
            <path d="M-7 -1L7 -1L9 11L-8 11Z" fill="#3c8579" stroke="#c5d8d0" stroke-opacity=".5" stroke-width=".8"/>
            <path d="M-7 3L8 4M-5 8L8 8" stroke="#f1c45f" stroke-width="2"/>
            <circle cx="0" cy="-7" r="5.5" fill="#d6a77f"/>
            <path d="M-7 -8Q-6 -16 1 -15Q7 -14 7 -8Z" fill="url(#rw-yellow)" stroke="#72552d" stroke-width=".8"/>
            <path d="M-6 -7L7 -7" stroke="#ffe6a1" stroke-width="1.2"/>
            <path d="M-6 1L-13 7L-10 10L-3 5M6 1L12 -3L14 0L8 7" fill="none" stroke="#d6a77f" stroke-width="3" stroke-linecap="round"/>
            <path d="M-4 -1L-1 3L2 -1" fill="none" stroke="#e2e9df" stroke-width="1"/>
          </g>
          <g class="rw-svg-worker rw-worker-two" transform="translate(450 241) scale(.9)">
            <ellipse cx="0" cy="20" rx="10" ry="3" fill="#000" opacity=".32"/>
            <path d="M-5 8L-6 19L-2 20L1 10M3 9L5 19L9 18L7 8" fill="#283032" stroke="#141a1b" stroke-width="1"/>
            <path d="M-7 -2L7 -2L9 10L-8 10Z" fill="#d58b37" stroke="#f8d58b" stroke-opacity=".6" stroke-width=".8"/>
            <path d="M-7 3L8 4M-5 8L8 8" stroke="#f5e5b3" stroke-width="1.7"/>
            <circle cx="0" cy="-8" r="5.2" fill="#c9926e"/>
            <path d="M-7 -9Q-6 -16 1 -16Q7 -15 7 -9Z" fill="url(#rw-yellow)" stroke="#72552d" stroke-width=".8"/>
            <path d="M-5 0L-12 -5L-14 -2L-7 5M6 0L12 5L10 8L4 5" fill="none" stroke="#c9926e" stroke-width="3" stroke-linecap="round"/>
          </g>
          <!-- brick stacks and timber pallet -->
          <g transform="translate(160 244)">
            <path d="M-4 24L35 4L79 24L39 45Z" fill="#090d0e" opacity=".42"/>
            <path d="M0 12L38 -7L74 10L36 29Z" fill="url(#rw-brick-pattern)" stroke="#f1b29a" stroke-opacity=".55" stroke-width=".8"/>
            <path d="M0 12L36 29V38L0 21Z" fill="#8d4738"/><path d="M36 29L74 10V19L36 38Z" fill="#75382e"/>
            <path d="M6 3L43 20M18 -3L55 14M30 -8L67 9" stroke="#e9a188" stroke-opacity=".65" stroke-width="1"/>
            <path d="M-3 39L36 57L79 36L39 18Z" fill="url(#rw-wood)" stroke="#4b3727" stroke-width="1"/>
            <path d="M-3 39L-3 44L36 62L79 41L79 36L36 57Z" fill="#503a29"/>
            <path d="M4 39L43 57M20 31L59 49M37 24L76 42" stroke="#d0a878" stroke-opacity=".55" stroke-width="2"/>
          </g>
          <!-- stone sample crates / slabs -->
          <g transform="translate(498 251)">
            <ellipse cx="0" cy="21" rx="45" ry="14" fill="#000" opacity=".28"/>
            <path d="M-37 2L-4 -15L34 2L1 20Z" fill="#d9d1c4" stroke="#f0e9dd" stroke-width=".8"/>
            <path d="M-37 2L1 20V31L-37 13Z" fill="#8b8174" stroke="#d4c9b8" stroke-width=".7"/>
            <path d="M1 20L34 2V13L1 31Z" fill="#5c5852" stroke="#b6ab9b" stroke-width=".7"/>
            <path d="M-31 -3L3 13M-21 -8L13 8M-11 -12L23 4" stroke="#a69a89" stroke-width="1.1" opacity=".7"/>
            <path d="M-29 -10L3 -26L31 -12L0 4Z" fill="#a9a093" stroke="#e1d8ca" stroke-width=".8"/>
            <path d="M-29 -10L0 4V10L-29 -4Z" fill="#6d675e"/><path d="M0 4L31 -12V-6L0 10Z" fill="#57534d"/>
          </g>
          <!-- compact forklift, moving very subtly -->
          <g class="rw-svg-forklift" transform="translate(92 264)">
            <ellipse cx="28" cy="25" rx="36" ry="7" fill="#000" opacity=".3"/>
            <path d="M3 8L11 -3L34 -3L42 8L42 20L2 20Z" fill="url(#rw-fork)" stroke="#6b4b24" stroke-width="1"/>
            <path d="M12 -3L15 -16L29 -16L34 -3Z" fill="#d7a03e" stroke="#704d23" stroke-width="1"/>
            <path d="M16 -5L18 -13L27 -13L30 -5Z" fill="url(#rw-glass)" stroke="#fff1c5" stroke-opacity=".5" stroke-width=".8"/>
            <path d="M35 -8L39 -8L39 18L35 18Z" fill="#d9a84c" stroke="#664c2a" stroke-width=".8"/>
            <path d="M38 17L62 17L62 20L38 20Z" fill="#b7c1bd" stroke="#39413f" stroke-width=".8"/>
            <path d="M3 7L-2 7L-2 16L3 16" fill="#f1c05c"/>
            <circle cx="11" cy="20" r="7" fill="#202628" stroke="#687270" stroke-width="2"/><circle cx="11" cy="20" r="2.2" fill="#c1c8c3"/>
            <circle cx="36" cy="20" r="7" fill="#202628" stroke="#687270" stroke-width="2"/><circle cx="36" cy="20" r="2.2" fill="#c1c8c3"/>
            <path d="M4 2L8 2M31 2L35 2" stroke="#fff0bd" stroke-width="1.4"/>
          </g>
          <!-- subtle measurement markers and material labels -->
          <g fill="none" stroke="#9ce5d2" stroke-opacity=".6" stroke-width=".9">
            <path d="M270 282L270 294L298 294"/><path d="M456 275L456 287L474 287"/>
            <circle cx="270" cy="282" r="2.5" fill="#9ce5d2" stroke="none"/><circle cx="456" cy="275" r="2.5" fill="#9ce5d2" stroke="none"/>
          </g>
          <g font-family="Arial,sans-serif" font-size="7" letter-spacing="1.2" fill="#d6e8e0" fill-opacity=".7">
            <text x="281" y="302">STRUCTURE / 03</text><text x="467" y="296">STONE / A2</text>
          </g>
          <path d="M112 300L143 284L160 292L129 308Z" fill="#e2b15b" opacity=".75"/>
          <path d="M118 299L143 286" stroke="#fff0c4" stroke-width="1" opacity=".75"/>
        </svg>
        <div class="rw-material-card">
          <small>در حال بررسی</small><strong>سنگ طبیعی</strong><span><i></i><i></i><i></i><em>۳۶۰°</em></span>
        </div>
        <div class="rw-price-card"><small>استعلام قیمت</small><strong>۲,۸۵۰,۰۰۰</strong><span>تومان / m²</span></div>
        <div class="rw-route"><i></i><i></i><i></i><span>ارسال به پروژه</span></div>
      </div>

      <div class="rw-live-foot">
        <span><i class="rw-mini-dot"></i> بررسی متریال</span>
        <span><i class="rw-mini-dot amber"></i> بارگیری</span>
        <span><i class="rw-mini-dot coral"></i> اجرای پروژه</span>
      </div>
    </section>`;
function projectsView() {
  const rows = S.projects || [];
  const savedProjects = rows.length
    ? `<div class="projects-list">${rows.map(pr => `<article class="ln project-card">
        <header class="project-card-head"><h4>${esc(pr.name || 'پروژه بدون نام')}</h4><time datetime="${esc((pr.updatedAt || '').slice(0,10))}">${esc((pr.updatedAt || '').slice(0,10) || 'تاریخ ثبت نشده')}</time></header>
        ${pr.client ? `<p class="project-client">کارفرما: ${esc(pr.client)}</p>` : ''}
        ${pr.notes ? `<p class="project-notes">${esc(pr.notes)}</p>` : ''}
        <div class="meta project-meta"><span>${fa((pr.rooms || []).length)} فضا</span><span>${fa((pr.estimate || []).length)} قلم برآورد</span></div>
        <div class="ft project-actions"><button type="button" class="act act-primary" data-x="project-load" data-pid="${esc(pr.id)}">بارگذاری پروژه</button><button type="button" class="act" data-x="project-delete" data-pid="${esc(pr.id)}">حذف</button></div>
      </article>`).join('')}</div>`
    : '<div class="empty project-empty"><p>هنوز پروژه‌ای ذخیره نشده است.</p></div>';
  return `<div class="projects-layout">${liveWorkshop}<section class="tot projects-summary"><b>پروژه‌ها روی سرور پاکار</b><p class="hint">پروژه‌ها به حساب تلگرام متصل‌اند؛ برای ذخیره‌ی دائمی، دیسک پایدار Render لازم است.</p><div class="ft project-summary-actions"><button type="button" class="act act-primary" data-x="project-save">ذخیره‌ی وضعیت فعلی</button><button type="button" class="act" data-x="project-new">پروژه‌ی جدید</button><button type="button" class="act" data-x="project-refresh">همگام‌سازی</button></div></section>${savedProjects}</div>`;
}
function pricesView() {
  const rows=[]; D.companies.forEach(c=>(c.products||[]).forEach(p=>{if((p.priceLog||[]).length) rows.push({c,p,log:p.priceLog});}));
  if(!rows.length) return '<div class="empty"><div class="empty-icon">↗</div><h3>تاریخچه‌ی قیمت</h3><p>روند قیمت پس از ثبت تغییر قیمت توسط ادمین و همراه تاریخ نمایش داده می‌شود. قیمت ثبت‌نشده به‌معنای «استعلام» است.</p></div>';
  return rows.map(({c,p,log})=>{const last=log[log.length-1], stale=staleDays(last.date);return `<div class="ln"><h4><span>${esc(p.name)}</span><em>${esc(c.name)}</em></h4><div class="pc">${last.price?fa(last.price)+' تومان':'استعلام'} <small>/ ${esc(last.unit||p.unit)}</small></div><div class="meta"><span>آخرین ثبت: ${esc(last.date||'نامشخص')}</span>${stale!=null&&stale>30?'<span class="wr">قدیمی‌تر از ۳۰ روز</span>':''}</div><table class="spt">${log.slice(-6).reverse().map(x=>`<tr><td>${esc(x.date||'—')}</td><td>${x.price?fa(x.price)+' تومان':'استعلام'}</td><td>${esc(x.source||'منبع ثبت نشده')}</td></tr>`).join('')}</table><button class="act" data-prod="${esc(p.id)}">شناسنامه‌ی محصول</button></div>`}).join('');
}
function dealersView() {
  const rows=[]; D.companies.forEach(c=>{(c.dealers||[]).forEach(d=>rows.push({c,d}));});
  return rows.length?rows.map(({c,d})=>`<div class="ln"><h4><span>${esc(d.name||c.name)}</span><em>${esc(d.city||'شهر ثبت نشده')}</em></h4>${d.address?`<p>${esc(d.address)}</p>`:''}${d.phone?`<div class="ft"><a class="act act-primary" href="tel:${esc(d.phone.replace(/[^+\d]/g,''))}">تماس با نمایندگی</a><button class="act" data-x="quote-open" data-co="${esc(c.id)}" data-pid="">استعلام قیمت</button></div>`:`<button class="act act-primary" data-x="quote-open" data-co="${esc(c.id)}">درخواست معرفی نمایندگی</button>`}</div>`).join(''):'<div class="empty"><div class="empty-icon">⌖</div><h3>نمایندگی‌ها</h3><p>اطلاعات نمایندگی هنوز ثبت نشده. می‌توانی از داخل شناسنامه‌ی محصول درخواست استعلام بفرستی؛ اطلاعات تماس فقط پس از تأیید ثبت می‌شود.</p>'+D.companies.map(c=>`<button class="act" data-x="quote-open" data-co="${esc(c.id)}">استعلام از ${esc(c.name)}</button>`).join(' ')+'</div>';
}
const PROBLEMS = [
  {id:'basement_moisture',title:'رطوبت زیرزمین',groups:['عایق رطوبتی','آب‌بندی','ملات'],reason:'برای انتخاب سامانه، ابتدا منشأ رطوبت، فشار آب و وضعیت بستر باید مشخص شود.'},
  {id:'light_roof',title:'کاهش وزن سقف',groups:['سبک‌سازی','لیکا','دانه سبک'],reason:'وزن نهایی به چگالی واقعی، ضخامت، رطوبت و لایه‌های کامل کف‌سازی وابسته است.'},
  {id:'cold_facade',title:'نمای ساختمان در اقلیم سرد',groups:['عایق حرارتی','نما','چسب'],reason:'پل حرارتی، آب‌بندی، یخ‌زدگی و سازگاری لایه‌ها باید هم‌زمان بررسی شوند.'},
  {id:'hot_dry',title:'پوسته در اقلیم گرم و خشک',groups:['عایق حرارتی','سایه‌انداز','نما'],reason:'جهت‌گیری، تابش، جرم حرارتی، سایه و تهویه در کنار مشخصات محصول مهم‌اند.'},
  {id:'fire',title:'نیاز به عملکرد حریق',groups:['عایق','پوشش ضدحریق','پنل'],reason:'فقط گزارش آزمون و طبقه‌بندی معتبر همان سامانه قابل استناد است؛ ادعای تبلیغاتی کافی نیست.'},
  {id:'sound',title:'کاهش انتقال صدا',groups:['عایق صوتی','پنل','پشم معدنی'],reason:'عملکرد صوتی به جزئیات اتصال، درزبندی و مجموعه‌ی کامل دیوار یا سقف وابسته است.'},
  {id:'wet_area',title:'آب‌بندی سرویس و حمام',groups:['عایق رطوبتی','چسب کاشی','آب‌بندی'],reason:'جزئیات گوشه‌ها، کف‌شور، نفوذی‌ها و تست آب‌بندی باید در نظر گرفته شود.'},
  {id:'fast_finish',title:'اجرای سریع نازک‌کاری',groups:['گچ','گچ ماشینی','ملات آماده'],reason:'زمان اجرا به آماده‌سازی زیرکار، شرایط محیطی، تجهیزات و دستورالعمل سازنده وابسته است.'},
  {id:'floor_weight',title:'وزن و تراز کف‌سازی',groups:['سبک‌سازی','لیکا','کف‌سازی'],reason:'ضخامت واقعی، چگالی و لایه‌های شیب‌بندی و پوشش نهایی باید جداگانه محاسبه شوند.'},
  {id:'tile_waste',title:'کاهش پرت کاشی و سرامیک',groups:['کاشی','سرامیک','چسب کاشی'],reason:'ابعاد قطعه، الگوی چیدمان، بندها، شکستگی و پیچیدگی محیط بر پرت اثر دارند.'}
];
function wizardView() {
  const w=S.wizard, prob=PROBLEMS.find(x=>x.id===w.problem)||PROBLEMS[0];
  const matched=[]; D.companies.forEach(c=>(c.products||[]).forEach(p=>{const text=nz((c.cat||'')+' '+(p.group||'')+' '+p.name+' '+(p.tags||[]).join(' ')); if(prob.groups.some(g=>text.includes(nz(g)))) matched.push({c,p});}));
  return `<div class="tot"><b>مسئله‌ی پروژه را انتخاب کن</b><p class="hint">این ابزار فهرست اولیه برای بررسی است، نه دستور طراحی یا جایگزین محاسبات مهندسی. هیچ گزینه‌ای بدون داده‌ی معتبر رتبه‌بندی نمی‌شود.</p><label class="fl"><span>مسئله</span><select data-i="wizard" data-k="problem">${PROBLEMS.map(x=>`<option value="${x.id}" ${x.id===w.problem?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label><div class="rw"><label class="fl"><span>اقلیم پروژه</span><select data-i="wizard" data-k="climate"><option value="hotdry" ${w.climate==='hotdry'?'selected':''}>گرم و خشک</option><option value="cold" ${w.climate==='cold'?'selected':''}>سرد</option><option value="humid" ${w.climate==='humid'?'selected':''}>مرطوب</option><option value="mixed" ${w.climate==='mixed'?'selected':''}>معتدل / ترکیبی</option></select></label><label class="fl"><span>محدوده‌ی بودجه</span><select data-i="wizard" data-k="budget"><option value="low" ${w.budget==='low'?'selected':''}>محدود</option><option value="mid" ${w.budget==='mid'?'selected':''}>متوسط</option><option value="high" ${w.budget==='high'?'selected':''}>باز</option></select></label></div><label class="fl"><span>روش اجرا</span><select data-i="wizard" data-k="method"><option value="standard" ${w.method==='standard'?'selected':''}>اجرای متعارف</option><option value="dry" ${w.method==='dry'?'selected':''}>خشک / پیش‌ساخته</option><option value="wet" ${w.method==='wet'?'selected':''}>تر / ملات‌محور</option></select></label></div><div class="ln"><h4>${esc(prob.title)}</h4><p>${esc(prob.reason)}</p><div class="meta"><span>وضعیت محتوا: راهنمای اولیه، نیازمند بررسی متخصص</span></div><div class="grp">مواردی که قبل از انتخاب باید بررسی شوند</div><ul class="fts"><li>دیتاشیت و دستورالعمل معتبر سازنده</li><li>سازگاری محصول با زیرکار و لایه‌های مجاور</li><li>جزئیات اتصال، آب‌بندی و شرایط اجرای واقعی</li><li>ضوابط و مقررات لازم‌الاجرا برای پروژه</li></ul></div><div class="grp">محصولات مرتبط در کاتالوگ</div>${matched.length?matched.slice(0,8).map(({c,p})=>`<div class="ln"><h4><span>${esc(p.name)}</span><em>${esc(c.name)}</em></h4><p>${esc(p.desc||'برای تطبیق با شرایط پروژه، دیتاشیت و جزئیات اجرا بررسی شود.')}</p><button class="act act-primary" data-prod="${esc(p.id)}">مشاهده شناسنامه</button></div>`).join(''):'<div class="empty"><p>محصول مرتبطی در داده‌های فعلی پیدا نشد. این به معنی نامناسب بودن محصولی خاص نیست؛ داده‌ی کاتالوگ را تکمیل کن.</p></div>'}<div class="tot"><b>قبل از تصمیم نهایی</b><p class="hint">این راهنما توسط متخصص پروژه‌ی شما تأیید نشده است. برای سازه، حریق، آب‌بندی و عملکرد حرارتی از طراح مسئول و مدارک رسمی استفاده کن.</p></div>`;
}
function educationView() {
 const rows=[]; D.companies.forEach(c=>(c.products||[]).forEach(p=>{if(p.install && ((p.install.steps||[]).length||(p.install.mistakes||[]).length)) rows.push({c,p});}));
 const q=nz(S.guideQ||''); const cats=[...new Set(rows.map(x=>x.c.cat).filter(Boolean))];
 const verifiedRows=rows.filter(({p})=>p.install&&p.install.source&&p.install.verifiedBy).length;
 const totalSteps=rows.reduce((n,{p})=>n+(p.install.steps||[]).length,0);
 const filtered=rows.filter(({c,p})=>(!S.guideCat||c.cat===S.guideCat)&&(!q||nz([c.name,c.cat,p.name,p.group,p.desc,p.install.source,(p.install.steps||[]).map(x=>typeof x==='string'?x:(x.text||x.title||'')).join(' '),(p.install.mistakes||[]).map(x=>typeof x==='string'?x:(x.text||x.title||'')).join(' ')].join(' ')).includes(q)));
 const intro=`<section class="guide-intro"><div class="guide-intro-main"><div class="guide-intro-kicker"><span>${uiIcon('book')}</span><b>راهنمای اجرای پاکار</b><em>FIELD GUIDE / 02</em></div><h2>از شناخت متریال تا اجرای اصولی</h2><p>راهنمای فشرده‌ی اجرا؛ مراحل درست، نقاط کنترل و خطاهای پرریسک را قبل از اجرا سریع مرور کن.</p></div><div class="guide-intro-stats"><div><b>${fa(rows.length)}</b><small>پرونده</small></div><div><b>${fa(verifiedRows)}</b><small>بازبینی‌شده</small></div><div><b>${fa(totalSteps)}</b><small>مرحله</small></div></div></section>`;
 const tools=`<div class="guide-toolbar glass-panel"><label class="guide-search"><span>${uiIcon('search')}</span><input type="search" data-guide-search value="${esc(S.guideQ||'')}" placeholder="جست‌وجوی محصول، دسته یا روش اجرا…"></label><select data-guide-cat aria-label="فیلتر دسته"><option value="">همه‌ی دسته‌ها</option>${cats.map(c=>`<option ${S.guideCat===c?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>`;
 if(!rows.length) return `${intro}<div class="field-empty"><div class="field-empty-icon"><span>R</span></div><div class="field-empty-copy"><span class="eyebrow">LIBRARY STATUS</span><h3>پرونده‌های اجرا در حال تکمیل‌اند</h3><p>هنوز مراحل اجرا و خطاهای اختصاصی به شناسنامه‌ی محصولات متصل نشده‌اند.</p><div class="field-empty-actions"><button class="act act-primary" data-tab="cat">مرور محصولات</button>${S.admin?'<button class="act" data-x="admin-catalog">تکمیل اطلاعات محصولات</button>':''}</div></div></div>`;
 const files=filtered.length?filtered.map(({c,p},idx)=>{
   const ins=p.install||{}, steps=ins.steps||[], mistakes=ins.mistakes||[], verified=!!(ins.source&&ins.verifiedBy);
   const key='rq.guide.check.'+p.id, checked=ld(key,[]), doneCount=checked.filter(i=>i<steps.length).length;
   const stepHtml=steps.length?`<ol class="guide-steps">${steps.map((x,i)=>{const text=typeof x==='string'?x:(x.text||x.title||'');const done=checked.includes(i);return `<li class="${done?'done':''}"><label><input type="checkbox" data-guide-check data-pid="${esc(p.id)}" data-step="${i}" ${done?'checked':''}><span class="step-no">${fa(i+1)}</span><span>${esc(text)}</span></label></li>`}).join('')}</ol><div class="guide-progress"><span style="width:${Math.round(doneCount/steps.length*100)}%"></span></div><small class="guide-progress-note">${fa(doneCount)} از ${fa(steps.length)} مرحله انجام‌شده</small>`:'<p class="hint">مراحل اجرا ثبت نشده‌اند.</p>';
   const riskHtml=mistakes.length?`<div class="guide-mistakes">${mistakes.map(m=>{const text=typeof m==='string'?m:(m.text||m.title||'');const severity=typeof m==='object'?(m.severity||'important'):'important';const consequence=typeof m==='object'?(m.consequence||''):'';const sevLabel={critical:'بحرانی',important:'مهم',minor:'مهم'}[severity]||'مهم';return `<div class="guide-mistake"><span class="severity ${severity}">${sevLabel}</span><p>${esc(text)}</p>${consequence?`<small>${esc(consequence)}</small>`:''}</div>`}).join('')}</div>`:'<p class="hint">خطای مشخصی ثبت نشده است.</p>';
   return `<details class="guide-file" ${idx===0?'open':''}><summary class="guide-file-head"><div class="guide-symbol">${logoBox(c,'mono')}</div><div class="guide-file-title"><span class="guide-kicker">${esc(c.cat||p.group||'راهنمای اجرا')}</span><h3>${esc(p.name)}</h3><small>${esc(c.name)}</small></div><span class="guide-state ${verified?'verified':'unverified'}">${verified?uiIcon('shield')+' بازبینی‌شده':uiIcon('warn')+' نیازمند بررسی'}</span><span class="guide-chevron" aria-hidden="true"></span></summary><div class="guide-meta">${ins.source?`<span>منبع: ${esc(ins.source)}</span>`:'<span class="guide-warning">منبع ثبت نشده</span>'}${ins.verifiedBy?`<span>بازبین: ${esc(ins.verifiedBy)} · ${esc(ins.verifiedAt||'تاریخ نامشخص')}</span>`:''}${ins.standard?`<span>استاندارد: ${esc(ins.standard)}</span>`:''}</div><div class="guide-dual"><section class="guide-correct"><h4><span class="guide-section-symbol">${uiIcon('check')}</span><b>مراحل صحیح اجرا</b><small>${fa(steps.length)} مرحله</small></h4>${stepHtml}</section><section class="guide-risk"><h4><span class="guide-section-symbol">${uiIcon('warn')}</span><b>خطاهای پرریسک</b><small>${fa(mistakes.length)} مورد</small></h4>${riskHtml}</section></div><div class="guide-actions"><button class="act act-primary" data-prod="${esc(p.id)}">شناسنامه‌ی محصول <span>↗</span></button>${ins.video_url&&safe(ins.video_url)?`<a class="act" data-stop href="${esc(safe(ins.video_url))}" target="_blank" rel="noopener">ویدئوی اجرا</a>`:''}<button class="act" data-guide-print="${esc(p.id)}">چاپ</button><button class="act" data-guide-share="${esc(p.id)}">اشتراک</button></div></details>`;
 }).join(''):`<div class="field-no-results"><b>نتیجه‌ای پیدا نشد</b><span>عبارت جست‌وجو یا فیلتر دسته را تغییر بده.</span><button class="act" data-x="guide-reset">پاک‌کردن فیلترها</button></div>`;
 return `${intro}${tools}<div class="guide-list">${files}</div>`;
}
function communityView() {
 if(!S.communityData){ if(!S.communityLoading){S.communityLoading=true;api('community').then(r=>S.communityData=r).catch(()=>S.communityData={ok:false,items:[],mine:[]}).finally(()=>{S.communityLoading=false;if(S.tab==='community')render();});} return `<div class="field-loading"><span class="field-loading-mark">R</span><b>در حال آماده‌سازی تجربه‌های پاکار</b><small>در حال دریافت یادداشت‌های کارگاهی…</small><div><i></i></div></div>`; }
 const d=S.communityData; if(!d.ok)return `<section class="field-hero community-hero"><div class="field-hero-copy"><span class="eyebrow"><i></i>یادداشت‌های میدانی / ۰۳</span><h2>تجربه‌هایی از<br><em>دلِ کارگاه</em></h2><p>گزارش‌های اجرایی، نکته‌ها و هشدارهای ثبت‌شده را در یک فضای مشترک دنبال کن.</p></div><div class="field-hero-art community-art" aria-hidden="true"><div class="community-art-board"><span></span><span></span><span></span><b>FIELD<br>NOTES</b></div><div class="community-art-pin pin-a"></div><div class="community-art-pin pin-b"></div><div class="community-art-pin pin-c"></div></div></section><div class="field-empty"><div class="field-empty-icon"><span>!</span></div><div class="field-empty-copy"><h3>برای مشاهده تجربه‌ها وارد تلگرام شو</h3><p>نمایش و ثبت تجربه‌ها از طریق نسخه‌ی تلگرامی پاکار و ارتباط با سرور انجام می‌شود.</p></div></div>`;
 const allPublic=(d.items||[]).slice().reverse(); const mine=(d.mine||[]).slice().reverse(); const q=nz(S.communityQ||'');
 const typeLabel={success:'تجربه موفق',warning:'هشدار اجرایی',tip:'نکته فنی',question:'پرسش از جمع'};
 const typeMeta={success:{icon:uiIcon('check'),sub:'نتیجه اجرا'},warning:{icon:uiIcon('warn'),sub:'ریسک و خطا'},tip:{icon:uiIcon('tip'),sub:'نکته کاربردی'},question:{icon:uiIcon('question'),sub:'گفت‌وگو'}};
 const typeRows=allPublic.filter(x=>S.communityType==='all'||(x.type||'success')===S.communityType);
 const publicRows=typeRows.filter(x=>!q||nz([x.title,x.material,x.details,x.context,x.user,x.username].join(' ')).includes(q));
 const featured=allPublic.find(x=>x.featured)||allPublic[0];
 const verifiedCount=allPublic.filter(x=>x.expert_verified).length;
 const totalVotes=allPublic.reduce((n,x)=>n+(Number(x.votes)||0),0);
 const search=`<label class="field-search"><span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.3 4.3"/></svg></span><input type="search" data-community-search value="${esc(S.communityQ||'')}" placeholder="جست‌وجو در تجربه‌ها، متریال یا شرایط پروژه…"><kbd>جست‌وجو</kbd></label>`;
 const hero=`<section class="community-compact-intro"><div><h2>تجربه‌های واقعی از کارگاه</h2><p>گزارش کوتاهِ اجرا، نتیجه و شرایط پروژه؛ با انتشار پس از بررسی.</p></div><button class="act act-primary" data-x="community-new">ثبت تجربه</button></section>`;
 const stats=`<div class="field-metrics community-metrics"><div><span class="field-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h14v15H5zM8 8h8M8 11.5h8M8 15h5"/></svg></span><small>تجربه‌های منتشرشده</small><b>${fa(allPublic.length)}</b></div><div><span class="field-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.2 4.2L19 7"/></svg></span><small>دارای نشان تخصص</small><b>${fa(verifiedCount)}</b></div><div><span class="field-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16M8 15l4-4 3 2 5-7"/></svg></span><small>رأی‌های مفید</small><b>${fa(totalVotes)}</b></div></div>`;
 const featuredBlock=featured?`<article class="featured-experience"><div class="featured-experience-top"><span class="featured-label"><i></i>یادداشت منتخب</span><span class="featured-index">FIELD NOTE / ${fa(allPublic.indexOf(featured)+1)}</span></div><div class="featured-experience-body"><div class="featured-experience-mark">${(typeMeta[featured.type||'success']||typeMeta.success).icon}</div><div class="featured-experience-copy"><small>${esc(typeLabel[featured.type||'success']||'تجربه')} · ${esc(featured.material||'مصالح ساختمانی')}</small><h3>${esc(featured.title)}</h3><p>${esc(featured.details||'')}</p><div class="featured-experience-foot"><span>${esc(featured.user||'کاربر پاکار')}${featured.expert_verified?' · تخصص بررسی‌شده':''}</span><span>${fa(featured.votes||0)} رأی مفید</span></div></div></div></article>`:`<div class="featured-experience featured-empty"><div class="featured-experience-mark">${uiIcon('tip')}</div><div><b>اولین یادداشت منتخب می‌تواند از پروژه‌ی تو باشد.</b><p>تجربه‌ای دقیق و مستند ثبت کن تا پس از بررسی در این مجموعه قرار بگیرد.</p><button class="act act-primary" data-x="community-new">ثبت اولین تجربه</button></div></div>`;
 const filters=[['all','همه‌ی تجربه‌ها',allPublic.length],['success','موفق',allPublic.filter(x=>(x.type||'success')==='success').length],['warning','هشدار',allPublic.filter(x=>x.type==='warning').length],['tip','نکته فنی',allPublic.filter(x=>x.type==='tip').length],['question','پرسش',allPublic.filter(x=>x.type==='question').length]];
 const cards=publicRows.length?publicRows.map(x=>{const type=x.type||'success',meta=typeMeta[type]||typeMeta.success,preview=(x.details||'').trim();return `<article class="experience-card experience-${esc(type)}"><div class="experience-card-rail"><span>${meta.icon}</span><i></i></div><div class="experience-card-main"><div class="experience-card-head"><span class="experience-type-tag">${esc(typeLabel[type]||'تجربه')}</span>${x.expert_verified?'<span class="experience-badge">✓ تخصص بررسی‌شده</span>':''}</div><h3>${esc(x.title)}</h3><div class="experience-material-line"><span class="material-mark">${uiIcon('layers')}</span><b>${esc(x.material||'مصالح ساختمانی')}</b>${x.context?`<span class="experience-context-inline">${esc(x.context)}</span>`:''}</div><p class="experience-preview">${esc(preview.length>135?preview.slice(0,135).trimEnd()+'…':preview)}</p><details class="experience-detail"><summary>ادامه‌ی تجربه</summary><p>${esc(x.details||'')}</p></details>${x.photo_url&&safe(x.photo_url)?`<a class="experience-photo-link" data-stop href="${esc(safe(x.photo_url))}" target="_blank" rel="noopener"><span>${uiIcon('file')}</span> مشاهده تصویر پروژه <b>↗</b></a>`:''}<div class="experience-card-footer"><div class="experience-author"><div class="experience-avatar" aria-hidden="true">${x.author_photo_url&&safe(x.author_photo_url)?`<img src="${esc(safe(x.author_photo_url))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.add('avatar-fallback')">`:`<span>${esc(initials(x.user||'کاربر'))}</span>`}</div><div class="experience-byline"><b>${esc(x.user||'کاربر پاکار')}</b><small>${x.username?`@${esc(x.username)} · `:''}${esc((x.created_at||'').slice(0,10))}</small></div></div><div class="experience-actions"><span class="experience-votes">${uiIcon('check')} ${fa(x.votes||0)}</span><button class="act ${x.voted?'act-voted':''}" data-x="community-vote" data-id="${esc(x.id)}" ${x.voted?'disabled':''}>${x.voted?'مفید بود ✓':'مفید بود؟'}</button></div></div></div></article>`}).join(''):`<div class="field-no-results"><div class="field-empty-icon"><span class="ui-icon" aria-hidden="true">${uiIcon('search')}</span></div><b>${allPublic.length?'تجربه‌ای با این فیلتر پیدا نشد':'هنوز تجربه‌ی منتشرشده‌ای ثبت نشده'}</b><span>${allPublic.length?'عبارت جست‌وجو یا دسته‌ی انتخاب‌شده را تغییر بده.':'با ثبت یک گزارش دقیق، به کامل‌تر شدن دانش اجرایی جامعه کمک کن.'}</span>${allPublic.length?'<button class="act" data-x="community-reset">پاک‌کردن جست‌وجو و فیلتر</button>':'<button class="act act-primary" data-x="community-new">ثبت تجربه‌ی جدید</button>'}</div>`;
 return `${hero}${stats}${featuredBlock}<div class="field-section-head"><div><span class="eyebrow">COMMUNITY ARCHIVE</span><h2>آرشیو تجربه‌ها</h2><p>جست‌وجو بر اساس متریال، نتیجه یا شرایط اجرا</p></div><span class="field-section-count">${fa(allPublic.length)} یادداشت</span></div>${search}<div class="community-filters">${filters.map(([v,l,n])=>`<button class="chip ${S.communityType===v?'active':''}" data-community-type="${v}">${l}<small>${fa(n)}</small></button>`).join('')}</div><div class="community-results-line"><span>${fa(publicRows.length)} نتیجه</span><span>تجربه شخصی جایگزین دیتاشیت یا تأیید طراح مسئول نیست.</span></div><div class="experience-feed">${cards}</div><section class="my-experiences"><div class="field-section-head"><div><span class="eyebrow">YOUR CONTRIBUTIONS</span><h2>ارسال‌های من</h2><p>وضعیت یادداشت‌هایی که ثبت کرده‌ای</p></div><span class="field-section-count">${fa(mine.length)} ارسال</span></div>${mine.length?mine.map(x=>`<article class="my-experience-row"><span class="my-experience-status ${x.status==='approved'?'approved':x.status==='rejected'?'rejected':'pending'}">${x.status==='approved'?'منتشرشده':x.status==='rejected'?'نیازمند اصلاح':'در انتظار بررسی'}</span><div><b>${esc(x.title)}</b><small>${esc(x.material||'مصالح ساختمانی')}</small>${x.status==='rejected'&&x.rejection_reason?`<p class="rejection-reason">دلیل بازگشت: ${esc(x.rejection_reason)}</p>`:''}</div><span class="my-experience-arrow">↙</span></article>`).join(''):'<div class="my-experiences-empty"><span>＋</span><p>هنوز ارسالی ثبت نکرده‌ای.</p><button class="act" data-x="community-new">ثبت اولین تجربه</button></div>'}</section>`;
}
function marketView() {
 if(!S.admin)return '<div class="empty"><p>این گزارش فقط برای مدیران پاکار قابل مشاهده است.</p></div>';
 if(!S.marketData){if(!S.marketLoading){S.marketLoading=true;api('market-dashboard').then(r=>S.marketData=r).catch(()=>S.marketData={ok:false}).finally(()=>{S.marketLoading=false;if(S.tab==='market')render();});}return '<div class="empty"><p>در حال ساخت گزارش بازار…</p></div>';}
 const d=S.marketData;if(!d.ok)return '<div class="empty"><p>گزارش در دسترس نیست.</p></div>';
 const ag=(title,arr)=>`<div class="grp">${title}</div>${(arr||[]).length?(arr||[]).slice(0,12).map(x=>`<div class="ln"><h4><span>${esc(x.name)}</span><em>${fa(x.count)}</em></h4></div>`).join(''):'<p class="hint">داده‌ای در این بازه ثبت نشده است.</p>'}`;
 return `<div class="tot"><div class="r"><span>بازه‌ی گزارش</span><b>${esc(d.period)}</b></div><div class="r"><span>رویدادهای ثبت‌شده</span><b>${fa(d.events)}</b></div><div class="r"><span>استعلام‌ها</span><b>${fa(d.quotes)}</b></div><div class="r"><span>جست‌وجوهای بی‌نتیجه</span><b>${fa(d.noResultSearches)}</b></div><div class="r"><span>تجربه‌های در انتظار بررسی</span><b>${fa(d.communityPending)}</b></div><p class="hint">این آمار نشان‌دهنده‌ی رفتار ثبت‌شده در مینی‌اپ است؛ نه کاربران یکتا، فروش یا سهم بازار. جست‌وجوهای بی‌نتیجه فقط پس از فعال بودن ثبت رویداد قابل تحلیل‌اند.</p><button class="act" data-x="market-refresh">به‌روزرسانی</button></div>${ag('محصولات پرتکرار',d.popularProducts)}${ag('نیازهای جست‌وجوشده‌ی بی‌پاسخ',d.searchGaps)}${ag('انواع رویداد',d.eventTypes)}`;
}
function phase4Track(event, company, product, extra={}) { api('event',{method:'POST',body:JSON.stringify({event,company:company||'',product:product||'',...extra})}).catch(()=>{}); }

function sponsorView() {
  if(!S.sponsorData) { if(!S.sponsorLoading) { S.sponsorLoading=true; api('sponsor-dashboard').then(r=>{S.sponsorData=r;}).catch(()=>{S.sponsorData={ok:false};}).finally(()=>{S.sponsorLoading=false;if(S.tab==='sponsor')render();}); } return '<div class="empty"><p>در حال دریافت آمار…</p></div>'; }
  const d=S.sponsorData; if(!d.ok) return '<div class="empty"><p>دریافت آمار ممکن نشد.</p></div>';
  const ag=(title,arr)=>`<div class="grp">${title}</div>`+(arr||[]).slice(0,10).map(x=>`<div class="ln"><h4><span>${esc(x.name)}</span><em>${fa(x.count)}</em></h4></div>`).join('');
  return `<div class="tot"><div class="r"><span>بازه</span><b>${esc(d.period)}</b></div><div class="r"><span>رویدادهای ثبت‌شده</span><b>${fa(d.events)}</b></div><div class="r"><span>درخواست‌های استعلام</span><b>${fa(d.quotes)}</b></div><p class="hint">این آمار بر اساس رویدادهای ثبت‌شده در مینی‌اپ است و معادل کاربران یکتا یا فروش نیست.</p><button class="act" data-x="sponsor-refresh">به‌روزرسانی</button></div>${ag('بر اساس برند',d.byCompany)}${ag('بر اساس نوع رویداد',d.byEvent)}${ag('محصولات پرتکرار',d.byProduct)}`;
}
async function saveProjects() {
  const name=(S.proj.name||'').trim()||'پروژه‌ی '+new Date().toLocaleDateString('fa-IR');
  const current={id:S.activeProject||uid(),name,client:S.proj.client||'',notes:S.proj.notes||'',estimate:S.est,rooms:S.rooms};
  let arr=[...(S.projects||[])]; const i=arr.findIndex(x=>x.id===current.id); if(i>=0) arr[i]=current; else arr.unshift(current);
  try { const r=await api('projects',{method:'POST',body:JSON.stringify({projects:arr})}); if(!r.ok) return toast(r.error||'ذخیره انجام نشد'); S.projects=r.projects||arr; S.activeProject=current.id; toast('پروژه روی سرور ذخیره شد ✓'); render(); } catch(e) { toast('ذخیره‌ی سروری ناموفق بود؛ اتصال تلگرام را بررسی کن.'); }
}
async function loadProjects() { try { const r=await api('projects'); if(r.ok) S.projects=r.projects||[]; } catch(e) {} }
function quoteSheet(coId,pid) {
 const c=D.companies.find(x=>x.id===coId)||{}, p=(c.products||[]).find(x=>x.id===pid);
 sheet(`<h3>استعلام قیمت</h3><p class="hint">درخواست به مدیران پاکار ارسال می‌شود؛ قیمت یا موجودی تا زمان پاسخ، تأییدشده محسوب نمی‌شود.</p><label class="fl">برند<input id="qCompany" value="${esc(c.name||'')}" readonly></label><label class="fl">محصول<input id="qProduct" value="${esc(p?p.name:'')}" placeholder="نام محصول"></label><label class="fl">شهر<input id="qCity" placeholder="مثلاً مشهد"></label><label class="fl">مقدار و واحد<input id="qQty" placeholder="مثلاً ۲۰ متر مربع"></label><label class="fl">راه تماس (اختیاری)<input id="qContact" placeholder="شماره تماس یا ترجیح ارتباط"></label><label class="fl">توضیحات<textarea id="qNote" rows="3" placeholder="شرایط پروژه یا سوال شما"></textarea></label><div class="sd-bar"><button class="act" data-x="scok">انصراف</button><button class="act act-primary" data-x="quote-submit" data-co="${esc(c.name||'')}" data-pid="${esc(p?p.name:'')}">ارسال درخواست</button></div>`);
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
      ? `<div class="fl"><span>تعداد</span><div class="stp"><button type="button" class="sq" data-st="${l.id}" data-d="-1">−</button><input class="qi" inputmode="numeric" data-l="${l.id}" data-k="q" value="${l.q}" aria-label="تعداد"><button type="button" class="sq pl" data-st="${l.id}" data-d="1">＋</button></div></div>`
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
function addLine(p, c, q) { const ex = S.est.find(l => l.pid === p.id); if (ex && p.mode === 'count') { ex.q += q || 1; } else S.est.push({ id: uid(), pid: p.id, name: p.name, co: c.name, unit: p.unit, mode: p.mode || 'count', price: validPrice(p) || 0, q: q || 1, per: p.perM2 || 1, th: p.def || 5 }); persist(); }
function summary() {
  const R = '\u200F', by = {}; let sum = 0, miss = 0;
  S.est.forEach(l => { (by[l.co] = by[l.co] || []).push(l); sum += qty(l) * (l.price || 0); if (!l.price) miss++; });
  const lab = sum * S.cfg.labor / 100, out = [R + '🧱 برآورد مصالح — پاکار'];
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
const CF = [['name', 'نام برند'], ['en', 'نام لاتین'], ['cat', 'دسته‌بندی'], ['desc', 'توضیح کوتاه', 'area'], ['site', 'وب‌سایت رسمی (https://…)'], ['catalog', 'لینک کاتالوگ (https://…)'], ['featuresT', 'ویژگی‌های برند — هر خط یک مورد', 'area'], ['linksT', 'لینک‌های مفید — هر خط: «عنوان | https://…»', 'area'], ['sponsor', 'حامی پاکار', 'chk']];
const QPF = [['name','نام محصول'],['group','گروه'],['unit','واحد فروش'],['price','قیمت (اختیاری)'],['page','لینک رسمی محصول (اختیاری)'],['source','منبع اطلاعات (اختیاری)']];
const PF = [
  ['name', 'نام محصول'],
  ['group', 'گروه'],
  ['desc', 'توضیح', 'area'],
  ['unit', 'واحد (عدد، کیسه، م²…)'],
  ['price', 'قیمت روز (تومان)'],
  ['mode', 'نوع محاسبه', 'sel', [['count', 'تعدادی'], ['area', 'بر اساس متراژ'], ['vol', 'حجمی (متراژ × ضخامت)']]],
  ['perM2', 'مصرف هر م²'],
  ['def', 'ضخامت پیش‌فرض (cm)'],
  ['catalog', 'لینک کاتالوگ محصول (PDF)'],
  ['page', 'لینک صفحه‌ی رسمی محصول (https://…)'],
  ['catalogVer', 'نسخه/تاریخ کاتالوگ (مثلاً ۱۴۰۵)'],
  ['availability', 'قابل تهیه در ایران؟', 'sel', [['', 'نامشخص'], ['داخلی', 'تولید داخل'], ['وارداتی', 'وارداتی'], ['معادل ایرانی', 'معادل ایرانی دارد']]],
  ['confidence', 'نشان اطمینان', 'sel', [['', 'انتخاب کن'], ['datasheet', 'تأییدشده با دیتاشیت'], ['field', 'تجربه‌ی اجرایی'], ['review', 'نیازمند بررسی']]],
  ['source', 'منبع (مثلاً دیتاشیت شرکت، نسخه)'],
  ['lastVerified', 'آخرین بررسی (مثلاً ۱۴۰۵/۰۷/۰۱)'],
  ['standardsT', 'استانداردهای ملی — هر خط: «کد | تاریخ بررسی»\nمثال: INSO 7782 | 1405/06/01', 'area'],
  ['techCertNo', 'شماره گواهی فنی مرکز تحقیقات راه، مسکن و شهرسازی'],
  ['techCertUntil', 'اعتبار گواهی فنی (تاریخ)'],
  ['feHesab', 'ردیف فهرست بهای مرتبط'],
  ['surf', 'سطح پیش‌فرض در متره', 'sel', [['', 'خودکار'], ['floor', 'کف'], ['wall', 'دیوار'], ['ceiling', 'سقف']]],
  ['tier', 'رده برای سناریو', 'sel', [['', 'بدون رده (بر اساس قیمت)'], ['eco', 'اقتصادی'], ['mid', 'متوسط'], ['lux', 'لوکس']]],
  ['speed', 'سرعت اجرا (۱ تا ۵؛ ۵ = سریع‌ترین)'],
  ['durability', 'دوام (۱ تا ۵؛ ۵ = بادوام‌ترین)'],
  ['featuresT', 'ویژگی‌ها — هر خط یک ویژگی (از کاتالوگ)', 'area'],
  ['specsT', 'مشخصات فنی — هر خط «عنوان: مقدار»', 'area'],
  ['model3dUrl', 'لینک عمومی مدل سه‌بعدی GLB/GLTF (HTTPS)', 'area'],
  ['installStepsT', 'آموزش اجرا — هر خط یک مرحله', 'area'],
  ['installMistakesT', 'خطاهای رایج — هر خط: متن ساده یا «بحرانی | خطا | پیامد»', 'area'],
  ['installSource', 'منبع آموزش اجرا', 'area'],
  ['installVideoUrl', 'لینک ویدیوی کوتاه اجرا (HTTPS)', 'area'],
  ['installVerifiedBy', 'نام بازبین متخصص (پس از تأیید)', 'area'],
  ['installVerifiedAt', 'تاریخ بازبینی', 'area'], ['installStandard', 'استاندارد / بند مرجع (با ذکر منبع)', 'area']
];
const SPEC_TPL = [
  [/سبکدانه|سبک‌سازی|عایق|کف‌سازی|ژئوتکنیک|زیرساخت|کشاورز/, ['چگالی', 'ضریب هدایت حرارتی', 'مقاومت فشاری', 'جذب آب', 'رده‌ی آتش', 'دانه‌بندی', 'وزن هر کیسه']],
  [/بلوک|دیوار|سقف|تیغه|پانل/, ['ابعاد', 'وزن', 'مقاومت فشاری', 'ضریب هدایت حرارتی', 'مقاومت صوتی', 'رده‌ی آتش']],
  [/گچ|ملات|مخلوط|بتن|سیمان/, ['وزن هر بسته', 'مصرف تقریبی', 'زمان گیرش', 'مقاومت فشاری', 'نسبت آب به پودر']],
  [/شیر|توالت|بهداشتی|سرویس|روشویی|کابین|اکسسوری|تجهیزات|سنگ/, ['جنس', 'ابعاد', 'وزن', 'روکش', 'فشار کاری', 'گارانتی']]
];
const specTplFor = (...ts) => { for (const t of ts) { const m = SPEC_TPL.find(x => x[0].test(t || '')); if (m) return m[1]; } return ['ابعاد', 'وزن', 'جنس']; };   /* اول گروه/نام محصول، بعد دسته‌ی برند */
function form(title, F, v, ok, back, val) {
  const isP = F === PF;
  const fieldHtml = ([k, l, t, o]) => `<label class="fl" style="min-width:${t === 'area' ? '100%' : '140px'}"><span>${l.replace(/\n/g, '<br>')}</span>${t === 'area' ? `<textarea data-f="${k}" rows="2">${esc(v[k])}</textarea>` : t === 'sel' ? `<select data-f="${k}">${o.map(x => `<option value="${x[0]}" ${v[k] === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select>` : t === 'chk' ? `<input type="checkbox" data-f="${k}" ${v[k] ? 'checked' : ''} style="width:24px;height:24px">` : `<input data-f="${k}" value="${esc(v[k])}">`}</label>`;
  const coreCount = isP ? 10 : F.length;
  const coreFields = F.slice(0, coreCount), advancedFields = F.slice(coreCount);
  sheet(`<h3 style="margin:4px 0 6px;color:var(--ink)">${title}</h3><p class="hint">${isP ? 'برای ثبت اولیه فقط نام محصول کافی است. اطلاعات ناموجود را خالی بگذار؛ مشخصات حدسی وارد نکن.' : 'فقط فیلدهای ضروری را تکمیل کن؛ اطلاعات بیشتر را می‌توانی بعداً اضافه کنی.'}</p><div class="rw">${coreFields.map(fieldHtml).join('')}</div>${advancedFields.length ? `<details class="form-advanced"><summary>اطلاعات تکمیلی <small>استاندارد، مشخصات، آموزش اجرا و گواهی‌ها</small></summary><div class="rw">${advancedFields.map(fieldHtml).join('')}</div></details>` : ''}${isP ? '<div class="ft"><button type="button" class="act" data-a="spectpl">＋ درج قالب مشخصات این گروه</button></div>' : ''}<div class="sd-bar" style="margin-top:14px"><button type="button" class="act act-primary" data-a="fok">ذخیره</button><button type="button" class="act" data-a="fno">انصراف</button></div>`, back);
  S.ok = ok; S.val = val || null;
}
const readForm = () => { const o = {}; document.querySelectorAll('#sdPanel [data-f]').forEach(e => o[e.dataset.f] = e.type === 'checkbox' ? e.checked : e.value.trim()); return o; };
const rate = v => { const n = Math.round(num(v)); return n >= 1 && n <= 5 ? n : null; };
const cleanP = o => {
  const r = {
    ...o,
    speed: rate(o.speed),
    durability: rate(o.durability),
    price: num(o.price) || null,
    perM2: num(o.perM2) || null,
    def: num(o.def) || null,
    catalog: safe(o.catalog),
    specs: parseSpecs(o.specsT),
    features: String(o.featuresT || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 20),
    standards: parseStandards(o.standardsT),
    techCert: {
      no: String(o.techCertNo || '').trim().slice(0, 80),
      until: String(o.techCertUntil || '').trim().slice(0, 30)
    },
    feHesab: String(o.feHesab || '').trim().slice(0, 80),
    page: safe(o.page),
    catalogVer: String(o.catalogVer || '').trim().slice(0, 60),
    model3d: ('model3dUrl' in o) ? (safe(o.model3dUrl) ? { url: safe(o.model3dUrl) } : null) : (o.model3d || null),
    install: { steps: String(o.installStepsT || '').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,20), mistakes: String(o.installMistakesT || '').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,20).map(line=>{const a=line.split('|').map(v=>v.trim());return a.length>=2&&['بحرانی','مهم','جزئی','critical','important','minor'].includes(a[0].toLowerCase())?{severity:({'بحرانی':'critical','مهم':'important','جزئی':'minor','critical':'critical','important':'important','minor':'minor'})[a[0].toLowerCase()],text:a[1],consequence:a.slice(2).join(' | ')}:line}), source: String(o.installSource||'').trim().slice(0,250), video_url: safe(o.installVideoUrl), verifiedBy: String(o.installVerifiedBy||'').trim().slice(0,120), verifiedAt: String(o.installVerifiedAt||'').trim().slice(0,30), standard: String(o.installStandard||'').trim().slice(0,180) }
  };
  if (!r.confidence && (r.specs.length || r.standards.length || r.features.length || r.price || r.speed || r.durability)) r.confidence = 'review';
  ['specsT', 'featuresT', 'standardsT', 'techCertNo', 'techCertUntil', 'feHesab', 'model3dUrl', 'installStepsT', 'installMistakesT', 'installSource', 'installVideoUrl', 'installVerifiedBy', 'installVerifiedAt', 'installStandard'].forEach(k => delete r[k]);
  return r;
};
const valP = () => '';   /* فقط «نام» اجباری است؛ ردیابی‌پذیری با نشان «نیازمند بررسی» خودکار حفظ می‌شود */
const parseLinks = t => String(t || '').split('\n').map(l => { const i = l.indexOf('|'); if (i < 1) return null; const u = safe(l.slice(i + 1).trim()); return u ? { t: l.slice(0, i).trim().slice(0, 80), u: u.slice(0, 500) } : null; }).filter(x => x && x.t).slice(0, 12);
const cleanC = o => { const r = { ...o, catalog: safe(o.catalog), site: safe(o.site), features: String(o.featuresT || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12), links: parseLinks(o.linksT) }; delete r.featuresT; delete r.linksT; return r; };
const coVals = c => ({ ...c, featuresT: (c.features || []).join('\n'), linksT: (c.links || []).map(x => x.t + ' | ' + x.u).join('\n') });

/* ================================================================
   فاز ۲ — متره‌ی اتاق‌محور، سه سناریو، مقایسه‌گر، ماشین‌حساب‌ها، برگه‌ی پیشنهاد
   ================================================================ */
const P = v => Math.max(0, num(v));
const R2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const nf = v => fa(R2(v));
const SURF = { floor: 'کف', wall: 'دیوار (خالص)', ceiling: 'سقف' };
const AV = { 'داخلی': 3, 'معادل ایرانی': 2, 'وارداتی': 1 };
const TIERS = [['eco', 'اقتصادی'], ['mid', 'متوسط'], ['lux', 'لوکس']];
const priceOf = p => (S.px[p.id] > 0 ? S.px[p.id] : validPrice(p)) || 0;
const defSurf = p => (SURF[p.surf] ? p.surf : p.mode === 'vol' ? 'floor' : 'wall');
const newRoom = n => ({ id: uid(), name: 'اتاق ' + fa(n), n: 1, L: '', W: '', H: '', dn: '', dw: '', dh: '', wn: '', ww: '', wh: '', items: [] });
const $$ = s => document.querySelectorAll(s);

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
const CDEF = {
  floor: { t: 'کف سبک و بار مرده', f: [['A', 'مساحت کف (م²)'], ['T', 'ضخامت لایه (cm)'], ['dl', 'چگالی سبکدانه — kg/m³ (از دیتاشیت)'], ['dt', 'چگالی مصالح سنتی — kg/m³ (مقایسه)'], ['bag', 'حجم هر کیسه (لیتر) — اختیاری'], ['w', 'ضایعات (٪)']] },
  block: { t: 'بلوک و ملات', f: [['A', 'مساحت دیوار (م²)'], ['o', 'بازشو (م²)'], ['bl', 'طول بلوک (cm)'], ['bh', 'ارتفاع بلوک (cm)'], ['bt', 'ضخامت بلوک (cm)'], ['j', 'ضخامت ملات (mm) — فرض قابل‌ویرایش'], ['w', 'ضایعات (٪)']] },
  gyp: { t: 'گچ و پانل', f: [['A', 'مساحت سطح گچ‌کاری (م²)'], ['t', 'ضخامت متوسط (mm)'], ['ref', 'مصرف مرجع — kg بر م² به‌ازای هر ۱cm (دیتاشیت)'], ['bag', 'وزن هر کیسه (kg)'], ['Ap', 'مساحت دیوار پانلی (م²)'], ['pw', 'عرض پانل (m)'], ['ph', 'ارتفاع پانل (m)'], ['po', 'بازشو (م²)'], ['w', 'ضایعات (٪)']] }
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
window.RQ = { geom, itemQty, calcRun, scoreCmp, takeoff, specNum, S, nz, staleDays };

function pickList() {
  const q = S.pick.q.trim(), f = S.pick.filter;
  const h = D.companies.map(c => { const ps = c.products.filter(p => f(p, c) && (!q || (h => nz(q).split(' ').filter(Boolean).every(w => h.includes(w)))(nz(p.name + ' ' + c.name + ' ' + c.en + ' ' + (p.group || ''))))); return ps.length ? `<div class="grp">${esc(c.name)}</div>` + ps.map(p => `<button type="button" class="pkr" data-x="pk" data-pid="${p.id}">${thumb(c, p)}<span><b>${esc(p.name)}</b><small>${esc(p.group || '')} · ${esc(p.unit)}</small></span></button>`).join('') : ''; }).join('');
  return h || '<div class="empty"><p>محصولی پیدا نشد</p></div>';
}
function pick(title, filter, cb, note) {
  S.pick = { q: '', filter, cb };
  sheet(`<h3 style="margin:4px 0 8px;color:var(--ink)">${title}</h3>${note ? `<p class="hint">${note}</p>` : ''}<div class="fl" style="margin-bottom:8px"><input type="search" data-i="ps" placeholder="جست‌وجو…" autocomplete="off"></div><div id="pkL">${pickList()}</div>`);
}
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
  if (p.mode === 'count') ctl = `<div class="fl"><span>تعداد در هر اتاق</span><div class="stp"><button type="button" class="sq" data-x="iq" data-rid="${r.id}" data-iid="${i.id}" data-d="-1">−</button><input class="qi" inputmode="numeric" data-i="item" data-rid="${r.id}" data-iid="${i.id}" data-k="q" value="${esc(i.q)}" aria-label="تعداد"><button type="button" class="sq pl" data-x="iq" data-rid="${r.id}" data-iid="${i.id}" data-d="1">＋</button></div></div>`;
  else ctl = `<label class="fl"><span>سطح اجرا</span><select ${a} data-k="on">${Object.entries(SURF).map(([k, l]) => `<option value="${k}" ${(i.on || defSurf(p)) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` + (p.mode === 'area' ? `<label class="fl"><span>مصرف هر م²</span><input inputmode="decimal" ${a} data-k="per" value="${esc(i.per)}" placeholder="${fa(p.perM2 || 1)}"></label>` : `<label class="fl"><span>ضخامت (cm)</span><input inputmode="decimal" ${a} data-k="th" value="${esc(i.th)}" placeholder="${fa(p.def || 5)}"></label>`);
  return `<div class="it"><div class="it-t"><b>${esc(p.name)}</b><em>${esc(c.name)}</em><button type="button" class="sq dg" data-x="irm" data-rid="${r.id}" data-iid="${i.id}" aria-label="حذف">✕</button></div><div class="rw">${ctl}</div><small class="iq" data-iq="${i.id}"></small></div>`;
}
function matList() {
  const T = takeoff('mid'); if (!T.lines.length) return '';
  return `<div class="grp">فهرست مصالح (سناریوی متوسط)</div>` + T.lines.map(l => `<div class="ln"><h4><span>${esc(l.p.name)}</span><em>${esc(l.c.name)}</em></h4><div class="rw"><label class="fl"><span>قیمت هر ${esc(l.p.unit)} (تومان)${validPrice(l.p)!==null && !(S.px[l.p.id] > 0) ? ' — ثبت‌شده' : ''}</span><input inputmode="decimal" data-i="px" data-pid="${l.p.id}" value="${S.px[l.p.id] > 0 ? S.px[l.p.id] : ''}" placeholder="${validPrice(l.p)!==null ? fa(validPrice(l.p)) : 'وارد کن'}"></label></div><div class="lt"><small data-mq="${l.p.id}"></small><span data-mc="${l.p.id}"></span></div></div>`).join('');
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
  return `<div class="grp">سه سناریو کنار هم</div><div class="scn">${cards}</div><p class="hint">اقتصادی و لوکس: اگر ادمین رده تعیین کرده باشد همان؛ وگرنه ارزان‌ترین/گران‌ترین جایگزینِ هم‌گروه که قیمت دارد. سرعت اجرا فقط از امتیازهای ثبت‌شده‌ی پاکار میانگین می‌شود. برای هر قلم می‌توانی دستی عوض کنی.</p>`;
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
  keys.forEach(k => { const vs = ps.map(p => { const s = (p.specs || []).find(x => x.k === k); return s ? s.v : null; }), dir = S.dir[k] || '', nums = vs.map(v => v == null ? null : specNum(v)); h += row(`${esc(k)}<button type="button" class="dirb ${dir}" data-x="dir" data-k="${esc(k)}" aria-label="جهت برتری">${dir === 'hi' ? '▲ بیشتر بهتر' : dir === 'lo' ? '▼ کمتر بهتر' : '± جهت؟'}</button>`, vs.map(v => v == null ? '—' : ltrv(v)), dir ? win(nums, dir) : []); });
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
  return `<div class="chips" style="margin:14px 0 6px">${Object.entries(CDEF).map(([id, x]) => `<button type="button" class="chip ${id === k ? 'active' : ''}" data-x="cc" data-k="${id}">${x.t}</button>`).join('')}</div><p class="hint">اعداد فنی (چگالی، مصرف مرجع، ابعاد) را از دیتاشیت وارد کن؛ پاکار عدد فنی از خودش نمی‌گذارد. خروجی‌ها خالی‌اند تا ورودی‌ها کامل شود.</p><div class="rw">${d.f.map(([f, l]) => `<label class="fl" style="min-width:${l.length > 28 ? '100%' : '140px'}"><span>${l}</span><input inputmode="decimal" data-i="calc" data-k="${f}" value="${esc(v[f])}"></label>`).join('')}</div>${dh ? `<button type="button" class="act" data-x="cfill" style="margin-top:8px">برداشتن چگالی «${esc(dh.p.name)}» از شناسنامه (${fa(dh.v)})${dh.src ? ' — ' + esc(dh.src) : ''}</button>` : ''}<div class="tot" id="cOut"></div>`;
}
function paintCalc() {
  const b = $('#cOut'); if (!b) return; S.cres = calcRun(S.cc.k, S.cc.v[S.cc.k]);
  b.innerHTML = S.cres.length ? S.cres.map((o, i) => `<div class="co"><span>${o.l}</span><b>${nf(o.v)} ${o.u}</b>${o.add ? `<button type="button" class="sq pl" data-x="cadd" data-o="${i}" aria-label="افزودن به برآورد">＋</button>` : ''}</div>`).join('') : '<div class="hint" style="margin:0">ورودی‌ها را کامل کن تا نتیجه نمایش داده شود.</div>';
}

/* ---------- برگه‌ی پیشنهاد ---------- */
const loadImg = u => new Promise(res => { const i = new Image(); const t = setTimeout(() => res(null), 6000); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); res(null); }; i.src = u; });
async function makeSheet(tk) {
  const WD = 1240, HT = 1754, M = 72, IN = WD - 2 * M, F = "'Vazirmatn',Tahoma,sans-serif", INK = '#1A1714', DIM = '#5A5347', AC = '#0B8468', LN = '#DAD3C7';
  try {
    await Promise.all([400, 500, 600, 700, 800, 900].map(w => document.fonts.load(`${w} 28px Vazirmatn`)));
  } catch (e) {}
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
      tx('برگه‌ی پیشنهاد مصالح', WD - M - 108, 96, 50, 800, '#FFFFFF'); tx('پاکار — مرجع فایل‌های معماری و عمران', WD - M - 108, 138, 22, 500, 'rgba(255,255,255,.85)');
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
    xr -= mw[0]; tx(l.p.name, xr - 14, y, l.p.name.length > 22 ? 20 : 25, 800, INK, 'right', mw[1] - 26); tx(l.c.name, xr - 14, y + 30, 20, 500, DIM, 'right', mw[1] - 26);
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
    if (!TG || !TG.initData) { const a = document.createElement('a'); a.href = jp[0]; a.download = 'pakar-sheet.jpg'; a.click(); return toast('خارج از تلگرام: صفحه‌ی اول دانلود شد'); }
    const r = await api('sheet', { method: 'POST', body: JSON.stringify({ title: S.proj.name, pages: jp }) });
    if (r.ok) { hp('medium'); sheet(`<div class="empty"><div class="empty-icon">✅</div><h3>برگه ارسال شد</h3><p>فایل PDF (${fa(pages.length)} صفحه) داخل چت ربات فرستاده شد.</p></div><div class="sd-bar"><button type="button" class="act" data-x="scok">ادامه</button><button type="button" class="act act-primary" data-x="tgclose">دیدن برگه در چت</button></div>`); } else toast('ارسال نشد: ' + (r.error || ''));
  } catch (e) { toast('خطا در ساخت یا ارسال برگه'); }
}

/* ---------- رویدادهای فاز ۲ ---------- */
const persist2 = () => { sv(K.rooms, S.rooms); sv(K.scn, S.scn); sv(K.px, S.px); sv(K.cmp, S.cmp); sv(K.w, S.w); sv(K.dir, S.dir); sv(K.proj, S.proj); sv(K.cc, S.cc); };
const rm = id => S.rooms.find(r => r.id === id), itm = (r, id) => r && r.items.find(i => i.id === id);
function addItem(r, p, q) { r.items.push({ id: uid(), pid: p.id, q: q || 1, on: defSurf(p) }); }
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-x]'); if (!t) return; const d = t.dataset, r = rm(d.rid);
  switch (d.x) {
    case 'quick-products': {
      if (!S.admin) return toast('دسترسی مدیر لازم است');
      const opts = D.companies.map(co=>`<option value="${esc(co.id)}">${esc(co.name)}</option>`).join('');
      return sheet(`<h3 style="margin:4px 0 6px;color:var(--ink)">افزودن سریع محصولات</h3><p class="hint">هر خط یک محصول؛ قالب: نام محصول | گروه | واحد | قیمت (اختیاری) | لینک صفحه رسمی (اختیاری). فقط نام ضروری است؛ قیمت یا منبع را حدس نزن.</p><label class="fl"><span>برند</span><select id="quickProductBrand">${opts}</select></label><label class="fl" style="margin-top:10px"><span>فهرست محصولات</span><textarea id="quickProductLines" rows="7" placeholder="مثال:
بلوک سبک | دیوار | عدد
چسب کاشی | چسب و ملات | کیسه | 250000 | https://example.com/product"></textarea></label><div class="hint">می‌توانی ۴، ۱۰ یا بیشتر محصول را یک‌جا وارد کنی. اطلاعات ناقص بعداً از بخش ویرایش تکمیل می‌شود.</div><div class="sd-bar"><button class="act act-primary" data-x="quick-products-save">ثبت محصولات</button><button class="act" data-x="fno">انصراف</button></div>`);
    }
    case 'quick-products-save': {
      if (!S.admin) return toast('دسترسی مدیر لازم است');
      const coId=$('#quickProductBrand')?.value, raw=$('#quickProductLines')?.value||'', co=D.companies.find(x=>x.id===coId);
      if (!co) return toast('ابتدا یک برند انتخاب کن');
      const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); if(!lines.length) return toast('حداقل یک محصول وارد کن');
      const made=[]; const existing=new Set((co.products||[]).map(p=>nz(p.name)));
      for (const line of lines.slice(0,100)) {
        const parts=line.split('|').map(x=>x.trim()); const name=(parts[0]||'').slice(0,180); if(!name) continue;
        if(existing.has(nz(name))) continue;
        const price=parts[3] ? num(parts[3]) : 0; const page=parts[4] ? safe(parts[4]) : '';
        made.push({id:uid(),name,group:(parts[1]||'سایر').slice(0,80),unit:(parts[2]||'عدد').slice(0,40),desc:'',price:price>0?price:null,mode:'count',perM2:null,catalog:'',page,availability:'',confidence:'review',source:'',lastVerified:'',features:[],specs:[],standards:[],speed:null,durability:null,def:null,surf:'floor'});
        existing.add(nz(name));
      }
      if(!made.length) return toast('محصول جدیدی پیدا نشد؛ نام‌ها ممکن است تکراری باشند');
      co.products=co.products||[]; co.products.push(...made);
      const ok=await saveData(true); if(!ok){co.products=co.products.filter(p=>!made.some(m=>m.id===p.id));return toast('ذخیره در سرور ناموفق بود؛ دوباره تلاش کن');}
      closeSheet(); S.tab='manage'; render(); toast(`${fa(made.length)} محصول ثبت شد؛ مشخصات ناقص را بعداً تکمیل کن`); return;
    }
    case 'catalog-upload': { if (!S.admin) return toast('دسترسی مدیر لازم است'); return reqUpload('catalog', '', ''); }
    case 'admin-catalog': S.tab='cat'; S.edit=true; render(); toast('حالت ویرایش فعال شد'); return;
    case 'admin-save': return saveData();
    case 'admin-refresh': return reload().then(()=>{render();toast('اطلاعات از سرور به‌روز شد')}).catch(()=>toast('بازخوانی ناموفق بود'));
    case 'admin-edit-product': { const co=D.companies.find(x=>x.id===d.id); const p=co&&(co.products||[]).find(x=>x.id===d.pid); if(!co||!p)return; return form('ویرایش محصول', PF, {...p,specsT:specsText(p.specs),featuresT:(p.features||[]).join('\n'),standardsT:standardsText(p.standards),techCertNo:(p.techCert&&p.techCert.no)||'',techCertUntil:(p.techCert&&p.techCert.until)||'',feHesab:p.feHesab||'',model3dUrl:p.model3d&&typeof p.model3d==='object'?(p.model3d.url||''):(typeof p.model3d==='string'?p.model3d:''),installStepsT:(p.install&&p.install.steps||[]).join('\n'),installMistakesT:(p.install&&p.install.mistakes||[]).map(x=>typeof x==='string'?x:[({critical:'بحرانی',important:'مهم',minor:'جزئی'}[x.severity]||'مهم'),x.text||x.title||'',x.consequence||''].filter(Boolean).join(' | ')).join('\n'),installSource:p.install&&p.install.source||'',installVideoUrl:p.install&&p.install.video_url||'',installVerifiedBy:p.install&&p.install.verifiedBy||'',installVerifiedAt:p.install&&p.install.verifiedAt||'',installStandard:p.install&&p.install.standard||''}, o=>{Object.assign(p,cleanP(o));saveData();},()=>{S.tab='manage';render();},valP); }
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
    case 'xsh': return sheet(`<div class="empty" style="padding-bottom:6px"><div class="empty-icon">📄</div><h3>برگه‌ی پیشنهاد مصالح</h3><p>PDF برندشده‌ی پاکار با خلاصه‌ی فضاها، مقایسه‌ی سه سناریو و فهرست مصالح (با عکس، منبع و نشان اطمینان) داخل چت ربات ارسال می‌شود. کدام سناریو با جزئیات چاپ شود؟</p></div><div class="sd-bar" style="flex-wrap:wrap">${TIERS.map(([k, l]) => `<button type="button" class="act ${k === 'mid' ? 'act-primary' : ''}" data-x="xgo" data-t="${k}">${l}</button>`).join('')}</div>`);
    case 'xgo': closeSheet(); sendSheet(d.t); return;
    case 'tgclose': try { TG.close(); } catch (x) {} return;
    case 'pk': { const p = find(d.pid)[1], cb = S.pick && S.pick.cb; if (p && cb) cb(p, find(d.pid)[0]); return; }
    case 'cmp': { const pair = find(d.pid); if (pair[1]) phase3Track('compare', pair[0].name, pair[1].name); const i = S.cmp.indexOf(d.pid); if (i >= 0) S.cmp.splice(i, 1); else if (S.cmp.length >= 3) return toast('حداکثر ۳ محصول را می‌شود مقایسه کرد'); else S.cmp.push(d.pid); persist2(); hp(); if (t.classList.contains('sq') && S.tab !== 'cmp') t.classList.toggle('on', i < 0); if (S.tab === 'cmp') paintCmp(); tabs(); return toast(i >= 0 ? 'از مقایسه برداشته شد' : 'به مقایسه اضافه شد'); }
    case 'cmpadd': return pick('افزودن به مقایسه', p => !S.cmp.includes(p.id), p => { if (S.cmp.length < 3) S.cmp.push(p.id); persist2(); closeSheet(); paintCmp(); tabs(); });
    case 'cmpclr': S.cmp = []; persist2(); paintCmp(); return tabs();
    case 'dir': S.dir[d.k] = S.dir[d.k] === 'hi' ? 'lo' : S.dir[d.k] === 'lo' ? '' : 'hi'; persist2(); return paintCmp();
    case 'cc': S.cc.k = d.k; persist2(); return render();
    case 'cfill': { const h = densHint(); if (h) { S.cc.v.floor.dl = String(h.v); persist2(); render(); toast('چگالی از شناسنامه برداشته شد'); } return; }
    case 'sendfile': { try { const r=await api('send-file',{method:'POST',body:JSON.stringify({doc_id:d.docid})}); if(r.ok){toast('فایل در چت ربات ارسال شد');hp('medium');} else toast(r.error||'ارسال فایل ناموفق بود'); } catch(e){toast('خطا در ارسال فایل');} return; }
    case 'project-save': return saveProjects();
    case 'project-refresh': await loadProjects(); render(); return toast('همگام‌سازی انجام شد');
    case 'project-new': S.activeProject=''; S.proj={name:'',client:'',notes:''}; S.rooms=[]; S.est=[]; persist(); persist2(); render(); return toast('پروژه‌ی جدید آماده است');
    case 'project-load': { const pr=S.projects.find(x=>x.id===d.pid); if(!pr)return; S.activeProject=pr.id; S.proj={name:pr.name||'',client:pr.client||'',notes:pr.notes||''}; S.rooms=Array.isArray(pr.rooms)?pr.rooms:[]; S.est=Array.isArray(pr.estimate)?pr.estimate:[]; persist(); persist2(); S.tab='room'; render(); return toast('پروژه بارگذاری شد'); }
    case 'project-delete': { const arr=S.projects.filter(x=>x.id!==d.pid); try {const r=await api('projects',{method:'POST',body:JSON.stringify({projects:arr})}); if(r.ok){S.projects=r.projects||arr;render();toast('پروژه حذف شد');}else toast(r.error||'حذف نشد');}catch(e){toast('ارتباط با سرور برقرار نشد');} return; }
    case 'sponsor-refresh': S.sponsorData=null; render(); return;
    case 'market-refresh': S.marketData=null; render(); return;
    case 'profile-edit': { const p=ld(PROFILE_KEY,{}); return sheet(`<h3>شخصی‌سازی پروفایل</h3><p class="hint">نام و تصویر این بخش فقط در همین دستگاه نمایش داده می‌شود؛ هویت ثبت تجربه از حساب تلگرام خوانده می‌شود.</p><label class="fl"><span>نام نمایشی</span><input id="profileName" maxlength="80" value="${esc(p.displayName || accountName)}" placeholder="نامی که دوست داری ببینی"></label><label class="fl"><span>لینک تصویر (اختیاری، HTTPS)</span><input id="profilePhoto" maxlength="500" value="${esc(p.photoUrl || '')}" placeholder="https://…"></label><div class="sd-bar"><button class="act" data-x="scok">انصراف</button><button class="act act-primary" data-x="profile-save">ذخیره</button></div>`); }
    case 'profile-save': { const name=($('#profileName')?.value || accountName).trim().slice(0,80); let photo=($('#profilePhoto')?.value || '').trim().slice(0,500); if(photo && !/^https:\/\//i.test(photo)) return toast('لینک تصویر باید با https شروع شود'); const p={displayName:name || accountName, photoUrl:photo}; sv(PROFILE_KEY,p); Object.assign(profileSaved,p); closeSheet(); render(); return toast('پروفایل ذخیره شد'); }
    case 'guide-reset': S.guideQ=''; S.guideCat=''; render(); return;
    case 'community-reset': S.communityQ=''; S.communityType='all'; render(); return;
    case 'community-new': return sheet(`<h3>ثبت تجربه‌ی اجرایی</h3><label class="fl"><span>نوع تجربه</span><select id="cmType"><option value="success">تجربه‌ی موفق</option><option value="warning">هشدار / شکست</option><option value="tip">نکته‌ی اجرایی</option><option value="question">پرسش از جمع</option></select></label><p class="hint">این تجربه با هویت حساب تلگرام ثبت می‌شود: <b>${esc(accountName)}</b>${TG_USER.username ? ` (@${esc(TG_USER.username)})` : ''}. اگر در پروفایل پاکار لینک تصویر HTTPS ثبت کرده باشی، با اجازهٔ تو کنار تجربه نمایش داده می‌شود؛ این تصویر به‌تنهایی تأیید هویت نیست. اطلاعات شخصی یا محرمانه‌ی کارفرما را وارد نکن. انتشار پس از بررسی مدیر انجام می‌شود.</p><label class="fl"><span>عنوان تجربه</span><input id="cmTitle" maxlength="120" placeholder="مثلاً اجرای عایق در سرویس"></label><label class="fl"><span>مصالح / سامانه</span><input id="cmMaterial" maxlength="120" placeholder="نام مصالح یا سامانه"></label><label class="fl"><span>شرایط پروژه (اختیاری)</span><input id="cmContext" maxlength="500" placeholder="اقلیم، زیرکار، شرایط اجرا"></label><label class="fl"><span>لینک عکس پروژه (اختیاری، HTTPS)</span><input id="cmPhoto" maxlength="500" placeholder="لینک عمومی عکس، بدون اطلاعات محرمانه"></label><label class="fl"><span>شرح تجربه (حداقل ۲۰ حرف)</span><textarea id="cmDetails" rows="5" maxlength="2500" placeholder="چه چیزی اجرا شد، چه نتیجه‌ای دیدی و محدودیت‌ها چه بود؟"></textarea></label><label class="fl"><span>ارزیابی شخصی (اختیاری)</span><select id="cmRating"><option value="0">ثبت نمی‌کنم</option><option value="1">۱ از ۵</option><option value="2">۲ از ۵</option><option value="3">۳ از ۵</option><option value="4">۴ از ۵</option><option value="5">۵ از ۵</option></select></label><div class="sd-bar"><button class="act" data-x="scok">انصراف</button><button class="act act-primary" data-x="community-submit">ارسال برای بررسی</button></div>`);
    case 'community-submit': {const v=id=>document.getElementById(id)?.value||'';const body={type:v('cmType')||'success',title:v('cmTitle'),material:v('cmMaterial'),context:v('cmContext'),photo_url:v('cmPhoto'),author_photo_url:profilePhoto(),details:v('cmDetails'),rating:Number(v('cmRating'))||0};try{const r=await api('community',{method:'POST',body:JSON.stringify(body)});if(r.ok){S.communityData=null;closeSheet();render();toast(r.message||'برای بررسی ثبت شد');}else toast(r.error||'ثبت انجام نشد');}catch(e){toast('خطا در ثبت تجربه');}return;}
    case 'community-admin': {try{const r=await api('community-admin');if(!r.ok)return toast(r.error||'دسترسی ندارید');const rows=(r.items||[]).filter(x=>x.status==='pending'||x.status==='approved');return sheet(`<h3>مدیریت تجربه‌ها</h3>${rows.length?rows.map(x=>`<div class="ln"><h4><span>${esc(x.title)}</span><em>${esc(x.status==='approved'?'منتشرشده':'در انتظار بررسی')}</em></h4><p>${esc(x.details)}</p><small>${esc(x.user||'کاربر')} · ${esc(x.id)}</small><div class="ft">${x.status==='pending'?`<button class="act act-primary" data-x="community-review" data-id="${esc(x.id)}" data-action="approve">تأیید انتشار</button><button class="act" data-x="community-review" data-id="${esc(x.id)}" data-action="reject">رد</button>`:`<button class="act ${x.expert_verified?'act-primary':''}" data-x="community-review" data-id="${esc(x.id)}" data-action="expert">${x.expert_verified?'لغو نشان کارشناس':'تأیید تخصص (فقط پس از بررسی مدرک)'}</button>`}<button class="act" data-x="community-review" data-id="${esc(x.id)}" data-action="delete">حذف</button></div></div>`).join(''):'<p class="hint">موردی برای بررسی نیست.</p>'}`);}catch(e){return toast('خطا در دریافت ارسال‌ها');}}
    case 'community-review': {const reason=d.action==='reject'?(prompt('دلیل رد برای نمایش به نویسنده (اختیاری):','')||''):''; try{const r=await api('community-admin',{method:'POST',body:JSON.stringify({id:d.id,action:d.action,reason})});if(r.ok){S.communityData=null;closeSheet();render();toast('وضعیت ارسال به‌روزرسانی شد');}else toast(r.error||'عملیات انجام نشد');}catch(e){toast('ارتباط با سرور برقرار نشد');}return;}
    case 'community-vote': {try{const r=await api('community',{method:'POST',body:JSON.stringify({action:'vote',id:d.id})});if(r.ok){S.communityData=null;render();toast(r.voted?'رأی شما ثبت شد':'رأی ثبت شد');}else toast(r.error||'رأی ثبت نشد');}catch(e){toast('ارتباط با سرور برقرار نشد');}return;}
    case 'quote-open': { const coId=d.co||S.cur; const pid=d.pid||''; return quoteSheet(coId,pid); }
    case 'quote-submit': { const v=id=>document.getElementById(id)?.value||''; const body={company:v('qCompany')||d.co,product:v('qProduct')||d.pid,city:v('qCity'),quantity:v('qQty'),contact:v('qContact'),note:v('qNote')}; if(!body.product.trim())return toast('نام محصول را وارد کن'); try{const r=await api('quote',{method:'POST',body:JSON.stringify(body)});if(r.ok){closeSheet();toast(r.notification_warning ? (r.message || 'درخواست ثبت شد؛ نیازی به ارسال دوباره نیست') : 'درخواست برای مدیران پاکار ارسال شد ✓');}else toast(r.error||'درخواست ارسال نشد');}catch(e){toast('خطا در ارسال درخواست');} return; }
        case 'cadd': { const o = S.cres[Number(d.o)]; if (!o) return; return pick('افزودن «' + esc(o.l) + '» به برآورد', p => p.unit === o.u, (p, c) => { addLine({ ...p, mode: 'count', price: priceOf(p) }, c, R2(o.v)); persist(); closeSheet(); toast('به برآورد اضافه شد'); tabs(); }, `مقدار ${nf(o.v)} ${o.u}؛ فقط محصولاتی با واحد «${o.u}» نشان داده می‌شوند.`); }
    default: return;
  }
  persist2(); render();
});
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset, k = d.i;
  if (t.matches('[data-guide-search]')) { S.guideQ=t.value; const pos=t.selectionStart; render(); const inp=document.querySelector('[data-guide-search]'); if(inp){inp.focus();try{inp.setSelectionRange(pos,pos)}catch(_){}} return; }
  if (t.matches('[data-community-search]')) { S.communityQ=t.value; const pos=t.selectionStart; render(); const inp=document.querySelector('[data-community-search]'); if(inp){inp.focus();try{inp.setSelectionRange(pos,pos)}catch(_){}} return; }
  if (!k) return;
  if (k === 'ps') { S.pick.q = t.value; $('#pkL').innerHTML = pickList(); return; }
  if (k === 'wizard') { S.wizard[d.k] = t.value; return; }
  if (k === 'pj') { S.proj[d.k] = t.value; return persist2(); }
  if (k === 'room') { const r = rm(d.rid); if (r) r[d.k] = t.value; persist2(); return paintRoom(); }
  if (k === 'item') { const i = itm(rm(d.rid), d.iid); if (i) i[d.k] = t.value; persist2(); return paintRoom(); }
  if (k === 'px') { const v = num(t.value); if (v > 0) S.px[d.pid] = v; else delete S.px[d.pid]; persist2(); return paintRoom(); }
  if (k === 'sk') { (S.scn[d.iid] = S.scn[d.iid] || {})[d.t] = t.value; persist2(); return paintRoom(); }
  if (k === 'w') { S.w[d.k] = Number(t.value); const b = document.querySelector(`[data-wv="${d.k}"]`); if (b) b.textContent = fa(S.w[d.k]); persist2(); return paintCmp(); }
  if (k === 'calc') { S.cc.v[S.cc.k][d.k] = t.value; persist2(); return paintCalc(); }
});

function GenUIUnavailableGuideShare(text){try{navigator.clipboard.writeText(text);toast('متن پرونده کپی شد؛ در چت ربات ارسالش کن');}catch(_){sheet('<h3>پرونده‌ی اجرا</h3><textarea readonly rows=10>'+esc(text)+'</textarea><p class="hint">ارسال مستقیم از سرور در این نسخه فعال نیست؛ متن را کپی کن.</p>');}}
/* ---------- رویدادها ---------- */
document.addEventListener('change', e => { if(e.target.matches('[data-csort]')) { S.catalogSort=e.target.value; render(); } if(e.target.matches('[data-guide-cat]')) { S.guideCat=e.target.value; render(); } if(e.target.matches('[data-guide-check]')) { const t=e.target, key='rq.guide.check.'+t.dataset.pid, arr=ld(key,[]), idx=Number(t.dataset.step), next=t.checked?[...new Set([...arr,idx])]:arr.filter(x=>x!==idx); sv(key,next); render(); } });
document.addEventListener('click', e => {
  if (e.target.closest('a[data-stop]')) return;
  const t = e.target.closest('[data-x],[data-logo],[data-prod],[data-rmimg],[data-tab],[data-cat],[data-brand],[data-add],[data-fav],[data-pack],[data-st],[data-rm],[data-ep],[data-dp],[data-a],[data-cview],[data-community-type],[data-guide-print],[data-guide-share],[data-product-jump],#sdScrim,#themeBtn,#editBtn,#searchClear,#toTop');
  if (!t || t.dataset.x) return; const d = t.dataset, id = t.id;
  if (id === 'sdScrim') return closeSheet();
  if (id === 'themeBtn') { const r = document.documentElement, cur = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'), nx = cur === 'light' ? 'dark' : 'light'; r.setAttribute('data-theme', nx); syncThemeColor(nx); try { localStorage.setItem(K.th, nx); } catch (x) {} return hp(); }
  if (id === 'editBtn') { S.edit = !S.edit; toast(S.edit ? 'حالت ویرایش روشن شد' : 'حالت ویرایش خاموش شد'); return render(); }
  if (id === 'searchClear') { $('#search').value = ''; S.q = ''; t.hidden = true; return render(); }
  if (id === 'toTop') return scrollTo({ top: 0, behavior: 'smooth' });
  if (d.cview) { S.catalogView=d.cview; return render(); }
  if (d.communityType) { S.communityType=d.communityType; return render(); }
  if (d.productJump) { const panel=$('#sdPanel'); const target=[...panel.querySelectorAll('.grp')].find(h=>h.textContent.trim().includes(d.productJump)); if(target) target.scrollIntoView({behavior:'smooth',block:'start'}); else toast('این بخش هنوز اطلاعات ثبت‌شده ندارد'); return; }
  if (d.guidePrint) { const pair=find(d.guidePrint); if(!pair[1])return; const ins=pair[1].install||{}; const w=window.open('','_blank'); if(!w)return toast('اجازه‌ی بازشدن پنجره‌ی چاپ را بده'); w.document.write('<html lang="fa" dir="rtl"><meta charset="utf-8"><title>پرونده اجرا</title><style>body{font:14px sans-serif;line-height:2;padding:28px;color:#222}h1{font-size:22px}li{margin:8px 0}.warn{color:#a33}</style><h1>'+esc(pair[1].name)+'</h1><p>برند: '+esc(pair[0].name)+'</p><p>منبع: '+esc(ins.source||'ثبت نشده')+' | بازبین: '+esc(ins.verifiedBy||'ثبت نشده')+'</p><h2>مراحل اجرا</h2><ol>'+(ins.steps||[]).map(x=>'<li>'+esc(typeof x==='string'?x:(x.text||x.title||''))+'</li>').join('')+'</ol><h2 class="warn">خطاهای رایج</h2><ul>'+(ins.mistakes||[]).map(x=>'<li>'+esc(typeof x==='string'?x:(x.text||x.title||''))+'</li>').join('')+'</ul><p>این پرونده جایگزین دیتاشیت و تأیید طراح مسئول نیست.</p><script>window.onload=()=>window.print()<\/script></html>'); w.document.close(); return; }
  if (d.guideShare) { const pair=find(d.guideShare); if(!pair[1])return; const ins=pair[1].install||{}; const text='پرونده اجرا: '+pair[1].name+' — '+pair[0].name+'\nمنبع: '+(ins.source||'ثبت نشده')+'\nمراحل:\n'+(ins.steps||[]).map((x,i)=>(i+1)+'. '+(typeof x==='string'?x:(x.text||x.title||''))).join('\n')+'\nخطاها:\n'+(ins.mistakes||[]).map(x=>'• '+(typeof x==='string'?x:(x.text||x.title||''))).join('\n'); const url='https://t.me/share/url?url='+encodeURIComponent(link(pair[1].id))+'&text='+encodeURIComponent(text); try{if(TG&&TG.openTelegramLink)TG.openTelegramLink(url);else window.open(url,'_blank','noopener');}catch(_){GenUIUnavailableGuideShare(text);} return; }
  if (d.logo) { S.brand = S.brand === d.logo ? '' : d.logo; hp(); return render(); }
  if (d.prod) { hp(); return openProd(d.prod); }
  if (d.tab) { S.tab = d.tab; hp(); if (d.tab === 'community' && !S.communityData) S.communityLoading = false; render(); return scrollTo({ top: 0 }); }
  if (t.hasAttribute('data-cat')) { const cat=d.cat||''; S.cat = S.cat === cat ? '' : cat; hp(); return render(); }
  if (d.brand) { hp(); return openBrand(d.brand); }
  if (d.add) { const [c, p] = find(d.add); if (p) phase3Track('estimate', c.name, p.name); addLine(p, c); hp('medium'); toast(`«${p.name}» به برآورد اضافه شد`); return tabs(); }
  if (d.fav) { const i = S.fav.indexOf(d.fav); i < 0 ? S.fav.push(d.fav) : S.fav.splice(i, 1); persist(); hp(); t.classList.toggle('on', i < 0); t.setAttribute('aria-pressed', i < 0); tabs(); if (S.tab === 'fav') render(); return; }
  if (d.pack) { const k = D.packs.find(x => x.id === d.pack); let n = 0; k.items.forEach(it => { const [c, p] = find(it.p); if (p) { addLine(p, c, it.q); n++; } }); hp('medium'); toast(`${fa(n)} قلم اضافه شد`); return render(); }
  if (d.st) { const l = S.est.find(x => x.id === d.st); l.q = Math.max(1, l.q + Number(d.d)); persist(); hp(); return render(); }
  if (d.rm) { S.est = S.est.filter(l => l.id !== d.rm); persist(); return render(); }
  if (d.rmimg) { if (confirm('این عکس حذف شود؟')) rmMedia(S.cur, S.curP, d.rmimg).then(() => openProd(S.curP)); return; }
  const c = D.companies.find(x => x.id === (d.id || S.cur));
  if (d.ep) {
    const p = c.products.find(x => x.id === d.ep);
    return form('ویرایش محصول', PF, {
      ...p,
      specsT: specsText(p.specs),
      featuresT: (p.features || []).join('\n'),
      standardsT: standardsText(p.standards),
      techCertNo: (p.techCert && p.techCert.no) || '',
      techCertUntil: (p.techCert && p.techCert.until) || '',
      feHesab: p.feHesab || '',
      model3dUrl: p.model3d && typeof p.model3d === 'object' ? (p.model3d.url || '') : (typeof p.model3d === 'string' ? p.model3d : ''),
      installStepsT: (p.install && p.install.steps || []).join('\n'),
      installMistakesT: (p.install && p.install.mistakes || []).map(x=>typeof x==='string'?x:[({critical:'بحرانی',important:'مهم',minor:'جزئی'}[x.severity]||'مهم'),x.text||x.title||'',x.consequence||''].filter(Boolean).join(' | ')).join('\n'),
      installSource: p.install && p.install.source || '',
      installVideoUrl: p.install && p.install.video_url || '',
      installVerifiedBy: p.install && p.install.verifiedBy || '',
      installVerifiedAt: p.install && p.install.verifiedAt || '', installStandard: p.install && p.install.standard || ''
    }, o => { Object.assign(p, cleanP(o)); saveData(); }, () => openBrand(c.id), valP);
  }
  if (d.dp) { if (confirm('این محصول حذف شود؟')) { c.products = c.products.filter(x => x.id !== d.dp); S.fav = S.fav.filter(x => x !== d.dp); saveData(); persist(); openBrand(c.id); } return; }
  switch (d.a) {
    case 'tobrand': return openBrand(S.cur);
    case 'uplogo': return reqUpload('logo', c.id);
    case 'upimg': return reqUpload('image', c.id, t.dataset.pid);
    case 'upfile': { const title=prompt('عنوان فایل (مثلاً دیتیل اجرایی یا Family رویت)'); if(!title)return; const typ=prompt('نوع فایل: dwg / pdf / rvt / skp / texture / manual / other','pdf')||'document'; const version=prompt('نسخه (اختیاری)','')||''; const date=prompt('تاریخ/نسخه انتشار (اختیاری)','')||''; return reqUpload('file',c.id,t.dataset.pid,{title,doc_type:typ,version,date}); }
    case 'rmlogo': if (confirm('لوگو حذف شود؟')) rmMedia(c.id, '', c.logo && c.logo.key).then(() => openBrand(c.id)); return;
    case 'shareprod': { const pp = find(t.dataset.pid)[1]; const u = 'https://t.me/share/url?url=' + encodeURIComponent(link(t.dataset.pid)) + '&text=' + encodeURIComponent(pp ? pp.name : ''); TG && TG.openTelegramLink ? TG.openTelegramLink(u) : window.open(u, '_blank'); return; }
    case 'goest': closeSheet(); S.tab = 'est'; render(); return scrollTo({ top: 0 });
    case 'clear': if (confirm('همه‌ی اقلام برآورد پاک شود؟')) { S.est = []; persist(); render(); } return;
    case 'share': { const u = 'https://t.me/share/url?url=' + encodeURIComponent(`https://t.me/${S.bot}?start=${S.start}`) + '&text=' + encodeURIComponent(summary()); TG && TG.openTelegramLink ? TG.openTelegramLink(u) : window.open(u, '_blank'); return; }
    case 'addco': return form('برند جدید', CF, { sponsor: false }, o => { const n = { id: uid(), products: [], ...cleanC(o) }; D.companies.push(n); saveData(); render(); });
    case 'editco': return form('ویرایش برند', CF, coVals(c), o => { Object.assign(c, cleanC(o)); saveData(); render(); }, () => openBrand(c.id));
    case 'spectpl': { const ta = document.querySelector('#sdPanel [data-f=specsT]'); if (!ta) return; const g = (document.querySelector('#sdPanel [data-f=group]') || {}).value || '', nm = (document.querySelector('#sdPanel [data-f=name]') || {}).value || '', co = D.companies.find(x => x.id === S.cur) || {}; const have = ta.value.split('\n').map(l => l.split(/[:：]/)[0].trim()); const add = specTplFor(g + ' ' + nm, co.cat).filter(k => !have.includes(k)).map(k => k + ': '); ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + add.join('\n'); ta.rows = 8; hp(); return toast('عنوان‌ها درج شد؛ فقط مقدارهایی را که داری پر کن، بقیه خالی بماند'); }
    case 'dealers-edit': { const raw=(c.dealers||[]).map(x=>[x.city||'',x.name||'',x.phone||'',x.address||''].join(' | ')).join('\n'); const val=prompt('هر نمایندگی در یک خط با قالب شهر | نام | تلفن | نشانی\nبرای پاک‌کردن، ورودی را خالی بگذار.',raw); if(val===null)return; c.dealers=val.split('\n').map(line=>line.split('|').map(x=>x.trim())).filter(a=>a[1]).slice(0,100).map(a=>({city:(a[0]||'').slice(0,80),name:(a[1]||'').slice(0,100),phone:(a[2]||'').slice(0,40),address:(a[3]||'').slice(0,200)})); saveData(); return openBrand(c.id); }
    case 'delco': if (confirm('این برند و همه‌ی محصولاتش حذف شود؟')) { D.companies = D.companies.filter(x => x !== c); saveData(); closeSheet(); render(); } return;
    case 'addp': return form('افزودن سریع محصول', QPF, { group: 'سایر', unit: 'عدد' }, o => { c.products.push({ id: uid(), name: String(o.name||'').trim(), group: String(o.group||'سایر').trim(), unit: String(o.unit||'عدد').trim(), desc: '', price: num(o.price)||null, mode: 'count', perM2: null, catalog: '', page: safe(o.page), availability: '', confidence: 'review', source: String(o.source||'').trim().slice(0,250), lastVerified: '', features: [], specs: [], standards: [], speed: null, durability: null, def: null, surf: 'floor' }); saveData(); }, () => openBrand(c.id));
    case 'fok': { const o = readForm(); if (!o.name) return toast('نام را وارد کن'); const er = S.val && S.val(o); if (er) return toast(er); const b = S.back, ok = S.ok; ok(o); if (b) b(); else closeSheet(); return render(); }
    case 'fno': return S.back ? S.back() : closeSheet();
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'search') { S.q = t.value; $('#searchClear').hidden = !t.value; clearTimeout(S.dt); S.dt = setTimeout(render, 160); return; }
  if (t.dataset.l) { const l = S.est.find(x => x.id === t.dataset.l); l[t.dataset.k] = num(t.value); persist(); return paint(); }
  if (t.dataset.g) { S.cfg[t.dataset.g] = num(t.value); persist(); if (S.tab === 'room') paintRoom(); else if (S.tab === 'est') paint(); return; }
});
document.addEventListener('change', e => { const t=e.target; if(t && t.dataset && t.dataset.i==='wizard'){ S.wizard[t.dataset.k]=t.value; phase4Track('wizard','','', {query:S.wizard.problem}); render(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('mc')) { e.preventDefault(); openBrand(e.target.dataset.brand); } if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pr2')) { e.preventDefault(); openProd(e.target.dataset.prod); } });
addEventListener('scroll', () => { $('#toTop').hidden = scrollY < 500; }, { passive: true });
addEventListener('online',()=>toast('اتصال اینترنت برقرار شد')); addEventListener('offline',()=>toast('حالت آفلاین؛ فقط اطلاعات ذخیره‌شده در دسترس است'));
function syncThemeColor(theme) { const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', theme === 'light' ? '#e9e5dd' : '#25292b'); }
try { const th = localStorage.getItem(K.th); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) {}
syncThemeColor(document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

/* ---------- شروع و لودینگ ---------- */
const bootStartedAt = Date.now();
let bootFinished = false;
const bootMessages = ['در حال همگام‌سازی اطلاعات…', 'چیدن آجرهای کاتالوگ…', 'آماده‌سازی مشخصات فنی…', 'روشن‌کردن چراغ‌های پاکار…'];
let bootMsgIdx = 0;
function bootSay(text) { const st = $('#bootStatus'); if (!st) return; st.textContent = text; st.style.animation = 'none'; void st.offsetWidth; st.style.animation = ''; }
const bootTicker = setInterval(() => { if (bootFinished) return; bootMsgIdx = (bootMsgIdx + 1) % bootMessages.length; bootSay(bootMessages[bootMsgIdx]); }, 1150);
function finishBoot(message) {
  if (bootFinished) return;
  bootFinished = true;
  clearInterval(bootTicker);
  const screen = $('#bootScreen');
  const wait = 0;
  setTimeout(() => {
    if (!screen) return;
    if (message) bootSay(message);
    screen.classList.add('boot-done');
    setTimeout(() => { screen.classList.add('boot-out'); setTimeout(() => screen.remove(), 620); }, 720);
  }, wait);
}
const bootFailsafe = setTimeout(() => { finishBoot('امکان ادامه وجود دارد'); toast('بارگذاری طول کشید؛ اگر اطلاعات ناقص است، اتصال را بررسی کن'); }, 12000);
render();
const deep = () => { try { const p = new URLSearchParams(location.search).get('p'); if (p && find(p)[1]) openProd(p); } catch (e) {} };
addEventListener('error', e => { const i = e.target; if (!i || i.tagName !== 'IMG') return; if (!i.dataset.r) { i.dataset.r = '1'; i.src = i.src + (i.src.includes('?') ? '&' : '?') + 'r=' + Date.now(); } else { i.style.display = 'none'; i.parentElement && i.parentElement.classList.add('bad'); } }, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' || !S.admin) return; const cp = S.curP, open = !$('#sd').hidden; reload().then(() => { render(); if (open && cp && find(cp)[1]) openProd(cp); }).catch(() => {}); });
api('data').then(async r => { if(!r || !r.data) throw new Error('catalog unavailable'); D = normalizeCatalog(r.data); sv('rq.mat.catalog.cache',D); S.admin = !!r.admin; S.bot = r.bot || 'irarchitps_bot'; S.start = r.start || 'materials'; await loadProjects(); render(); deep(); clearTimeout(bootFailsafe); finishBoot('آماده‌ایم'); }).catch(() => { const cached=ld('rq.mat.catalog.cache',null); if(cached&&cached.companies){D=normalizeCatalog(cached);render();deep();clearTimeout(bootFailsafe);finishBoot('نسخه‌ی ذخیره‌شده آماده است');toast('نسخه‌ی ذخیره‌شده نمایش داده می‌شود؛ اتصال برقرار نیست');return;} fetch('/materials/data/materials.json',{cache:'no-store'}).then(r => r.json()).then(d => { D = normalizeCatalog(d); sv('rq.mat.catalog.cache',D); render(); deep(); clearTimeout(bootFailsafe); finishBoot('کاتالوگ آماده است'); }).catch(()=>{D={companies:[],packs:[]};render();clearTimeout(bootFailsafe);finishBoot('نمایش در حالت محدود');toast('اتصال برقرار نیست و داده‌ای برای نمایش ذخیره نشده');}); });
})();