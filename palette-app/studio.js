/* ============================================================
   رواق — استودیو چیدمان (قالب خام برای هر دسته فضا)
   وابستگی: script.js (state, copyText, showToast, haptic, textColor)
   ============================================================ */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  // نقش‌ها → ایندکس رنگ در پالت (۰ تیره‌ترین … ۴ روشن‌ترین)  |  P = رنگ تأکیدی (پراشباع‌ترین)
  const AUTO = { L1: 4, L2: 3, M: 2, D: 1, K: 0 };
  const POOL = { L1: [3, 4], L2: [2, 3, 4], M: [1, 2, 3], D: [0, 1, 2], K: [0, 1], P: [0, 1, 2, 3, 4] };
  const L = (id, name, role, html) => ({ id, name, role, html });
  const S = (html) => ({ id: null, html }); // لایه ثابت (سایه و جزئیات)

  const SIDE = '<path d="M0 0L60 50V200L0 300Z"/><path d="M400 0L340 50V200L400 300Z"/>';
  const ROOM = [
    L('ceiling', 'سقف', 'L1', '<path d="M0 0H400L340 50H60Z"/>'),
    L('side', 'دیوارهای کناری', 'L2', SIDE),
    S(`<g fill="#000" opacity=".10">${SIDE}</g>`),
  ];

  const TPL = {
    living: {
      name: 'نشیمن',
      avoid: [['sofa', 'floor'], ['sofa', 'wall'], ['wall', 'floor'], ['sofa', 'rug'], ['rug', 'floor']],
      layers: [
        ...ROOM,
        L('wall', 'دیوار اصلی', 'L1', '<rect x="60" y="50" width="280" height="150"/>'),
        L('panel', 'پنل تلویزیون', 'D', '<rect x="140" y="78" width="120" height="76"/>'),
        S('<rect x="162" y="94" width="76" height="44" rx="2" fill="#000" opacity=".55"/>'),
        L('curtain', 'پرده', 'P', '<rect x="66" y="50" width="38" height="150"/><rect x="296" y="50" width="38" height="150"/>'),
        L('floor', 'کف', 'M', '<path d="M60 200H340L400 300H0Z"/>'),
        L('rug', 'فرش', 'L2', '<path d="M120 236H280L318 284H82Z"/>'),
        L('sofa', 'مبل', 'D', '<rect x="115" y="180" width="170" height="46" rx="10"/><rect x="105" y="206" width="190" height="42" rx="10"/>'),
        L('cushion', 'کوسن', 'P', '<rect x="126" y="190" width="28" height="26" rx="6"/><rect x="246" y="190" width="28" height="26" rx="6"/>'),
        L('table', 'میز جلومبلی', 'K', '<rect x="165" y="258" width="70" height="16" rx="4"/>'),
      ],
    },
    bedroom: {
      name: 'اتاق خواب',
      avoid: [['bedding', 'floor'], ['headboard', 'back'], ['back', 'floor'], ['bedding', 'rug'], ['rug', 'floor']],
      layers: [
        ...ROOM,
        L('wall', 'دیوار اصلی', 'L1', '<rect x="60" y="50" width="280" height="150"/>'),
        L('back', 'دیوار پشت تخت', 'D', '<rect x="105" y="58" width="190" height="142"/>'),
        L('art', 'تابلو', 'P', '<rect x="165" y="76" width="70" height="40" rx="2"/>'),
        L('floor', 'کف', 'M', '<path d="M60 200H340L400 300H0Z"/>'),
        L('rug', 'فرش', 'L2', '<path d="M92 244H308L340 292H60Z"/>'),
        L('headboard', 'تاج تخت', 'K', '<rect x="118" y="128" width="164" height="56" rx="8"/>'),
        L('bedding', 'روتختی', 'M', '<rect x="106" y="172" width="188" height="64" rx="10"/>'),
        L('pillow', 'بالش و کوسن', 'P', '<rect x="128" y="150" width="60" height="26" rx="9"/><rect x="212" y="150" width="60" height="26" rx="9"/>'),
        L('nightstand', 'پاتختی', 'K', '<rect x="70" y="190" width="28" height="44"/><rect x="302" y="190" width="28" height="44"/>'),
        L('lamp', 'آباژور', 'L2', '<path d="M76 168h16l4 18H72z"/><path d="M308 168h16l4 18h-24z"/>'),
      ],
    },
    kitchen: {
      name: 'آشپزخانه',
      avoid: [['upper', 'lower'], ['wall', 'upper'], ['splash', 'counter'], ['lower', 'floor']],
      layers: [
        L('wall', 'دیوار', 'L1', '<rect width="400" height="300"/>'),
        L('splash', 'بین‌کابینتی', 'L2', '<rect x="24" y="112" width="352" height="54"/>'),
        L('upper', 'کابینت بالا', 'M', '<rect x="24" y="28" width="108" height="84" rx="3"/><rect x="146" y="28" width="108" height="84" rx="3"/><rect x="268" y="28" width="108" height="84" rx="3"/>'),
        L('lower', 'کابینت پایین', 'D', '<rect x="24" y="178" width="352" height="96" rx="3"/>'),
        S('<path d="M141 178v96M259 178v96M24 226h352" stroke="#000" stroke-opacity=".25" fill="none"/>'),
        L('counter', 'سنگ کانتر', 'L2', '<rect x="16" y="164" width="368" height="14" rx="2"/>'),
        L('floor', 'کف', 'K', '<rect y="274" width="400" height="26"/>'),
        L('hardware', 'دستگیره و شیرآلات', 'P', '<rect x="122" y="90" width="4" height="16"/><rect x="146" y="90" width="4" height="16"/><rect x="248" y="90" width="4" height="16"/><rect x="272" y="90" width="4" height="16"/><rect x="128" y="196" width="4" height="22"/><rect x="150" y="196" width="4" height="22"/><rect x="250" y="196" width="4" height="22"/><rect x="268" y="196" width="4" height="22"/><path d="M196 164v-24q0-10 10-10h8v6h-6q-6 0-6 6v22z"/>'),
      ],
    },
  };

  const LIGHTS = {
    day:   { name: 'روز',  fill: 'rgba(0,0,0,0)' },
    dawn:  { name: 'صبح سرد',  fill: 'rgba(170,205,255,.85)' },
    dusk:  { name: 'عصر گرم',  fill: 'rgba(255,190,120,.85)' },
    night: { name: 'شب',   fill: 'rgba(70,80,130,.9)' },
  };

  const st = { pal: null, tpl: 'living', as: {}, lock: new Set(), h: [], f: [], sel: null, light: 'day' };
  let root, stage;

  /* ---------- منطق رنگ ---------- */
  const sat = (hex) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };
  const popIdx = () => {
    const c = st.pal.colors;
    let best = 1;
    for (let i = 1; i < c.length - 1; i++) if (sat(c[i]) > sat(c[best])) best = i;
    return Math.min(best, c.length - 1);
  };
  const idxOf = (role) => role === 'P' ? popIdx() : Math.min(AUTO[role], st.pal.colors.length - 1);
  const layers = () => TPL[st.tpl].layers.filter(l => l.id);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const cur = () => st.as[st.tpl];
  const hexOf = (id) => st.pal.colors[cur()[id]];

  function autoAssign() {
    st.as[st.tpl] = Object.fromEntries(layers().map(l => [l.id, idxOf(l.role)]));
  }
  function shuffle() {
    const t = TPL[st.tpl];
    let best = null;
    for (let n = 0; n < 14; n++) {
      const a = clone(cur());
      layers().forEach(l => {
        if (st.lock.has(l.id)) return;
        const pool = POOL[l.role].map(i => Math.min(i, st.pal.colors.length - 1));
        a[l.id] = pool[Math.floor(Math.random() * pool.length)];
      });
      best = a;
      if (!t.avoid.some(([x, y]) => a[x] === a[y]) && JSON.stringify(a) !== JSON.stringify(cur())) break;
    }
    commit(best);
  }
  function commit(next) {
    st.h.push(clone(cur())); st.f = [];
    st.as[st.tpl] = next;
    paint(); haptic.light();
  }

  /* ---------- رندر ---------- */
  function svgMarkup() {
    const body = TPL[st.tpl].layers.map(l => l.id
      ? `<g class="ly${st.sel === l.id ? ' sel' : ''}" data-l="${l.id}" fill="${hexOf(l.id)}">${l.html}</g>`
      : `<g pointer-events="none">${l.html}</g>`).join('');
    const f = LIGHTS[st.light].fill;
    return `<svg viewBox="0 0 400 300" xmlns="${NS}" role="img" aria-label="پیش‌نمایش ${TPL[st.tpl].name}">${body}
      <rect width="400" height="300" fill="${f}" style="mix-blend-mode:multiply" pointer-events="none"/></svg>`;
  }

  function paint() {
    const c = st.pal.colors;
    stage.innerHTML = svgMarkup();
    $('.stu-tabs', root).innerHTML = Object.entries(TPL).map(([k, t]) =>
      `<button class="${k === st.tpl ? 'on' : ''}" data-tpl="${k}">${t.name}</button>`).join('');
    $('.stu-light', root).innerHTML = Object.entries(LIGHTS).map(([k, t]) =>
      `<button class="${k === st.light ? 'on' : ''}" data-light="${k}">${t.name}</button>`).join('');
    $('.stu-pal', root).innerHTML = c.map((h, i) =>
      `<button style="--c:${h}" data-pick="${i}" aria-label="${h}" class="${st.sel && cur()[st.sel] === i ? 'on' : ''}"></button>`).join('');
    $('.stu-list', root).innerHTML = layers().map(l => {
      const h = hexOf(l.id);
      return `<div class="row${st.sel === l.id ? ' on' : ''}" data-row="${l.id}">
        <i style="background:${h}"></i><b>${l.name}</b>
        <button data-lock="${l.id}" aria-pressed="${st.lock.has(l.id)}" aria-label="قفل">${st.lock.has(l.id) ? '🔒' : '🔓'}</button>
        <button class="hx" dir="ltr" data-copy="${h}">${h}</button></div>`;
    }).join('');
    $('[data-a=undo]', root).disabled = !st.h.length;
    $('[data-a=redo]', root).disabled = !st.f.length;
    $('.stu-hint', root).textContent = st.sel
      ? `لایهٔ «${layers().find(l => l.id === st.sel).name}» انتخاب شد؛ یکی از رنگ‌ها را بزن.`
      : 'روی هر بخش از تصویر بزن، بعد رنگش را از پالت انتخاب کن.';
  }

  /* ---------- خروجی PNG ---------- */
  async function exportPng() {
    const svg = new DOMParser().parseFromString(svgMarkup(), 'image/svg+xml').documentElement;
    svg.setAttribute('width', 1080); svg.setAttribute('height', 810);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
    const x = cv.getContext('2d');
    x.fillStyle = '#F2EEE8'; x.fillRect(0, 0, 1080, 1350);
    x.drawImage(img, 0, 0, 1080, 810);
    const c = st.pal.colors, w = 1080 / c.length;
    c.forEach((h, i) => {
      x.fillStyle = h; x.fillRect(i * w, 810, w, 210);
      x.fillStyle = textColor(h); x.font = '600 26px Vazirmatn, sans-serif';
      x.textAlign = 'center'; x.fillText(h.toUpperCase(), i * w + w / 2, 930);
    });
    x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = '#1A1714';
    x.font = '800 56px Vazirmatn, sans-serif'; x.fillText(st.pal.name, 1032, 1120);
    x.font = '500 30px Vazirmatn, sans-serif'; x.fillStyle = '#5A5347';
    x.fillText(`چیدمان ${TPL[st.tpl].name} — ${LIGHTS[st.light].name}`, 1032, 1178);
    x.textAlign = 'left'; x.font = '700 34px Vazirmatn, sans-serif'; x.fillStyle = '#2C9E82';
    x.fillText('رواق', 48, 1290);
    URL.revokeObjectURL(url);
    cv.toBlob(async (b) => {
      const file = new File([b], `ravaq-${st.pal.id}-${st.tpl}.png`, { type: 'image/png' });
      try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file.name; a.click();
      showToast('تصویر ذخیره شد'); haptic.success();
    }, 'image/png');
  }

  /* ---------- UI ---------- */
  const CSS = `
  .stu{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center}
  .stu[hidden]{display:none}
  .stu-sheet{width:min(560px,100%);max-height:94dvh;overflow:auto;background:var(--bg-elev);color:var(--ink);border-radius:22px 22px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:var(--shadow-lg);animation:stuUp .32s var(--ease)}
  @keyframes stuUp{from{transform:translateY(40px);opacity:0}}
  @media(prefers-reduced-motion:reduce){.stu-sheet{animation:none}}
  .stu-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
  .stu-top h3{margin:0;font-size:16px;font-weight:800}
  .stu button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:var(--glass);border-radius:12px;padding:8px 12px;min-height:40px}
  .stu button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .stu button:disabled{opacity:.4;cursor:default}
  .stu-tabs,.stu-light,.stu-tools{display:flex;gap:6px;overflow-x:auto;margin:8px 0}
  .stu-tabs button,.stu-light button{flex:1;white-space:nowrap}
  .stu .on{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:700}
  .stage{border-radius:16px;overflow:hidden;background:var(--bg-sunk);line-height:0;touch-action:manipulation}
  .stage svg{width:100%;height:auto;display:block}
  .ly{cursor:pointer;transition:fill .28s var(--ease)}
  .ly.sel{stroke:#fff;stroke-width:2.5;paint-order:stroke;stroke-dasharray:6 4}
  .stu-hint{font-size:12.5px;color:var(--ink-dim);margin:8px 2px}
  .stu-pal{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}
  .stu-pal button{background:var(--c);height:52px;border-radius:14px;border:2px solid var(--line)}
  .stu-pal button.on{border-color:var(--ink);box-shadow:0 0 0 3px var(--accent)}
  .stu-list .row{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:12px;border:1px solid transparent}
  .stu-list .row.on{border-color:var(--accent);background:var(--glass)}
  .stu-list i{width:22px;height:22px;border-radius:7px;border:1px solid var(--line);flex:none}
  .stu-list b{flex:1;font-weight:600;font-size:14px}
  .stu-list button{padding:4px 8px;min-height:32px;font-size:12px}
  .stu-cta{width:100%;margin-top:12px;background:var(--accent)!important;color:var(--accent-ink)!important;font-weight:800;border:0!important}`;

  function build() {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    root = document.createElement('div'); root.className = 'stu'; root.hidden = true;
    root.innerHTML = `<div class="stu-sheet" role="dialog" aria-modal="true" aria-label="استودیو چیدمان">
      <div class="stu-top"><h3 id="stuTitle"></h3><button data-a="close" aria-label="بستن">✕</button></div>
      <div class="stu-tabs"></div>
      <div class="stage"></div>
      <div class="stu-light"></div>
      <p class="stu-hint"></p>
      <div class="stu-pal"></div>
      <div class="stu-tools">
        <button data-a="shuffle">🎲 بُر بزن</button><button data-a="undo">↶ قبلی</button>
        <button data-a="redo">↷ بعدی</button><button data-a="reset">بازنشانی</button>
      </div>
      <div class="stu-list"></div>
      <button class="stu-cta" data-a="export">ذخیره / اشتراک تصویر</button></div>`;
    document.body.appendChild(root);
    stage = $('.stage', root);

    root.addEventListener('click', (e) => {
      const t = e.target.closest('button,.ly,[data-row]'); if (e.target === root) return close();
      if (!t) return;
      const d = t.dataset;
      if (t.classList.contains('ly')) { st.sel = d.l; haptic.select(); return paint(); }
      if (d.a === 'close') return close();
      if (d.a === 'shuffle') return shuffle();
      if (d.a === 'undo' && st.h.length) { st.f.push(clone(cur())); st.as[st.tpl] = st.h.pop(); return paint(); }
      if (d.a === 'redo' && st.f.length) { st.h.push(clone(cur())); st.as[st.tpl] = st.f.pop(); return paint(); }
      if (d.a === 'reset') { st.lock.clear(); const prev = clone(cur()); autoAssign(); const n = cur(); st.as[st.tpl] = prev; return commit(n); }
      if (d.a === 'export') return exportPng().catch(() => showToast('ساخت تصویر ناموفق بود'));
      if (d.tpl) { st.tpl = d.tpl; st.sel = null; st.h = []; st.f = []; st.lock.clear(); if (!cur()) autoAssign(); return paint(); }
      if (d.light) { st.light = d.light; return paint(); }
      if (d.pick !== undefined) {
        if (!st.sel) return showToast('اول یک بخش از تصویر را انتخاب کن');
        const n = clone(cur()); n[st.sel] = +d.pick; return commit(n);
      }
      if (d.lock) { st.lock.has(d.lock) ? st.lock.delete(d.lock) : st.lock.add(d.lock); return paint(); }
      if (d.copy) { copyText(d.copy); showToast(`${d.copy} کپی شد`); return; }
      if (d.row) { st.sel = d.row; return paint(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  }

  function pickTpl(p) {
    const tags = p.tags || [];
    return tags.includes('اتاق خواب') ? 'bedroom' : tags.includes('آشپزخانه') ? 'kitchen' : 'living';
  }
  function open(id) {
    const p = (window.state || state).palettes.find(x => x.id === id); if (!p) return;
    if (!root) build();
    Object.assign(st, { pal: p, tpl: pickTpl(p), as: {}, lock: new Set(), h: [], f: [], sel: null, light: 'day' });
    autoAssign();
    $('#stuTitle', root).textContent = p.name;
    root.hidden = false; document.body.style.overflow = 'hidden';
    paint(); haptic.medium();
  }
  function close() { root.hidden = true; document.body.style.overflow = ''; }

  /* ---------- اتصال به کارت‌ها بدون دست‌بردن در renderCard ---------- */
  function decorate() {
    $$('.pal').forEach(card => {
      const box = $('.pal-actions', card);
      if (!box || $('.act-studio', box)) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'act act-studio'; b.dataset.studio = card.dataset.id;
      b.innerHTML = '<span>امتحان در فضا</span>';
      box.appendChild(b);
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-studio]'); if (b) open(b.dataset.studio);
  });
  const list = document.getElementById('list');
  if (list) { new MutationObserver(decorate).observe(list, { childList: true }); decorate(); }
})();