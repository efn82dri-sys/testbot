/* ============================================================
   رواق — Mini App palettes / logic
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
  THEME:  'ravaq.palettes.theme',
  FAVS:   'ravaq.palettes.favs',
  FILTER: 'ravaq.palettes.filter',
};
// مسیر اصلی: API فشرده (gzip + ETag)؛ اگر نبود، فایل استاتیک
const DATA_URLS = ['/palettes/api/data', '/palettes/data/palettes.json'];
const PAGE_SIZE = 24;   // تعداد کارتی که در هر نوبت رندر می‌شود (به‌جای ۱۲۵۰ کارتِ یک‌جا)

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

/* ---------- Color formats ---------- */
function hexToRgbArr(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
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

/* ---------- State ---------- */
const state = {
  palettes: [],
  tags: [],
  filter: localStorage.getItem(STORAGE.FILTER) || '',
  query: '',
  favsOnly: false,
  favs: new Set(JSON.parse(localStorage.getItem(STORAGE.FAVS) || '[]')),
  items: [],   // نتیجه‌ی فیلترشده
  shown: 0,    // چندتایش تا الان رندر شده
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
  const root = document.documentElement;
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE.THEME, next); } catch (e) {}
    if (tg?.setHeaderColor) {
      try { tg.setHeaderColor(next === 'dark' ? '#0C0E10' : '#F2EEE8'); } catch (e) {}
    }
  };
  const finish = () => root.classList.remove('theme-switching');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Match the Materials mini-app: freeze individual CSS transitions and swap
  // the page as one View Transition, preventing surfaces from changing in patches.
  root.classList.add('theme-switching');
  if (document.startViewTransition && !reducedMotion) {
    try {
      document.startViewTransition(apply).finished.then(finish, finish);
    } catch (e) {
      apply();
      requestAnimationFrame(() => requestAnimationFrame(finish));
    }
  } else {
    apply();
    requestAnimationFrame(() => requestAnimationFrame(finish));
  }
  haptic.light();
}

/* ---------- Favorites ---------- */
function isFav(id) { return state.favs.has(id); }

function toggleFav(id) {
  if (state.favs.has(id)) {
    state.favs.delete(id);
    haptic.light();
  } else {
    state.favs.add(id);
    haptic.success();
  }
  localStorage.setItem(STORAGE.FAVS, JSON.stringify([...state.favs]));
  updateFavCount();
}

function updateFavCount() {
  const btn = $('#favBtn');
  const cnt = $('#favCount');
  const n = state.favs.size;
  if (n > 0) {
    cnt.hidden = false;
    cnt.textContent = toPersian(n);
  } else {
    cnt.hidden = true;
  }
  btn.setAttribute('aria-pressed', state.favsOnly ? 'true' : 'false');
}

/* ---------- Filtering ---------- */
function matchesQuery(p, q) {
  if (!q) return true;
  const lq = q.toLowerCase().trim();
  if (p.name.toLowerCase().includes(lq)) return true;
  if ((p.desc || '').toLowerCase().includes(lq)) return true;
  if (p.colors.some(c => c.toLowerCase().includes(lq))) return true;
  const nq = lq.replace(/[\s,\-]+/g, ' ');
  if (/\d/.test(nq) && p.colors.some(c => hexToRgbArr(c).join(' ').includes(nq))) return true;
  if ((p.tags || []).some(t => t.toLowerCase().includes(lq))) return true;
  return false;
}

function visiblePalettes() {
  return state.palettes.filter(p => {
    if (state.favsOnly && !isFav(p.id)) return false;
    if (state.filter && !(p.tags || []).includes(state.filter)) return false;
    if (!matchesQuery(p, state.query)) return false;
    return true;
  });
}

/* ---------- Render ---------- */
const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  code: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  share:'<svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  empty:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01"/></svg>',
};

function renderCard(p, idx, total) {
  const fav = isFav(p.id);
  const swatchesHtml = p.colors.map(c => {
    const [r, g, b] = hexToRgbArr(c);
    return `
    <button type="button" class="sw" data-hex="${c}" style="--sw-bg:${c};--sw-ink:${textColor(c)}" aria-label="کپی کد ${c} (کد رویت ${r} ${g} ${b})">
      <span class="sw-codes" dir="ltr">
        <span class="sw-rvt" aria-hidden="true"><b>${r}</b><b>${g}</b><b>${b}</b></span>
        <span class="sw-hex">${c}</span>
      </span>
      <span class="sw-check" aria-hidden="true">${ICONS.check}<span>کپی شد</span></span>
    </button>
  `;
  }).join('');

  return `
    <article class="pal" data-id="${p.id}" data-idx="${idx}">
      <header class="pal-head">
        <div class="pal-title-wrap">
          <h2>${p.name}</h2>
          <span class="pal-counter">${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        </div>
        <button type="button" class="pal-fav ${fav ? 'is-fav' : ''}" data-fav="${p.id}" aria-label="${fav ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}" aria-pressed="${fav}">
          ${ICONS.heart}
        </button>
      </header>
      <p class="pal-desc">${p.desc || ''}</p>
      <div class="swatches">${swatchesHtml}</div>
      <div class="pal-actions">
        <button type="button" class="act act-primary" data-act="copy-all" data-id="${p.id}">${ICONS.copy}<span>کپی پالت</span></button>
        <button type="button" class="act" data-act="copy-css" data-id="${p.id}">${ICONS.code}<span>CSS</span></button>
        <button type="button" class="act" data-act="share" data-id="${p.id}">${ICONS.share}<span>اشتراک</span></button>
      </div>
    </article>
  `;
}

function render() {
  const list = $('#list');
  const items = visiblePalettes();
  const total = state.palettes.length;

  if (!state.palettes.length) {
    list.innerHTML = '';
    return;
  }

  if (!items.length) {
    const isFavView = state.favsOnly;
    const isSearch = !!state.query || !!state.filter;
    let msg, hint, showReset = false;
    if (isFavView && !isSearch) {
      msg = 'هنوز پالتی را نشان نکردی';
      hint = 'روی قلب هر پالت بزن تا اینجا ذخیره شود.';
    } else if (isSearch) {
      msg = 'چیزی پیدا نشد';
      hint = 'عبارت یا فیلتر دیگری را امتحان کن.';
      showReset = true;
    } else {
      msg = 'خالی است';
      hint = '';
    }
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${ICONS.empty}</div>
        <h3>${msg}</h3>
        <p>${hint}</p>
        ${showReset ? '<button type="button" class="act act-primary" id="resetFilters">پاک‌کردن فیلترها</button>' : ''}
      </div>
    `;
    const reset = $('#resetFilters');
    if (reset) reset.addEventListener('click', resetAllFilters);
    return;
  }

  state.items = items;
  state.shown = 0;
  if (moreObserver) moreObserver.disconnect();
  list.innerHTML = '';
  updateCountPill();
  appendChunk();
}

/* ---------- Progressive rendering ---------- */
function updateCountPill() {
  const pill = $('#countPill');
  if (!pill) return;
  const all = state.palettes.length;
  const n = state.items.length;
  pill.textContent = n === all
    ? `${toPersian(all)} پالت رنگ`
    : `${toPersian(n)} از ${toPersian(all)} پالت`;
}

function moreHtml() {
  const left = state.items.length - state.shown;
  const next = Math.min(PAGE_SIZE, left);
  return `
    <div class="more-wrap" id="moreWrap">
      <button type="button" class="act act-primary" id="moreBtn">
        <span>نمایش ${toPersian(next)} پالتِ بعدی</span>
        <span class="more-left">(${toPersian(left)} باقی‌مانده)</span>
      </button>
    </div>`;
}

let moreObserver = null;
function appendChunk() {
  const list = $('#list');
  const items = state.items;
  const start = state.shown;
  const end = Math.min(start + PAGE_SIZE, items.length);
  if (start >= end) return;

  const old = $('#moreWrap');
  if (old) old.remove();

  const total = items.length;
  list.insertAdjacentHTML('beforeend',
    items.slice(start, end).map((p, i) => renderCard(p, start + i, total)).join(''));
  state.shown = end;
  if (end < total) list.insertAdjacentHTML('beforeend', moreHtml());

  observeCards();
  observeMore();
}

function observeMore() {
  const el = $('#moreWrap');
  if (!el || !('IntersectionObserver' in window)) return;
  if (moreObserver) moreObserver.disconnect();
  // پیش از رسیدن به انتهای لیست، دسته‌ی بعدی خودکار بارگذاری می‌شود
  moreObserver = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) appendChunk();
  }, { rootMargin: '900px 0px' });
  moreObserver.observe(el);
}

function resetAllFilters() {
  state.query = '';
  state.filter = '';
  state.favsOnly = false;
  const search = $('#search');
  if (search) search.value = '';
  const clear = $('#searchClear');
  if (clear) clear.hidden = true;
  localStorage.removeItem(STORAGE.FILTER);
  renderChips();
  updateFavCount();
  render();
  haptic.light();
}

/* ---------- Scroll reveal ---------- */
let cardObserver = null;
function observeCards() {
  const cards = $$('.pal:not(.in-view)');
  if (!('IntersectionObserver' in window)) {
    cards.forEach(c => c.classList.add('in-view'));
    return;
  }
  if (cardObserver) cardObserver.disconnect();
  cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const idx = Number(el.dataset.idx) || 0;
      const delay = Math.min(idx % 4, 3) * 55;
      el.style.animationDelay = `${delay}ms`;
      el.classList.add('in-view');
      cardObserver.unobserve(el);
    });
  }, { rootMargin: '0px 0px -50px 0px', threshold: 0.06 });
  cards.forEach(c => cardObserver.observe(c));
}

/* ---------- Chips ---------- */
function renderChips() {
  const wrap = $('#chips');
  const tags = state.tags;
  const all = [{ id: '', label: 'همه' }, ...tags.map(t => ({ id: t, label: t }))];
  wrap.innerHTML = all.map(t => `
    <button type="button" class="chip ${state.filter === t.id ? 'active' : ''}" data-tag="${t.id}" role="tab" aria-selected="${state.filter === t.id}">${t.label}</button>
  `).join('');
}

/* ---------- Category switching ---------- */
function setFilter(tag, enterFrom = 0) {
  state.filter = tag;
  localStorage.setItem(STORAGE.FILTER, tag);
  renderChips();
  render();
  const active = $('#chips .chip.active');
  if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  if (enterFrom) {
    const list = $('#list');
    list.style.setProperty('--swipe-from', `${enterFrom}px`);
    list.classList.remove('swipe-in');
    void list.offsetWidth;               // restart animation
    list.classList.add('swipe-in');
  }
}

function bindCategorySwipe() {
  const MIN_DX = 56;          // حداقل کشیدن افقی (px)
  const MAX_MS = 800;         // حداکثر مدت حرکت
  const RATIO  = 1.6;         // افقی باید حداقل ۱٫۶ برابر عمودی باشد
  let t0 = null;

  const ignore = (el) => !!el.closest('.chips, input, textarea, .search-wrap, .toast, #toTop');

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || ignore(e.target)) { t0 = null; return; }
    const t = e.touches[0];
    t0 = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });

  document.addEventListener('touchcancel', () => { t0 = null; }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!t0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - t0.x;
    const dy = t.clientY - t0.y;
    const dt = Date.now() - t0.time;
    t0 = null;
    if (dt > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return;

    const cats = ['', ...state.tags];
    const i = Math.max(0, cats.indexOf(state.filter));
    // در حالت راست‌به‌چپ، دسته‌ی بعدی سمت چپ است: کشیدن به راست = بعدی
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const forward = rtl ? dx > 0 : dx < 0;
    const j = i + (forward ? 1 : -1);
    if (j < 0 || j >= cats.length) { haptic.light(); return; }   // انتهای فهرست

    // اگر کاربر پایین صفحه است، به ابتدای لیست برگردد
    const top = $('#list').offsetTop - 100;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' });

    setFilter(cats[j], dx > 0 ? -36 : 36);
    haptic.select();
  }, { passive: true });
}

/* ---------- Event Delegation ---------- */
function bindEvents() {
  // App bar
  $('#themeBtn').addEventListener('click', toggleTheme);

  $('#favBtn').addEventListener('click', () => {
    state.favsOnly = !state.favsOnly;
    updateFavCount();
    render();
    haptic.light();
    if (state.favsOnly) {
      window.scrollTo({ top: $('#list').offsetTop - 100, behavior: 'smooth' });
    }
  });

  // Search
  const search = $('#search');
  const searchClear = $('#searchClear');
  let searchDebounce = null;

  search.addEventListener('input', (e) => {
    const v = e.target.value;
    searchClear.hidden = !v;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.query = v;
      render();
    }, 120);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      state.query = '';
      searchClear.hidden = true;
      render();
      search.blur();
    }
  });
  searchClear.addEventListener('click', () => {
    search.value = '';
    state.query = '';
    searchClear.hidden = true;
    render();
    search.focus();
    haptic.light();
  });

  // Ctrl/Cmd + K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      search.focus();
    }
  });

  // Chips (delegated)
  $('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    setFilter(chip.dataset.tag);
    haptic.select();
  });

  // Swipe between categories (horizontal finger drag)
  bindCategorySwipe();

  // List — swatches, favs, actions
  $('#list').addEventListener('click', async (e) => {
    // Load more
    if (e.target.closest('#moreBtn')) { appendChunk(); haptic.light(); return; }

    // Swatch copy
    const sw = e.target.closest('.sw');
    if (sw) {
      const hex = sw.dataset.hex;
      const ok = await copyText(hex);
      if (ok) {
        sw.classList.add('copied');
        haptic.success();
        showToast(`کد ${hex} کپی شد`);
        setTimeout(() => sw.classList.remove('copied'), 1100);
      } else {
        showToast('کپی نشد — دستی امتحان کن');
      }
      return;
    }

    // Favorite
    const favBtn = e.target.closest('.pal-fav');
    if (favBtn) {
      const id = favBtn.dataset.fav;
      toggleFav(id);
      const nowFav = isFav(id);
      favBtn.classList.toggle('is-fav', nowFav);
      favBtn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
      if (state.favsOnly && !nowFav) {
        // remove card with a smooth collapse
        const card = favBtn.closest('.pal');
        if (card) {
          card.style.transition = 'opacity .3s ease, transform .3s ease';
          card.style.opacity = '0';
          card.style.transform = 'translateY(-8px)';
          setTimeout(render, 260);
        }
      }
      return;
    }

    // Actions
    const act = e.target.closest('.act');
    if (!act) return;
    const id = act.dataset.id;
    const action = act.dataset.act;
    const p = state.palettes.find(x => x.id === id);
    if (!p) return;

    if (action === 'copy-all') {
      const ok = await copyText(p.colors.join(', '));
      if (ok) {
        haptic.success();
        showToast(`پالت «${p.name}» کپی شد (${toPersian(p.colors.length)} رنگ)`);
      } else showToast('کپی نشد');
    } else if (action === 'copy-css') {
      const lines = p.colors.map((c, i) => `  --c${i + 1}: ${c};`).join('\n');
      const css = `/* ${p.name} — رواق */\n:root {\n${lines}\n}`;
      const ok = await copyText(css);
      if (ok) {
        haptic.success();
        showToast('کدهای CSS کپی شد');
      } else showToast('کپی نشد');
    } else if (action === 'share') {
      const text = `${p.name} — پالت رنگی رواق\n${p.colors.join(' · ')}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: p.name, text });
        } catch (err) { /* user cancelled */ }
      } else {
        const ok = await copyText(text);
        if (ok) { haptic.success(); showToast('برای اشتراک کپی شد'); }
      }
    }
  });

  // Scroll to top
  const toTop = $('#toTop');
  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    haptic.light();
  });
  let rafPending = false;
  window.addEventListener('scroll', () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      toTop.hidden = window.scrollY < 600;
    });
  }, { passive: true });
}

/* ---------- Data loading ---------- */
async function loadPalettes() {
  const list = $('#list');
  list.innerHTML = '<div class="skel"></div><div class="skel"></div>';

  try {
    let data = null, lastErr = null;
    for (const url of DATA_URLS) {
      try {
        // no-cache = همیشه با سرور (ETag) چک شود؛ اگر تغییری نبود ۳۰۴ و بدون دانلودِ دوباره
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!Array.isArray(json) || !json.length) throw new Error('empty');
        data = json;
        break;
      } catch (err) { lastErr = err; }
    }
    if (!data) throw lastErr || new Error('load failed');

    // Normalize
    state.palettes = data.map((p, i) => ({
      id: p.id || `p${i}`,
      name: p.name || `پالت ${i + 1}`,
      desc: p.desc || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
      colors: Array.isArray(p.colors) ? p.colors.filter(c => /^#[0-9A-Fa-f]{6}$/.test(c)) : [],
    })).filter(p => p.colors.length >= 2);

    // Collect unique tags
    const tagSet = new Set();
    state.palettes.forEach(p => p.tags.forEach(t => tagSet.add(t)));
    state.tags = [...tagSet];

    // Validate current filter
    if (state.filter && !state.tags.includes(state.filter)) {
      state.filter = '';
      localStorage.removeItem(STORAGE.FILTER);
    }

    renderChips();
    render();
  } catch (err) {
    console.error(err);
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${ICONS.empty}</div>
        <h3>بارگذاری نشد</h3>
        <p>اتصال را بررسی کن و دوباره امتحان کن.</p>
        <button type="button" class="act act-primary" id="retryBtn">تلاش مجدد</button>
      </div>
    `;
    $('#retryBtn').addEventListener('click', loadPalettes);
  }
}

/* ---------- Boot ---------- */
function boot() {
  initTheme();
  updateFavCount();
  renderChips();
  bindEvents();
  loadPalettes();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}