/* experiences.js — فید اجتماعی «تجربه‌ها» (فاز ۰ تا ۲ نقشه‌راه). وابسته به window.PakarCore. */
(() => {
  'use strict';
  const C = () => window.PakarCore;
  const esc = s => C().esc(s), fa = n => C().fa(n), safe = u => C().safe(u), nz = s => C().nz(s);
  const TGW = () => window.Telegram && Telegram.WebApp;
  const $ = (s, r = document) => r.querySelector(s);
  const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
  const track = (n, o) => { try { C().phase3Track && C().phase3Track(n, o); } catch (_) {} };
  const haptic = (k = 'light') => { try { TGW().HapticFeedback.impactOccurred(k); } catch (_) {} };
  const hnote = k => { try { TGW().HapticFeedback.notificationOccurred(k); } catch (_) {} };
  const hsel = () => { try { TGW().HapticFeedback.selectionChanged(); } catch (_) {} };
  const SAVE_K = 'pakar.exp.saved', DRAFT_K = 'pakar.exp.draft', CACHE_K = 'pakar.exp.feed';
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  const IC = {
    vote: '<path d="m5 12.5 4.2 4.2L19 7"/>',
    seen: '<path d="M8 5v14M16 5v14"/>',
    warn: '<path d="M12 4 3 19h18z"/><path d="M12 10v4M12 17v.2"/>',
    save: '<path d="M6 4h12v16l-6-4-6 4z"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.3 4.3"/>',
    mine: '<path d="M5 4.5h14v15H5zM8 8h8M8 11.5h8M8 15h5"/>',
    reply: '<path d="M4 5h16v11H9l-5 4z"/>', send: '<path d="M20 4 10 14M20 4l-6 16-4-6-6-4z"/>', back: '<path d="m9 5 7 7-7 7"/>',
    success: '<path d="m5 12.5 4.2 4.2L19 7"/>', warning: '<path d="M12 4 3 19h18z"/><path d="M12 10v4"/>',
    tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 17v.2"/>'
  };
  const ico = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
  const TYPE = { success: 'تجربه موفق', warning: 'هشدار اجرایی', tip: 'نکته فنی', question: 'پرسش از جمع' };
  const TABS = [['foryou', 'برای تو'], ['new', 'تازه‌ها'], ['warning', 'هشدارها'], ['question', 'پرسش‌ها']];

  /* ---------- Store ---------- */
  const store = (() => {
    const items = new Map(), ls = new Set();
    return {
      load(list) { items.clear(); list.forEach(p => items.set(p.id, p)); },
      all: () => [...items.values()], get: id => items.get(id), has: id => items.has(id),
      patch(id, part) { const p = items.get(id); if (!p) return; Object.assign(p, part); ls.forEach(f => f(id, p)); },
      on: f => ls.add(f)
    };
  })();

  const st = { data: null, mine: [], loading: false, failed: false, tab: 'foryou', q: '', search: false, saved: false, savedSet: new Set(lsGet(SAVE_K, [])), focus: null, fresh: 0, pending: null, io: null, lastY: 0, supportsReact: false };

  /* ---------- زمان و مرتب‌سازی ---------- */
  const ts = x => { const t = Date.parse(x.created_at || ''); return isNaN(t) ? 0 : t; };
  const ago = x => {
    const t = ts(x); if (!t) return esc((x.created_at || '').slice(0, 10));
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return 'هم‌اکنون'; if (m < 60) return fa(m) + ' دقیقه پیش';
    const h = Math.round(m / 60); if (h < 24) return fa(h) + ' ساعت پیش';
    const d = Math.round(h / 24); if (d < 30) return fa(d) + ' روز پیش'; return esc((x.created_at || '').slice(0, 10));
  };
  /* امتیاز «برای تو»: (رأی مفید + ۲×تأیید مستقل) ÷ (۱ + عمر به هفته)؛ شفاف و بدون وزن پنهان */
  const score = x => ((Number(x.votes) || 0) + 2 * (Number((x.reactions || {}).seen) || 0) + 1) / (1 + (Date.now() - ts(x)) / 6048e5);
  const rows = () => {
    const all = store.all(), q = nz(st.q);
    let r = st.saved ? all.filter(x => st.savedSet.has(x.id)) : all.filter(x => st.tab === 'warning' ? x.type === 'warning' : st.tab === 'question' ? x.type === 'question' : true);
    if (q) r = r.filter(x => nz([x.title, x.material, x.details, x.context, x.user, x.username].join(' ')).includes(q));
    if (st.tab === 'new' && !st.saved) r.sort((a, b) => ts(b) - ts(a));
    else r.sort((a, b) => (!!b.featured - !!a.featured) || score(b) - score(a));
    return r;
  };
  const tabCount = k => { const a = store.all(); return k === 'warning' ? a.filter(x => x.type === 'warning').length : k === 'question' ? a.filter(x => x.type === 'question').length : a.length; };

  /* ---------- رندر ---------- */
  const avatar = (x, cls = '') => `<span class="exp-av ${cls}" aria-hidden="true">${x.author_photo_url && safe(x.author_photo_url) ? `<img src="${esc(safe(x.author_photo_url))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : esc((String(x.user || 'پ').trim()[0]) || 'پ')}</span>`;
  const num = n => `<span class="exp-num"><span>${fa(n)}</span></span>`;
  const rxBtn = (kind, icon, on, n, label, extra = '') => `<button type="button" class="exp-rx ${on ? 'on' : ''}" data-exp="${kind}" aria-pressed="${!!on}" aria-label="${label}">${ico(icon)}${n == null ? '' : num(n)}<span class="exp-burst" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<i style="--i:${i}"></i>`).join('')}</span>${extra}</button>`;
  const actions = x => {
    const r = x.reactions || {}, saved = st.savedSet.has(x.id);
    return `<div class="exp-actions">${rxBtn('vote', 'vote', x.voted, x.votes || 0, 'مفید بود')}${rxBtn('reply', 'reply', false, x.reply_count || 0, 'پاسخ')}${st.supportsReact ? rxBtn('react-seen', 'seen', x.my_reaction === 'seen', r.seen || 0, 'من هم دیدم') + rxBtn('react-warn', 'warn', x.my_reaction === 'warn', r.warn || 0, 'هشدار جدی') : ''}<span class="exp-grow"></span>${rxBtn('save', 'save', saved, null, 'ذخیره')}${rxBtn('share', 'share', false, null, 'اشتراک‌گذاری')}</div>`;
  };
  const idxOf = x => fa(store.all().length - store.all().indexOf(x));
  const post = x => {
    const t = TYPE[x.type] ? x.type : 'success', rp = (x.reply_preview || []).slice(0, 3);
    return `<article class="exp-post exp-${t}" data-post="${esc(x.id)}" role="article"><div class="exp-phead"><span class="exp-mark">${ico(t)}</span><div class="exp-ptitle"><b>${TYPE[t]}</b><small>${esc(x.material || 'مصالح ساختمانی')}</small></div><span class="exp-idx">${x.featured ? 'سنجاق' : 'یادداشت ' + idxOf(x)}</span></div><div class="exp-author">${avatar(x, 'sm')}<span class="exp-name">${esc(x.user || 'کاربر پاکار')}</span>${x.expert_verified ? '<span class="exp-badge">✓ تخصص بررسی‌شده</span>' : ''}<span class="exp-time">${ago(x)}</span></div><h3 class="exp-title" data-exp="open">${esc(x.title)}</h3><p class="exp-body">${esc(x.details || '')}</p>${x.photo_url && safe(x.photo_url) ? `<a class="exp-photo" data-stop href="${esc(safe(x.photo_url))}" target="_blank" rel="noopener"><img src="${esc(safe(x.photo_url))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></a>` : ''}${x.context ? `<div class="exp-tags"><span>شرایط: <b>${esc(x.context)}</b></span></div>` : ''}${x.reply_count ? `<button type="button" class="exp-replies" data-exp="open"><span class="exp-stack">${rp.map(r => avatar({ user: r.user, author_photo_url: r.photo }, 'sm')).join('')}</span>${fa(x.reply_count)} پاسخ · گفتگو را ببین</button>` : ''}${actions(x)}</article>`;
  };
  const skeleton = () => Array(3).fill('<div class="exp-skel" aria-hidden="true"><i></i><div><b></b><b></b><b></b></div></div>').join('');
  const wall = `<svg class="exp-wall" viewBox="0 0 120 72" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(n => `<rect style="--n:${n}" x="${(n % 3) * 38 + (Math.floor(n / 3) ? 19 : 0)}" y="${(1 - Math.floor(n / 3)) * 24 + 12}" width="36" height="22" rx="3"/>`).join('')}</svg>`;
  const emptyHTML = () => st.failed ? `<div class="exp-empty"><h3>برای مشاهده تجربه‌ها وارد تلگرام شو</h3><p>نمایش و ثبت تجربه‌ها از طریق نسخه‌ی تلگرامی پاکار و ارتباط با سرور انجام می‌شود.</p><button type="button" class="exp-cta" data-exp="reload">تلاش دوباره</button></div>`
    : store.all().length ? `<div class="exp-empty"><h3>تجربه‌ای پیدا نشد</h3><p>${st.saved ? 'هنوز چیزی ذخیره نکرده‌ای.' : 'عبارت جست‌وجو یا تب انتخاب‌شده را تغییر بده.'}</p><button type="button" class="exp-cta" data-exp="reset">پاک‌کردن فیلتر</button></div>`
    : `<div class="exp-empty">${wall}<h3>اولین دیوار را تو بچین</h3><p>هنوز تجربه‌ای منتشر نشده. یک گزارش دقیق از اجرا، نتیجه و شرایط پروژه به جامعه کمک می‌کند.</p><button type="button" class="exp-cta" data-exp="compose">ثبت اولین تجربه</button></div>`;

  const shell = () => `<section class="exp" id="exp" style="--exp-sticky:${($('.app-bar') || {}).offsetHeight || 0}px"><div class="exp-top ${st.search ? 'is-search' : ''}" id="expTop"><h2>تجربه‌ها</h2><div class="exp-searchbar"><input type="search" id="expQ" data-exp-q value="${esc(st.q)}" placeholder="جست‌وجو در تجربه‌ها و مصالح…" aria-label="جست‌وجو"><button type="button" class="exp-ibtn" data-exp="search-close" aria-label="بستن جست‌وجو"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><button type="button" class="exp-ibtn hide-on-search" data-exp="search" aria-label="جست‌وجو">${ico('search')}</button><button type="button" class="exp-ibtn hide-on-search" data-exp="mine" aria-label="ارسال‌های من">${ico('mine')}</button><button type="button" class="exp-ibtn hide-on-search" data-exp="saved" aria-pressed="${st.saved}" aria-label="ذخیره‌شده‌ها">${ico('save')}</button></div><section class="exp-hero"><div class="exp-grid"></div><div><div class="exp-kick"><i></i>FIELD NOTES / ${fa(store.all().length)}</div><h2>تجربه‌هایی از <em>دلِ کارگاه</em></h2><p>گزارش اجرا، هشدار و پرسش؛ با پاسخ و تجربه‌ی بقیه‌ی همکاران.</p></div><i class="exp-tile a"></i><i class="exp-tile b"></i><i class="exp-tile c"></i><div class="exp-level"><i></i><span>${fa(store.all().length)} یادداشت</span><span>·</span><span>${fa(store.all().filter(x => x.expert_verified).length)} تخصص‌دار</span></div></section><div class="exp-tabs" id="expTabs" role="tablist"></div><button type="button" class="exp-composer" data-exp="compose"><span class="exp-av sm">+</span><span class="t">تجربه‌ات از کارگاه چیه؟</span><b>ثبت</b></button><div id="expPill"></div><div class="exp-feed" id="expFeed" role="feed" aria-busy="${st.loading}"></div><div class="exp-sentinel"></div><p class="exp-note">تجربه شخصی جایگزین دیتاشیت یا تأیید طراح مسئول نیست.</p></section>`;

  function paintTabs() {
    const el = $('#expTabs'); if (!el) return;
    el.innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" class="exp-tab" data-exp="tab" data-k="${k}" aria-selected="${!st.saved && st.tab === k}">${l}${store.all().length ? `<small>${fa(tabCount(k))}</small>` : ''}</button>`).join('') + '<i class="exp-ink"></i>';
    inkMove(false);
  }
  function inkMove() {
    const el = $('#expTabs'), cur = el && el.querySelector('[aria-selected=true]'), ink = el && el.querySelector('.exp-ink'); if (!ink) return;
    if (!cur) { ink.style.opacity = 0; return; } ink.style.opacity = 1;
    const rtl = getComputedStyle(el).direction === 'rtl', x = rtl ? -(el.clientWidth - cur.offsetLeft - cur.offsetWidth) : cur.offsetLeft;
    ink.style.width = cur.offsetWidth + 'px'; ink.style.transform = `translateX(${x}px)`;
  }
  function paintFeed(fade) {
    const el = $('#expFeed'); if (!el) return;
    el.setAttribute('aria-busy', st.loading);
    if (st.loading && !store.all().length) { el.innerHTML = skeleton(); return; }
    const r = rows(); el.innerHTML = r.length ? r.map(post).join('') : emptyHTML();
    el.querySelectorAll('.exp-post').forEach((n, i) => { n.setAttribute('aria-posinset', i + 1); n.setAttribute('aria-setsize', r.length); });
    reveal(el); paintTabs(); const lv = $('.exp-level'); if (lv) lv.innerHTML = `<i></i><span>${fa(store.all().length)} یادداشت</span><span>·</span><span>${fa(store.all().filter(x => x.expert_verified).length)} تخصص‌دار</span>`;
    if (fade && !reduced()) el.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 120 });
    if (st.focus) { const n = el.querySelector(`[data-post="${CSS.escape(st.focus)}"]`); if (n) { n.classList.add('in', 'is-flash'); n.scrollIntoView({ block: 'center' }); } else if (!st.loading) toast('این تجربه در دسترس نیست'); st.focus = null; }
  }
  function reveal(root) {
    if (st.io) st.io.disconnect();
    const list = [...root.querySelectorAll('.exp-post:not(.in)')];
    if (!('IntersectionObserver' in window) || reduced()) { list.forEach(n => n.classList.add('in')); return; }
    let k = 0;
    st.io = new IntersectionObserver(es => { es.forEach(e => { if (!e.isIntersecting) return; e.target.style.setProperty('--d', Math.min(k++, 5) * 40 + 'ms'); e.target.classList.add('in'); st.io.unobserve(e.target); }); k = 0; }, { rootMargin: '0px 0px -8% 0px' });
    list.forEach(n => st.io.observe(n));
  }
  const toast = t => C().toast(t);

  /* ---------- بارگذاری ---------- */
  async function load(silent) {
    if (st.loading) return; st.loading = true; st.failed = false;
    if (!silent && !store.all().length) { try { const c = JSON.parse(sessionStorage.getItem(CACHE_K) || 'null'); if (c && c.items) { store.load(c.items); st.mine = c.mine || []; st.supportsReact = c.items.some(x => x.reactions); } } catch (_) {} }
    try {
      const r = await C().api('community');
      if (!r || !r.ok) throw new Error('bad');
      const items = r.items || []; store.load(items); st.mine = r.mine || []; st.supportsReact = items.some(x => x.reactions);
      try { sessionStorage.setItem(CACHE_K, JSON.stringify({ items, mine: st.mine })); } catch (_) {}
      st.data = true; try { C().S.communityData = r; } catch (_) {}
    } catch (e) { if (!store.all().length) st.failed = true; }
    st.loading = false; paintFeed(); track('exp_view', { n: store.all().length });
  }
  async function poll() {
    if (document.hidden || C().S.tab !== 'community' || !$('#exp') || st.loading) return;
    try {
      const r = await C().api('community'); if (!r || !r.ok) return;
      const fresh = (r.items || []).filter(x => !store.has(x.id)).length;
      if (fresh && fresh !== st.fresh) { st.fresh = fresh; st.pending = r; const p = $('#expPill'); if (p) p.innerHTML = `<button type="button" class="exp-pill" data-exp="fresh" aria-live="polite">${fa(fresh)} تجربه‌ی تازه ↑</button>`; }
    } catch (_) {}
  }
  setInterval(poll, 60000);

  /* ---------- نمای اصلی (فراخوانی از render) ---------- */
  function view() {
    if (!st.data && !st.loading) setTimeout(load, 0);
    else setTimeout(() => { paintFeed(); }, 0);
    setTimeout(() => { paintFeed(); bindScroll(); }, 0);
    return shell();
  }
  function bindScroll() {
    if (bindScroll.on) return; bindScroll.on = true;
    addEventListener('scroll', () => {
      const top = $('#expTop'); if (!top) return; const y = scrollY;
      top.classList.toggle('is-hidden', y > st.lastY + 6 && y > 140 && !st.search); if (y < st.lastY - 6 || y < 140) top.classList.remove('is-hidden'); st.lastY = y;
    }, { passive: true });
  }

  /* ---------- واکنش‌ها (Optimistic UI) ---------- */
  function rerender(id, anim) {
    const p = store.get(id); if (!p) return;
    document.querySelectorAll(`[data-post="${CSS.escape(id)}"] .exp-actions`).forEach(n => {
      const tmp = document.createElement('div'); tmp.innerHTML = actions(p); const nw = tmp.firstChild; n.replaceWith(nw);
      if (anim) { const b = nw.querySelector(`[data-exp="${anim}"]`); if (b && !reduced()) { b.classList.add('is-pop'); const w = b.querySelector('.exp-num'); if (w) w.classList.add('roll'); setTimeout(() => b.classList.remove('is-pop'), 600); } }
    });
  }
  store.on(() => {});
  async function react(id, kind) {
    const p = store.get(id); if (!p || p.pending) return;
    const snap = { voted: p.voted, votes: p.votes, my_reaction: p.my_reaction, reactions: { ...(p.reactions || {}) } };
    if (kind === 'vote') { if (p.voted) return toast('رأی مفید قبلاً ثبت شده'); store.patch(p.id, { voted: true, votes: (p.votes || 0) + 1, pending: true }); }
    else { const r = { ...(p.reactions || {}) }, old = p.my_reaction; if (old) r[old] = Math.max(0, (r[old] || 0) - 1); const nw = old === kind ? null : kind; if (nw) r[nw] = (r[nw] || 0) + 1; store.patch(p.id, { my_reaction: nw, reactions: r, pending: true }); }
    rerender(id, kind === 'vote' ? 'vote' : 'react-' + kind); haptic('light'); track('exp_vote', { kind });
    try {
      const r = await C().api('community', { method: 'POST', body: JSON.stringify(kind === 'vote' ? { action: 'vote', id } : { action: 'react', id, kind }) });
      if (!r || !r.ok) throw new Error((r && r.error) || 'x');
      store.patch(id, { pending: false, ...(typeof r.votes === 'number' ? { votes: r.votes } : {}) }); if (typeof r.votes === 'number') rerender(id);
    } catch (e) { store.patch(id, { ...snap, pending: false }); rerender(id); toast('ثبت نشد؛ دوباره تلاش کن'); hnote('error'); }
  }
  function toggleSave(id) {
    st.savedSet.has(id) ? st.savedSet.delete(id) : st.savedSet.add(id); lsSet(SAVE_K, [...st.savedSet]); haptic('light');
    rerender(id, 'save'); if (st.saved && !st.savedSet.has(id)) setTimeout(() => paintFeed(), 220); else toast(st.savedSet.has(id) ? 'ذخیره شد' : 'از ذخیره‌شده‌ها برداشته شد');
  }
  function share(id) {
    const p = store.get(id); if (!p) return; const S = C().S, url = `https://t.me/${S.bot}?startapp=exp_${encodeURIComponent(id)}`;
    const u = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(p.title || 'تجربه‌ای از کارگاه');
    const g = TGW(); g && g.openTelegramLink ? g.openTelegramLink(u) : window.open(u, '_blank'); track('exp_open', { via: 'share' });
  }
  /* لمس طولانی روی «مفید» → انتخاب واکنش (فقط وقتی سرور واکنش‌ها را پشتیبانی کند) */
  let lp = null, lpFired = false;
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.exp-rx[data-exp="vote"]'); if (!b || !st.supportsReact) return; lpFired = false;
    lp = setTimeout(() => { lpFired = true; haptic('medium'); closePicker(); const id = b.closest('[data-post]').dataset.post; b.insertAdjacentHTML('beforebegin', `<div class="exp-picker" role="menu"><button type="button" data-exp="pick" data-kind="vote" data-id="${esc(id)}" aria-label="مفید">${ico('vote')}</button><button type="button" data-exp="pick" data-kind="seen" data-id="${esc(id)}" aria-label="من هم دیدم">${ico('seen')}</button><button type="button" data-exp="pick" data-kind="warn" data-id="${esc(id)}" aria-label="هشدار جدی">${ico('warn')}</button></div>`); }, 350);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach(ev => document.addEventListener(ev, () => { clearTimeout(lp); }, { passive: true }));
  const closePicker = () => document.querySelectorAll('.exp-picker').forEach(n => n.remove());

  /* ---------- رویدادها ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-exp]'); if (!t) { closePicker(); return; }
    if (lpFired && t.dataset.exp === 'vote') { lpFired = false; return; }
    const k = t.dataset.exp, id = (t.closest('[data-post]') || {}).dataset ? t.closest('[data-post]').dataset.post : t.dataset.id;
    if (k !== 'pick') closePicker();
    switch (k) {
      case 'vote': case 'react-seen': case 'react-warn': return react(id, k === 'vote' ? 'vote' : k.slice(6));
      case 'pick': closePicker(); return react(t.dataset.id, t.dataset.kind);
      case 'save': return toggleSave(id);
      case 'share': return share(id);
      case 'tab': st.tab = t.dataset.k; st.saved = false; hsel(); syncTop(); paintFeed(true); return;
      case 'saved': st.saved = !st.saved; t.setAttribute('aria-pressed', st.saved); hsel(); paintFeed(true); return;
      case 'search': st.search = true; $('#expTop').classList.add('is-search'); setTimeout(() => { const i = $('#expQ'); i && i.focus(); }, 30); return;
      case 'search-close': st.search = false; st.q = ''; $('#expTop').classList.remove('is-search'); paintFeed(true); return;
      case 'reset': st.q = ''; st.saved = false; st.tab = 'foryou'; C().render(); return;
      case 'reload': st.failed = false; st.data = null; C().render(); return;
      case 'fresh': { const r = st.pending; if (r) { store.load(r.items || []); st.supportsReact = (r.items || []).some(x => x.reactions); } st.fresh = 0; st.pending = null; const p = $('#expPill'); if (p) p.innerHTML = ''; paintFeed(); scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
      case 'reply': case 'open': return openThread(id);
      case 'compose': return compose();
      case 'mine': return mine();
      case 'draft-clear': lsSet(DRAFT_K, null); return C().closeSheet();
    }
  });
  const syncTop = () => { const t = $('#expTop'); if (t) t.classList.remove('is-hidden'); };
  let qt; document.addEventListener('input', e => {
    if (e.target.matches && e.target.matches('[data-exp-q]')) { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { st.q = v; paintFeed(); }, 180); }
    if (e.target.closest && e.target.closest('#expForm')) saveDraft();
  });
  addEventListener('resize', () => inkMove());

  /* ---------- ثبت تجربه (فرم موجود + انتخاب مصالح از کاتالوگ + پیش‌نویس) ---------- */
  const v = id => (document.getElementById(id) || {}).value || '';
  function saveDraft() { lsSet(DRAFT_K, { type: v('cmType'), title: v('cmTitle'), material: v('cmMaterial'), context: v('cmContext'), photo: v('cmPhoto'), details: v('cmDetails') }); }
  function compose() {
    const g = C(), d = lsGet(DRAFT_K, null) || {}, names = [...new Set((g.D.companies || []).flatMap(c => [c.name, ...(c.products || []).map(p => p.name)]).filter(Boolean))].slice(0, 400);
    const U = g.TG_USER || {}, who = [U.first_name, U.last_name].filter(Boolean).join(' ') || 'حساب تلگرام تو';
    g.sheet(`<div id="expForm"><h3>ثبت تجربه‌ی اجرایی</h3><label class="fl"><span>نوع تجربه</span><select id="cmType">${Object.entries(TYPE).map(([k, l]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fl"><span>عنوان تجربه</span><input id="cmTitle" maxlength="120" value="${esc(d.title || '')}" placeholder="مثلاً اجرای عایق در سرویس"></label><label class="fl"><span>مصالح / سامانه (از کاتالوگ انتخاب کن یا بنویس)</span><input id="cmMaterial" maxlength="120" list="expMats" value="${esc(d.material || '')}" placeholder="نام مصالح یا سامانه"><datalist id="expMats">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label><label class="fl"><span>شرح تجربه (حداقل ۲۰ حرف)</span><textarea id="cmDetails" rows="6" maxlength="2500" placeholder="چه چیزی اجرا شد، چه نتیجه‌ای دیدی و محدودیت‌ها چه بود؟">${esc(d.details || '')}</textarea></label><label class="fl"><span>شرایط پروژه (اختیاری)</span><input id="cmContext" maxlength="500" value="${esc(d.context || '')}" placeholder="اقلیم، زیرکار، شرایط اجرا"></label><label class="fl"><span>لینک عکس پروژه (اختیاری، HTTPS)</span><input id="cmPhoto" maxlength="500" value="${esc(d.photo || '')}" placeholder="لینک عمومی عکس، بدون اطلاعات محرمانه"></label><p class="hint">این تجربه با هویت حساب تلگرام ثبت می‌شود: <b>${esc(who)}</b>. اطلاعات شخصی یا محرمانه‌ی کارفرما را وارد نکن. انتشار پس از بررسی مدیر انجام می‌شود. پیش‌نویس به‌صورت خودکار نگه‌داشته می‌شود.</p><div class="sd-bar"><button class="act" data-exp="draft-clear">انصراف و حذف پیش‌نویس</button><button class="act act-primary" id="expSend" data-exp-send>ارسال برای بررسی</button></div></div>`);
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-exp-send]'); if (!b || b.disabled) return;
    const body = { type: v('cmType') || 'success', title: v('cmTitle'), material: v('cmMaterial'), context: v('cmContext'), photo_url: v('cmPhoto'), author_photo_url: C().profilePhoto, details: v('cmDetails') };
    b.disabled = true;
    try {
      const r = await C().api('community', { method: 'POST', body: JSON.stringify(body) });
      if (r && r.ok) { lsSet(DRAFT_K, null); C().closeSheet(); hnote('success'); toast(r.message || 'برای بررسی ثبت شد'); track('exp_submit'); load(true); }
      else { hnote('error'); toast((r && r.error) || 'ثبت انجام نشد'); b.disabled = false; }
    } catch (_) { hnote('error'); toast('خطا در ثبت تجربه؛ متن شما در پیش‌نویس می‌ماند'); b.disabled = false; }
  });

  /* ---------- ارسال‌های من ---------- */
  async function mine() {
    if (!st.data) await load(true);
    const m = (st.mine || []).slice().reverse(), lab = s => s === 'approved' ? 'منتشرشده' : s === 'rejected' ? 'نیازمند اصلاح' : 'در انتظار بررسی';
    C().sheet(`<h3>ارسال‌های من</h3>${m.length ? `<div class="exp-mine">${m.map(x => `<div class="exp-mine-row"><b>${esc(x.title)}</b><small>${lab(x.status)} · ${esc(x.material || 'مصالح ساختمانی')}</small>${x.status === 'rejected' && x.rejection_reason ? `<p>دلیل بازگشت: ${esc(x.rejection_reason)}</p>` : ''}</div>`).join('')}</div>` : '<p class="hint">هنوز ارسالی ثبت نکرده‌ای.</p>'}<div class="sd-bar"><button class="act act-primary" data-exp="compose">ثبت تجربه‌ی جدید</button></div>`);
  }

  /* ---------- مدیریت (بدون prompt) ---------- */
  async function admin() {
    try {
      const r = await C().api('community-admin'); if (!r.ok) return toast(r.error || 'دسترسی ندارید');
      const rows = (r.items || []).filter(x => x.status === 'pending' || x.status === 'approved');
      C().sheet(`<h3>مدیریت تجربه‌ها</h3>${rows.length ? rows.map(x => `<div class="ln"><h4><span>${esc(x.title)}</span><em>${x.status === 'approved' ? 'منتشرشده' : 'در انتظار بررسی'}</em></h4><p>${esc(x.details)}</p><small>${esc(x.user || 'کاربر')} · ${esc(x.id)}</small><div class="ft">${x.status === 'pending' ? `<button class="act act-primary" data-adm="approve" data-id="${esc(x.id)}">تأیید انتشار</button><button class="act" data-adm="reject" data-id="${esc(x.id)}">رد</button>` : `<button class="act ${x.expert_verified ? 'act-primary' : ''}" data-adm="expert" data-id="${esc(x.id)}">${x.expert_verified ? 'لغو نشان کارشناس' : 'تأیید تخصص (فقط پس از بررسی مدرک)'}</button>`}<button class="act" data-adm="delete" data-id="${esc(x.id)}">حذف</button></div></div>`).join('') : '<p class="hint">موردی برای بررسی نیست.</p>'}`);
    } catch (_) { toast('خطا در دریافت ارسال‌ها'); }
  }
  async function review(id, action, reason) {
    try { const r = await C().api('community-admin', { method: 'POST', body: JSON.stringify({ id, action, reason: reason || '' }) }); if (r.ok) { C().closeSheet(); toast('وضعیت ارسال به‌روزرسانی شد'); load(true); } else toast(r.error || 'عملیات انجام نشد'); } catch (_) { toast('ارتباط با سرور برقرار نشد'); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-adm]'); if (!b) return; const id = b.dataset.id, a = b.dataset.adm;
    if (a === 'reject') return C().sheet(`<h3>دلیل رد</h3><label class="fl"><span>پیامی که به نویسنده نشان داده می‌شود (اختیاری)</span><textarea id="expReason" rows="4" maxlength="300"></textarea></label><div class="sd-bar"><button class="act" data-adm-back>بازگشت</button><button class="act act-primary" data-adm-reject data-id="${esc(id)}">ثبت رد</button></div>`);
    review(id, a);
  });
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('[data-adm-back]')) return admin();
    const b = e.target.closest && e.target.closest('[data-adm-reject]'); if (b) review(b.dataset.id, 'reject', v('expReason'));
  });

  /* ---------- گفتگو و پاسخ‌ها (قرارداد API: بخش ۷ نقشه‌راه) ---------- */
  const th = { id: null, replies: [], to: null, busy: false, err: null };
  const QUICK = ['من هم همین را دیدم', 'کدام برند؟', 'چه ضخامتی؟', 'چند وقت بعد؟'];
  const mention = t => esc(t).replace(/(^|\s)@([\w\u0600-\u06FF]+)/g, '$1<span class="m">@$2</span>');
  const replyHTML = (r, i) => `<div class="exp-reply ${r.pending ? 'is-pending' : ''} ${r.fresh ? 'is-new' : ''}" data-rid="${esc(r.id)}" style="--r:${i}"><div class="rail">${avatar(r, 'sm')}</div><div><div class="exp-rtop"><b>${esc(r.user || 'کاربر پاکار')}</b>${r.is_author ? '<span class="exp-own">نویسنده</span>' : ''}${r.expert_verified ? '<span class="exp-badge">✓ تخصص</span>' : ''}<small>${ago(r)}</small></div><p class="exp-rtext">${mention(r.text || '')}</p>${r.pending ? '' : `<div class="exp-ract"><button type="button" data-exp="reply-to" data-u="${esc(r.username || r.user || '')}" data-rid="${esc(r.id)}">پاسخ</button><button type="button" data-exp="report" data-rid="${esc(r.id)}">گزارش</button></div>`}</div></div>`;
  const send = () => `<svg viewBox="0 0 24 24">${IC.send}</svg>`;
  function paintReplies() {
    const el = $('#expReplies'); if (!el) return;
    el.innerHTML = th.err ? `<div class="exp-th-empty">${esc(th.err)}<br><button type="button" class="exp-cta" data-exp="th-retry">تلاش دوباره</button></div>`
      : th.replies.length ? th.replies.map(replyHTML).join('') : '<div class="exp-th-empty">هنوز پاسخی نیست. اولین نفری باش که تجربه‌ی خودش را اضافه می‌کند.</div>';
    const h = $('#expThCount'); if (h) h.textContent = `گفتگو · ${fa(th.replies.length)} پاسخ`;
  }
  async function loadThread() {
    th.err = null; const el = $('#expReplies'); if (el) el.innerHTML = skeleton();
    try { const r = await C().api('community-thread?id=' + encodeURIComponent(th.id)); if (!r || !r.ok) throw new Error('x'); th.replies = r.replies || []; store.patch(th.id, { reply_count: th.replies.length }); }
    catch (e) { th.replies = []; th.err = 'گفتگو در دسترس نیست. اتصال یا نسخه‌ی سرور را بررسی کن.'; }
    paintReplies();
  }
  function openThread(id) {
    const p = store.get(id); if (!p) return; closeThread(true); th.id = id; th.last = id; th.to = null; track('exp_open', { via: 'thread' });
    const d = document.createElement('div'); d.className = 'exp-thread'; d.id = 'expThread'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'گفتگو');
    d.innerHTML = `<div class="exp-th-bar"><button type="button" class="exp-ibtn" data-exp="th-close" aria-label="بازگشت"><svg viewBox="0 0 24 24">${IC.back}</svg></button><h3 id="expThCount">گفتگو</h3></div><div class="exp-th-scroll"><div id="expThPost">${post(p).replace('exp-post ', 'exp-post in ')}</div><div class="exp-th-head">پاسخ‌ها</div><div id="expReplies"></div></div><div class="exp-reply-bar"><div class="exp-chips">${QUICK.map(q => `<button type="button" data-exp="quick" data-t="${esc(q)}">${q}</button>`).join('')}</div><div id="expReplying"></div><div class="exp-rrow"><textarea id="expRText" rows="1" maxlength="800" placeholder="تجربه یا پاسخ خودت را بنویس…" aria-label="متن پاسخ"></textarea><button type="button" class="exp-send" id="expSendR" data-exp="send-reply" aria-label="ارسال پاسخ" disabled>${send()}</button></div><div class="exp-cnt" id="expRCnt">۰ / ۸۰۰</div></div>`;
    document.body.appendChild(d); document.body.classList.add('locked'); requestAnimationFrame(() => d.classList.add('open'));
    try { const b = TGW().BackButton; b.show(); b.onClick(thBack); } catch (_) {}
    loadThread();
  }
  const thBack = () => closeThread();
  function closeThread(instant) {
    const d = $('#expThread'); if (!d) return; th.id = null; try { const b = TGW().BackButton; b.offClick(thBack); b.hide(); } catch (_) {}
    document.body.classList.remove('locked'); if (instant || reduced()) d.remove(); else { d.classList.remove('open'); setTimeout(() => d.remove(), 260); }
    const id = th.last; if (id) rerenderPost(id);
  }
  function rerenderPost(id) { const n = $(`#expFeed [data-post="${CSS.escape(id)}"]`), p = store.get(id); if (n && p) { const t = document.createElement('div'); t.innerHTML = post(p).replace('exp-post ', 'exp-post in '); n.replaceWith(t.firstChild); } }
  async function sendReply() {
    const ta = $('#expRText'), text = (ta.value || '').trim(); if (text.length < 2 || th.busy || !th.id) return;
    const id = th.id, U = C().TG_USER || {}, tmp = { id: 'tmp' + Date.now(), user: [U.first_name, U.last_name].filter(Boolean).join(' ') || 'من', username: U.username || '', author_photo_url: C().profilePhoto, text, created_at: new Date().toISOString(), pending: true, fresh: true };
    th.busy = true; th.replies.push(tmp); th.err = null; paintReplies(); ta.value = ''; autoGrow(ta); setReplying(null);
    const sc = $('.exp-th-scroll'); if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' }); haptic('light');
    try {
      const r = await C().api('community', { method: 'POST', body: JSON.stringify({ action: 'reply', id, text, reply_to: th.to || undefined }) });
      if (!r || !r.ok) throw new Error((r && r.error) || 'x');
      const i = th.replies.indexOf(tmp); if (i >= 0) th.replies[i] = { ...tmp, ...(r.reply || {}), pending: false };
      store.patch(id, { reply_count: th.replies.length }); th.last = id; hnote('success'); track('exp_reply');
    } catch (e) { th.replies = th.replies.filter(x => x !== tmp); ta.value = text; autoGrow(ta); toast((e && e.message && e.message !== 'x') ? e.message : 'ارسال نشد؛ متن شما نگه داشته شد'); hnote('error'); }
    th.busy = false; th.to = null; paintReplies(); autoGrow(ta);
  }
  function setReplying(u) { th.to = u ? u.rid : null; const el = $('#expReplying'); if (el) el.innerHTML = u ? `<div class="exp-replying"><span>پاسخ به ${esc(u.name)}</span><button type="button" data-exp="reply-cancel" aria-label="لغو">✕</button></div>` : ''; }
  function autoGrow(ta) { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; const n = ta.value.length, c = $('#expRCnt'), b = $('#expSendR'); if (c) c.textContent = `${fa(n)} / ۸۰۰`; if (b) b.disabled = ta.value.trim().length < 2 || th.busy; }
  document.addEventListener('input', e => { if (e.target.id === 'expRText') autoGrow(e.target); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#expThread')) closeThread(); });
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-exp]'); if (!t) return; const k = t.dataset.exp;
    if (k === 'th-close') return closeThread();
    if (k === 'th-retry') return loadThread();
    if (k === 'send-reply') return sendReply();
    if (k === 'reply-cancel') return setReplying(null);
    if (k === 'quick') { const ta = $('#expRText'); ta.value = (ta.value ? ta.value + ' ' : '') + t.dataset.t; ta.focus(); return autoGrow(ta); }
    if (k === 'reply-to') { const ta = $('#expRText'), u = t.dataset.u; setReplying({ rid: t.dataset.rid, name: u || 'کاربر' }); if (u && !ta.value.includes('@' + u)) ta.value = '@' + u.replace(/\s+/g, '_') + ' ' + ta.value; ta.focus(); return autoGrow(ta); }
    if (k === 'report') { try { const r = await C().api('community', { method: 'POST', body: JSON.stringify({ action: 'report', id: th.id, reply_id: t.dataset.rid, reason: 'user_report' }) }); toast(r && r.ok ? 'گزارش ثبت شد؛ ممنون' : 'گزارش ثبت نشد'); } catch (_) { toast('گزارش ثبت نشد'); } }
  });

  /* ---------- لینک عمیق: startapp=exp_<id> ---------- */
  try { const sp = TGW() && TGW().initDataUnsafe && TGW().initDataUnsafe.start_param; if (sp && /^exp_/.test(sp)) { st.focus = decodeURIComponent(sp.slice(4)); (window.PakarCore ? C().S : { }).tab = 'community'; } } catch (_) {}

  window.PakarExperiences = { openThread, view, compose, mine, admin, reload: () => load(true), store };
})();
