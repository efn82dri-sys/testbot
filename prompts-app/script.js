/* ============================================================
   رواق — Mini App prompts / logic
   ============================================================ */

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  try { tg.ready(); tg.expand(); if (tg.setHeaderColor) tg.setHeaderColor('#0C0E10'); } catch (e) {}
}

/* ---------- DOM helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Constants ---------- */
const STORAGE = {
  THEME:  'ravaq.prompts.theme',
  FAVS:   'ravaq.prompts.favs',
  FILTER: 'ravaq.prompts.filter',
};
const DATA_URL = '/prompts/data/prompts.json';

/* ---------- Haptics ---------- */
const haptic = {
  light()  { try { tg?.HapticFeedback?.impactOccurred('light'); } catch (e) {} },
  medium() { try { tg?.HapticFeedback?.impactOccurred('medium'); } catch (e) {} },
  success(){ try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (e) {} },
  select() { try { tg?.HapticFeedback?.selectionChanged(); } catch (e) {} },
};

/* ---------- Utils ---------- */
function textColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#1A1714' : '#F5EFE3';
}

function toPersian(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}


/* ---------- عنوان‌ها (هشتگ‌ها بدونِ #) ---------- */
const TITLES = ['پلان','اسکچ','سکشن','ایزومتریک','سایت','دیاگرام','تحلیل','مودبرد','پالت','داخلی','خارجی','دیتیل','شیت_بندی','انیمیشن','ماکت','کاراکتر'];
const label = t => String(t).replace(/_/g, ' ');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LONG_LIMIT = 3900; // بلندتر از این در یک پیامِ تلگرام جا نمی‌شود

/* ---------- State ---------- */
const state = {
  prompts: [], filter: '', query: '', favsOnly: false, open: null,
  favs: new Set(JSON.parse(localStorage.getItem(STORAGE.FAVS) || '[]')),
};
/* ---------- Theme ---------- */
function initTheme() {
  const saved = localStorage.getItem(STORAGE.THEME);
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE.THEME, next);
    if (tg?.setHeaderColor) {
      try { tg.setHeaderColor(next === 'dark' ? '#0C0E10' : '#F2EEE8'); } catch (e) {}
    }
  };
  if (document.startViewTransition) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
  haptic.light();
}


/* ---------- Favorites ---------- */
const isFav = id => state.favs.has(id);
function toggleFav(id) {
  if (state.favs.has(id)) { state.favs.delete(id); haptic.light(); } else { state.favs.add(id); haptic.success(); }
  localStorage.setItem(STORAGE.FAVS, JSON.stringify([...state.favs]));
  updateFavCount();
}
function updateFavCount() {
  const cnt = $('#favCount'), n = state.favs.size;
  cnt.hidden = n === 0; cnt.textContent = toPersian(n);
  $('#favBtn').setAttribute('aria-pressed', state.favsOnly ? 'true' : 'false');
}

/* ---------- Filtering ---------- */
function visible() {
  const q = state.query.toLowerCase().trim();
  return state.prompts.filter(p =>
    (!state.favsOnly || isFav(p.id)) &&
    (!state.filter || p.title === state.filter) &&
    (!q || `${label(p.title)} ${p.note} ${p.text}`.toLowerCase().includes(q)));
}

/* ---------- Render ---------- */
const ICONS = {
  heart: '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  empty: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};
const numOf = p => toPersian(String(state.prompts.indexOf(p) + 1).padStart(2, '0'));

function renderIndex() {
  const counts = {};
  state.prompts.forEach(p => counts[p.title] = (counts[p.title] || 0) + 1);
  const extra = Object.keys(counts).filter(t => !TITLES.includes(t));
  $('#index').innerHTML = [...TITLES, ...extra].map(t => `
    <button type="button" class="tile ${state.filter === t ? 'on' : ''}" data-tag="${esc(t)}" ${counts[t] ? '' : 'disabled'} role="tab" aria-selected="${state.filter === t}">
      <span>${esc(label(t))}</span><b>${toPersian(counts[t] || 0)}</b>
    </button>`).join('');
  $('#now').innerHTML = state.filter
    ? `<button type="button" class="chip active" id="clearTag">${esc(label(state.filter))}${ICONS.x}</button>` : '';
}

function renderCard(p, i) {
  const fav = isFav(p.id);
  const snip = p.text.replace(/\s+/g, ' ').slice(0, 150);
  return `
  <article class="pr" data-id="${esc(p.id)}" data-idx="${i}" tabindex="0" role="button" aria-label="باز کردن پرامپت ${esc(label(p.title))}">
    <div class="pr-thumb">${p.image ? `<img src="/prompts/${esc(p.image)}" alt="" loading="lazy" decoding="async">` : ''}</div>
    <div class="pr-body">
      <div class="pr-meta"><span class="pr-tag">${esc(label(p.title))}</span><span class="pr-no">${numOf(p)}</span>${p.note ? '<i class="pr-note-dot" title="توضیح دارد"></i>' : ''}</div>
      <p class="pr-snip" dir="auto">${esc(snip)}</p>
    </div>
    <button type="button" class="pal-fav ${fav ? 'is-fav' : ''}" data-fav="${esc(p.id)}" aria-label="علاقه‌مندی" aria-pressed="${fav}">${ICONS.heart}</button>
  </article>`;
}

function render() {
  const list = $('#list'), items = visible();
  if (!state.prompts.length) { list.innerHTML = ''; return; }
  if (!items.length) {
    const filtered = state.query || state.filter;
    list.innerHTML = `<div class="empty"><div class="empty-icon">${ICONS.empty}</div>
      <h3>${filtered ? 'چیزی پیدا نشد' : 'هنوز پرامپتی نشان نکردی'}</h3>
      <p>${filtered ? 'عبارت یا برگه‌ی دیگری را امتحان کن.' : 'روی قلبِ هر پرامپت بزن تا اینجا ذخیره شود.'}</p>
      ${filtered ? '<button type="button" class="act act-primary" id="resetFilters">پاک‌کردن فیلترها</button>' : ''}</div>`;
    const r = $('#resetFilters'); if (r) r.addEventListener('click', resetAll);
    return;
  }
  list.innerHTML = items.map(renderCard).join('');
  observeCards();
}

function resetAll() {
  state.query = ''; state.filter = ''; state.favsOnly = false;
  $('#search').value = ''; $('#searchClear').hidden = true;
  localStorage.removeItem(STORAGE.FILTER);
  renderIndex(); updateFavCount(); render(); haptic.light();
}

let cardObserver = null;
function observeCards() {
  const cards = $$('.pr:not(.in-view)');
  if (!('IntersectionObserver' in window)) return cards.forEach(c => c.classList.add('in-view'));
  if (cardObserver) cardObserver.disconnect();
  cardObserver = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.style.animationDelay = `${Math.min(Number(e.target.dataset.idx) % 4, 3) * 50}ms`;
    e.target.classList.add('in-view'); cardObserver.unobserve(e.target);
  }), { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
  cards.forEach(c => cardObserver.observe(c));
}

/* ---------- شیتِ پایین: تنها جایِ اسکرولِ متنِ کامل ---------- */
function openSheet(id) {
  const p = state.prompts.find(x => x.id === id); if (!p) return;
  state.open = id;
  const long = p.text.length > LONG_LIMIT, fav = isFav(id);
  $('#sdPanel').innerHTML = `
    <div class="sd-grab"></div>
    <div class="sd-scroll">
      ${p.image ? `<img class="sd-img" src="/prompts/${esc(p.image)}" alt="">` : ''}
      <div class="sd-head"><span class="pr-tag">${esc(label(p.title))}</span><span class="pr-no">${numOf(p)}</span><span class="sd-count">${toPersian(p.text.length.toLocaleString('en'))} کاراکتر</span></div>
      ${p.note ? `<div class="sd-note"><b>توضیح</b>${esc(p.note).replace(/\n/g, '<br>')}</div>` : ''}
      <pre class="sd-text" dir="auto">${esc(p.text)}</pre>
    </div>
    <div class="sd-bar">
      <button type="button" class="act ${long ? '' : 'hot'}" data-sd="copy">${ICONS.copy}<span>کپی پرامپت</span></button>
      <button type="button" class="act ${long ? 'hot' : ''}" data-sd="file">${ICONS.file}<span>${long ? 'دریافت فایل (پیشنهادی)' : 'فایل txt'}</span></button>
      <button type="button" class="pal-fav ${fav ? 'is-fav' : ''}" data-sd="fav" aria-pressed="${fav}" aria-label="علاقه‌مندی">${ICONS.heart}</button>
    </div>`;
  const sd = $('#sd'); sd.hidden = false; document.body.classList.add('locked');
  requestAnimationFrame(() => sd.classList.add('open'));
  if (tg?.BackButton) { try { tg.BackButton.show(); tg.BackButton.onClick(closeSheet); } catch (e) {} }
  haptic.light();
}
function closeSheet() {
  if (!state.open) return;
  state.open = null;
  const sd = $('#sd'); sd.classList.remove('open'); document.body.classList.remove('locked');
  if (tg?.BackButton) { try { tg.BackButton.hide(); tg.BackButton.offClick(closeSheet); } catch (e) {} }
  setTimeout(() => { if (!state.open) sd.hidden = true; }, 300);
}

async function sendFile(p) {
  const initData = tg?.initData || '';
  if (initData) {
    try {
      const res = await fetch('/prompts/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify({ id: p.id }) });
      if (res.ok) { haptic.success(); return showToast('فایل توی چت رواق فرستاده شد'); }
      if (res.status === 429) return showToast('چند ثانیه صبر کن و دوباره بزن');
    } catch (e) {}
  }
  // خارج از تلگرام یا خطای سرور: دانلودِ مستقیم
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + p.text], { type: 'text/plain;charset=utf-8' }));
  a.download = `${p.title}_${p.id}.txt`; document.body.appendChild(a); a.click(); a.remove();
  showToast('فایل آماده شد');
}

/* ---------- Events ---------- */
function bindEvents() {
  $('#themeBtn').addEventListener('click', toggleTheme);
  $('#favBtn').addEventListener('click', () => {
    state.favsOnly = !state.favsOnly; updateFavCount(); render(); haptic.light();
    if (state.favsOnly) window.scrollTo({ top: $('#list').offsetTop - 100, behavior: 'smooth' });
  });
  const search = $('#search'), clear = $('#searchClear'); let deb = null;
  search.addEventListener('input', e => { const v = e.target.value; clear.hidden = !v; clearTimeout(deb); deb = setTimeout(() => { state.query = v; render(); }, 120); });
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; state.query = ''; clear.hidden = true; render(); search.blur(); } });
  clear.addEventListener('click', () => { search.value = ''; state.query = ''; clear.hidden = true; render(); search.focus(); haptic.light(); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.focus(); }
    if (e.key === 'Escape') closeSheet();
  });

  $('#index').addEventListener('click', e => {
    const t = e.target.closest('.tile'); if (!t || t.disabled) return;
    state.filter = state.filter === t.dataset.tag ? '' : t.dataset.tag;
    localStorage.setItem(STORAGE.FILTER, state.filter);
    renderIndex(); render(); haptic.select();
    if (state.filter) window.scrollTo({ top: $('.filters').offsetTop - 60, behavior: 'smooth' });
  });
  $('#now').addEventListener('click', e => { if (e.target.closest('#clearTag')) { state.filter = ''; localStorage.removeItem(STORAGE.FILTER); renderIndex(); render(); haptic.select(); } });

  $('#list').addEventListener('click', e => {
    const fb = e.target.closest('.pal-fav');
    if (fb) {
      e.stopPropagation();
      const id = fb.dataset.fav; toggleFav(id);
      fb.classList.toggle('is-fav', isFav(id)); fb.setAttribute('aria-pressed', String(isFav(id)));
      if (state.favsOnly && !isFav(id)) setTimeout(render, 200);
      return;
    }
    const card = e.target.closest('.pr'); if (card) openSheet(card.dataset.id);
  });
  $('#list').addEventListener('keydown', e => {
    const card = e.target.closest?.('.pr');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSheet(card.dataset.id); }
  });

  $('#sdScrim').addEventListener('click', closeSheet);
  $('#sdPanel').addEventListener('click', async e => {
    const b = e.target.closest('[data-sd]'); if (!b) return;
    const p = state.prompts.find(x => x.id === state.open); if (!p) return;
    if (b.dataset.sd === 'copy') {
      if (await copyText(p.text)) { haptic.success(); showToast(p.text.length > LONG_LIMIT ? 'کپی شد — متنِ بلند رو با فایل هم می‌تونی بگیری' : 'پرامپتِ کامل کپی شد'); }
      else showToast('کپی نشد — فایل txt رو امتحان کن');
    } else if (b.dataset.sd === 'file') {
      b.disabled = true; await sendFile(p); setTimeout(() => b.disabled = false, 2500);
    } else if (b.dataset.sd === 'fav') {
      toggleFav(p.id); b.classList.toggle('is-fav', isFav(p.id)); b.setAttribute('aria-pressed', String(isFav(p.id)));
      const cardFav = $(`.pal-fav[data-fav="${CSS.escape(p.id)}"]`); if (cardFav) cardFav.classList.toggle('is-fav', isFav(p.id));
    }
  });

  const toTop = $('#toTop'); let raf = false;
  toTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); haptic.light(); });
  window.addEventListener('scroll', () => { if (raf) return; raf = true; requestAnimationFrame(() => { raf = false; toTop.hidden = window.scrollY < 600; }); }, { passive: true });
}

/* ---------- Data ---------- */
async function loadPrompts() {
  const list = $('#list');
  list.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('bad');
    state.prompts = data.map((p, i) => ({
      id: String(p.id || `p${i}`), title: String(p.title || ''), text: String(p.text || ''),
      note: String(p.note || '').trim(), image: p.image || '',
    })).filter(p => p.text && p.title);
    if (state.filter && !state.prompts.some(p => p.title === state.filter)) { state.filter = ''; localStorage.removeItem(STORAGE.FILTER); }
    renderIndex();
    if (!state.prompts.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">${ICONS.empty}</div><h3>هنوز پرامپتی اضافه نشده</h3><p>به‌زودی اینجا پر می‌شود.</p></div>`;
      return;
    }
    render();
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty"><div class="empty-icon">${ICONS.empty}</div><h3>بارگذاری نشد</h3><p>اتصال را بررسی کن و دوباره امتحان کن.</p><button type="button" class="act act-primary" id="retryBtn">تلاش مجدد</button></div>`;
    $('#retryBtn').addEventListener('click', loadPrompts);
  }
}

function boot() { initTheme(); updateFavCount(); bindEvents(); loadPrompts(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();