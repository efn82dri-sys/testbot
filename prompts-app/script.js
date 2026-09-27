/* ============================================================
   رواق — Mini App prompts / logic [IMPROVED]
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
  TAGS:   'ravaq.prompts.tags',
};
const DATA_URL = '/prompts/data/prompts.json';

/* گروه‌های ثابت — باید دقیقاً هم‌راستا با PROMPT_GROUPS در main.py بمونه */
const GROUPS = [
  { id: 'docs',     emoji: '📐', name: 'مدارک و خطوط فنی' },
  { id: 'ideation', emoji: '📊', name: 'آنالیز و ایده‌پردازی' },
  { id: 'render',   emoji: '📸', name: 'رندر و فضاسازی' },
  { id: 'output',   emoji: '🎬', name: 'ارائه و خروجی نهایی' },
];
const GROUP_MAP = Object.fromEntries(GROUPS.map(g => [g.id, g]));

/* ---------- Haptics ---------- */
const haptic = {
  light()  { try { tg?.HapticFeedback?.impactOccurred('light'); } catch (e) {} },
  medium() { try { tg?.HapticFeedback?.impactOccurred('medium'); } catch (e) {} },
  success(){ try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (e) {} },
  select() { try { tg?.HapticFeedback?.selectionChanged(); } catch (e) {} },
};

/* ---------- Utils ---------- */
function toPersian(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  prompts: [],
  filter: localStorage.getItem(STORAGE.FILTER) || '',
  query: '',
  favsOnly: false,
  favs: new Set(JSON.parse(localStorage.getItem(STORAGE.FAVS) || '[]')),
  selectedTags: new Set(JSON.parse(localStorage.getItem(STORAGE.TAGS) || '[]')),
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
  const group = GROUP_MAP[p.group];
  if (p.title.toLowerCase().includes(lq)) return true;
  if ((p.text || '').toLowerCase().includes(lq)) return true;
  if ((p.note || '').toLowerCase().includes(lq)) return true;
  if (group && group.name.toLowerCase().includes(lq)) return true;
  return false;
}

function matchesTags(p) {
  if (state.selectedTags.size === 0) return true;
  const pTags = new Set((p.tags || []).map(t => t.toLowerCase()));
  for (let tag of state.selectedTags) {
    if (pTags.has(tag.toLowerCase())) return true;
  }
  return false;
}

function visiblePrompts() {
  return state.prompts.filter(p => {
    if (state.favsOnly && !isFav(p.id)) return false;
    if (state.filter && p.group !== state.filter) return false;
    if (!matchesTags(p)) return false;
    if (!matchesQuery(p, state.query)) return false;
    return true;
  });
}

/* ---------- Render ---------- */
const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  share:'<svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  empty:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01"/></svg>',
};

function downloadPromptFile(p) {
  const content = p.text;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${p.title.replace(/\s+/g, '-')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  haptic.success();
  showToast(`فایلِ #${p.title} دانلود شد`);
}

function renderCard(p) {
  const fav = isFav(p.id);
  const group = GROUP_MAP[p.group] || { emoji: '🔖', name: '' };
  const tags = (p.tags || []).map(t => `<span class="pr-tag">${escapeHtml(t)}</span>`).join('');
  const hasNote = !!p.note && p.note.trim().length > 0;
  
  return `
    <article class="pr" data-id="${p.id}">
      <header class="pr-head">
        <div class="pr-title-wrap">
          <span class="pr-group-badge">${group.emoji} ${group.name}</span>
          <h2>#${escapeHtml(p.title)}</h2>
        </div>
        <button type="button" class="pr-fav ${fav ? 'is-fav' : ''}" data-fav="${p.id}" aria-label="${fav ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}" aria-pressed="${fav}">
          ${ICONS.heart}
        </button>
      </header>
      ${tags ? `<div class="pr-tags">${tags}</div>` : ''}
      ${hasNote ? `<div class="pr-note" dir="auto">${escapeHtml(p.note)}</div>` : ''}
      <div class="pr-image-wrap">
        <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy">
      </div>
      <p class="pr-text" dir="auto">${escapeHtml(p.text)}</p>
      <div class="pr-actions">
        <button type="button" class="act act-primary" data-act="copy-prompt" data-id="${p.id}">${ICONS.copy}<span>کپی پرامپت</span></button>
        <button type="button" class="act" data-act="download" data-id="${p.id}">${ICONS.download}<span>دانلود</span></button>
        <button type="button" class="act" data-act="share" data-id="${p.id}">${ICONS.share}<span>اشتراک</span></button>
      </div>
    </article>
  `;
}

function render() {
  const list = $('#list');
  const items = visiblePrompts();

  if (!state.prompts.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${ICONS.empty}</div>
        <h3>هنوز پرامپتی اضافه نشده</h3>
        <p>به‌زودی پرامپت‌های تازه اینجا قرار می‌گیرن.</p>
      </div>
    `;
    return;
  }

  if (!items.length) {
    const isFavView = state.favsOnly;
    const isSearch = !!state.query || !!state.filter || state.selectedTags.size > 0;
    let msg, hint, showReset = false;
    if (isFavView && !isSearch) {
      msg = 'هنوز پرامپتی را نشان نکردی';
      hint = 'روی قلب هر پرامپت بزن تا اینجا ذخیره شود.';
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

  list.innerHTML = items.map(p => renderCard(p)).join('');
  observeCards();
}

function resetAllFilters() {
  state.query = '';
  state.filter = '';
  state.favsOnly = false;
  state.selectedTags.clear();
  const search = $('#search');
  if (search) search.value = '';
  localStorage.removeItem(STORAGE.FILTER);
  localStorage.removeItem(STORAGE.TAGS);
  renderChips();
  renderTagChips();
  updateFavCount();
  render();
}

let cardObserver = null;
function observeCards() {
  const cards = $$('.pr:not(.in-view)');
  if (!('IntersectionObserver' in window)) {
    cards.forEach(c => c.classList.add('in-view'));
    return;
  }
  if (cardObserver) cardObserver.disconnect();
  cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      cardObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -50px 0px', threshold: 0.06 });
  cards.forEach(c => cardObserver.observe(c));
}

/* ---------- Chips (Group filters) ---------- */
function renderChips() {
  const wrap = $('#chips');
  const all = [{ id: '', label: 'همه' }, ...GROUPS.map(g => ({ id: g.id, label: `${g.emoji} ${g.name}` }))];
  wrap.innerHTML = all.map(t => `
    <button type="button" class="chip ${state.filter === t.id ? 'active' : ''}" data-tag="${t.id}" role="tab" aria-selected="${state.filter === t.id}">${t.label}</button>
  `).join('');
}

/* ---------- Tag Chips ---------- */
function getAllTags() {
  const tags = new Set();
  state.prompts.forEach(p => {
    (p.tags || []).forEach(t => tags.add(t));
  });
  return Array.from(tags).sort();
}

function renderTagChips() {
  const wrap = $('#tagChips');
  if (!wrap) return;
  
  const allTags = getAllTags();
  if (allTags.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  
  wrap.style.display = 'flex';
  wrap.innerHTML = allTags.map(t => `
    <button type="button" class="chip tag-chip ${state.selectedTags.has(t) ? 'active' : ''}" data-tag="${t}" role="tab" aria-selected="${state.selectedTags.has(t)}">${escapeHtml(t)}</button>
  `).join('');
}

/* ---------- Event Delegation ---------- */
function bindEvents() {
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

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      search.focus();
    }
  });

  $('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip:not(.tag-chip)');
    if (!chip) return;
    const tag = chip.dataset.tag;
    state.filter = tag;
    localStorage.setItem(STORAGE.FILTER, tag);
    renderChips();
    render();
    haptic.select();
  });

  const tagChips = $('#tagChips');
  if (tagChips) {
    tagChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      const tag = chip.dataset.tag;
      if (state.selectedTags.has(tag)) {
        state.selectedTags.delete(tag);
      } else {
        state.selectedTags.add(tag);
      }
      localStorage.setItem(STORAGE.TAGS, JSON.stringify([...state.selectedTags]));
      renderTagChips();
      render();
      haptic.select();
    });
  }

  $('#list').addEventListener('click', async (e) => {
    // Favorite
    const favBtn = e.target.closest('.pr-fav');
    if (favBtn) {
      const id = favBtn.dataset.fav;
      toggleFav(id);
      const nowFav = isFav(id);
      favBtn.classList.toggle('is-fav', nowFav);
      favBtn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
      if (state.favsOnly && !nowFav) {
        const card = favBtn.closest('.pr');
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
    const p = state.prompts.find(x => x.id === id);
    if (!p) return;

    if (action === 'copy-prompt') {
      const ok = await copyText(p.text);
      if (ok) {
        haptic.success();
        act.classList.add('copied');
        showToast(`پرامپتِ «#${p.title}» کپی شد`);
        setTimeout(() => act.classList.remove('copied'), 1200);
      } else {
        showToast('کپی نشد — دستی امتحان کن');
      }
    } else if (action === 'download') {
      downloadPromptFile(p);
    } else if (action === 'share') {
      const text = `#${p.title} — رواق\n\n${p.text}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: `#${p.title}`, text });
        } catch (err) { /* user cancelled */ }
      } else {
        const ok = await copyText(text);
        if (ok) { haptic.success(); showToast('برای اشتراک کپی شد'); }
      }
    }
  });

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
async function loadPrompts() {
  const list = $('#list');
  list.innerHTML = '<div class="skel"></div><div class="skel"></div>';

  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('bad format');

    state.prompts = data
      .filter(p => p && p.id && p.title && p.text && p.image && GROUP_MAP[p.group])
      .map(p => ({
        id: p.id,
        group: p.group,
        title: String(p.title),
        text: String(p.text),
        note: p.note ? String(p.note) : '',
        tags: Array.isArray(p.tags) ? p.tags.map(t => String(t)) : [],
        image: `/prompts/${p.image}`,
      }));

    if (state.filter && !GROUP_MAP[state.filter]) {
      state.filter = '';
      localStorage.removeItem(STORAGE.FILTER);
    }

    $('#countPill').textContent = `${toPersian(state.prompts.length)} پرامپت`;

    renderChips();
    renderTagChips();
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
    $('#retryBtn').addEventListener('click', loadPrompts);
  }
}

/* ---------- Boot ---------- */
function boot() {
  initTheme();
  updateFavCount();
  renderChips();
  bindEvents();
  loadPrompts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}