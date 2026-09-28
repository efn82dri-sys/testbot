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
let TITLES = ['پلان','اسکچ','سکشن','ایزومتریک','سایت','دیاگرام','تحلیل','مودبرد','پالت','داخلی','خارجی','دیتیل','شیت_بندی','انیمیشن','ماکت','کاراکتر'];
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
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>',
  chevL: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
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

/* ---------- اسلایدرِ رسانه: کارت (۱۶:۹) و شیت (ابعادِ اصلی) ---------- */
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SWIPED_KEY = 'ravaq.prompts.swiped';
try { if (localStorage.getItem(SWIPED_KEY)) document.documentElement.classList.add('swiped'); } catch (e) {}
const mediaUrl = m => m.key ? `/prompts/m/${m.key}` : `/prompts/${m.src}`;
const trackSign = t => (getComputedStyle(t).direction === 'rtl' ? -1 : 1);
const trackIndex = t => Math.max(0, Math.round(Math.abs(t.scrollLeft) / (t.clientWidth || 1)));

function slidesHtml(media, mode) {
  return media.map(m => {
    const ar = m.w && m.h ? `${m.w} / ${m.h}` : '16 / 9';
    const lab = m.label ? `<span class="mv-pill mv-label">${esc(m.label)}</span>` : '';
    let inner;
    if (m.type === 'video') {
      const poster = mode === 'card' ? m.poster : (m.poster_full || m.poster);
      inner = `<video muted loop playsinline preload="none" ${mode === 'sheet' ? 'controls' : ''} ${poster ? `poster="/prompts/${esc(poster)}"` : ''} data-src="${esc(mediaUrl(m))}"></video>
        <span class="mv-pill mv-vid">${ICONS.play}<span>ویدیو</span></span>`;
    } else {
      const src = mode === 'card' ? (m.thumb || mediaUrl(m)) : mediaUrl(m);
      inner = `<img src="${esc(mode === 'card' && m.thumb ? '/prompts/' + m.thumb : src)}" alt="" decoding="async" draggable="false" ${mode === 'card' ? 'loading="lazy"' : ''}>`;
    }
    return `<div class="mv-slide" style="--ar:${ar}">${inner}${lab}</div>`;
  }).join('');
}

function sliderHtml(p, mode) {
  const media = p.media, n = media.length;
  if (!n) return `<div class="mv mv-${mode}"><div class="mv-empty"><span>${esc(label(p.title))}</span></div></div>`;
  const multi = n > 1;
  return `<div class="mv mv-${mode}" data-n="${n}">
    <div class="mv-track">${slidesHtml(media, mode)}</div>
    ${multi ? `<span class="mv-pill mv-count" dir="ltr">${toPersian(1)} / ${toPersian(n)}</span>
      <span class="mv-dots" aria-hidden="true">${media.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</span>
      <span class="mv-pill mv-hint" aria-hidden="true"><span class="ch">${ICONS.chevL}${ICONS.chevL}</span><span>ورق بزن</span></span>` : ''}
    ${multi && mode === 'sheet' ? `<button type="button" class="mv-nav mv-prev" data-gl="prev" aria-label="قبلی">${ICONS.chevR}</button><button type="button" class="mv-nav mv-next" data-gl="next" aria-label="بعدی">${ICONS.chevL}</button>` : ''}
  </div>`;
}

function markSwiped() {
  if (document.documentElement.classList.contains('swiped')) return;
  document.documentElement.classList.add('swiped');
  try { localStorage.setItem(SWIPED_KEY, '1'); } catch (e) {}
}

function goTo(t, i) {
  const n = t.children.length;
  i = Math.max(0, Math.min(n - 1, i));
  t.scrollTo({ left: trackSign(t) * i * t.clientWidth, behavior: REDUCED ? 'auto' : 'smooth' });
}

/* ارتفاعِ اسلایدرِ شیت = ارتفاعِ اسلایدِ فعال (هر رسانه نسبتِ خودش را دارد) */
function syncHeight(t, i) {
  const s = t.children[i];
  if (s) t.style.height = s.offsetHeight + 'px';
}

/* حرکتِ «تمایل به اسلاید»: اسلایدِ بعدی کمی سرک می‌کشد و با فنر برمی‌گردد */
function nudge(t) {
  if (REDUCED || t._nudged || t.children.length < 2 || Math.abs(t.scrollLeft) > 4) return;
  t._nudged = true; t._nudge = true; t._cancel = false;
  const sign = trackSign(t), max = t.clientWidth * 0.17, D1 = 520, D2 = 780, t0 = performance.now();
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  t.classList.add('nudging');
  const end = () => { t._nudge = false; t.classList.remove('nudging'); };
  (function step(now) {
    if (t._cancel) return end();
    const k = now - t0;
    let x;
    if (k < D1) x = easeOut(k / D1) * max;
    else if (k < D1 + D2) { const u = (k - D1) / D2; x = max * (1 - easeOut(u)) + Math.sin(u * Math.PI * 2) * max * 0.06 * (1 - u); }
    else { t.scrollLeft = 0; return end(); }
    t.scrollLeft = sign * Math.max(0, x);
    requestAnimationFrame(step);
  })(t0);
}

const vidObs = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(e => {
  const v = e.target;
  const allowed = !state.open || v.closest('#sd');
  if (e.isIntersecting && e.intersectionRatio >= 0.6 && allowed) {
    if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.preload = 'metadata'; }
    const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
  } else v.pause();
}), { threshold: [0, 0.6] }) : null;

const nudgeObs = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  nudgeObs.unobserve(e.target);
  setTimeout(() => nudge(e.target), 380 + Math.random() * 320);
}), { threshold: 0.8 }) : null;

function wireSliders(root) {
  $$('.mv-track', root).forEach(t => {
    if (t._wired) return;
    t._wired = true;
    const mv = t.closest('.mv'), n = Number(mv.dataset.n) || 0;
    $$('video', t).forEach(v => vidObs && vidObs.observe(v));
    if (n < 2) return;
    const isSheet = mv.classList.contains('mv-sheet');
    const dots = $$('.mv-dots i', mv), counter = $('.mv-count', mv);
    const prev = $('.mv-prev', mv), next = $('.mv-next', mv);
    let raf = 0;
    const update = () => {
      raf = 0;
      const i = Math.min(n - 1, trackIndex(t));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      if (counter) counter.textContent = `${toPersian(i + 1)} / ${toPersian(n)}`;
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === n - 1;
      if (isSheet) syncHeight(t, i);
    };
    t.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(update);
      if (!t._nudge && Math.abs(t.scrollLeft) > 10) markSwiped();
    }, { passive: true });
    t.addEventListener('touchstart', () => { t._cancel = true; }, { passive: true });
    t.addEventListener('pointerdown', () => { t._cancel = true; });
    t.addEventListener('wheel', () => { t._cancel = true; }, { passive: true });
    update();
    if (!isSheet && nudgeObs) nudgeObs.observe(t);
  });
}

function resumeCardVideos() {
  if (!vidObs) return;
  $$('#list video').forEach(v => { vidObs.unobserve(v); vidObs.observe(v); });
}

function renderCard(p, i) {
  const fav = isFav(p.id);
  const snip = p.text.replace(/\s+/g, ' ').slice(0, 150);
  return `
  <article class="pr" data-id="${esc(p.id)}" data-idx="${i}" tabindex="0" role="button" aria-label="باز کردن پرامپت ${esc(label(p.title))}">
    ${sliderHtml(p, 'card')}
    <div class="pr-row">
      <div class="pr-body">
        <div class="pr-meta"><span class="pr-tag">${esc(label(p.title))}</span><span class="pr-no">${numOf(p)}</span>${p.note ? '<i class="pr-note-dot" title="توضیح دارد"></i>' : ''}</div>
        <p class="pr-snip" dir="auto">${esc(snip)}</p>
      </div>
      <button type="button" class="pal-fav ${fav ? 'is-fav' : ''}" data-fav="${esc(p.id)}" aria-label="علاقه‌مندی" aria-pressed="${fav}">${ICONS.heart}</button>
    </div>
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
  wireSliders(list);
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
  $$('#list video').forEach(v => v.pause());
  $('#sdPanel').innerHTML = `
    <div class="sd-grab"></div>
    <div class="sd-scroll">
      ${p.media.length ? sliderHtml(p, 'sheet') : ''}
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
  const track = $('#sdPanel .mv-track');
  if (track) {
    wireSliders($('#sdPanel'));
    requestAnimationFrame(() => {
      syncHeight(track, 0);
      if (track.children.length > 1) setTimeout(() => { if (state.open === id) nudge(track); }, 800);
    });
  }
  if (tg?.BackButton) { try { tg.BackButton.show(); tg.BackButton.onClick(closeSheet); } catch (e) {} }
  try { tg?.disableVerticalSwipes?.(); } catch (e) {}
  haptic.light();
}
function closeSheet() {
  if (!state.open) return;
  state.open = null;
  const sd = $('#sd'); sd.classList.remove('open'); document.body.classList.remove('locked');
  if (tg?.BackButton) { try { tg.BackButton.hide(); tg.BackButton.offClick(closeSheet); } catch (e) {} }
  try { tg?.enableVerticalSwipes?.(); } catch (e) {}
  setTimeout(() => { if (!state.open) { sd.hidden = true; $('#sdPanel').innerHTML = ''; resumeCardVideos(); } }, 320);
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
    const gl = e.target.closest('[data-gl]');
    if (gl) {
      const t = $('#sdPanel .mv-track'); if (!t) return;
      t._cancel = true;
      goTo(t, trackIndex(t) + (gl.dataset.gl === 'next' ? 1 : -1)); haptic.select();
      return;
    }
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
async function loadTitles() {
  try {
    const r = await fetch('/prompts/data/titles.json', { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d) && d.length) TITLES = d.map(String);
  } catch (e) { /* از لیستِ پیش‌فرض استفاده می‌شود */ }
}
async function loadPrompts() {
  const list = $('#list');
  list.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('bad');
    await loadTitles();
    const okPath = v => (typeof v === 'string' && /^data\/[\w\-./]+$/.test(v)) ? v : '';
    const normMedia = p => {
      const raw = Array.isArray(p.media) && p.media.length ? p.media : (p.image ? [{ type: 'image', src: p.image, thumb: p.image }] : []);
      return raw.map(m => ({
        type: m.type === 'video' ? 'video' : 'image',
        key: /^[0-9a-f]{20}$/.test(m.key || '') ? m.key : '',
        src: okPath(m.src), thumb: okPath(m.thumb) || okPath(m.src),
        poster: okPath(m.poster), poster_full: okPath(m.poster_full) || okPath(m.poster),
        w: Number(m.w) || 0, h: Number(m.h) || 0, label: String(m.label || '').slice(0, 24),
      })).filter(m => m.key || m.src);
    };
    state.prompts = data.map((p, i) => ({
      id: String(p.id || `p${i}`), title: String(p.title || ''), text: String(p.text || ''),
      note: String(p.note || '').trim(), media: normMedia(p),
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

function boot() {
  initTheme(); updateFavCount(); bindEvents(); loadPrompts();
  let rz = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => $$('.mv-sheet .mv-track').forEach(t => syncHeight(t, trackIndex(t))), 120);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();