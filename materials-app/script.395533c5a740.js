(() => {
'use strict';
let TG = window.Telegram && window.Telegram.WebApp;
try { if ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 2)) document.documentElement.classList.add('low-power'); } catch(e) {}
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* مقدار فنی لاتین‌دار (مثل «0.45 W/m²·K») در متن راست‌به‌چپ وارونه دیده نشود */
const ltrv = v => { const t = String(v == null ? '' : v); return /^[\d.,\s–\-]+\s*[A-Za-z][\w\/²³·°%\s]*$/.test(t) ? `<bdi dir="ltr">${esc(t)}</bdi>` : esc(t); };
const fa = n => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: 2 });
const num = v => parseFloat(String(v == null ? '' : v).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬،]/g, '').replace('٫', '.')) || 0;
const uid = () => Math.random().toString(36).slice(2, 9);
/* نرمال‌سازی جست‌وجو: ي/ك عربی، اعداد فارسی/عربی، نیم‌فاصله، حروف بزرگ و کوچک */
const nz = s => String(s == null ? '' : s).toLowerCase().replace(/[يئ]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u200c\u200f\u064b-\u065f]/g, '').replace(/\s+/g, ' ');
/* تاریخ شمسی (۱۴۰۵/۰۷/۰۱) → تعداد روز از آن تاریخ؛ اگر قابل‌تشخیص نبود null */
const staleDays = js => {
  try {
    const m = nz(js).match(/(1[34]\d\d)\D+(\d{1,2})\D+(\d{1,2})/); if (!m) return null;
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
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const COL = ['#6FE3C4', '#E3B26F', '#8AA2FF', '#E36F9A', '#B58AFF', '#7FD1E8'];
let TG_USER = (() => { try { return (TG && TG.initDataUnsafe && TG.initDataUnsafe.user) || {}; } catch (_) { return {}; } })();
let savedCfg = ld(K.cfg, { waste: null, labor: 0 });
if (!Object.prototype.hasOwnProperty.call(savedCfg, 'wasteExplicit')) { savedCfg.wasteExplicit = savedCfg.waste !== 5; if (!savedCfg.wasteExplicit) savedCfg.waste = null; }
if (!savedCfg.wasteByCategory) savedCfg.wasteByCategory = { tile: null, block: null, plaster: null, floor: null, other: null };
const PROFILE_KEY = 'rq.mat.profile';
const profileSaved = ld(PROFILE_KEY, {});
let accountName = [TG_USER.first_name, TG_USER.last_name].filter(Boolean).join(' ').trim() || TG_USER.username || 'کاربر رواق';
const initializeTelegramSdk = () => new Promise(resolve => {
  const accept = () => { try { TG = window.Telegram && window.Telegram.WebApp; if (TG) { TG.ready(); TG.expand(); TG_USER = (TG.initDataUnsafe && TG.initDataUnsafe.user) || {}; accountName = [TG_USER.first_name, TG_USER.last_name].filter(Boolean).join(' ').trim() || TG_USER.username || 'کاربر رواق'; } } catch(e) {} resolve(TG || null); };
  if (TG) return accept();
  const s = document.createElement('script'); s.src = 'https://telegram.org/js/telegram-web-app.js'; s.async = true; s.onload = accept; s.onerror = () => resolve(null); document.head.appendChild(s);
});
const displayName = () => String(profileSaved.displayName || accountName).slice(0, 80);
const profilePhoto = () => safe(profileSaved.photoUrl || TG_USER.photo_url || '');
const initials = name => (String(name || 'ر').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('') || 'ر');
const S = { catalogLoading: true, tab: 'cat', q: '', cat: '', edit: false, admin: false, est: ld(K.est, []), fav: ld(K.fav, []), cfg: savedCfg, mode: ld('rq.mat.mode','simple'), back: null, brand: '', bot: 'irarchitps_bot', start: 'materials', curP: '', rooms: ld(K.rooms, []), scn: ld(K.scn, {}), px: ld(K.px, {}), cmp: ld(K.cmp, []), w: ld(K.w, { price: 3, dur: 3, spd: 3, av: 3 }), dir: ld(K.dir, {}), proj: ld(K.proj, { name: '', client: '' }), cc: ld(K.cc, { k: 'floor', v: { floor: { w: '' }, block: { j: '', w: '' }, gyp: { w: '' } } }), pick: null, cres: [], projects: [], sponsorData: null, communityData: null, marketData: null, wizard: {problem:'basement_moisture', climate:'mixed', budget:'mid', method:'standard'} };
let D = { companies: [], packs: [] };
S.mediaBase = '';
const loadMediaManifest = async () => { if (!S.mediaBase) return; try { const r=await fetch(S.mediaBase + '/manifest.json', {cache:'no-cache'}); if(!r.ok) return; const m=await r.json(); const products=m.products||{}; D.companies.forEach(c=>(c.products||[]).forEach(p=>{ const x=products[p.id]; if(x && x.medium) { p.cdnImageUrl=S.mediaBase + '/' + String(x.medium).replace(/^\/+/, ''); p.cdnLqip=String(x.lqip||'').startsWith('data:image/webp;base64,')?x.lqip:''; p.imageKind=x.imageKind==='family'?'family':(p.imageKind||'product'); } })); if(S.tab==='cat') render(); } catch(e) {} };
const refreshMediaManifest = () => { loadMediaManifest(); };

/* ---------- ابزارها ---------- */
let tt; const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 1800); };
const cacheRole = () => TG_USER.id && String(TG_USER.id)===String(ld('rq.mat.catalog.adminUserId','')) ? 'admin' : 'public';
const api = (p, o = {}) => { const headers = { 'Content-Type': 'application/json', 'X-Init-Data': TG ? TG.initData : '', ...(o.headers||{}) }; if (p === 'data') { const role=cacheRole(), et=ld('rq.mat.catalog.etag.'+role,''); const cache=ld(role==='admin'?'rq.mat.catalog.admin-cache':'rq.mat.catalog.cache',null); if(et&&cache)headers['If-None-Match']=et; } return fetch('/materials/api/' + p, { cache: p === 'data' ? 'no-cache' : 'no-store', ...o, headers }).then(async r => { if (r.status === 304) return { ok:true, notModified:true, _role:cacheRole() }; const data = await r.json(); if (p === 'data' && r.headers.get('ETag')) data._etag = r.headers.get('ETag'); if (!r.ok && !data.error) data.error = 'خطای سرور (' + r.status + ')'; return data; }); };
const catalogDb = (() => { let dbp; const open=()=>dbp||(dbp=new Promise(resolve=>{ if(!('indexedDB' in window)) return resolve(null); const q=indexedDB.open('ravaq-materials-v3',1); q.onupgradeneeded=()=>q.result.createObjectStore('cache'); q.onsuccess=()=>resolve(q.result); q.onerror=()=>resolve(null); })); return { get:async k=>{const db=await open(); if(!db)return null; return new Promise(resolve=>{try{const r=db.transaction('cache').objectStore('cache').get(k);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)}catch(e){resolve(null)}})}, put:async(k,v)=>{const db=await open(); if(!db)return; try{db.transaction('cache','readwrite').objectStore('cache').put(v,k)}catch(e){}} }; })();
const cacheCatalog = (d, isAdmin=S.admin) => { const full=JSON.parse(JSON.stringify(d||{companies:[],packs:[]})); if(isAdmin&&TG_USER.id){sv('rq.mat.catalog.adminUserId',String(TG_USER.id));sv('rq.mat.catalog.admin-cache',full);} const safeData=JSON.parse(JSON.stringify(full)); const show=!!safeData.showIncompleteProducts; (safeData.companies||[]).forEach(c=>{c.products=(c.products||[]).filter(p=>{const has=!!(p.sourceImageUrl||p.cdnImageUrl||(p.images||[]).length); const v=p.verification||{},lic=p.mediaLicense||{}; const ready=has&&p.confidence==='verified'&&!!(v.datasheetUrl&&v.page&&v.reviewedAt&&v.reviewer)&&lic.status==='approved'&&!!(lic.source&&lic.rightsHolder&&lic.approvedAt); if(!ready&&show)p.publicationStatus='incomplete'; return ready||show;});}); sv('rq.mat.catalog.cache',safeData); catalogDb.put('catalog',safeData).catch(()=>{}); };
const find = id => { for (const c of D.companies) for (const p of c.products) if (p.id === id) return [c, p]; return []; };
const persist = () => { sv(K.est, S.est); sv(K.fav, S.fav); sv(K.cfg, S.cfg); };
const qty = l => { const w = l.mode==='area' || l.mode==='vol' ? wasteValue({group:l.group||'',name:l.name||''}) : 0; let q=null; if (l.mode === 'area') q=(Number(l.q)>0 && Number(l.per)>0 && w!=null) ? l.q*l.per*(1+w/100) : null; else if (l.mode === 'vol') q=(Number(l.q)>0 && Number(l.th)>0 && w!=null) ? l.q*l.th/100*(1+w/100) : null; else q=Number(l.q)>0 ? Number(l.q) : null; const product=find(l.pid)[1]; if(q!=null && product && Number(product.salesPackSize)>0) return window.RavaqCalcCore.roundToSalesUnit(q,Number(product.salesPackSize)).roundedQuantity; return q; };
const saveData = async (quiet = false) => { try { const r = await api('save', { method: 'POST', body: JSON.stringify(D) }); if (!quiet) toast(r.ok ? 'ذخیره شد ✓' + (noImg() ? ` — ${fa(noImg())} محصول هنوز بدون تصویر` : '') : (r.error ? 'ذخیره نشد: ' + r.error : 'ذخیره نشد')); return !!r.ok; } catch (e) { if (!quiet) toast('خطا در ارتباط'); return false; } };
const I = { heart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>', calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>' };

/* ---------- رسانه و شناسنامه ---------- */
const CONF = { verified: 'تأییدشده با دیتاشیت', datasheet: 'منبع دیتاشیت ثبت‌شده؛ تأیید کامل نشده', field: 'تجربه‌ی اجرایی', review: 'نیازمند بررسی' };
const mUrl = (m, z) => '/materials/m/' + m.key + '?s=' + z;
const letter = c => esc((c.en || c.name || '').trim()[0] || '؟');
const logoBox = (c, cls) => { const lic=c.logoLicense||{}; const approved=lic.status==='approved'&&lic.source&&lic.rightsHolder&&lic.approvedAt; return c.logo&&c.logo.key&&(S.admin||approved) ? `<div class="${cls} has-logo"><img src="${mUrl(c.logo, 'g')}" alt="${esc(c.name)}" decoding="async"></div>` : `<div class="${cls}">${letter(c)}</div>`; };
const externalProductImage = p => { const u=String(p && (p.cdnImageUrl || p.sourceImageUrl) || ''); return u.startsWith('/materials/images/') || (S.mediaBase && u.startsWith(S.mediaBase + '/')) ? u : ''; };
const thumb = (c, p) => { const m = (p.images || [])[0]; const ext = externalProductImage(p); const cdn=!!(p.cdnImageUrl&&S.mediaBase&&p.cdnImageUrl.startsWith(S.mediaBase+'/')); if(cdn) return `<div class="im"><img src="${esc(p.cdnLqip || ext)}" ${p.cdnLqip?`data-fullsrc="${esc(ext)}"`:''} data-fallback="${esc(m?mUrl(m,'t'):(p.sourceImageUrl||''))}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`; return m ? `<div class="im"><img src="${mUrl(m, 't')}" alt="${esc(p.name)}" loading="lazy" decoding="async"></div>` : ext ? `<div class="im"><img src="${esc(p.cdnLqip || ext)}" ${p.cdnLqip?`data-fullsrc="${esc(ext)}"`:''} data-fallback="${esc(p.sourceImageUrl || '')}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>` : `<div class="im ph"><b>${letter(c)}</b><small>در حال تکمیل</small></div>`; };
const specsText = a => (a || []).map(x => x.k + ': ' + x.v).join('\n');
const parseSpecs = t => String(t || '').split('\n').map(l => { const i = l.search(/[:：]/); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : null; }).filter(x => x && x.k && x.v);
const standardsText = a => (a || []).map(x => x.code + (x.verified ? ' | ' + x.verified : '')).join('\n');
const parseStandards = t => String(t || '').split('\n').map(l => {
  const parts = l.split('|').map(x => x.trim());
  return parts[0] ? { code: parts[0].slice(0, 80), verified: (parts[1] || '').slice(0, 30) } : null;
}).filter(Boolean).slice(0, 10);
const noImg = () => D.companies.reduce((n, c) => n + c.products.filter(p => !(p.images || []).length && !externalProductImage(p)).length, 0);
const link = id => S.bot ? `https://t.me/${S.bot}?start=mat_${id}` : '';
const reload = () => api('data').then(r => { if(r&&r.notModified)return {ok:true,notModified:true}; if (!r || !r.data) throw new Error('داده در دسترس نیست'); D = r.data; S.admin=!!r.admin; cacheCatalog(D,S.admin); if(r._etag)sv('rq.mat.catalog.etag.'+(S.admin?'admin':'public'),r._etag); S.bot = r.bot || 'irarchitps_bot'; S.start = r.start || 'materials'; S.mediaBase=String(r.mediaBase||'').replace(/\/$/,''); return {ok:true}; });
const reqUpload = async (kind, co, pid, extra = {}) => { try { const r = await api('upload-request', { method: 'POST', body: JSON.stringify({ kind, co, pid: pid || '', ...extra }) }); if (r.ok) { toast(kind === 'file' ? 'فایل را در چت ربات بفرست' : kind === 'catalog' ? 'فایل JSON را در چت ربات بفرست' : 'عکس را در چت ربات بفرست'); setTimeout(() => { try { TG.close(); } catch (e) {} }, 900); } else toast('ناموفق: ' + (r.error || '')); } catch (e) { toast('خطا در ارتباط'); } };
const rmMedia = async (co, pid, key) => { try { const r = await api('media-remove', { method: 'POST', body: JSON.stringify({ co, pid, key }) }); if (!r.ok) toast('حذف نشد'); await reload(); render(); } catch (e) { toast('خطا در ارتباط'); } };

/* ---------- شیت ---------- */
const sheet = (html, back) => { S.sheetReturnFocus=document.activeElement; $('#sdPanel').innerHTML = '<div class="sd-grab"></div><div class="sd-scroll">' + html + '</div>'; const sd = $('#sd'); sd.hidden = false; document.body.classList.add('locked'); requestAnimationFrame(() => { sd.classList.add('open'); const f=sd.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'); if(f)f.focus({preventScroll:true}); }); S.back = back || null; };
const closeSheet = () => { const sd = $('#sd'); sd.classList.remove('open'); document.body.classList.remove('locked'); S.back = null; const returnFocus=S.sheetReturnFocus; setTimeout(() => { if (!sd.classList.contains('open')) { sd.hidden = true; $('#sdPanel').innerHTML = ''; if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true}); } }, 300); };

/* ---------- نما ---------- */
function updateNavNeon() {
 const nav = $('#bottomNav'); if (!nav) return;
 let indicator = nav.querySelector('.nav-neon');
 if (!indicator) { indicator = document.createElement('span'); indicator.className = 'nav-neon'; indicator.setAttribute('aria-hidden','true'); nav.prepend(indicator); }
 const items = [...nav.querySelectorAll('.bottom-item:not([hidden])')];
 const activeTab = S.tab === 'manage' || S.tab === 'market' || S.tab === 'sponsor' ? 'profile' : S.tab; const active = items.find(b => b.dataset.tab === activeTab) || items[0]; if (!active) return;
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
  document.querySelectorAll('#bottomNav [data-tab]').forEach(b => { const active = b.dataset.tab === S.tab || (b.dataset.tab === 'profile' && ['manage','market','sponsor'].includes(S.tab)); b.classList.toggle('active', active); b.setAttribute('aria-selected', active ? 'true' : 'false'); b.setAttribute('tabindex', active ? '0' : '-1'); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const activeTab=document.querySelector('#bottomNav [role="tab"][aria-selected="true"]'); if(activeTab)$('#list').setAttribute('aria-labelledby',activeTab.id);
  updateNavNeon();
  $('#filters').hidden = S.tab !== 'cat';
  $('#editBtn').hidden = !S.admin; $('#editBtn').setAttribute('aria-pressed', S.edit);
  const hero = document.querySelector('.hero'); if (hero) hero.classList.toggle('compact', S.tab !== 'cat');
}
function toolsView() {
 const groups = [
  ['اندازه بگیر', 'متره و محاسبات', [['room','متره‌ی فضا','ابعاد، سطح اجرا و مقدار مصالح'],['calc','محاسبات تخصصی','محاسبات با ورودی‌های مشخص']]],
  ['تصمیم بگیر', 'انتخاب و مقایسه', [['wizard','راهنمای انتخاب','از مسئله‌ی پروژه شروع کن'],['cmp','مقایسه‌ی مصالح','مشخصات ثبت‌شده را کنار هم ببین'],['glossary','واژه‌نامه‌ی فنی','تعریف کوتاه اصطلاحات؛ موارد نیازمند بازبینی مشخص‌اند']]],
  ['پیگیری و تماس', 'مدارک و ارتباط با بازار', [['library','فایل‌های اجرایی','دفترچه‌ها و فایل‌های ثبت‌شده'],['prices','تاریخچه‌ی قیمت','فقط قیمت‌های دارای تاریخ ثبت'],['dealers','نمایندگی و استعلام','راه تماس و ثبت درخواست'],['education','راهنمای اجرا','آموزش‌های کوتاه محصول']]]
 ];
 const card = ([id,title,desc]) => `<button class="tool-card" data-tab="${id}"><b>${title}</b><small>${desc}</small><span class="tool-arrow">←</span></button>`;
 return `<div class="tools-intro"><span class="eyebrow">جعبه‌ابزار رواق</span><h2>برای چه کاری آمده‌ای؟</h2><p>ابزارها بدون تکرار، بر اساس کاری که می‌خواهی انجام بدهی مرتب شده‌اند.</p></div>${groups.map((g,i)=>`<details class="tool-group" ${i===0?'open':''}><summary><span><b>${g[0]}</b><small>${g[1]}</small></span><span class="tool-group-count">${fa(g[2].length)} ابزار</span></summary><div class="tool-grid">${g[2].map(card).join('')}</div></details>`).join('')}`;
}
let glossaryModulePromise = null;
function glossaryView() {
  if (window.RavaqGlossary && window.RavaqGlossary.renderGlossary) return window.RavaqGlossary.renderGlossary(esc);
  if (!glossaryModulePromise) glossaryModulePromise = import('/materials/modules/glossary.c3ed4ab0d3b8.js').then(mod => { window.RavaqGlossary=mod; if(S.tab==='glossary') render(); }).catch(()=>{ glossaryModulePromise=null; });
  return '<div class="ln" role="status" aria-live="polite">در حال بارگذاری واژه‌نامه…</div>';
}
function recentView() {
 const ids = ld('rq.mat.recent', []); const rows = ids.map(id=>{const [c,p]=find(id);return c&&p?{c,p}:null}).filter(Boolean);
 return rows.length ? `<div class="tools-intro"><h2>اخیراً دیده‌شده</h2><p>آخرین شناسنامه‌هایی که باز کرده‌ای.</p></div>${rows.map(({c,p})=>`<div class="ln"><h4><span>${esc(p.name)}</span><em>${esc(c.name)}</em></h4><button class="act act-primary" data-prod="${esc(p.id)}">بازکردن شناسنامه</button></div>`).join('')}` : '<div class="empty"><h3>هنوز محصولی باز نکرده‌ای</h3><p>وقتی شناسنامه‌ای را باز کنی، برای دسترسی سریع اینجا ذخیره می‌شود.</p><button class="act act-primary" data-tab="cat">رفتن به کاتالوگ</button></div>';
}
function profileView() {
 const name = displayName(); const photo = profilePhoto(); const uname = TG_USER.username ? '@' + TG_USER.username : 'نام کاربری تلگرام ثبت نشده';
 return `<section class="profile-card"><div class="profile-head"><div class="profile-avatar">${photo ? `<img src="${esc(photo)}" alt="تصویر پروفایل" referrerpolicy="no-referrer">` : `<span>${esc(initials(name))}</span>`}</div><div class="profile-identity"><span class="eyebrow">حساب کاربری</span><h2>${esc(name)}</h2><p>${esc(uname)}</p><small>${TG_USER.id ? 'متصل به حساب تلگرام' : 'پروفایل محلی؛ برای امکانات اجتماعی از داخل تلگرام باز کن'}</small></div></div><button class="act act-primary" data-x="profile-edit">ویرایش نام نمایشی و تصویر</button><div class="grp">حالت کاربری</div><div class="mode-toggle" role="group" aria-label="حالت رابط کاربری"><button type="button" class="act ${S.mode !== 'pro' ? 'act-primary' : ''}" data-x="set-mode" data-mode="simple" aria-pressed="${S.mode !== 'pro'}">ساده</button><button type="button" class="act ${S.mode === 'pro' ? 'act-primary' : ''}" data-x="set-mode" data-mode="pro" aria-pressed="${S.mode === 'pro'}">حرفه‌ای</button></div></section>
 <div class="grp">فضای شخصی</div><div class="profile-links"><button class="profile-link" data-tab="fav"><b>ذخیره‌شده‌ها</b><span>محصولات نشان‌شده ←</span></button><button class="profile-link" data-tab="recent"><b>اخیراً دیده‌شده</b><span>بازگشت به شناسنامه‌های اخیر ←</span></button><button class="profile-link" data-tab="projects"><b>پروژه‌های من</b><span>برآوردها و کارهای ذخیره‌شده ←</span></button><button class="profile-link" data-tab="community"><b>تجربه‌های من</b><span>ارسال‌ها و وضعیت بررسی ←</span></button>${S.admin?'<button class="profile-link" data-tab="manage"><b>مدیریت محتوا</b><span>کاتالوگ، فایل‌ها و بررسی اطلاعات ←</span></button>':''}</div>
 <p class="hint profile-note">در حالت ساده توضیح فیلدها و راهنمای واژه‌ها نمایش داده می‌شود؛ در حالت حرفه‌ای صفحه فشرده‌تر است. تنظیم حساب در تلگرام همگام می‌شود.</p><p class="hint profile-note">نام نمایشی و تصویر انتخابی فقط برای شخصی‌سازی همین دستگاه است. تجربه‌های اجرایی با هویت تأییدشدهٔ حساب تلگرام ثبت می‌شوند تا تغییر نام نمایشی باعث جعل هویت نشود.</p>`;
}
function mediaGapRowsHtml(companies) { const rows=[]; companies.forEach(co=>{ if(!co.logo||!co.logo.key) rows.push(`<div class="ln review-row" data-brand="${esc(co.id)}" data-gaptype="logo"><h4><span>لوگوی ${esc(co.name)}</span><em>ثبت نشده</em></h4><button class="act act-primary" data-a="uplogo" data-id="${esc(co.id)}">آپلود لوگو از ربات</button></div>`); (co.products||[]).forEach(p=>{ const noImage=!(p.images||[]).length&&!externalProductImage(p); const noLicense=!noImage&&!(p.mediaLicense&&p.mediaLicense.status==='approved'); if(noImage)rows.push(`<div class="ln review-row" data-brand="${esc(co.id)}" data-gaptype="image"><h4><span>${esc(p.name)}</span><em>${esc(co.name)}</em></h4><p class="hint">تصویر اختصاصی ثبت نشده؛ محصول در حالت پیش‌نویس است.</p><button class="act act-primary" data-a="upimg" data-id="${esc(co.id)}" data-pid="${esc(p.id)}">آپلود تصویر از ربات</button></div>`); if(noLicense)rows.push(`<div class="ln review-row" data-brand="${esc(co.id)}" data-gaptype="license"><h4><span>مجوز تصویر: ${esc(p.name)}</span><em>${esc(co.name)}</em></h4><p class="hint">منبع، دارنده‌ی حق و تاریخ تأیید ثبت نشده یا تأیید نشده است.</p>${!noImage?`<button class="act" data-x="approve-license" data-id="${esc(co.id)}" data-pid="${esc(p.id)}">ثبت مجوز تصویر</button>`:''}</div>`); }); if(co.logo&&co.logo.key&&(!co.logoLicense||co.logoLicense.status!=='approved'))rows.push(`<div class="ln review-row" data-brand="${esc(co.id)}" data-gaptype="license"><h4><span>مجوز لوگوی ${esc(co.name)}</span><em>نیازمند بررسی</em></h4><button class="act" data-x="approve-license" data-id="${esc(co.id)}">ثبت مجوز لوگو</button></div>`); }); return rows.join('')||'<div class="empty"><p>کمبود رسانه‌ای ثبت نشده است.</p></div>'; }
function reviewRowsHtml(rows) { return rows.map(({co,p,verifyMissing,licenseMissing})=>`<div class="ln review-row" data-brand="${esc(co.id)}" data-verify="${verifyMissing}" data-license="${licenseMissing}" data-image="${!(p.images||[]).length&&!externalProductImage(p)}"><h4><span>${esc(p.name)}</span><em>${esc(co.name)}</em></h4><div class="meta">${verifyMissing?'<span>نیازمند بررسی فنی</span>':''}${licenseMissing?'<span>مجوز تصویر بررسی نشده</span>':''}${!(p.images||[]).length&&!externalProductImage(p)?'<span>تصویر ندارد</span>':''}</div><div class="ft">${verifyMissing?`<button class="act act-primary" data-x="verify-product" data-id="${esc(co.id)}" data-pid="${esc(p.id)}">تأیید با دیتاشیت</button>`:''}${licenseMissing&&(externalProductImage(p)||(p.images||[]).length)?`<button class="act" data-x="approve-license" data-id="${esc(co.id)}" data-pid="${esc(p.id)}">ثبت مجوز تصویر</button>`:''}${p.publicationStatus!=='published'&&(externalProductImage(p)||(p.images||[]).length)?`<button class="act" data-x="publish-product" data-id="${esc(co.id)}" data-pid="${esc(p.id)}">انتشار محصول</button>`:''}<button class="act" data-prod="${esc(p.id)}">شناسنامه</button></div></div>`).join('') || '<div class="empty"><p>موردی برای بررسی باقی نمانده است.</p></div>'; }
function manageView() {
 if (!S.admin) return '<div class="empty"><p>این بخش فقط برای مدیران رواق است.</p></div>';
 const products=[]; D.companies.forEach(c=>(c.products||[]).forEach(p=>products.push({c,p})));
 const missingImage=products.filter(x=>!(x.p.images||[]).length && !externalProductImage(x.p)); const missingLogo=D.companies.filter(c=>!(c.logo&&c.logo.key)); const missingLicense=products.filter(x=>((x.p.images||[]).length||externalProductImage(x.p))&&(!x.p.mediaLicense||x.p.mediaLicense.status!=='approved')); const mediaGapTotal=missingImage.length+missingLogo.length+missingLicense.length+D.companies.filter(c=>c.logo&&c.logo.key&&(!c.logoLicense||c.logoLicense.status!=='approved')).length; const reviewQueue=products.filter(x=>x.p.confidence!=='verified'||!x.p.verification||!x.p.verification.datasheetUrl||!x.p.verification.page||!x.p.verification.reviewedAt||!x.p.verification.reviewer); const needsWork=products.filter(x=>(!(x.p.images||[]).length && !externalProductImage(x.p)) || (!x.p.source && !(x.p.specs||[]).length)); const pending=(S.communityData&&S.communityData.items||[]).filter(x=>x.status==='pending').length;
 return `<div class="admin-welcome"><span class="eyebrow">میزکار مدیر</span><h2>مدیریت محتوا، بدون گشتن در منوها</h2><p>کارهای مهم را از اینجا شروع کن. تغییرات فقط پس از ذخیره روی کاتالوگ اعمال می‌شوند.</p><div class="admin-metrics"><div><b>${fa(D.companies.length)}</b><small>برند</small></div><div><b>${fa(products.length)}</b><small>محصول</small></div><div><b>${fa(mediaGapTotal)}</b><small>کمبود رسانه (مورد)</small></div><div><b>${fa(missingImage.length)}</b><small>بدون تصویر</small></div><div><b>${fa(missingLogo.length)}</b><small>بدون لوگو</small></div><div><b>${fa(missingLicense.length)}</b><small>مجوز نیازمند بررسی</small></div><div><b>${fa(reviewQueue.length)}</b><small>نیازمند بررسی فنی</small></div></div></div>
 <div class="admin-actions"><button class="admin-action admin-action-primary" data-x="catalog-upload"><b>آپلود کاتالوگ از فایل</b><small>ارسال فایل JSON در چت ربات و افزودن گروهی محصولات بدون دیپلوی مجدد</small><span>انتخاب فایل از طریق چت ربات ←</span></button><button class="admin-action" data-x="bulk-media-upload"><b>ورود گروهی تصویر با نام فایل</b><small>هر تصویر باید نامی با قالب brands/brandId/products/productId/NN.webp داشته باشد؛ مجوز پیش‌فرض تأییدنشده می‌ماند.</small><span>شروع آپلود از چت ربات ←</span></button><button class="admin-action" data-x="media-gaps"><b>فهرست کمبود رسانه</b><small>${fa(mediaGapTotal)} مورد شامل تصویر، لوگو و مجوز</small><span>بررسی کمبودها ←</span></button><button class="admin-action" data-x="license-export"><b>خروجی مجوزهای رسانه</b><small>فایل JSON برای همگام‌سازی manifest مخزن جداگانه‌ی رسانه</small><span>دریافت خروجی ←</span></button><button class="admin-action" data-x="quick-products"><b>افزودن سریع چند محصول</b><small>ثبت چند محصول در یک فرم کوتاه؛ بدون بازکردن فرم بلند برای هرکدام</small><span>شروع افزودن سریع ←</span></button><button class="admin-action" data-x="admin-catalog"><b>۱. ویرایش برندها و محصولات</b><small>افزودن محصول، تصویر، مشخصات و فایل</small><span>ورود به کاتالوگ ←</span></button><button class="admin-action" data-x="review-queue"><b>۲. صف تأیید محصول و مجوز</b><small>${fa(reviewQueue.length)} محصول نیازمند بررسی دیتاشیت · ${fa(missingLicense.length)} مجوز رسانه</small><span>بررسی و تأیید مستند ←</span></button><button class="admin-action" data-x="community-admin"><b>۳. بررسی تجربه‌های کاربران</b><small>تأیید، رد یا مدیریت نشان کارشناسی</small><span>بررسی ارسال‌ها ←</span></button><button class="admin-action" data-tab="market"><b>۴. شاخص بازار</b><small>بازدیدها، جست‌وجوهای بی‌نتیجه و استعلام‌ها</small><span>مشاهده گزارش ←</span></button><button class="admin-action" data-tab="sponsor"><b>۵. گزارش حامیان</b><small>رویدادهای ثبت‌شده برای برندهای حامی</small><span>مشاهده گزارش ←</span></button></div>
 <div class="ln"><h4><span>نمایش محصولات بدون تصویر</span><em>${D.showIncompleteProducts ? 'فعال' : 'غیرفعال'}</em></h4><p class="hint">در حالت عادی، محصول بدون تصویر واقعی در کاتالوگ عمومی پنهان است.</p><button class="act act-primary" data-x="toggle-incomplete" data-enabled="${!D.showIncompleteProducts}">${D.showIncompleteProducts ? 'پنهان‌کردن محصولات ناقص' : 'نمایش با برچسب «در حال تکمیل»'}</button></div><div class="grp">موارد نیازمند تکمیل</div>${needsWork.length?needsWork.slice(0,10).map(({c,p})=>`<div class="ln admin-missing"><h4><span>${esc(p.name)}</span><em>${esc(c.name)}</em></h4><div class="meta"><span>تصویر ندارد</span>${!p.source&&!(p.specs||[]).length?'<span>منبع/مشخصات ناقص</span>':''}</div><div class="ft"><button class="act act-primary" data-prod="${esc(p.id)}">بازکردن محصول</button><button class="act" data-x="admin-edit-product" data-id="${esc(c.id)}" data-pid="${esc(p.id)}">ویرایش اطلاعات</button></div></div>`).join(''):'<div class="empty"><p>همه‌ی محصولات تصویر دارند. برای انتشار، منبع و مشخصات فنی را هم بررسی کن.</p></div>'}
 <div class="ft"><button class="act act-primary" data-x="admin-save">ذخیره‌ی تغییرات</button><button class="act" data-x="admin-refresh">بازخوانی از سرور</button></div>`;
}
function render() {
  tabs();
  const L = $('#list');
  L.innerHTML = ({ est: estView, fav: favView, room: roomView, cmp: cmpView, calc: calcView, library: libraryView, projects: projectsView, prices: pricesView, dealers: dealersView, sponsor: sponsorView, wizard: wizardView, education: educationView, community: communityView, market: marketView, tools: toolsView, glossary: glossaryView, recent: recentView, manage: manageView, profile: profileView }[S.tab] || catView)();
  if (S.tab === 'cat') { const cats = [...new Set(D.companies.map(c => c.cat).filter(Boolean))]; $('#chips').innerHTML = cats.map(c => `<button type="button" class="chip ${S.cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join(''); $('#logos').innerHTML = [...D.companies].sort((a, b) => (!!b.sponsor) - (!!a.sponsor)).map(c => `<button type="button" class="lgo ${S.brand === c.id ? 'on' : ''}" data-logo="${c.id}" aria-pressed="${S.brand === c.id}">${logoBox(c, 'lgb')}<small>${esc(c.name)}</small>${c.sponsor ? '<i class="spd" title="حامی رواق"></i>' : ''}</button>`).join(''); observe(); }
  if (S.tab === 'est') paint(); else if (S.tab === 'room') paintRoom(); else if (S.tab === 'cmp') paintCmp(); else if (S.tab === 'calc') paintCalc();
}
let io; function observe() { const cs = document.querySelectorAll('.mc'); if (!('IntersectionObserver' in window)) return cs.forEach(c => c.classList.add('in-view')); io && io.disconnect(); io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.transitionDelay = (Number(e.target.dataset.i) % 4) * 50 + 'ms'; e.target.classList.add('in-view'); io.unobserve(e.target); } }), { threshold: .05 }); cs.forEach(c => io.observe(c)); }

function catView() {
  const q = S.q.trim();
  const nq = nz(q).split(' ').filter(Boolean);
  const hay = c => nz([c.name, c.en, c.cat, c.desc, ...c.products.map(p => [p.name, p.group, p.desc, (p.features || []).join(' '), (p.specs || []).map(x => x.k + ' ' + x.v).join(' ')].join(' '))].join(' '));
  const list = D.companies.filter(c => (!S.cat || c.cat === S.cat) && (!S.brand || c.id === S.brand) && (!nq.length || (h => nq.every(w => h.includes(w)))(hay(c))));
  const add = S.edit ? '<button type="button" class="act act-primary" data-a="addco" style="margin-top:12px">+ برند جدید</button>' : '';
  if (!list.length && !D.companies.length && S.catalogLoading) return '<div class="grid"><div class="skeleton-card" aria-hidden="true"></div><div class="skeleton-card" aria-hidden="true"></div><div class="skeleton-card" aria-hidden="true"></div><div class="skeleton-card" aria-hidden="true"></div></div>';
  if (!list.length) { if (S.q.trim()) { const sk=nz(S.q).slice(0,100); if(S.lastNoResult!==sk){S.lastNoResult=sk;phase4Track('search_no_result','','',{query:sk});} } else S.lastNoResult=''; return add + '<div class="empty"><div class="empty-icon">🔍</div><p>موردی پیدا نشد</p></div>'; }
  return add + '<div class="grid">' + list.map((c, i) => `<article class="mc" data-brand="${c.id}" data-i="${i}" tabindex="0" role="button"><div style="display:flex;gap:10px;align-items:center">${logoBox(c, 'mono')}<div><h3>${esc(c.name)}</h3><div class="meta"><span>${esc(c.cat)}</span></div></div></div><p>${esc(c.desc)}</p><div class="meta"><span>${fa(c.products.length)} محصول</span>${safe(c.catalog) ? '<span class="sp">کاتالوگ</span>' : ''}${c.sponsor ? '<span class="sp">حامی رواق</span>' : ''}</div></article>`).join('') + '</div>';
}
function prodRow(c, p) {
  const price = p.price ? `<div class="pc">${fa(p.price)} تومان <small>/ ${esc(p.unit)}</small>${p.priceSource&&p.priceUpdatedAt?`<small> · ${esc(p.priceUpdatedAt)} · ${esc(p.priceSource)}</small>`:'<small class="src-note">منبع یا تاریخ قیمت نیازمند تکمیل است؛ برای سناریو معتبر محسوب نمی‌شود.</small>'}</div>` : `<div class="pc no">قیمت روز: استعلام <small>(${esc(p.unit)})</small></div>`;
  const on = S.fav.includes(p.id);
  const warn = (S.edit && !(p.images || []).length && !externalProductImage(p) ? '<small class="wr">⚠ بدون تصویر؛ از داخل محصول عکس اضافه کن</small>' : (p.publicationStatus === 'incomplete' ? '<small class="wr">در حال تکمیل</small>' : '')) + (p.imageKind === 'family' ? '<small class="src-note">تصویر خانواده‌ی محصول</small>' : ''); 
  return `<div class="pr2" data-prod="${p.id}" tabindex="0" role="button">${thumb(c, p)}<h4>${esc(p.name)}</h4>${p.desc ? `<small>${esc(p.desc)}</small>` : ''}${price}${(p.features || []).length ? `<div class="fch">${p.features.slice(0, 2).map(f => `<b>${esc(f)}</b>`).join('')}</div>` : ''}${warn}<div class="bt"><button type="button" class="sq pl" data-add="${p.id}" aria-label="افزودن به برآورد">＋</button><button type="button" class="sq ${on ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${on}" aria-label="ذخیره">${I.heart}</button><button type="button" class="sq ${S.cmp.includes(p.id) ? 'on' : ''}" data-x="cmp" data-pid="${p.id}" aria-label="مقایسه">⇄</button>${safe(p.catalog) ? `<a class="sq" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener" aria-label="کاتالوگ محصول">${I.pdf.replace('<svg', '<svg width="17" height="17"')}</a>` : ''}${S.edit ? `<button type="button" class="sq" data-ep="${p.id}">✎</button><button type="button" class="sq dg" data-dp="${p.id}">✕</button>` : ''}</div></div>`;
}
function openBrand(id) {
  const c = D.companies.find(x => x.id === id); if (!c) return;
  const gs = {}; c.products.forEach(p => (gs[p.group || 'سایر'] = gs[p.group || 'سایر'] || []).push(p));
  const cat = safe(c.catalog);
  sheet(`<div class="sd-head">${logoBox(c, 'mono')}<div><h3 style="margin:0;font-size:18px;color:var(--ink)">${esc(c.name)}${c.en ? ` <small style="color:var(--ink-faint)">${esc(c.en)}</small>` : ''}</h3><div class="meta" style="margin-top:4px"><span>${esc(c.cat)}</span>${c.sponsor ? '<span class="sp">حامی رواق</span>' : ''}</div></div></div>
  <p style="color:var(--ink-dim);font-size:13px;margin:6px 0 4px">${esc(c.desc)}</p>
  ${(c.features || []).length ? `<ul class="fts" style="margin:8px 0">${c.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
  ${(safe(c.site) || (c.links || []).some(x => safe(x.u))) ? `<div class="ft" style="margin:8px 0">${safe(c.site) ? `<a class="act" data-stop href="${esc(safe(c.site))}" target="_blank" rel="noopener">وب‌سایت رسمی</a>` : ''}${(c.links || []).filter(x => safe(x.u)).map(x => `<a class="act" data-stop href="${esc(safe(x.u))}" target="_blank" rel="noopener">${esc(x.t)}</a>`).join('')}</div>` : ''}
  ${S.edit ? `<div class="ft"><button type="button" class="act" data-a="editco" data-id="${c.id}">✎ ویرایش برند</button><button type="button" class="act act-primary" data-a="addp" data-id="${c.id}">+ محصول</button><button type="button" class="act" data-a="uplogo" data-id="${c.id}">🖼 لوگو از ربات</button><button type="button" class="act" data-a="dealers-edit" data-id="${c.id}">⌖ مدیریت نمایندگی‌ها</button>${c.logo ? `<button type="button" class="act" data-a="rmlogo" data-id="${c.id}" style="color:var(--danger)">حذف لوگو</button>` : ''}<button type="button" class="act" data-a="delco" data-id="${c.id}" style="color:var(--danger)">حذف برند</button></div>` : ''}
  ${Object.entries(gs).map(([g, ps]) => `<div class="grp">${esc(g)}</div>${ps.map(p => prodRow(c, p)).join('')}`).join('') || '<div class="empty"><p>هنوز محصولی ثبت نشده</p></div>'}
  <div class="sd-bar" style="margin-top:12px">${cat ? `<a class="act act-primary" href="${esc(cat)}" target="_blank" rel="noopener">${I.pdf}<span>کاتالوگ شرکت</span></a>` : ''}<button type="button" class="act" data-a="goest">${I.calc}<span>برآورد (${fa(S.est.length)})</span></button></div>`, () => openBrand(id));
  S.cur = id;
}
const ratings = p => ((p.speed && p.speedSource) || (p.durability && p.durabilitySource)) ? `<div class="grp">نظر کارشناسی رواق</div><p class="hint">این امتیازها نظر کارشناسی‌اند، نه مشخصات دیتاشیت؛ منبع ثبت‌شده کنار هر معیار آمده است.</p><table class="spt">${p.durability && p.durabilitySource ? `<tr><td>دوام</td><td>${fa(p.durability)} از ۵ · ${esc(p.durabilitySource)}</td></tr>` : ''}${p.speed && p.speedSource ? `<tr><td>سرعت اجرا</td><td>${fa(p.speed)} از ۵ · ${esc(p.speedSource)}</td></tr>` : ''}</table>` : '';

function openProd(pid) {
  const [c, p] = find(pid); if (!p) return;
  const recent = ld('rq.mat.recent', []).filter(x => x !== pid); recent.unshift(pid); sv('rq.mat.recent', recent.slice(0, 8));
  S.cur = c.id; S.curP = pid;
  phase3Track('view', c.name, p.name);
  const imgs = p.images || [];
  const exactImage = externalProductImage(p);
  const hasCdnImage=!!(p.cdnImageUrl&&S.mediaBase&&p.cdnImageUrl.startsWith(S.mediaBase+'/'));
  const gal = hasCdnImage ? `<div class="gal"><div class="gal-track"><div class="gal-s im"><img src="${esc(p.cdnLqip || exactImage)}" ${p.cdnLqip?`data-fullsrc="${esc(exactImage)}"`:''} data-fallback="${esc(imgs[0]?mUrl(imgs[0],'l'):(p.sourceImageUrl||''))}" alt="${esc(p.name)}" decoding="async"></div></div><small class="src-note">${p.imageKind === 'family' ? 'تصویر خانواده‌ی محصول از دفترچه' : 'تصویر اختصاصی محصول از دفترچه'}</small></div>` : imgs.length ? `<div class="gal"><div class="gal-track" id="galT">${imgs.map((m, k) => `<div class="gal-s im"><img src="${mUrl(m, 'l')}" alt="${esc(p.name)}" ${k ? 'loading="lazy" ' : ''}decoding="async">${S.edit ? `<button type="button" class="sq dg gal-x" data-rmimg="${m.key}" aria-label="حذف عکس">✕</button>` : ''}</div>`).join('')}</div>${imgs.length > 1 ? `<div class="dots" id="galD">${imgs.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>` : exactImage ? `<div class="gal"><div class="gal-track"><div class="gal-s im"><img src="${esc(p.cdnLqip || exactImage)}" ${p.cdnLqip?`data-fullsrc="${esc(exactImage)}"`:''} data-fallback="${esc(p.sourceImageUrl || '')}" alt="${esc(p.name)} — تصویر دفترچه" decoding="async"></div></div><small class="src-note">${p.imageKind === 'family' ? 'تصویر خانواده‌ی محصول از دفترچه' : 'تصویر اختصاصی محصول از دفترچه'}</small></div>` : `<div class="im ph big"><b>${letter(c)}</b><small>در حال تکمیل — تصویر اختصاصی ثبت نشده</small></div>`;
  const price = p.price ? `<div class="pc">${fa(p.price)} تومان <small>/ ${esc(p.unit)}</small>${p.priceSource&&p.priceUpdatedAt?`<small> · ${esc(p.priceUpdatedAt)} · ${esc(p.priceSource)}</small>`:'<small class="src-note">منبع یا تاریخ قیمت نیازمند تکمیل است؛ برای سناریو معتبر محسوب نمی‌شود.</small>'}</div>` : `<div class="pc no">قیمت روز: استعلام <small>(${esc(p.unit)})</small></div>`;
  const prange=priceRange(p); const priceRangeHtml=prange?`<div class="meta"><span>بازه‌ی ثبت‌شده: ${fa(prange.min)} تا ${fa(prange.max)} تومان</span><span>تاریخ: ${esc(prange.from)} تا ${esc(prange.to)}</span></div>`:'';
  const specs = (p.specs || []).length ? `<table class="spt">${p.specs.map(x => `<tr><td>${S.mode!=='pro' && ['ضریب هدایت حرارتی','مقاومت فشاری','چگالی','مصرف مرجع'].includes(x.k) ? `<button class="term-link" data-x="glossary-term" data-term="${esc(x.k)}">${esc(x.k)} ⓘ</button>` : esc(x.k)}</td><td>${ltrv(x.v)}</td></tr>`).join('')}</table>` : '<div class="pc no">مشخصات فنی: استعلام</div>';

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
  const trace = (p.confidence || p.source || p.lastVerified || p.availability) ? `<div class="tr">${p.confidence === 'verified' && p.verification && p.verification.reviewedAt ? `<span class="cf verified">تأییدشده با دیتاشیت (${esc(p.verification.reviewedAt)})</span> ` : p.confidence && p.confidence !== 'verified' ? `<span class="cf ${esc(p.confidence)}">${esc(CONF[p.confidence] || '')}</span> ` : ''}${sd != null && sd > 90 ? '<span class="cf review">بررسی قدیمی؛ دوباره تأیید شود</span> ' : ''}${p.availability ? `<div>قابل تهیه در ایران: ${esc(p.availability)}</div>` : ''}${p.source ? `<div>منبع: ${esc(p.source)}</div>` : ''}${p.lastVerified ? `<div>آخرین بررسی: ${esc(p.lastVerified)}</div>` : ''}${p.catalogVer ? `<div>نسخه‌ی کاتالوگ: ${esc(p.catalogVer)}</div>` : ''}</div>` : '<div class="tr">منبع و تاریخ بررسی برای این محصول هنوز ثبت نشده است.</div>';
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
  sheet(`<div class="sd-head"><button type="button" class="act" data-a="tobrand">‹ ${esc(c.name)}</button></div>${gal}${modelHtml}<h3 style="margin:0 0 4px;font-size:18px;color:var(--ink)">${esc(p.name)}</h3>${p.desc ? `<p style="color:var(--ink-dim);font-size:13px;margin:0 0 8px">${esc(p.desc)}</p>` : ''}${price}${priceRangeHtml}${feats}${installHtml}<div class="grp">مشخصات فنی</div>${specs}${stdsHtml}${tcHtml}${feHtml}${ratings(p)}${trace}${histHtml}${docsHtml}
  ${S.edit ? `<div class="ft"><button type="button" class="act act-primary" data-a="upimg" data-id="${c.id}" data-pid="${p.id}">📷 افزودن عکس از ربات (${fa(imgs.length)}/۶)</button><button type="button" class="sq" data-ep="${p.id}">✎</button></div>` : ''}
  <div class="sd-bar" style="margin-top:12px;flex-wrap:wrap"><button type="button" class="act act-primary" data-add="${p.id}">＋ برآورد</button><button type="button" class="act" data-fav="${p.id}" aria-pressed="${on}">${on ? '♥ ذخیره‌شده' : '♡ ذخیره'}</button><button type="button" class="act" data-x="cmp" data-pid="${p.id}">⇄ مقایسه</button><button type="button" class="act" data-a="shareprod" data-pid="${p.id}">اشتراک</button><button type="button" class="act" data-x="quote-open" data-co="${esc(c.id)}" data-pid="${esc(p.id)}">استعلام قیمت</button>${safe(p.catalog) ? `<a class="act" data-stop href="${esc(safe(p.catalog))}" target="_blank" rel="noopener">${I.pdf}<span>کاتالوگ</span></a>` : ''}${safe(p.page) ? `<a class="act" data-stop href="${esc(safe(p.page))}" target="_blank" rel="noopener">صفحه‌ی رسمی</a>` : ''}</div>`);
  if(modelUrl && !customElements.get('model-viewer')) { const ms=document.createElement('script'); ms.type='module'; ms.src='https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js'; document.head.appendChild(ms); }
  const tr = $('#galT'); if (tr) tr.addEventListener('scroll', () => { const k = Math.round(Math.abs(tr.scrollLeft) / tr.clientWidth); document.querySelectorAll('#galD i').forEach((d, n) => d.classList.toggle('on', n === k)); }, { passive: true });
}
function phase3Track(event, c, p) { api('event', {method:'POST', body:JSON.stringify({event, company:c || '', product:p || ''})}).catch(()=>{}); }
function libraryView() {
  const rows=[];
  D.companies.forEach(c=>(c.products||[]).forEach(p=>(p.docs||[]).forEach(d=>rows.push({c,p,d}))));
  if (!rows.length) return `<div class="empty"><div class="empty-icon">📚</div><h3>کتابخانه‌ی فایل‌های اجرایی</h3><p>دیتیل DWG/PDF، فمیلی رویت، فایل اسکچاپ، تکسچر و دفترچه‌ی محصول پس از ثبت ادمین اینجا نمایش داده می‌شود.</p></div>`;
  return `<div class="grp">${fa(rows.length)} فایل ثبت‌شده</div>`+rows.map(({c,p,d})=>`<div class="ln"><h4><span>${esc(d.title||d.file_name||'فایل اجرایی')}</span><em>${esc((d.type||'document').toUpperCase())}</em></h4><small>${esc(c.name)} · ${esc(p.name)}</small><div class="meta">${d.version?`<span>نسخه ${esc(d.version)}</span>`:''}${d.date?`<span>${esc(d.date)}</span>`:''}${d.size?`<span>${fa(Math.round(d.size/1024))} KB</span>`:''}</div><div class="ft"><button type="button" class="act act-primary" data-x="sendfile" data-docid="${esc(d.id)}">ارسال فایل به چت ربات</button><button type="button" class="act" data-prod="${esc(p.id)}">مشاهده محصول</button></div></div>`).join('');
}
function projectsView() {
  const rows=S.projects||[];
  return `<div class="tot"><b>پروژه‌ها روی سرور رواق</b><p class="hint">پروژه‌ها به حساب تلگرام متصل‌اند؛ برای ذخیره‌ی دائمی، دیسک پایدار Render لازم است.</p><div class="ft"><button class="act act-primary" data-x="project-save">ذخیره‌ی وضعیت فعلی</button><button class="act" data-x="project-new">پروژه‌ی جدید</button><button class="act" data-x="project-refresh">همگام‌سازی</button></div></div>`+(rows.length?rows.map(pr=>`<div class="ln"><h4><span>${esc(pr.name||'پروژه بدون نام')}</span><em>${esc((pr.updatedAt||'').slice(0,10))}</em></h4>${pr.client?`<small>کارفرما: ${esc(pr.client)}</small>`:''}${pr.notes?`<p>${esc(pr.notes)}</p>`:''}<div class="meta"><span>${fa((pr.rooms||[]).length)} فضا</span><span>${fa((pr.estimate||[]).length)} قلم برآورد</span></div><div class="ft"><button class="act act-primary" data-x="project-load" data-pid="${esc(pr.id)}">بارگذاری پروژه</button><button class="act" data-x="project-delete" data-pid="${esc(pr.id)}">حذف</button></div></div>`).join(''):'<div class="empty"><p>هنوز پروژه‌ای ذخیره نشده است.</p></div>');
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
 if(!rows.length) return `<div class="empty"><div class="empty-icon">▶</div><h3>آموزش کوتاه اجرا</h3><p>محتوای تأییدشده‌ی اجرا هنوز ثبت نشده است. برای جلوگیری از انتشار دستورالعمل ساختگی، این بخش فقط آموزش‌هایی را نمایش می‌دهد که ادمین در شناسنامه‌ی محصول وارد کند.</p>${S.admin?'<p class="hint">فیلدهای install.steps و install.mistakes را در داده‌ی محصول تکمیل کن؛ هر راهنما باید با منبع و بازبینی متخصص همراه باشد.</p>':''}</div>`;
 return rows.map(({c,p})=>`<div class="ln"><h4><span>${esc(p.name)}</span><em>${esc(c.name)}</em></h4>${p.install.source?`<small>منبع: ${esc(p.install.source)}</small>`:'<small>منبع آموزش ثبت نشده؛ پیش از اجرا بررسی شود.</small>'}${p.install.verifiedBy?`<small>بازبین: ${esc(p.install.verifiedBy)} · ${esc(p.install.verifiedAt||'تاریخ ثبت نشده')}</small>`:'<div class="wr">تأیید متخصص ثبت نشده</div>'}${p.install.video_url&&safe(p.install.video_url)?`<a class="act act-primary" data-stop href="${esc(safe(p.install.video_url))}" target="_blank" rel="noopener">▶ مشاهده ویدیوی اجرا</a>`:''}<div class="grp">مراحل ثبت‌شده</div><ol>${(p.install.steps||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>مرحله‌ای ثبت نشده است.</li>'}</ol><div class="grp">خطاهای رایج</div><ul class="fts">${(p.install.mistakes||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>موردی ثبت نشده است.</li>'}</ul><button class="act" data-prod="${esc(p.id)}">مشاهده شناسنامه‌ی محصول</button></div>`).join('');
}
function communityView() {
 if(!S.communityData){ if(!S.communityLoading){S.communityLoading=true;api('community').then(r=>S.communityData=r).catch(()=>S.communityData={ok:false,items:[],mine:[]}).finally(()=>{S.communityLoading=false;if(S.tab==='community')render();});} return '<div class="empty"><p>در حال دریافت تجربه‌های اجرایی…</p></div>'; }
 const d=S.communityData; if(!d.ok)return '<div class="empty"><p>برای ثبت و دیدن تجربه‌ها، مینی‌اپ را از داخل تلگرام باز کن.</p></div>';
 const publicRows=(d.items||[]).slice().reverse(); const mine=(d.mine||[]).slice().reverse();
 return `<div class="tot"><b>تجربه‌ی اجرا را ثبت کن</b><p class="hint">تجربه‌ها پیش از انتشار توسط مدیر بررسی می‌شوند. تجربه‌ی شخصی جایگزین دیتاشیت، استاندارد یا نظر طراح مسئول نیست.</p><button class="act act-primary" data-x="community-new">＋ ثبت تجربه‌ی جدید</button></div>${S.admin?'<div class="ft"><button class="act" data-x="community-admin">مدیریت و بررسی ارسال‌ها</button></div>':''}<div class="grp">تجربه‌های منتشرشده</div>${publicRows.length?publicRows.map(x=>`<article class="ln experience-card"><div class="experience-author"><div class="experience-avatar" aria-hidden="true">${x.author_photo_url&&safe(x.author_photo_url)?`<img src="${esc(safe(x.author_photo_url))}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${esc(initials(x.user||'کاربر'))}</span>`}</div><div class="experience-byline"><b>${esc(x.user||'کاربر رواق')}</b><small>${x.username ? `@${esc(x.username)} · ` : ''}${esc((x.created_at||'').slice(0,10))}</small></div>${x.expert_verified?'<span class="experience-badge">تخصص بررسی‌شده</span>':''}</div><h4><span>${esc(x.title)}</span><em>${esc(x.material)}</em></h4><p>${esc(x.details)}</p>${x.context?`<small class="experience-context">شرایط پروژه: ${esc(x.context)}</small>`:''}${x.photo_url&&safe(x.photo_url)?`<a class="act" data-stop href="${esc(safe(x.photo_url))}" target="_blank" rel="noopener">مشاهده عکس پروژه</a>`:''}<div class="meta">${x.rating?`<span>ارزیابی شخصی: ${fa(x.rating)}/۵</span>`:''}<span>مفید: ${fa(x.votes||0)}</span></div><button class="act" data-x="community-vote" data-id="${esc(x.id)}" ${x.voted?'disabled':''}>${x.voted?'رأی ثبت شد ✓':'این تجربه مفید بود'}</button></article>`).join(''):'<div class="empty"><p>هنوز تجربه‌ی تأییدشده‌ای منتشر نشده است.</p></div>'}<div class="grp">ارسال‌های من</div>${mine.length?mine.map(x=>`<div class="ln"><h4><span>${esc(x.title)}</span><em>${x.status==='approved'?'منتشرشده':x.status==='rejected'?'رد شده':'در انتظار بررسی'}</em></h4><small>${esc(x.material)}</small></div>`).join(''):'<p class="hint">هنوز ارسالی ثبت نکرده‌ای.</p>'}`;
}
function marketView() {
 if(!S.admin)return '<div class="empty"><p>این گزارش فقط برای مدیران رواق قابل مشاهده است.</p></div>';
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
 sheet(`<h3>استعلام قیمت</h3><p class="hint">درخواست به مدیران رواق ارسال می‌شود؛ قیمت یا موجودی تا زمان پاسخ، تأییدشده محسوب نمی‌شود.</p><label class="fl">برند<input id="qCompany" value="${esc(c.name||'')}" readonly></label><label class="fl">محصول<input id="qProduct" value="${esc(p?p.name:'')}" placeholder="نام محصول"></label><label class="fl">شهر<input id="qCity" placeholder="مثلاً مشهد"></label><label class="fl">مقدار و واحد<input id="qQty" placeholder="مثلاً ۲۰ متر مربع"></label><label class="fl">راه تماس (اختیاری)<input id="qContact" placeholder="شماره تماس یا ترجیح ارتباط"></label><label class="fl">توضیحات<textarea id="qNote" rows="3" placeholder="شرایط پروژه یا سوال شما"></textarea></label><div class="sd-bar"><button class="act" data-x="scok">انصراف</button><button class="act act-primary" data-x="quote-submit" data-co="${esc(c.name||'')}" data-pid="${esc(p?p.name:'')}">ارسال درخواست</button></div>`);
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
  return packs + `<div class="grp">اقلام برآورد</div>${lines}<div class="tot"><div class="rw" style="margin:0 0 8px"><label class="fl"><span>ضایعات کاشی/سرامیک (%) — فرض</span><input inputmode="decimal" data-waste="tile" value="${esc(S.cfg.wasteByCategory.tile ?? '')}" placeholder="نیازمند ورودی"></label><label class="fl"><span>ضایعات بلوک (%) — فرض</span><input inputmode="decimal" data-waste="block" value="${esc(S.cfg.wasteByCategory.block ?? '')}" placeholder="نیازمند ورودی"></label><label class="fl"><span>ضایعات گچ/ملات (%) — فرض</span><input inputmode="decimal" data-waste="plaster" value="${esc(S.cfg.wasteByCategory.plaster ?? '')}" placeholder="نیازمند ورودی"></label><label class="fl"><span>ضایعات کف/سبکدانه (%) — فرض</span><input inputmode="decimal" data-waste="floor" value="${esc(S.cfg.wasteByCategory.floor ?? '')}" placeholder="نیازمند ورودی"></label><p class="hint">مقدارها عمداً پیش‌فرض ندارند؛ متخصص رواق باید تعیین کند.</p><label class="fl"><span>اجرت و متفرقه (٪)</span><input inputmode="decimal" data-g="labor" value="${S.cfg.labor}"></label></div><div class="r"><span>جمع مصالح</span><b id="tSum"></b></div><div class="r"><span>اجرت و متفرقه</span><b id="tLab"></b></div><div class="g"><span>برآورد نهایی</span><span id="tAll"></span></div><div class="bar2" id="tBar"></div><div class="lg" id="tLg"></div><div class="wr" id="tWr" hidden></div></div><div class="ft"><button type="button" class="act act-primary" data-a="share">ارسال در تلگرام</button><button type="button" class="act" data-a="clear" style="color:var(--danger)">پاک‌کردن همه</button></div>`;
}
function paint() {
  let sum = 0, miss = 0; const by = {};
  S.est.forEach(l => { const n = qty(l), t = n == null ? 0 : n * (l.price || 0); sum += t; by[l.co] = (by[l.co] || 0) + t; if (!l.price || n == null) miss++;
    const a = document.querySelector(`[data-lt="${l.id}"]`); if (!a) return;
    a.textContent = l.price && n != null ? fa(t) + ' تومان' : '—'; document.querySelector(`[data-lq="${l.id}"]`).textContent = n == null ? 'مقدار: نیازمند ورودی' : 'مقدار: ' + fa(n) + ' ' + l.unit + (l.mode !== 'count' ? ` (با ضایعاتِ فرض‌شده)` : ''); document.querySelector(`[data-lw="${l.id}"]`).hidden = !!l.price && n != null; });
  const lab = sum * S.cfg.labor / 100, set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('tSum', fa(sum) + ' تومان'); set('tLab', fa(lab) + ' تومان'); set('tAll', fa(sum + lab) + ' تومان');
  const ks = Object.keys(by).filter(k => by[k] > 0), bar = document.getElementById('tBar'), lg = document.getElementById('tLg');
  if (bar) { bar.hidden = lg.hidden = !ks.length; bar.innerHTML = ks.map((k, i) => `<i style="width:${by[k] / sum * 100}%;background:${COL[i % 6]}"></i>`).join(''); lg.innerHTML = ks.map((k, i) => `<span><i style="background:${COL[i % 6]}"></i>${esc(k)} ${fa(Math.round(by[k] / sum * 100))}٪</span>`).join(''); }
  const w = document.getElementById('tWr'); if (w) { w.hidden = !miss; w.textContent = miss ? `${fa(miss)} قلم قیمت یا ورودی کامل ندارد و در جمع لحاظ نشده است.` : ''; }
  const b = document.querySelector('[data-tab="est"] b'); if (b) b.textContent = fa(S.est.length);
  S.total = sum * (1 + S.cfg.labor / 100);
}
function addLine(p, c, q) { const ex = S.est.find(l => l.pid === p.id); if (ex && p.mode === 'count') { ex.q += q || 1; } else S.est.push({ id: uid(), pid: p.id, name: p.name, co: c.name, unit: p.unit, group: p.group || '', mode: p.mode || 'count', price: p.price || 0, q: q || 1, per: p.perM2 || null, th: p.def || null }); persist(); }
function summary() {
  const R = '\u200F', by = {}; let sum = 0, miss = 0;
  S.est.forEach(l => { (by[l.co] = by[l.co] || []).push(l); sum += (qty(l) == null ? 0 : qty(l)) * (l.price || 0); if (!l.price || qty(l) == null) miss++; });
  const lab = sum * S.cfg.labor / 100, out = [R + '🧱 برآورد مصالح — رواق'];
  Object.entries(by).forEach(([co, ls]) => {
    out.push('', R + '🏷 ' + co);
    ls.forEach(l => { const n = qty(l); out.push(R + '▫️ ' + l.name, R + '    ' + (n == null ? 'مقدار: نیازمند ورودی' : fa(n) + ' ' + l.unit + (l.mode !== 'count' ? ' (با ضایعاتِ فرض‌شده)' : '')) + (l.price && n != null ? ' × ' + fa(l.price) + ' = ' + fa(Math.round(n * l.price)) + ' تومان' : ' — قیمت/مقدار: نیازمند ورودی'));  });
  });
  out.push('', R + '━━━━━━━━━━', R + 'جمع مصالح: ' + fa(Math.round(sum)) + ' تومان');
  if (S.cfg.labor) out.push(R + 'اجرت و متفرقه (' + fa(S.cfg.labor) + '٪): ' + fa(Math.round(lab)) + ' تومان');
  out.push(R + '✅ برآورد نهایی: ' + fa(Math.round(sum + lab)) + ' تومان');
  if (miss) out.push('', R + '⚠️ ' + fa(miss) + ' قلم قیمت یا مقدار کامل ندارد و در جمع لحاظ نشده.');
  out.push('', R + 'برآورد تقریبی است و جایگزین استعلام رسمی نیست.', R + '🤖 @' + S.bot);
  return out.join('\n');
}

/* ---------- فرم ادمین ---------- */
const CF = [['name', 'نام برند'], ['en', 'نام لاتین'], ['cat', 'دسته‌بندی'], ['desc', 'توضیح کوتاه', 'area'], ['site', 'وب‌سایت رسمی (https://…)'], ['catalog', 'لینک کاتالوگ (https://…)'], ['featuresT', 'ویژگی‌های برند — هر خط یک مورد', 'area'], ['linksT', 'لینک‌های مفید — هر خط: «عنوان | https://…»', 'area'], ['sponsor', 'حامی رواق', 'chk']];
const QPF = [['name','نام محصول'],['group','گروه'],['unit','واحد فروش'],['price','قیمت (اختیاری)'],['page','لینک رسمی محصول (اختیاری)'],['source','منبع اطلاعات (اختیاری)']];
const PF = [
  ['name', 'نام محصول'],
  ['group', 'گروه'],
  ['desc', 'توضیح', 'area'],
  ['unit', 'واحد قیمت/مصرف (عدد، کیسه، kg…)'],
  ['salesPackSize', 'تعداد واحد در بسته/پالت (اختیاری؛ فقط اگر از منبع معلوم است)'],
  ['salesPackUnit', 'نام واحد فروش (بسته/پالت/شاخه)'],
  ['price', 'قیمت ثبت‌شده (تومان)'],
  ['priceUpdatedAt', 'تاریخ قیمت (ISO یا تاریخ شمسی)'],
  ['priceSource', 'منبع قیمت'],
  ['mode', 'نوع محاسبه', 'sel', [['count', 'تعدادی'], ['area', 'بر اساس متراژ'], ['vol', 'حجمی (متراژ × ضخامت)']]],
  ['perM2', 'مصرف هر م²'],
  ['def', 'ضخامت پیش‌فرض (cm)'],
  ['catalog', 'لینک کاتالوگ محصول (PDF)'],
  ['page', 'لینک صفحه‌ی رسمی محصول (https://…)'],
  ['catalogVer', 'نسخه/تاریخ کاتالوگ (مثلاً ۱۴۰۵)'],
  ['availability', 'قابل تهیه در ایران؟', 'sel', [['', 'نامشخص'], ['داخلی', 'تولید داخل'], ['وارداتی', 'وارداتی'], ['معادل ایرانی', 'معادل ایرانی دارد']]],
  ['confidence', 'نشان اطمینان', 'sel', [['', 'انتخاب کن'], ['datasheet', 'منبع دیتاشیت ثبت شده؛ تأیید کامل نشده'], ['field', 'تجربه‌ی اجرایی'], ['review', 'نیازمند بررسی']]],
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
  ['speedSource', 'منبع/بازبین امتیاز سرعت اجرا'],
  ['durabilitySource', 'منبع/بازبین امتیاز دوام'],
  ['featuresT', 'ویژگی‌ها — هر خط یک ویژگی (از کاتالوگ)', 'area'],
  ['specsT', 'مشخصات فنی — هر خط «عنوان: مقدار»', 'area'],
  ['model3dUrl', 'لینک عمومی مدل سه‌بعدی GLB/GLTF (HTTPS)', 'area'],
  ['installStepsT', 'آموزش اجرا — هر خط یک مرحله', 'area'],
  ['installMistakesT', 'خطاهای رایج — هر خط یک مورد', 'area'],
  ['installSource', 'منبع آموزش اجرا', 'area'],
  ['installVideoUrl', 'لینک ویدیوی کوتاه اجرا (HTTPS)', 'area'],
  ['installVerifiedBy', 'نام بازبین متخصص (پس از تأیید)', 'area'],
  ['installVerifiedAt', 'تاریخ بازبینی', 'area']
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
  const fieldHtml = ([k, l, t, o]) => `<label class="fl" style="min-width:${t === 'area' ? '100%' : '140px'}"><span>${l.replace(/\n/g, '<br>')}</span>${t === 'area' ? `<textarea data-f="${k}" rows="2">${esc(v[k])}</textarea>` : t === 'sel' ? `<select data-f="${k}">${o.map(x => `<option value="${x[0]}" ${v[k] === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select>` : t === 'chk' ? `<input type="checkbox" data-f="${k}" ${v[k] ? 'checked' : ''} style="width:24px;height:24px">` : `<input data-f="${k}" ${['price','salesPackSize','perM2','def','speed','durability'].includes(k)?'inputmode="decimal"':''} value="${esc(v[k])}">`}</label>`;
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
    speedSource: String(o.speedSource||'').trim().slice(0,200),
    durabilitySource: String(o.durabilitySource||'').trim().slice(0,200),
    price: num(o.price) || null,
    salesPackSize: num(o.salesPackSize) || null,
    salesPackUnit: String(o.salesPackUnit||'').trim().slice(0,30),
    priceSource: String(o.priceSource||'').trim().slice(0,200),
    priceUpdatedAt: String(o.priceUpdatedAt||'').trim().slice(0,30),
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
    install: { steps: String(o.installStepsT || '').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,20), mistakes: String(o.installMistakesT || '').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,20), source: String(o.installSource||'').trim().slice(0,250), video_url: safe(o.installVideoUrl), verifiedBy: String(o.installVerifiedBy||'').trim().slice(0,120), verifiedAt: String(o.installVerifiedAt||'').trim().slice(0,30) }
  };
  if (!r.confidence && (r.specs.length || r.standards.length || r.features.length || r.price || r.speed || r.durability)) r.confidence = 'review';
  ['specsT', 'featuresT', 'standardsT', 'techCertNo', 'techCertUntil', 'feHesab', 'model3dUrl', 'installStepsT', 'installMistakesT', 'installSource', 'installVideoUrl', 'installVerifiedBy', 'installVerifiedAt'].forEach(k => delete r[k]);
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
const priceOf = p => (S.px[p.id] > 0 ? S.px[p.id] : p.price) || 0;
function priceRange(p) { const validDate=v=>{const d=String(v||'').slice(0,10);return /^(?:1[34][0-9۰-۹٠-٩]{2}[\/-][0-9۰-۹٠-٩]{1,2}[\/-][0-9۰-۹٠-٩]{1,2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})$/.test(d);}; const rows=(p.priceLog||[]).filter(x=>Number(x.price)>0&&validDate(x.date)&&String(x.source||'').trim()).map(x=>({price:Number(x.price),date:String(x.date).slice(0,10)})); if(Number(p.price)>0&&validDate(p.priceUpdatedAt)&&String(p.priceSource||'').trim())rows.push({price:Number(p.price),date:String(p.priceUpdatedAt).slice(0,10)}); if(!rows.length)return null; const prices=rows.map(x=>x.price),dates=rows.map(x=>x.date).sort(); return {min:Math.min(...prices),max:Math.max(...prices),from:dates[0],to:dates[dates.length-1]}; }
const defSurf = p => (SURF[p.surf] ? p.surf : p.mode === 'vol' ? 'floor' : 'wall');
const newRoom = n => ({ id: uid(), name: 'اتاق ' + fa(n), n: 1, L: '', W: '', H: '', dn: '', dw: '', dh: '', wn: '', ww: '', wh: '', items: [] });
const $$ = s => document.querySelectorAll(s);
// Remove legacy calculator defaults that were previously inserted silently (5% waste, 10mm mortar).
for (const k of ['floor','block','gyp']) { if (S.cc.v[k] && num(S.cc.v[k].w)===5 && !S.cc.v[k].wExplicit) S.cc.v[k].w=''; }
if (S.cc.v.block && num(S.cc.v.block.j)===10 && !S.cc.v.block.jExplicit) S.cc.v.block.j='';

function geom(r) {
  const L = P(r.L), W = P(r.W), H = P(r.H), per = 2 * (L + W), gross = per * H;
  const open = P(r.dn) * P(r.dw) * P(r.dh) + P(r.wn) * P(r.ww) * P(r.wh);
  return { floor: L * W, ceiling: L * W, wall: Math.max(0, gross - open), gross, open, per, vol: L * W * H, over: open > gross && gross > 0 };
}
function wasteCategory(p) { const t = nz((p.group||'')+' '+(p.name||'')); if (/کاشی|سرامیک|سنگ کف/.test(t)) return 'tile'; if (/بلوک|آجر/.test(t)) return 'block'; if (/گچ|اندود|پلاستر|ملات/.test(t)) return 'plaster'; if (/کف|سبکدانه|بتن سبک/.test(t)) return 'floor'; return 'other'; }
function wasteValue(p) { const k=wasteCategory(p), v=S.cfg.wasteByCategory && S.cfg.wasteByCategory[k]; return v !== '' && v != null && Number.isFinite(Number(v)) ? Math.max(0,Number(v)) : null; }
function itemQty(r, it, p, base) { const on = base && SURF[it.on] ? it.on : defSurf(p); const item={...it,on,per:base?it.per:p.perM2,th:base?it.th:p.def}; return window.RavaqCalcCore.itemQty(r, item, p, p.mode === 'area' || p.mode === 'vol' ? wasteValue(p) : 0); }
function alts(p) {
  const c = find(p.id)[0]; if (!c) return [p];
  return c.products.filter(x => x.id === p.id || (x.group === p.group && x.unit === p.unit && (x.mode || 'count') === (p.mode || 'count')));
}
function tierPick(p, t) {
  if (t === 'mid') return p;
  const a = alts(p), tg = a.find(x => x.tier === t && x.id !== p.id); if (tg) return tg;
  const pr = a.filter(x => priceRange(x)).sort((x, y) => (priceRange(x).min) - (priceRange(y).min)), current=priceRange(p);
  if (!pr.length || !current) return p;
  return t === 'eco' ? (priceRange(pr[0]).min < current.min ? pr[0] : p) : (priceRange(pr[pr.length - 1]).max > current.max ? pr[pr.length - 1] : p);
}
function pickFor(it, p, t) { const o = (S.scn[it.id] || {})[t]; if (o) { const q = find(o)[1]; if (q) return q; } return tierPick(p, t); }
function takeoff(t) {
  const map = {}; let swaps = 0, missingInputs = 0, scenarioUnavailable = false;
  S.rooms.forEach(r => r.items.forEach(it => {
    const p0 = find(it.pid)[1]; if (!p0) return;
    const availablePrices = alts(p0).filter(x => priceRange(x)); if (availablePrices.length < 2) { scenarioUnavailable = true; if(t!=='mid') return; } const p = pickFor(it, p0, t); if (!p) { scenarioUnavailable = true; return; } if (t!=='mid' && !priceRange(p)) { scenarioUnavailable = true; return; } if (p.id !== p0.id) swaps++;
    const q = itemQty(r, it, p, p.id === p0.id); if (q == null) { missingInputs++; return; } const m = map[p.id] || (map[p.id] = { p, c: find(p.id)[0], q: 0 }); m.q += q;
  }));
  const lines = Object.values(map).map(m => { const rawQ=m.q, pack=Number(m.p.salesPackSize); const units=Number.isFinite(pack)&&pack>0?Math.ceil(rawQ/pack):null; const q=units==null?rawQ:units*pack; const range=priceRange(m.p); return { ...m, rawQ, q, salesUnits:units, salesPackUnit:m.p.salesPackUnit||'', surplus:units==null?0:q-rawQ, price: priceOf(m.p), cost: q * priceOf(m.p), priceMin:range?range.min:null, priceMax:range?range.max:null, costMin:range?q*range.min:null, costMax:range?q*range.max:null, priceFrom:range?range.from:'', priceTo:range?range.to:'' }; });
  const sum = lines.reduce((a, l) => a + l.cost, 0), miss = lines.filter(l => !l.price).length; const rangeComplete=lines.length>0&&lines.every(l=>l.priceMin!=null); const sumMin=rangeComplete?lines.reduce((a,l)=>a+l.costMin,0):null, sumMax=rangeComplete?lines.reduce((a,l)=>a+l.costMax,0):null; const dates=lines.flatMap(l=>[l.priceFrom,l.priceTo]).filter(Boolean).sort();
  const sp = lines.filter(l => l.p.speed > 0), spn = sp.length, spd = spn ? sp.reduce((a, l) => a + l.p.speed, 0) / spn : 0;
  const lab = sum * P(S.cfg.labor) / 100;
  return { lines, sum, lab, tot: sum + lab, miss, swaps, spn, sp: spd, missingInputs, scenarioUnavailable, sumMin, sumMax, totMin:sumMin==null?null:sumMin*(1+P(S.cfg.labor)/100), totMax:sumMax==null?null:sumMax*(1+P(S.cfg.labor)/100), priceFrom:dates[0]||'', priceTo:dates[dates.length-1]||'' };
}
function scoreCmp(ps) {
  const val = { price: p => (priceOf(p) > 0 ? priceOf(p) : null), dur: p => (p.durability && p.durabilitySource ? p.durability : null), spd: p => (p.speed && p.speedSource ? p.speed : null), av: p => AV[p.availability] || null };
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
  floor: { t: 'کف سبک و بار مرده', f: [['A', 'مساحت کف (م²)'], ['T', 'ضخامت لایه (cm)'], ['dl', 'چگالی سبکدانه — kg/m³ (از دیتاشیت)'], ['dt', 'چگالی مصالح سنتی — kg/m³ (مقایسه)'], ['bag', 'حجم هر کیسه (لیتر) — اختیاری'], ['w', 'ضایعات (٪) — فرض؛ متخصص رواق تعیین کند']] },
  block: { t: 'بلوک و ملات', f: [['A', 'مساحت دیوار (م²)'], ['o', 'بازشو (م²)'], ['bl', 'طول بلوک (cm)'], ['bh', 'ارتفاع بلوک (cm)'], ['bt', 'ضخامت بلوک (cm)'], ['j', 'ضخامت ملات (mm) — فرض؛ متخصص تعیین کند'], ['w', 'ضایعات (٪) — فرض؛ متخصص رواق تعیین کند']] },
  gyp: { t: 'گچ و پانل', f: [['A', 'مساحت سطح گچ‌کاری (م²)'], ['t', 'ضخامت متوسط (mm)'], ['ref', 'مصرف مرجع — kg بر م² به‌ازای هر ۱cm (دیتاشیت)'], ['bag', 'وزن هر کیسه (kg)'], ['Ap', 'مساحت دیوار پانلی (م²)'], ['pw', 'عرض پانل (m)'], ['ph', 'ارتفاع پانل (m)'], ['po', 'بازشو (م²)'], ['w', 'ضایعات (٪) — فرض؛ متخصص رواق تعیین کند']] }
};
function calcRun(k, v) { return window.RavaqCalcCore.calcRun(k, v); }
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
  else ctl = `<label class="fl"><span>سطح اجرا</span><select ${a} data-k="on">${Object.entries(SURF).map(([k, l]) => `<option value="${k}" ${(i.on || defSurf(p)) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` + (p.mode === 'area' ? `<label class="fl"><span>مصرف هر م²</span><input inputmode="decimal" ${a} data-k="per" value="${esc(i.per)}" placeholder="از دیتاشیت"></label>` : `<label class="fl"><span>ضخامت (cm)</span><input inputmode="decimal" ${a} data-k="th" value="${esc(i.th)}" placeholder="از دیتاشیت"></label>`);
  return `<div class="it"><div class="it-t"><b>${esc(p.name)}</b><em>${esc(c.name)}</em><button type="button" class="sq dg" data-x="irm" data-rid="${r.id}" data-iid="${i.id}" aria-label="حذف">✕</button></div><div class="rw">${ctl}</div><small class="iq" data-iq="${i.id}"></small></div>`;
}
function matList() {
  const T = takeoff('mid'); if (!T.lines.length) return '';
  return `<div class="grp">فهرست مصالح (سناریوی متوسط)</div>` + T.lines.map(l => `<div class="ln"><h4><span>${esc(l.p.name)}</span><em>${esc(l.c.name)}</em></h4><div class="rw"><label class="fl"><span>قیمت هر ${esc(l.p.unit)} (تومان)${l.p.price && !(S.px[l.p.id] > 0) ? ' — ثبت‌شده' : ''}</span><input inputmode="decimal" data-i="px" data-pid="${l.p.id}" value="${S.px[l.p.id] > 0 ? S.px[l.p.id] : ''}" placeholder="${l.p.price ? fa(l.p.price) : 'وارد کن'}"></label></div><div class="lt"><small data-mq="${l.p.id}"></small><span data-mc="${l.p.id}"></span></div>${l.salesUnits!=null?`<small class="src-note">${fa(l.salesUnits)} ${esc(l.salesPackUnit||'بسته')}؛ مازاد ${nf(l.surplus)} ${esc(l.p.unit)}</small>`:''}</div>`).join('');
}
function roomView() {
  const head = `<div class="rw proj"><label class="fl"><span>نام پروژه</span><input data-i="pj" data-k="name" value="${esc(S.proj.name)}" placeholder="مثلاً آپارتمان ۱۲۰ متری"></label><label class="fl"><span>کارفرما</span><input data-i="pj" data-k="client" value="${esc(S.proj.client)}"></label></div>`;
  const add = `<div class="ft"><button type="button" class="act act-primary" data-x="radd">＋ اتاق جدید</button><button type="button" class="act" data-x="room-example">مثال اتاق ۴ در ۵ متر</button></div>`;
  if (!S.rooms.length) return head + '<div class="empty"><div class="empty-icon">📐</div><p>ابعاد اتاق را بده تا کف، دیوار خالص و سقف حساب شود؛ بعد مصالح را به سطوح اختصاص بده.</p><button type="button" class="act" data-tab="est">بازکردن برآورد دستی</button></div>' + add;
  return head + S.rooms.map(roomCard).join('') + add + matList() + `<div class="tot" id="rmTot"><div class="rw" style="margin:0 0 8px"><label class="fl"><span>ضایعات کاشی/سرامیک (%) — فرض</span><input inputmode="decimal" data-waste="tile" value="${esc(S.cfg.wasteByCategory.tile ?? '')}" placeholder="نیازمند ورودی"></label><label class="fl"><span>ضایعات بلوک (%) — فرض</span><input inputmode="decimal" data-waste="block" value="${esc(S.cfg.wasteByCategory.block ?? '')}" placeholder="نیازمند ورودی"></label><label class="fl"><span>ضایعات گچ/ملات (%) — فرض</span><input inputmode="decimal" data-waste="plaster" value="${esc(S.cfg.wasteByCategory.plaster ?? '')}" placeholder="نیازمند ورودی"></label><label class="fl"><span>ضایعات کف/سبکدانه (%) — فرض</span><input inputmode="decimal" data-waste="floor" value="${esc(S.cfg.wasteByCategory.floor ?? '')}" placeholder="نیازمند ورودی"></label><p class="hint">مقدارها عمداً پیش‌فرض ندارند؛ متخصص رواق باید تعیین کند.</p><label class="fl"><span>اجرت و متفرقه (٪)</span><input inputmode="decimal" data-g="labor" value="${S.cfg.labor}"></label></div><div class="r"><span>جمع مصالح</span><b id="rSum"></b></div><div class="r"><span>اجرت و متفرقه</span><b id="rLab"></b></div><div class="g"><span>برآورد (متوسط)</span><span id="rAll"></span></div><div class="wr" id="rWr" hidden></div></div><div id="rmScn"></div><div class="ft"><button type="button" class="act" data-x="scs">شخصی‌سازی جایگزین‌ها</button><button type="button" class="act" data-x="toest">انتقال به برآورد</button><button type="button" class="act act-primary" data-x="xsh">${I.pdf}<span>برگه‌ی پیشنهاد (PDF)</span></button></div>`;
}
function scnCards() {
  const R = TIERS.map(([k, l]) => ({ k, l, ...takeoff(k) })), mid = R[1];
  const cards = R.map(s => {
    const scenarioReady = !s.scenarioUnavailable && !mid.scenarioUnavailable && s.missingInputs === 0 && mid.missingInputs === 0 && s.sumMin != null && s.sumMax != null && mid.sumMin != null && mid.sumMax != null;
    const rangeText = scenarioReady ? `${fa(Math.round(s.totMin))} تا ${fa(Math.round(s.totMax))}` : 'داده‌ی کافی نیست';
    return `<div class="sc ${s.k}"><h5>${s.l}</h5><b>${rangeText}</b><small>${scenarioReady ? 'تومان · بازه‌ی قیمت ثبت‌شده' : 'سناریو غیرفعال'}</small>${scenarioReady ? `<i>${esc(s.priceFrom)} تا ${esc(s.priceTo)}</i>` : '<i>کمتر از دو گزینه‌ی قیمت‌دارِ تاریخ‌دار یا ورودی ناقص</i>'}<em>سرعت اجرا: ${s.spn ? fa(R2(s.sp)) + ' از ۵' : 'ثبت‌نشده'}</em><em>${fa(s.swaps)} قلم جایگزین</em></div>`;
  }).join('');
  return `<div class="grp">سه سناریو کنار هم</div><div class="scn">${cards}</div><p class="hint">سناریوها فقط وقتی فعال‌اند که دست‌کم دو گزینه‌ی هم‌گروه، قیمت ثبت‌شده با تاریخ و ورودی کامل داشته باشند. مبلغ به شکل بازه‌ی کمینه تا بیشینه نمایش داده می‌شود؛ داده‌ی فاقد تاریخ قیمت وارد سناریو نمی‌شود.</p>`;
}
function paintRoom() {
  const setT = (sel, v) => { const e = document.querySelector(sel); if (e) e.textContent = v; };
  S.rooms.forEach(r => {
    const g = geom(r), n = Math.max(1, P(r.n) || 1);
    setT(`[data-g="${r.id}:floor"]`, nf(g.floor * n) + ' م²'); setT(`[data-g="${r.id}:wall"]`, nf(g.wall * n) + ' م²'); setT(`[data-g="${r.id}:ceiling"]`, nf(g.ceiling * n) + ' م²'); setT(`[data-g="${r.id}:vol"]`, nf(g.vol * n) + ' م³'); setT(`[data-g="${r.id}:per"]`, nf(g.per) + ' م');
    const w = document.querySelector(`[data-gw="${r.id}"]`); if (w) { w.hidden = !g.over; w.textContent = g.over ? 'مساحت بازشوها از سطح دیوار بیشتر است؛ ابعاد را بررسی کن.' : ''; }
    r.items.forEach(i => { const p = find(i.pid)[1]; if (p) { const q=itemQty(r,i,p,true); setT(`[data-iq="${i.id}"]`, q == null ? 'نیازمند ورودی: ' + (p.mode === 'area' ? 'مصرف هر مترمربع' : p.mode === 'vol' ? 'ضخامت لایه' : 'تعداد') : 'مقدار: ' + nf(q) + ' ' + p.unit + (p.mode !== 'count' ? ` (با ضایعاتِ فرض‌شده)` : '')); } });
  });
  const T = takeoff('mid');
  T.lines.forEach(l => { setT(`[data-mq="${l.p.id}"]`, 'مقدار کل: ' + nf(l.q) + ' ' + l.p.unit); setT(`[data-mc="${l.p.id}"]`, l.price ? fa(Math.round(l.cost)) + ' تومان' : 'استعلام'); });
  setT('#rSum', fa(Math.round(T.sum)) + ' تومان'); setT('#rLab', fa(Math.round(T.lab)) + ' تومان'); setT('#rAll', fa(Math.round(T.tot)) + ' تومان');
  const wr = $('#rWr'); if (wr) { const count=T.miss+T.missingInputs; wr.hidden = !count; wr.textContent = count ? `${fa(count)} مورد قیمت یا ورودی کامل ندارد و در جمع لحاظ نشده است.` : ''; }
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
  const W = [['price', 'قیمت'], ['dur', 'دوام — نظر کارشناسی رواق'], ['spd', 'سرعت اجرا — نظر کارشناسی رواق'], ['av', 'دسترسی']];
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
  notes.push('دوام و سرعت اجرا «نظر کارشناسی رواق» هستند، نه داده‌ی دیتاشیت؛ معیار فاقد داده از امتیاز کنار گذاشته می‌شود.'); notes.push('برنده‌ی ردیف‌های مشخصات فنی فقط بعد از انتخاب جهت برتری (▲/▼) نشان داده می‌شود؛ واحد اعداد را خودت هم بررسی کن.');
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

/* ---------- برگه‌ی پیشنهاد ---------- */
const loadImg = u => new Promise(res => { const i = new Image(); const t = setTimeout(() => res(null), 6000); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); res(null); }; i.src = u; });
async function makeSheet(tk) {
  const WD = 1240, HT = 1754, M = 72, IN = WD - 2 * M, F = "'RavaqArabic',Tahoma,sans-serif", INK = '#1A1714', DIM = '#5A5347', AC = '#0B8468', LN = '#DAD3C7';
  try {
    await Promise.all([400, 500, 600, 700, 800, 900].map(w => document.fonts.load(`${w} 28px RavaqArabic`)));
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
    wrap('برآورد تقریبی است و جایگزین استعلام رسمی نیست. ضایعات فقط بر اساس مقدار واردشده‌ی هر گروه محاسبه شده؛ هر قیمت یا مشخصات ثبت‌نشده «استعلام» است.', IN - 240, 18, 400).slice(0, 2).forEach((t, k) => tx(t, WD - M, HT - 72 + k * 26, 18, 400, DIM)); tx('صفحه ' + fa(i + 1) + ' از ' + fa(pages.length), M, HT - 70, 20, 700, AC, 'left'); tx('@' + S.bot, M, HT - 40, 20, 600, DIM, 'left'); });
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
    case 'glossary-term': { const terms={'ضریب هدایت حرارتی':'شاخصی برای توصیف انتقال گرما از ماده؛ مقدار و واحد باید از دیتاشیت همان محصول گرفته شود.','مقاومت فشاری':'نتیجه‌ی آزمون تحمل فشار نمونه؛ روش آزمون و شرایط نمونه باید همراه عدد بررسی شود.','چگالی':'جرم بر واحد حجم؛ حالت خشک/مرطوب و روش اندازه‌گیری باید مشخص باشد.','مصرف مرجع':'مقدار محصول برای واحد سطح یا حجم در شرایط تعریف‌شده‌ی سازنده.'}; const term=String(d.term||''); return sheet(`<h3>${esc(term)}</h3><p>${esc(terms[term]||'تعریف در دسترس نیست.')}</p><p class="hint">تعریف عمومی است؛ منبع تخصصی اختصاصی به این واژه‌نامه پیوست نشده و نیازمند بازبینی متخصص رواق است.</p><div class="sd-bar"><button class="act" data-x="scok">بستن</button></div>`); }
    case 'media-gaps': { if(!S.admin)return toast('دسترسی مدیر لازم است'); const total=D.companies.reduce((n,co)=>n+(!co.logo||!co.logo.key?1:0)+(co.logo&&co.logo.key&&(!co.logoLicense||co.logoLicense.status!=='approved')?1:0)+(co.products||[]).reduce((m,p)=>m+(!(p.images||[]).length&&!externalProductImage(p)?1:0)+(((p.images||[]).length||externalProductImage(p))&&!(p.mediaLicense&&p.mediaLicense.status==='approved')?1:0),0),0); const brandOpts=['<option value="">همه‌ی برندها</option>',...D.companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`)].join(''); return sheet(`<h3>فهرست کمبود رسانه</h3><p class="hint">${fa(total)} مورد برای بررسی ثبت شده؛ هیچ تصویر یا لوگویی به‌صورت ساختگی جایگزین نشده است.</p><label class="fl"><span>برند</span><select id="mediaGapBrand">${brandOpts}</select></label><label class="fl"><span>نوع کمبود</span><select id="mediaGapType"><option value="all">همه</option><option value="image">تصویر محصول</option><option value="logo">لوگوی برند</option><option value="license">مجوز رسانه</option></select></label><div id="mediaGapRows">${mediaGapRowsHtml(D.companies)}</div><div class="sd-bar"><button class="act" data-x="scok">بستن</button></div>`); }
    case 'license-export': { if(!S.admin)return toast('دسترسی مدیر لازم است'); try { const r=await api('license-export'); if(!r.ok && r.error)return toast(r.error); const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ravaq-media-license-export.json'; a.click(); URL.revokeObjectURL(url); toast('خروجی مجوزها آماده شد'); } catch(e) { toast('خروجی مجوزها دریافت نشد'); } return; }
    case 'set-mode': { const mode=d.mode==='pro'?'pro':'simple'; S.mode=mode; sv('rq.mat.mode',mode); document.documentElement.classList.toggle('pro-mode',mode==='pro'); try { const r=await api('preferences',{method:'POST',body:JSON.stringify({mode})}); if(!r.ok) toast(r.error||'حالت فقط روی همین دستگاه ذخیره شد'); else toast(mode==='pro'?'حالت حرفه‌ای ذخیره شد':'حالت ساده ذخیره شد'); } catch(e) { toast('حالت روی همین دستگاه ذخیره شد؛ همگام‌سازی انجام نشد'); } render(); return; }
    case 'toggle-incomplete': { if(!S.admin)return toast('دسترسی مدیر لازم است'); try { const r=await api('review',{method:'POST',body:JSON.stringify({action:'show-incomplete',enabled:d.enabled==='true'})}); if(!r.ok)return toast(r.error||'ذخیره نشد'); D=r.data; cacheCatalog(D); render(); return toast(D.showIncompleteProducts?'محصولات ناقص با برچسب نمایش داده می‌شوند':'محصولات بدون تصویر پنهان شدند'); } catch(e) { return toast('ذخیره تنظیمات ناموفق بود'); } }
    case 'review-queue': { if(!S.admin)return toast('دسترسی مدیر لازم است'); const rows=[]; D.companies.forEach(co=>(co.products||[]).forEach(p=>{const verifyMissing=p.confidence!=='verified'||!p.verification||!p.verification.datasheetUrl||!p.verification.page||!p.verification.reviewedAt||!p.verification.reviewer; const hasImage=!!((p.images||[]).length||externalProductImage(p)); const licenseMissing=hasImage&&!(p.mediaLicense&&p.mediaLicense.status==='approved'); if(verifyMissing||licenseMissing)rows.push({co,p,verifyMissing,licenseMissing});})); const brandOpts=['<option value="">همه‌ی برندها</option>',...D.companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`)].join(''); const brandRows=D.companies.filter(c=>!c.logo||!c.logo.key||!c.logoLicense||c.logoLicense.status!=='approved').map(c=>`<div class="ln review-row" data-brand="${esc(c.id)}" data-verify="false" data-license="${!c.logoLicense||c.logoLicense.status!=='approved'}" data-image="${!c.logo||!c.logo.key}"><h4><span>لوگوی برند ${esc(c.name)}</span><em>${!c.logo||!c.logo.key?'لوگو ثبت نشده':'مجوز بررسی نشده'}</em></h4><div class="ft">${!c.logo||!c.logo.key?`<button class="act act-primary" data-a="uplogo" data-id="${esc(c.id)}">آپلود لوگو</button>`:''}${c.logo&&c.logo.key&&(!c.logoLicense||c.logoLicense.status!=='approved')?`<button class="act" data-x="approve-license" data-id="${esc(c.id)}">ثبت مجوز لوگو</button>`:''}</div></div>`).join(''); return sheet(`<h3>صف تأیید محصول و مجوز رسانه</h3><p class="hint">محصول را فقط بعد از دیدن دیتاشیت تأیید کن. برای تأیید فنی، لینک HTTPS، صفحه، تاریخ و نام بررسی‌کننده الزامی است.</p><label class="fl"><span>فیلتر برند</span><select id="reviewBrand">${brandOpts}</select></label><label class="fl"><span>فیلتر نقص</span><select id="reviewReason"><option value="all">همه</option><option value="verify">نیازمند بررسی فنی</option><option value="license">مجوز تصویر</option><option value="image">بدون تصویر</option></select></label><div id="reviewRows">${brandRows}${reviewRowsHtml(rows)}</div><div class="sd-bar"><button class="act" data-x="scok">بستن</button></div>`); }
    case 'publish-product': { if(!S.admin)return toast('دسترسی مدیر لازم است'); try { const r=await api('review',{method:'POST',body:JSON.stringify({action:'publication',company:d.id,product:d.pid,status:'published'})}); if(!r.ok)return toast(r.error||'انتشار انجام نشد'); D=r.data; cacheCatalog(D); render(); toast('وضعیت انتشار ذخیره شد'); } catch(e) { toast('ارتباط با سرور برقرار نشد'); } return; }
    case 'verify-product': { if(!S.admin)return toast('دسترسی مدیر لازم است'); const co=D.companies.find(c=>c.id===d.id),p=co&&(co.products||[]).find(x=>x.id===d.pid); if(!p)return toast('محصول پیدا نشد'); return sheet(`<h3>تأیید محصول با دیتاشیت</h3><p class="hint">فقط پس از بررسی واقعی سند ثبت کن؛ این فرم به‌تنهایی محصول را تأیید نمی‌کند.</p><label class="fl"><span>لینک HTTPS دیتاشیت</span><input id="verifyUrl" type="url" inputmode="url" placeholder="https://…" required></label><label class="fl"><span>شماره صفحه</span><input id="verifyPage" inputmode="numeric" required></label><label class="fl"><span>تاریخ بررسی</span><input id="verifyDate" placeholder="۱۴۰۵/۰۷/۰۱" required></label><label class="fl"><span>نام بررسی‌کننده</span><input id="verifyReviewer" maxlength="100" required></label><div class="sd-bar"><button class="act" data-x="scok">انصراف</button><button class="act act-primary" data-x="verify-submit" data-id="${esc(co.id)}" data-pid="${esc(p.id)}">ثبت بررسی</button></div>`); }
    case 'verify-submit': { if(!S.admin)return toast('دسترسی مدیر لازم است'); const datasheetUrl=$('#verifyUrl')?.value.trim()||'',page=$('#verifyPage')?.value.trim()||'',reviewedAt=$('#verifyDate')?.value.trim()||'',reviewer=$('#verifyReviewer')?.value.trim()||''; if(!/^https:\/\//i.test(datasheetUrl)||!page||!reviewedAt||!reviewer)return toast('همه‌ی فیلدها الزامی‌اند و لینک باید HTTPS باشد'); try{const r=await api('review',{method:'POST',body:JSON.stringify({action:'verify-product',company:d.id,product:d.pid,datasheetUrl,page,reviewedAt,reviewer})});if(!r.ok)return toast(r.error||'تأیید نشد');D=r.data;cacheCatalog(D);closeSheet();render();toast('اطلاعات بررسی ثبت شد');}catch(e){toast('ارتباط با سرور برقرار نشد');}return; }
    case 'approve-license': { if(!S.admin)return toast('دسترسی مدیر لازم است'); const co=D.companies.find(c=>c.id===d.id); if(!co)return toast('برند پیدا نشد'); return sheet(`<h3>ثبت مجوز تصویر یا لوگو</h3><p class="hint">فقط وقتی اجازه‌ی استفاده را واقعاً دریافت کرده‌ای، وضعیت را ثبت کن.</p><label class="fl"><span>منبع یا سند اجازه</span><input id="licenseSource" maxlength="500" required></label><label class="fl"><span>دارنده‌ی حق</span><input id="licenseHolder" maxlength="200" required></label><label class="fl"><span>تاریخ تأیید</span><input id="licenseDate" placeholder="۱۴۰۵/۰۷/۰۱" required></label><div class="sd-bar"><button class="act" data-x="scok">انصراف</button><button class="act act-primary" data-x="license-submit" data-id="${esc(co.id)}" data-pid="${esc(d.pid||'')}">ثبت مجوز</button></div>`); }
    case 'license-submit': { if(!S.admin)return toast('دسترسی مدیر لازم است'); const source=$('#licenseSource')?.value.trim()||'',rightsHolder=$('#licenseHolder')?.value.trim()||'',approvedAt=$('#licenseDate')?.value.trim()||''; if(!source||!rightsHolder||!approvedAt)return toast('منبع، دارنده‌ی حق و تاریخ الزامی‌اند'); try{const r=await api('review',{method:'POST',body:JSON.stringify({action:'approve-license',company:d.id,product:d.pid||'',source,rightsHolder,approvedAt})});if(!r.ok)return toast(r.error||'ثبت مجوز ناموفق بود');D=r.data;cacheCatalog(D);closeSheet();render();toast('اطلاعات مجوز ثبت شد؛ تأیید نهایی فقط بر اساس سند واقعی انجام شود');}catch(e){toast('ارتباط با سرور برقرار نشد');}return; }
    case 'catalog-upload': { if (!S.admin) return toast('دسترسی مدیر لازم است'); return reqUpload('catalog', '', ''); }
    case 'bulk-media-upload': { if(!S.admin)return toast('دسترسی مدیر لازم است'); return reqUpload('bulk-image','',''); }
    case 'admin-catalog': S.tab='cat'; S.edit=true; render(); toast('حالت ویرایش فعال شد'); return;
    case 'admin-save': return saveData();
    case 'admin-refresh': return reload().then(()=>{render();toast('اطلاعات از سرور به‌روز شد')}).catch(()=>toast('بازخوانی ناموفق بود'));
    case 'admin-edit-product': { const co=D.companies.find(x=>x.id===d.id); const p=co&&(co.products||[]).find(x=>x.id===d.pid); if(!co||!p)return; return form('ویرایش محصول', PF, {...p,specsT:specsText(p.specs),featuresT:(p.features||[]).join('\n'),standardsT:standardsText(p.standards),techCertNo:(p.techCert&&p.techCert.no)||'',techCertUntil:(p.techCert&&p.techCert.until)||'',feHesab:p.feHesab||'',model3dUrl:p.model3d&&typeof p.model3d==='object'?(p.model3d.url||''):(typeof p.model3d==='string'?p.model3d:''),installStepsT:(p.install&&p.install.steps||[]).join('\n'),installMistakesT:(p.install&&p.install.mistakes||[]).join('\n'),installSource:p.install&&p.install.source||'',installVideoUrl:p.install&&p.install.video_url||'',installVerifiedBy:p.install&&p.install.verifiedBy||'',installVerifiedAt:p.install&&p.install.verifiedAt||''}, o=>{Object.assign(p,cleanP(o));saveData();},()=>{S.tab='manage';render();},valP); }
    case 'radd': S.rooms.push(newRoom(S.rooms.length + 1)); break;
    case 'room-example': { const room=newRoom(S.rooms.length+1); room.name='مثال اتاق ۴×۵'; room.L='4'; room.W='5'; room.H=''; S.rooms.push(room); S.tab='room'; persist2(); render(); toast('مثال ساخته شد؛ ارتفاع را وارد کن تا سطح دیوار محاسبه شود'); return; }
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
    case 'community-new': return sheet(`<h3>ثبت تجربه‌ی اجرایی</h3><p class="hint">این تجربه با هویت حساب تلگرام ثبت می‌شود: <b>${esc(accountName)}</b>${TG_USER.username ? ` (@${esc(TG_USER.username)})` : ''}. اگر در پروفایل رواق لینک تصویر HTTPS ثبت کرده باشی، با اجازهٔ تو کنار تجربه نمایش داده می‌شود؛ این تصویر به‌تنهایی تأیید هویت نیست. اطلاعات شخصی یا محرمانه‌ی کارفرما را وارد نکن. انتشار پس از بررسی مدیر انجام می‌شود.</p><label class="fl"><span>عنوان تجربه</span><input id="cmTitle" maxlength="120" placeholder="مثلاً اجرای عایق در سرویس"></label><label class="fl"><span>مصالح / سامانه</span><input id="cmMaterial" maxlength="120" placeholder="نام مصالح یا سامانه"></label><label class="fl"><span>شرایط پروژه (اختیاری)</span><input id="cmContext" maxlength="500" placeholder="اقلیم، زیرکار، شرایط اجرا"></label><label class="fl"><span>لینک عکس پروژه (اختیاری، HTTPS)</span><input id="cmPhoto" maxlength="500" placeholder="لینک عمومی عکس، بدون اطلاعات محرمانه"></label><label class="fl"><span>شرح تجربه (حداقل ۲۰ حرف)</span><textarea id="cmDetails" rows="5" maxlength="2500" placeholder="چه چیزی اجرا شد، چه نتیجه‌ای دیدی و محدودیت‌ها چه بود؟"></textarea></label><label class="fl"><span>ارزیابی شخصی (اختیاری)</span><select id="cmRating"><option value="0">ثبت نمی‌کنم</option><option value="1">۱ از ۵</option><option value="2">۲ از ۵</option><option value="3">۳ از ۵</option><option value="4">۴ از ۵</option><option value="5">۵ از ۵</option></select></label><div class="sd-bar"><button class="act" data-x="scok">انصراف</button><button class="act act-primary" data-x="community-submit">ارسال برای بررسی</button></div>`);
    case 'community-submit': {const v=id=>document.getElementById(id)?.value||'';const body={title:v('cmTitle'),material:v('cmMaterial'),context:v('cmContext'),photo_url:v('cmPhoto'),author_photo_url:profilePhoto(),details:v('cmDetails'),rating:Number(v('cmRating'))||0};try{const r=await api('community',{method:'POST',body:JSON.stringify(body)});if(r.ok){S.communityData=null;closeSheet();render();toast(r.message||'برای بررسی ثبت شد');}else toast(r.error||'ثبت انجام نشد');}catch(e){toast('خطا در ثبت تجربه');}return;}
    case 'community-admin': {try{const r=await api('community-admin');if(!r.ok)return toast(r.error||'دسترسی ندارید');const rows=(r.items||[]).filter(x=>x.status==='pending'||x.status==='approved');return sheet(`<h3>مدیریت تجربه‌ها</h3>${rows.length?rows.map(x=>`<div class="ln"><h4><span>${esc(x.title)}</span><em>${esc(x.status==='approved'?'منتشرشده':'در انتظار بررسی')}</em></h4><p>${esc(x.details)}</p><small>${esc(x.user||'کاربر')} · ${esc(x.id)}</small><div class="ft">${x.status==='pending'?`<button class="act act-primary" data-x="community-review" data-id="${esc(x.id)}" data-action="approve">تأیید انتشار</button><button class="act" data-x="community-review" data-id="${esc(x.id)}" data-action="reject">رد</button>`:`<button class="act ${x.expert_verified?'act-primary':''}" data-x="community-review" data-id="${esc(x.id)}" data-action="expert">${x.expert_verified?'لغو نشان کارشناس':'تأیید تخصص (فقط پس از بررسی مدرک)'}</button>`}<button class="act" data-x="community-review" data-id="${esc(x.id)}" data-action="delete">حذف</button></div></div>`).join(''):'<p class="hint">موردی برای بررسی نیست.</p>'}`);}catch(e){return toast('خطا در دریافت ارسال‌ها');}}
    case 'community-review': {try{const r=await api('community-admin',{method:'POST',body:JSON.stringify({id:d.id,action:d.action})});if(r.ok){S.communityData=null;closeSheet();render();toast('وضعیت ارسال به‌روزرسانی شد');}else toast(r.error||'عملیات انجام نشد');}catch(e){toast('ارتباط با سرور برقرار نشد');}return;}
    case 'community-vote': {try{const r=await api('community',{method:'POST',body:JSON.stringify({action:'vote',id:d.id})});if(r.ok){S.communityData=null;render();toast(r.voted?'رأی شما ثبت شد':'رأی ثبت شد');}else toast(r.error||'رأی ثبت نشد');}catch(e){toast('ارتباط با سرور برقرار نشد');}return;}
    case 'quote-open': { const coId=d.co||S.cur; const pid=d.pid||''; return quoteSheet(coId,pid); }
    case 'quote-submit': { const v=id=>document.getElementById(id)?.value||''; const body={company:v('qCompany')||d.co,product:v('qProduct')||d.pid,city:v('qCity'),quantity:v('qQty'),contact:v('qContact'),note:v('qNote')}; if(!body.product.trim())return toast('نام محصول را وارد کن'); try{const r=await api('quote',{method:'POST',body:JSON.stringify(body)});if(r.ok){closeSheet();toast(r.notification_warning ? (r.message || 'درخواست ثبت شد؛ نیازی به ارسال دوباره نیست') : 'درخواست برای مدیران رواق ارسال شد ✓');}else toast(r.error||'درخواست ارسال نشد');}catch(e){toast('خطا در ارسال درخواست');} return; }
        case 'cadd': { const o = S.cres[Number(d.o)]; if (!o) return; return pick('افزودن «' + esc(o.l) + '» به برآورد', p => p.unit === o.u, (p, c) => { addLine({ ...p, mode: 'count', price: priceOf(p) }, c, R2(o.v)); persist(); closeSheet(); toast('به برآورد اضافه شد'); tabs(); }, `مقدار ${nf(o.v)} ${o.u}؛ فقط محصولاتی با واحد «${o.u}» نشان داده می‌شوند.`); }
    default: return;
  }
  persist2(); render();
});
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset, k = d.i;
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
  if (d.tab) { S.tab = d.tab; hp(); if (d.tab === 'community' && !S.communityData) S.communityLoading = false; render(); requestAnimationFrame(()=>{ const panel=$('#list'); if(panel) panel.focus({preventScroll:true}); }); return scrollTo({ top: 0 }); }
  if (d.cat) { S.cat = S.cat === d.cat ? '' : d.cat; hp(); return render(); }
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
      installMistakesT: (p.install && p.install.mistakes || []).join('\n'),
      installSource: p.install && p.install.source || '',
      installVideoUrl: p.install && p.install.video_url || '',
      installVerifiedBy: p.install && p.install.verifiedBy || '',
      installVerifiedAt: p.install && p.install.verifiedAt || ''
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
  if (t.dataset.g) { S.cfg[t.dataset.g] = num(t.value); if(t.dataset.g==='waste') S.cfg.wasteExplicit=true; persist(); if (S.tab === 'room') paintRoom(); else if (S.tab === 'est') paint(); return; }
  if (t.dataset.waste) { S.cfg.wasteByCategory[t.dataset.waste] = t.value.trim()==='' ? null : num(t.value); persist(); if (S.tab === 'room') paintRoom(); else if (S.tab === 'est') paint(); return; }
});
document.addEventListener('change', e => { const t=e.target; if(t && (t.id==='mediaGapBrand'||t.id==='mediaGapType')) { const brand=$('#mediaGapBrand')?.value||'', type=$('#mediaGapType')?.value||'all'; document.querySelectorAll('#mediaGapRows .review-row').forEach(row=>{row.hidden=!!(brand&&row.dataset.brand!==brand)||!(type==='all'||row.dataset.gaptype===type);}); return; } if(t && (t.id==='reviewBrand'||t.id==='reviewReason')) { const brand=$('#reviewBrand')?.value||'', reason=$('#reviewReason')?.value||'all'; document.querySelectorAll('.review-row').forEach(row=>{ const showBrand=!brand||row.dataset.brand===brand; const showReason=reason==='all'||(reason==='verify'&&row.dataset.verify==='true')||(reason==='license'&&row.dataset.license==='true')||(reason==='image'&&row.dataset.image==='true'); row.hidden=!(showBrand&&showReason); }); return; } if(t && t.dataset && t.dataset.i==='wizard'){ S.wizard[t.dataset.k]=t.value; phase4Track('wizard','','', {query:S.wizard.problem}); render(); } });
document.addEventListener('keydown', e => {
  const navTab=e.target.closest && e.target.closest('#bottomNav [role="tab"]');
  if(navTab){
    const tabs=[...document.querySelectorAll('#bottomNav [role="tab"]:not([hidden])')]; const i=tabs.indexOf(navTab); let next=null;
    if(e.key==='ArrowLeft') next=tabs[(i+1)%tabs.length]; /* RTL: left moves to the next item visually */
    else if(e.key==='ArrowRight') next=tabs[(i-1+tabs.length)%tabs.length];
    else if(e.key==='Home') next=tabs[0]; else if(e.key==='End') next=tabs[tabs.length-1];
    if(next){e.preventDefault();next.focus();next.click();}
  }
  const dialog=$('#sd');
  if(e.key==='Escape' && dialog && !dialog.hidden){e.preventDefault();closeSheet();return;}
  if(e.key==='Tab' && dialog && !dialog.hidden){
    const focusables=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);
    if(focusables.length){const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('mc')) { e.preventDefault(); openBrand(e.target.dataset.brand); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pr2')) { e.preventDefault(); openProd(e.target.dataset.prod); }
});
addEventListener('scroll', () => { $('#toTop').hidden = scrollY < 500; }, { passive: true });
addEventListener('online',()=>toast('اتصال اینترنت برقرار شد')); addEventListener('offline',()=>toast('حالت آفلاین؛ فقط اطلاعات ذخیره‌شده در دسترس است'));
try { const th = localStorage.getItem(K.th); th && document.documentElement.setAttribute('data-theme', th); } catch (e) {}

/* ---------- شروع سریع: کش فوری، به‌روزرسانی بی‌صدا ---------- */
let bootFinished = false;
document.documentElement.classList.toggle('pro-mode', S.mode === 'pro');
function finishBoot(message) {
  if (bootFinished) return; bootFinished = true;
  const screen = $('#bootScreen');
  if (message) { const status = $('#bootStatus'); if (status) status.textContent = message; }
  if (screen) screen.classList.add('boot-ready');
  if (screen) { screen.classList.add('boot-out'); setTimeout(() => screen.remove(), 180); }
}
const deep = () => { try { const p = new URLSearchParams(location.search).get('p'); if (p && find(p)[1]) openProd(p); } catch (e) {} };
const cachedCatalog = cacheRole()==='admin' ? ld('rq.mat.catalog.admin-cache', null) : ld('rq.mat.catalog.cache', null);
const bootFailsafe = setTimeout(() => { if (!bootFinished) finishBoot(cachedCatalog ? 'کاتالوگ ذخیره‌شده نمایش داده می‌شود' : 'سرور در حال بیدار شدن است'); }, 10000);
if (cachedCatalog && Array.isArray(cachedCatalog.companies)) { D = cachedCatalog; render(); deep(); finishBoot('کاتالوگ ذخیره‌شده آماده است'); } else { render(); }
catalogDb.get('catalog').then(idbCatalog=>{ if(!bootFinished && idbCatalog && Array.isArray(idbCatalog.companies) && (!cachedCatalog || !Array.isArray(cachedCatalog.companies))) { D=idbCatalog; render(); deep(); finishBoot('کاتالوگ ذخیره‌شده آماده است'); } }).catch(()=>{});
// Load catalog in the background; don't wait for projects or images before showing it.
api('data').then(r => { if(r && r.notModified) { if(!cachedCatalog) throw new Error('catalog unavailable'); return {data:cachedCatalog,admin:r._role==='admin',bot:S.bot,start:S.start,mediaBase:S.mediaBase,_etag:ld('rq.mat.catalog.etag.'+(r._role||'public'),'')}; } if(!r || !r.data) throw new Error('catalog unavailable'); D = r.data; S.catalogLoading=false; S.admin = !!r.admin; cacheCatalog(D,S.admin); if(r._etag) sv('rq.mat.catalog.etag.'+(S.admin?'admin':'public'),r._etag); S.bot = r.bot || 'irarchitps_bot'; S.start = r.start || 'materials'; S.mediaBase = String(r.mediaBase || '').replace(/\/$/,''); render(); deep(); clearTimeout(bootFailsafe); finishBoot('کاتالوگ به‌روز است'); loadMediaManifest(); })
.catch(() => { clearTimeout(bootFailsafe); S.catalogLoading=false; if (!cachedCatalog) { D={companies:[],packs:[]}; render(); finishBoot('سرور در دسترس نیست'); toast('سرور در دسترس نیست؛ بعد از اتصال دوباره تلاش کن'); } else toast('سرور در حال بیدار شدن است؛ کاتالوگ ذخیره‌شده نمایش داده می‌شود'); });
loadProjects().then(() => { if (S.tab === 'projects') render(); });
initializeTelegramSdk().then(async tg => { if (!tg) return; try { const pref=await api('preferences'); if(pref.ok&&pref.preferences&&pref.preferences.mode){S.mode=pref.preferences.mode;sv('rq.mat.mode',S.mode);document.documentElement.classList.toggle('pro-mode',S.mode==='pro'); if(S.tab==='profile')render();} } catch(e) {} api('data').then(r => { if(r&&r.notModified) { if(r._role==='admin'){const ac=ld('rq.mat.catalog.admin-cache',null);if(ac){D=ac;S.admin=true;render();}} return; } if (!r || !r.data) return; D=r.data; S.catalogLoading=false; S.admin=!!r.admin; cacheCatalog(D,S.admin); if(r._etag) sv('rq.mat.catalog.etag.'+(S.admin?'admin':'public'),r._etag); S.bot=r.bot||S.bot; S.start=r.start||S.start; S.mediaBase=String(r.mediaBase||'').replace(/\/$/,''); loadProjects().finally(() => render()); loadMediaManifest(); }).catch(()=>{}); });
addEventListener('load', e => { const i=e.target; if(!i || i.tagName!=='IMG') return; if(i.dataset.cdnPending==='1'){i.dataset.cdnPending='0';return;} if(!i.dataset.fullsrc)return; const full=i.dataset.fullsrc; delete i.dataset.fullsrc; i.dataset.cdnPending='1'; if(i.src!==full)i.src=full; const fallback=i.dataset.fallback; setTimeout(()=>{if(i.dataset.cdnPending==='1'&&fallback){i.dataset.cdnPending='0';i.src=fallback;}},4000); }, true);
addEventListener('error', e => { const i=e.target; if(!i || i.tagName!=='IMG') return; const fallback=i.dataset && i.dataset.fallback; if(fallback && i.src !== new URL(fallback, location.origin).href) { i.src=fallback; delete i.dataset.fallback; return; } if(i.parentElement) { i.parentElement.classList.add('bad'); } i.style.display='none'; }, true);
// CDN manifest is cheap and cacheable; refresh it without touching the Render server.
setInterval(refreshMediaManifest, 10*60*1000);
})();
