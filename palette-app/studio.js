/* ============================================================
   رواق — استودیو چیدمان (نسخهٔ ارتقاءیافته)
   وابستگی: script.js (state, copyText, showToast, haptic)
   ------------------------------------------------------------
   - سیستم متریال (مات/ساتن/نیمه‌براق/چوب/سرامیک/سنگ/پارچه/مخمل/فلز/شیشه)
   - سناریوهای نور + اسلایدر ساعت روز + جهت پنجره
   - تحلیل زندهٔ ۶۰/۳۰/۱۰، LRV، هارمونی، کنتراست WCAG، هشدارها
   - خروجی PNG (با قاب و برند) + CSV مشخصات + JSON متریال
   ============================================================ */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const toFa = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

  /* ---------- رنگ: تبدیل و محاسبات ---------- */
  function hexToRgb(h) {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function srgbToLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function relativeLuminance(hex) {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
  }
  function lrv(hex) { return Math.round(relativeLuminance(hex) * 100); }
  function contrast(a, b) {
    const L1 = relativeLuminance(a), L2 = relativeLuminance(b);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (hi + 0.05) / (lo + 0.05);
  }
  function rgbToHsl(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  function textColorFor(hex) { return lrv(hex) > 60 ? '#1A1714' : '#F5EFE3'; }
  function satOf(hex) { return rgbToHsl(hex)[1]; }

  /* ---------- متریال ---------- */
  const MATERIALS = {
    matte:    { name: 'رنگ مات',   pat: null,     spec: 0,    sheen: 0 },
    satin:    { name: 'رنگ ساتن',  pat: null,     spec: 0.12, sheen: 0.08 },
    semigloss:{ name: 'نیمه‌براق', pat: null,     spec: 0.30, sheen: 0.15 },
    wood:     { name: 'چوب',      pat: 'wood',   spec: 0.15, sheen: 0.05 },
    tile:     { name: 'سرامیک',   pat: 'tile',   spec: 0.35, sheen: 0.12 },
    stone:    { name: 'سنگ',      pat: 'stone',  spec: 0.25, sheen: 0.10 },
    fabric:   { name: 'پارچه',    pat: 'fabric', spec: 0,    sheen: 0 },
    velvet:   { name: 'مخمل',     pat: 'fabric', spec: 0.10, sheen: 0.40 },
    metal:    { name: 'فلز',      pat: null,     spec: 0.70, sheen: 0.30 },
    glass:    { name: 'شیشه/آینه', pat: null,    spec: 0.80, sheen: 0.20 },
  };

  const AUTO = { L1: 4, L2: 3, M: 2, D: 1, K: 0 };
  const POOL = { L1: [3, 4], L2: [2, 3, 4], M: [1, 2, 3], D: [0, 1, 2], K: [0, 1], P: [0, 1, 2, 3, 4] };

  /* ---------- سناریوهای نور ---------- */
  const LIGHTS = {
    morning:  { name: 'صبح',  sun: 0.55, tint: 'rgba(190,215,255,.55)' },
    noon:     { name: 'ظهر',  sun: 1.00, tint: 'rgba(255,255,255,.35)' },
    afternoon:{ name: 'عصر',  sun: 0.85, tint: 'rgba(255,205,140,.60)' },
    dusk:     { name: 'غروب', sun: 0.50, tint: 'rgba(255,155,95,.70)'  },
    night:    { name: 'شب',   sun: 0.00, tint: 'rgba(60,70,110,.75)'  },
  };
  function timeToLight(min) {
    const h = min / 60;
    if (h < 8) return 'morning';
    if (h < 12) return 'noon';
    if (h < 17) return 'afternoon';
    if (h < 19.5) return 'dusk';
    return 'night';
  }

  /* ---------- صحنه‌ها ---------- */
  const L = (id, name, role, m, html) => ({ id, name, role, m, html });
  const S = (html) => ({ id: null, html });

  const ROOM = [
    L('ceiling', 'سقف', 'L1', 'matte', '<path d="M0 0 H400 L340 50 H60 Z"/>'),
    L('side', 'دیوارهای کناری', 'L2', 'matte',
      '<path d="M0 0 L60 50 V200 L0 300 Z"/><path d="M400 0 L340 50 V200 L400 300 Z"/>'),
    S('<path d="M0 0 L60 50 V200 L0 300 Z" fill="#000" opacity=".22"/>'
    + '<path d="M400 0 L340 50 V200 L400 300 Z" fill="#000" opacity=".22"/>'),
  ];

  const TEMPLATES = {
    living: {
      name: 'نشیمن',
      layers: [
        ...ROOM,
        L('wall',    'دیوار اصلی',  'L1', 'matte',    '<rect x="60" y="50" width="280" height="150"/>'),
        L('accent',  'دیوار تأکیدی','D',  'matte',    '<rect x="140" y="58" width="120" height="112"/>'),
        L('panel',   'پنل/تلویزیون','K',  'semigloss','<rect x="162" y="94" width="76" height="44" rx="2"/>'),
        L('curtain', 'پرده',        'P',  'fabric',   '<rect x="66" y="50" width="32" height="150"/><rect x="302" y="50" width="32" height="150"/>'),
        L('floor',   'کف',          'M',  'wood',     '<path d="M60 200 H340 L400 300 H0 Z"/>'),
        L('rug',     'فرش',         'L2', 'fabric',   '<path d="M120 234 H280 L318 284 H82 Z"/>'),
        L('sofa',    'مبل',         'D',  'fabric',   '<path d="M112 178 h176 q10 0 10 10 v40 q0 10 -10 10 h-176 q-10 0 -10 -10 v-40 q0 -10 10 -10 z"/>'),
        L('cushion', 'کوسن',        'P',  'velvet',   '<rect x="126" y="186" width="30" height="28" rx="6"/><rect x="244" y="186" width="30" height="28" rx="6"/>'),
        L('table',   'میز',         'K',  'wood',     '<rect x="160" y="252" width="80" height="14" rx="3"/><rect x="172" y="266" width="56" height="4"/>'),
        L('lamp',    'آباژور',       'P',  'metal',    '<path d="M330 168 h12 l3 14 h-18 z"/><rect x="334" y="182" width="4" height="18"/>'),
        L('plant',   'گیاه',        'M',  'matte',    '<path d="M84 224 q-6 -18 4 -30 q8 10 2 26 z"/><path d="M90 224 q6 -22 18 -28 q0 14 -12 28 z"/><rect x="80" y="222" width="16" height="14" rx="2"/>'),
      ],
      avoid: [['sofa','floor'],['sofa','wall'],['wall','floor'],['sofa','rug'],['rug','floor'],['accent','wall']],
    },
    bedroom: {
      name: 'اتاق خواب',
      layers: [
        ...ROOM,
        L('wall',    'دیوار اصلی',  'L1', 'matte',  '<rect x="60" y="50" width="280" height="150"/>'),
        L('accent',  'دیوار پشت تخت','D', 'matte',  '<rect x="105" y="58" width="190" height="142"/>'),
        L('art',     'تابلو',       'P',  'matte',  '<rect x="168" y="78" width="64" height="38" rx="2"/>'),
        L('floor',   'کف',          'M',  'wood',   '<path d="M60 200 H340 L400 300 H0 Z"/>'),
        L('rug',     'فرش',         'L2', 'fabric', '<path d="M92 244 H308 L340 292 H60 Z"/>'),
        L('bed',     'تخت',         'M',  'fabric', '<rect x="106" y="160" width="188" height="80" rx="8"/>'),
        L('headboard','تاج تخت',    'K',  'wood',   '<rect x="118" y="120" width="164" height="48" rx="6"/>'),
        L('pillow',  'بالش',        'P',  'fabric', '<rect x="126" y="148" width="62" height="26" rx="8"/><rect x="212" y="148" width="62" height="26" rx="8"/>'),
        L('nightstand','پاتختی',    'K',  'wood',   '<rect x="70" y="190" width="28" height="44" rx="2"/><rect x="302" y="190" width="28" height="44" rx="2"/>'),
        L('lamp',    'آباژور',       'L2', 'metal',  '<path d="M76 168 h16 l4 18 h-24 z"/><path d="M308 168 h16 l4 18 h-24 z"/>'),
      ],
      avoid: [['bed','floor'],['headboard','accent'],['accent','floor'],['bed','rug'],['rug','floor'],['pillow','bed']],
    },
    kitchen: {
      name: 'آشپزخانه',
      layers: [
        L('wall',   'دیوار',       'L1', 'matte',  '<rect width="400" height="300"/>'),
        L('splash', 'بین‌کابینتی', 'L2', 'tile',   '<rect x="24" y="112" width="352" height="54"/>'),
        L('upper',  'کابینت بالا', 'M',  'satin',  '<rect x="24" y="28" width="108" height="84" rx="3"/><rect x="146" y="28" width="108" height="84" rx="3"/><rect x="268" y="28" width="108" height="84" rx="3"/>'),
        L('lower',  'کابینت پایین','D',  'satin',  '<rect x="24" y="178" width="352" height="96" rx="3"/>'),
        S('<path d="M141 178 v96 M259 178 v96 M24 226 h352" stroke="rgba(0,0,0,.28)" fill="none"/>'),
        L('counter','سنگ کانتر',   'L2', 'stone',  '<rect x="16" y="164" width="368" height="14" rx="2"/>'),
        L('floor',  'کف',          'K',  'tile',   '<rect y="274" width="400" height="26"/>'),
        L('hardware','دستگیره و شیر','P','metal',
          '<rect x="122" y="90" width="4" height="16"/><rect x="146" y="90" width="4" height="16"/><rect x="248" y="90" width="4" height="16"/><rect x="272" y="90" width="4" height="16"/><rect x="128" y="196" width="4" height="22"/><rect x="150" y="196" width="4" height="22"/><rect x="250" y="196" width="4" height="22"/><rect x="268" y="196" width="4" height="22"/><path d="M196 164 v-24 q0 -10 10 -10 h8 v6 h-6 q-6 0 -6 6 v22 z"/>'),
      ],
      avoid: [['upper','lower'],['wall','upper'],['splash','counter'],['lower','floor'],['counter','lower']],
    },
    bathroom: {
      name: 'حمام',
      layers: [
        L('wall',    'دیوار',        'L1', 'matte', '<rect width="400" height="300"/>'),
        L('accent',  'دیوار تأکیدی', 'D',  'tile',  '<rect x="40" y="40" width="140" height="220"/>'),
        L('floor',   'کف',           'M',  'tile',  '<path d="M0 244 H400 V300 H0 Z"/>'),
        L('vanity',  'کابینت روشویی','K',  'satin', '<rect x="200" y="170" width="120" height="70" rx="4"/>'),
        L('counter', 'سنگ روشویی',   'L2', 'stone', '<rect x="196" y="164" width="128" height="12" rx="2"/>'),
        L('mirror',  'آینه',         'P',  'glass', '<rect x="210" y="60" width="100" height="96" rx="4"/>'),
        L('hardware','شیرآلات',      'P',  'metal', '<path d="M244 164 v-16 q0 -8 8 -8 h12 v6 h-10 q-4 0 -4 4 v14 z"/><circle cx="266" cy="152" r="3"/>'),
        L('towel',   'حوله',         'P',  'fabric','<rect x="60" y="120" width="20" height="90" rx="3"/><rect x="86" y="120" width="20" height="90" rx="3"/>'),
      ],
      avoid: [['wall','accent'],['wall','floor'],['vanity','floor'],['counter','vanity'],['mirror','wall']],
    },
    office: {
      name: 'اداری',
      layers: [
        ...ROOM,
        L('wall',   'دیوار',      'L1', 'matte',    '<rect x="60" y="50" width="280" height="150"/>'),
        L('accent', 'دیوار تأکیدی','D', 'matte',    '<rect x="140" y="58" width="120" height="112"/>'),
        L('board',  'تخته/تابلو', 'K',  'semigloss','<rect x="158" y="80" width="84" height="52" rx="2"/>'),
        L('floor',  'کف',         'M',  'wood',     '<path d="M60 200 H340 L400 300 H0 Z"/>'),
        L('rug',    'فرش',        'L2', 'fabric',   '<path d="M110 236 H290 L330 288 H70 Z"/>'),
        L('desk',   'میز کار',    'K',  'wood',     '<rect x="120" y="206" width="160" height="12" rx="2"/><rect x="130" y="218" width="6" height="34"/><rect x="264" y="218" width="6" height="34"/>'),
        L('chair',  'صندلی',      'P',  'fabric',   '<rect x="176" y="176" width="48" height="44" rx="6"/><rect x="182" y="220" width="36" height="6"/>'),
        L('shelf',  'کتابخانه',   'D',  'wood',     '<rect x="70" y="90" width="54" height="90" rx="2"/>'),
        S('<path d="M70 120 h54 M70 150 h54" stroke="rgba(0,0,0,.3)" fill="none"/>'),
        L('lamp',   'چراغ رومیزی','P',  'metal',    '<rect x="256" y="190" width="4" height="16"/><path d="M248 190 h20 l-3 -10 h-14 z"/>'),
      ],
      avoid: [['desk','floor'],['wall','floor'],['chair','rug'],['rug','floor'],['accent','wall']],
    },
    cafe: {
      name: 'کافه',
      layers: [
        L('wall',   'دیوار',       'L1', 'matte', '<rect width="400" height="300"/>'),
        L('accent', 'دیوار تأکیدی','D',  'matte', '<rect x="0" y="0" width="120" height="300"/>'),
        L('floor',  'کف',          'M',  'wood',  '<rect y="240" width="400" height="60"/>'),
        L('bar',    'بار/کانتر',   'K',  'wood',  '<rect x="180" y="150" width="200" height="90" rx="3"/>'),
        L('counter','سنگ کانتر',   'L2', 'stone', '<rect x="172" y="142" width="216" height="12" rx="2"/>'),
        L('stool',  'صندلی بار',   'P',  'metal', '<rect x="200" y="200" width="8" height="40"/><rect x="192" y="196" width="24" height="6" rx="3"/><rect x="260" y="200" width="8" height="40"/><rect x="252" y="196" width="24" height="6" rx="3"/>'),
        L('shelf',  'شلف دیواری',  'D',  'wood',  '<rect x="150" y="50" width="120" height="4"/><rect x="150" y="80" width="120" height="4"/>'),
        S('<path d="M160 40 h6 v14 h-6 z M172 42 h5 v12 h-5 z M186 38 h6 v16 h-6 z M198 44 h5 v10 h-5 z" fill="#000" opacity=".35"/>'),
      ],
      avoid: [['wall','floor'],['bar','floor'],['stool','floor'],['counter','bar']],
    },
  };

  /* ---------- State ---------- */
  const st = {
    pal: null, tpl: 'living', as: {}, lock: new Set(),
    h: [], f: [], sel: null, light: 'noon', timeMin: 12 * 60,
    windowDir: 'S', material: {}, analysis: false,
  };
  let root, stage, analysisEl;

  /* ---------- منطق رنگ ---------- */
  const popIdx = () => {
    const c = st.pal.colors;
    let best = 1;
    for (let i = 1; i < c.length - 1; i++) if (satOf(c[i]) > satOf(c[best])) best = i;
    return Math.min(best, c.length - 1);
  };
  const idxOf = (role) => role === 'P' ? popIdx() : Math.min(AUTO[role] ?? 0, st.pal.colors.length - 1);
  const layers = () => TEMPLATES[st.tpl].layers.filter(l => l.id);
  const cur = () => st.as[st.tpl];
  const hexOf = (id) => st.pal.colors[cur()[id]];
  const matOf = (l) => st.material[l.id] || l.m || 'matte';

  function autoAssign() {
    st.as[st.tpl] = Object.fromEntries(layers().map(l => [l.id, idxOf(l.role)]));
    st.material = {};
    layers().forEach(l => { st.material[l.id] = l.m || 'matte'; });
  }
  function commit(next) {
    st.h.push(clone(cur()));
    if (st.h.length > 30) st.h.shift();
    st.f = [];
    st.as[st.tpl] = next;
    paint(); haptic.light();
  }

  function shuffleSmart() {
    const tpl = TEMPLATES[st.tpl];
    const colors = st.pal.colors;
    const best = { a: null, score: -Infinity };
    for (let n = 0; n < 26; n++) {
      const a = clone(cur());
      layers().forEach(l => {
        if (st.lock.has(l.id)) return;
        const pool = (POOL[l.role] || [0, 1, 2, 3, 4]).map(i => Math.min(i, colors.length - 1));
        a[l.id] = pool[Math.floor(Math.random() * pool.length)];
      });
      const uniq = new Set(Object.values(a)).size;
      let score = uniq * 3;
      (tpl.avoid || []).forEach(([x, y]) => { if (a[x] === a[y]) score -= 6; });
      if (a.wall !== undefined && a.floor !== undefined) {
        const d = Math.abs(lrv(colors[a.wall]) - lrv(colors[a.floor]));
        if (d > 15 && d < 65) score += 4;
      }
      if (score > best.score) { best.score = score; best.a = a; }
    }
    commit(best.a || cur());
  }

  function suggestHarmony(kind) {
    const colors = st.pal.colors;
    const next = clone(cur());
    layers().forEach(l => {
      if (st.lock.has(l.id)) return;
      switch (kind) {
        case 'mono':     next[l.id] = clamp(idxOf(l.role), 0, colors.length - 1); break;
        case 'contrast': next[l.id] = (l.role === 'D' || l.role === 'K') ? 0 : colors.length - 1; break;
        case 'balanced': next[l.id] = Math.min(AUTO[l.role] ?? 2, colors.length - 1); break;
      }
    });
    commit(next);
  }

  /* ---------- رندر SVG ---------- */
  function defsInner() {
    const lt = LIGHTS[st.light];
    const h = st.timeMin / 60;
    const sunX = clamp((h - 6) / 15, 0, 1);
    const sunY = 0.2 + 0.5 * Math.abs(h - 12) / 6;

    return `
      <pattern id="pat-wood" patternUnits="userSpaceOnUse" width="44" height="9">
        <rect width="44" height="9" fill="transparent"/>
        <path d="M0 4.5 Q11 3.2 22 4.5 T44 4.5" stroke="rgba(0,0,0,.14)" fill="none" stroke-width=".8"/>
        <path d="M0 8 Q15 7 30 8" stroke="rgba(255,255,255,.06)" fill="none" stroke-width=".5"/>
      </pattern>
      <pattern id="pat-tile" patternUnits="userSpaceOnUse" width="56" height="56">
        <rect width="56" height="56" fill="transparent"/>
        <rect x=".5" y=".5" width="55" height="55" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1"/>
        <rect x="3" y="3" width="50" height="50" fill="none" stroke="rgba(255,255,255,.06)" stroke-width=".5"/>
      </pattern>
      <pattern id="pat-fabric" patternUnits="userSpaceOnUse" width="5" height="5">
        <rect width="5" height="5" fill="transparent"/>
        <circle cx="1.5" cy="1.5" r=".45" fill="rgba(0,0,0,.10)"/>
        <circle cx="4" cy="4" r=".4" fill="rgba(255,255,255,.06)"/>
      </pattern>
      <pattern id="pat-stone" patternUnits="userSpaceOnUse" width="60" height="30">
        <rect width="60" height="30" fill="transparent"/>
        <path d="M0 8 Q20 3 40 10 T60 6" stroke="rgba(0,0,0,.10)" fill="none" stroke-width=".9"/>
        <path d="M0 20 Q15 24 35 18 T60 22" stroke="rgba(0,0,0,.08)" fill="none" stroke-width=".7"/>
      </pattern>
      <linearGradient id="light-day" x1="0" y1="0" x2="${sunX.toFixed(2)}" y2="${sunY.toFixed(2)}">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="${(0.32 * lt.sun).toFixed(2)}"/>
        <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="light-window" cx="${(0.75 * (1 - sunX) + 0.5 * sunX).toFixed(2)}" cy="${(0.25 + sunY * .3).toFixed(2)}" r="0.7">
        <stop offset="0" stop-color="${lt.tint}" stop-opacity="1"/>
        <stop offset="1" stop-color="${lt.tint}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="sh-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".22"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="sh-bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".28"/>
      </linearGradient>
      <radialGradient id="vig" cx=".5" cy=".4" r=".85">
        <stop offset=".6" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".28"/>
      </radialGradient>
    `;
  }

  function layerOverlays(l) {
    const m = MATERIALS[matOf(l)] || MATERIALS.matte;
    const parts = [];
    if (m.pat) {
      parts.push(`<g clip-path="url(#clip-${l.id})"><rect x="0" y="0" width="400" height="300" fill="url(#pat-${m.pat})" opacity="${m.pat === 'fabric' ? .55 : .8}" style="mix-blend-mode:overlay"/></g>`);
    }
    if (m.spec > 0) {
      parts.push(`<g clip-path="url(#clip-${l.id})"><rect x="0" y="0" width="400" height="300" fill="url(#light-window)" opacity="${m.spec.toFixed(2)}" style="mix-blend-mode:screen"/></g>`);
    }
    if (m.sheen > 0) {
      parts.push(`<g clip-path="url(#clip-${l.id})"><rect x="0" y="0" width="400" height="300" fill="url(#light-day)" opacity="${m.sheen.toFixed(2)}" style="mix-blend-mode:soft-light"/></g>`);
    }
    return parts.join('');
  }

  function svgMarkup() {
    const lt = LIGHTS[st.light];
    const clips = layers().map(l => `<clipPath id="clip-${l.id}">${l.html}</clipPath>`).join('');

    const body = TEMPLATES[st.tpl].layers.map(l => {
      if (!l.id) return `<g pointer-events="none">${l.html}</g>`;
      const color = hexOf(l.id);
      const shadeOverlay = `
        <g clip-path="url(#clip-${l.id})" style="mix-blend-mode:multiply">
          <rect x="0" y="0" width="400" height="300" fill="url(#sh-top)" opacity=".34"/>
          <rect x="0" y="0" width="400" height="300" fill="url(#sh-bottom)" opacity=".30"/>
        </g>`;
      return `<g class="ly${st.sel === l.id ? ' sel' : ''}" data-l="${l.id}" fill="${color}">
        ${l.html}
        ${shadeOverlay}
        ${layerOverlays(l)}
      </g>`;
    }).join('');

    const dirTint = st.windowDir === 'N' ? 'rgba(200,215,235,.08)'
                    : st.windowDir === 'W' ? 'rgba(255,205,170,.08)'
                    : 'rgba(255,220,170,.06)';

    const nightLamp = lt.sun === 0
      ? '<rect width="400" height="300" fill="#FFC98A" opacity=".06" style="mix-blend-mode:screen" pointer-events="none"/>'
      : '';

    return `<svg viewBox="0 0 400 300" xmlns="${NS}" role="img" aria-label="پیش‌نمایش ${TEMPLATES[st.tpl].name}">
      <defs>${defsInner()}${clips}</defs>
      ${body}
      <rect width="400" height="300" fill="${dirTint}" style="mix-blend-mode:overlay" pointer-events="none"/>
      <rect width="400" height="300" fill="${lt.tint}" opacity="${lt.sun < 0.5 ? .55 : .38}" style="mix-blend-mode:multiply" pointer-events="none"/>
      <rect width="400" height="300" fill="url(#light-day)" style="mix-blend-mode:screen" pointer-events="none"/>
      ${nightLamp}
      <rect width="400" height="300" fill="url(#vig)" pointer-events="none"/>
    </svg>`;
  }

  /* ---------- تحلیل ---------- */
  const WEIGHT = {
    ceiling: 18, side: 20, wall: 22, accent: 10, floor: 22, rug: 8, sofa: 9, cushion: 2,
    table: 2, curtain: 6, lamp: 1, panel: 3, plant: 1, bed: 14, headboard: 6, pillow: 3,
    nightstand: 2, art: 2, splash: 6, upper: 12, lower: 14, counter: 4, hardware: .5,
    vanity: 6, mirror: 5, towel: 2, desk: 8, chair: 4, board: 3, shelf: 4, bar: 12, stool: 3,
  };

  function analyze() {
    const items = layers();
    const areas = {};
    let total = 0;
    items.forEach(l => { areas[l.id] = WEIGHT[l.id] || 3; total += areas[l.id]; });
    items.forEach(l => { areas[l.id] = areas[l.id] / total * 100; });

    const colorShare = {};
    items.forEach(l => {
      const h = hexOf(l.id);
      colorShare[h] = (colorShare[h] || 0) + areas[l.id];
    });

    const lrvRows = items.map(l => ({ name: l.name, hex: hexOf(l.id), lrv: lrv(hexOf(l.id)) }));

    const hues = items.map(l => rgbToHsl(hexOf(l.id))[0]);
    const uniqueHues = [...new Set(hues.map(h => Math.round(h / 5) * 5))].sort((a, b) => a - b);
    let harmony = 'چندرنگ (کاستوم)';
    if (uniqueHues.length <= 2) {
      const diffs = [];
      for (let i = 1; i < uniqueHues.length; i++) diffs.push(uniqueHues[i] - uniqueHues[i - 1]);
      harmony = (diffs.every(d => d < 20)) ? 'تک‌رنگ (مونوکروم)' : 'مکمل/کنتراست';
    } else if (uniqueHues.length === 3) {
      const d1 = uniqueHues[1] - uniqueHues[0], d2 = uniqueHues[2] - uniqueHues[1];
      if (Math.abs(d1 - 30) < 15 && Math.abs(d2 - 30) < 15) harmony = 'آنالوگ';
      else if (Math.abs(d1 - 120) < 20 && Math.abs(d2 - 120) < 20) harmony = 'سه‌گانه';
      else if (Math.abs(d1 - 30) < 20 && Math.abs(d2 - 120) < 30) harmony = 'آنالوگ + لهجه';
      else harmony = 'ترکیبی';
    }

    const shares = Object.entries(colorShare).sort((a, b) => b[1] - a[1]);
    const targets = [60, 30, 10];
    let score630 = 100;
    shares.slice(0, 3).forEach(([, p], i) => { score630 -= Math.abs(p - targets[i]); });
    score630 = clamp(Math.round(score630), 0, 100);

    const pairs = [
      ['wall', 'floor'], ['wall', 'ceiling'], ['sofa', 'wall'], ['sofa', 'rug'],
      ['accent', 'floor'], ['curtain', 'wall'], ['bed', 'wall'], ['counter', 'lower'],
    ].filter(([a, b]) => cur()[a] !== undefined && cur()[b] !== undefined);
    const contrastRows = pairs.map(([a, b]) => {
      const ca = hexOf(a), cb = hexOf(b);
      const nmA = layers().find(l => l.id === a)?.name || a;
      const nmB = layers().find(l => l.id === b)?.name || b;
      return { a: nmA, b: nmB, ratio: contrast(ca, cb).toFixed(2) };
    });

    const warnings = [];
    const allLRV = lrvRows.map(r => r.lrv);
    const maxLRV = Math.max(...allLRV), minLRV = Math.min(...allLRV);
    if (maxLRV - minLRV < 25) warnings.push('تضاد روشنایی کم است؛ فضا یکنواخت می‌شود. یک سطح تیره‌تر اضافه کن.');
    if (maxLRV < 50) warnings.push('فضا تیره است؛ رنگ روشن‌تر روی دیوار اصلی توصیه می‌شود.');
    if (minLRV > 70) warnings.push('همه‌ی سطوح روشن‌اند؛ یک لهجه‌ی تیره عمق می‌دهد.');
    if (cur().sofa !== undefined && cur().wall !== undefined
        && Math.abs(lrv(hexOf('sofa')) - lrv(hexOf('wall'))) < 10) {
      warnings.push('مبل و دیوار تقریباً هم‌رنگ‌اند؛ لهجه روی کوسن یا فرش جدایی می‌سازد.');
    }

    return { areas, colorShare, lrvRows, harmony, score630, contrastRows, warnings };
  }

  function renderAnalysis() {
    const a = analyze();
    const shares = Object.entries(a.colorShare).sort((x, y) => y[1] - x[1]);
    const bar = shares.map(([h, p]) => `<span style="flex:${p};background:${h}" title="${h} ${p.toFixed(1)}%"></span>`).join('');
    const shareList = shares.slice(0, 5).map(([h, p]) =>
      `<li><span class="dot" style="background:${h}"></span><code dir="ltr">${h}</code><b>${toFa(p.toFixed(1))}٪</b></li>`).join('');
    const lrvHTML = a.lrvRows.map(r => `
      <li><span class="dot" style="background:${r.hex}"></span>
        <span class="nm">${r.name}</span>
        <span class="lv" dir="ltr">LRV ${toFa(r.lrv)}</span></li>`).join('');
    const contrastHTML = a.contrastRows.map(r => {
      const ratio = parseFloat(r.ratio);
      const lvl = ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'کم';
      const cls = ratio >= 4.5 ? 'ok' : ratio >= 3 ? 'mid' : 'bad';
      return `<li class="${cls}"><span>${r.a} ↔ ${r.b}</span><b dir="ltr">${toFa(r.ratio)}:1 · ${lvl}</b></li>`;
    }).join('');
    const warnHTML = a.warnings.length
      ? a.warnings.map(w => `<li>⚠️ ${w}</li>`).join('')
      : `<li class="ok">✅ ترکیب متعادل و خوانا است.</li>`;

    analysisEl.innerHTML = `
      <div class="an-grid">
        <div class="an-card">
          <h4>توزیع ۶۰ / ۳۰ / ۱۰</h4>
          <div class="bar60">${bar}</div>
          <div class="score">امتیاز تعادل: <b>${toFa(a.score630)}</b> از ۱۰۰</div>
          <ul class="share">${shareList}</ul>
        </div>
        <div class="an-card">
          <h4>هارمونی رنگ</h4>
          <p class="harm">${a.harmony}</p>
          <h4 style="margin-top:12px">روشنایی سطوح (LRV)</h4>
          <ul class="lrv">${lrvHTML}</ul>
        </div>
        <div class="an-card">
          <h4>کنتراست WCAG</h4>
          <ul class="contrast">${contrastHTML}</ul>
        </div>
        <div class="an-card">
          <h4>پیشنهاد و هشدار</h4>
          <ul class="warn">${warnHTML}</ul>
          <div class="harmony-actions">
            <button data-suggest="balanced">متعادل</button>
            <button data-suggest="mono">تک‌رنگ</button>
            <button data-suggest="contrast">پُرتضاد</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------- خروجی PNG ---------- */
  async function exportPng() {
    const scale = 2;
    const svg = new DOMParser().parseFromString(svgMarkup(), 'image/svg+xml').documentElement;
    const W = 400 * scale, H = 300 * scale;
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });

    const PAD = 44, HEADER = 130, FOOTER = 200;
    const cv = document.createElement('canvas');
    cv.width = W + PAD * 2;
    cv.height = HEADER + H + FOOTER;
    const x = cv.getContext('2d');
    x.fillStyle = '#F2EEE8';
    x.fillRect(0, 0, cv.width, cv.height);
    x.drawImage(img, PAD, HEADER, W, H);

    x.direction = 'rtl';
    x.textAlign = 'right';
    x.fillStyle = '#1A1714';
    x.font = '800 44px Vazirmatn, Tahoma, sans-serif';
    x.fillText(st.pal.name, cv.width - PAD, 62);
    x.font = '500 24px Vazirmatn, Tahoma, sans-serif';
    x.fillStyle = '#5A5347';
    x.fillText(`چیدمان ${TEMPLATES[st.tpl].name} — نور ${LIGHTS[st.light].name}`, cv.width - PAD, 100);

    const y0 = HEADER + H + 24;
    const c = st.pal.colors, w = W / c.length;
    c.forEach((h, i) => {
      x.fillStyle = h;
      x.fillRect(PAD + i * w, y0, w, 88);
      x.fillStyle = textColorFor(h);
      x.font = '700 22px Vazirmatn, Tahoma, sans-serif';
      x.textAlign = 'center';
      x.fillText(h, PAD + i * w + w / 2, y0 + 54);
    });

    x.textAlign = 'left';
    x.fillStyle = '#2C9E82';
    x.font = '800 28px Vazirmatn, Tahoma, sans-serif';
    x.fillText('رواق', PAD, cv.height - 24);
    x.textAlign = 'right';
    x.fillStyle = '#5A5347';
    x.font = '500 16px Vazirmatn, Tahoma, sans-serif';
    x.fillText(new Date().toLocaleDateString('fa-IR'), cv.width - PAD, cv.height - 24);

    URL.revokeObjectURL(url);

    return new Promise((resolve) => {
      cv.toBlob(async (b) => {
        const file = new File([b], `ravaq-${st.pal.id}-${st.tpl}.png`, { type: 'image/png' });
        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file] });
            return resolve();
          }
        } catch (e) { if (e.name === 'AbortError') return resolve(); }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('تصویر ذخیره شد'); haptic.success();
        resolve();
      }, 'image/png');
    });
  }

  /* ---------- خروجی CSV مشخصات ---------- */
  function exportCSV() {
    const a = analyze();
    const rows = [['Layer', 'Material', 'HEX', 'RGB', 'LRV', 'Area %']];
    layers().forEach(l => {
      const hex = hexOf(l.id);
      const [r, g, b] = hexToRgb(hex);
      const mat = MATERIALS[matOf(l)]?.name || matOf(l);
      rows.push([l.name, mat, hex, `${r},${g},${b}`, String(lrv(hex)), (a.areas[l.id] || 0).toFixed(1)]);
    });
    const csv = '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = `ravaq-spec-${st.pal.id}-${st.tpl}.csv`;
    el.click();
    URL.revokeObjectURL(el.href);
    showToast('جدول مشخصات (CSV) ذخیره شد');
  }

  function exportJSON() {
    const a = analyze();
    const out = {
      palette: st.pal,
      scene: { template: st.tpl, light: st.light, windowDir: st.windowDir, timeMin: st.timeMin },
      layers: layers().map(l => ({
        id: l.id, name: l.name, role: l.role,
        hex: hexOf(l.id), material: matOf(l),
        lrv: lrv(hexOf(l.id)), areaPct: +(a.areas[l.id] || 0).toFixed(2),
      })),
      analysis: { harmony: a.harmony, score630: a.score630, warnings: a.warnings },
      generatedAt: new Date().toISOString(),
      app: 'Ravaq Studio v2',
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = `ravaq-material-${st.pal.id}-${st.tpl}.json`;
    el.click();
    URL.revokeObjectURL(el.href);
    showToast('فایل JSON متریال ذخیره شد');
  }

  /* ---------- رندر UI ---------- */
  function paint() {
    const colors = st.pal.colors;
    stage.innerHTML = svgMarkup();

    $('.stu-tabs', root).innerHTML = Object.entries(TEMPLATES).map(([k, t]) =>
      `<button class="${k === st.tpl ? 'on' : ''}" data-tpl="${k}">${t.name}</button>`).join('');

    const lt = LIGHTS[st.light];
    $('.stu-light', root).innerHTML = `
      <div class="time-wrap">
        <input type="range" min="360" max="1260" step="15" value="${st.timeMin}" class="time-slider" aria-label="ساعت روز">
        <span class="time-label">${String(Math.floor(st.timeMin / 60)).padStart(2, '0')}:${String(st.timeMin % 60).padStart(2, '0')} — ${lt.name}</span>
      </div>
      <div class="light-presets">
        ${Object.entries(LIGHTS).map(([k, t]) =>
          `<button class="${k === st.light ? 'on' : ''}" data-light="${k}">${t.name}</button>`).join('')}
      </div>`;

    $('.stu-pal', root).innerHTML = colors.map((h, i) =>
      `<button style="--c:${h}" data-pick="${i}" aria-label="${h}" class="${st.sel && cur()[st.sel] === i ? 'on' : ''}"></button>`).join('');

    $('.stu-list', root).innerHTML = layers().map(l => {
      const h = hexOf(l.id);
      const matKey = matOf(l);
      const opts = Object.entries(MATERIALS).map(([k, m]) =>
        `<option value="${k}" ${k === matKey ? 'selected' : ''}>${m.name}</option>`).join('');
      return `<div class="row${st.sel === l.id ? ' on' : ''}" data-row="${l.id}">
        <i style="background:${h}"></i>
        <b>${l.name}</b>
        <select data-mat="${l.id}" class="mat-sel" aria-label="متریال">${opts}</select>
        <button data-lock="${l.id}" aria-pressed="${st.lock.has(l.id)}" aria-label="قفل">${st.lock.has(l.id) ? '🔒' : '🔓'}</button>
        <button class="hx" dir="ltr" data-copy="${h}">${h}</button>
      </div>`;
    }).join('');

    $('[data-a=undo]', root).disabled = !st.h.length;
    $('[data-a=redo]', root).disabled = !st.f.length;

    $('.stu-hint', root).textContent = st.sel
      ? `لایهٔ «${layers().find(l => l.id === st.sel)?.name}» انتخاب شده؛ یکی از رنگ‌ها را بزن.`
      : 'روی هر بخش تصویر بزن تا انتخاب شود، بعد رنگ و متریالش را تنظیم کن.';

    if (st.analysis && analysisEl) renderAnalysis();
  }

  /* ---------- CSS ---------- */
  const CSS = `
  .stu{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
  .stu[hidden]{display:none}
  .stu-sheet{width:min(640px,100%);max-height:94dvh;overflow:auto;background:var(--bg-elev);color:var(--ink);border-radius:22px 22px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -20px 60px -20px rgba(0,0,0,.6);animation:stuUp .32s cubic-bezier(.16,1,.3,1)}
  @keyframes stuUp{from{transform:translateY(40px);opacity:0}}
  @media(prefers-reduced-motion:reduce){.stu-sheet{animation:none}}
  .stu-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
  .stu-top h3{margin:0;font-size:16px;font-weight:800}
  .stu button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:var(--glass);border-radius:12px;padding:8px 12px;min-height:40px;transition:all .16s var(--ease)}
  .stu button:active{transform:scale(.96)}
  .stu button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .stu button:disabled{opacity:.4;cursor:default}
  .stu-tabs,.light-presets,.stu-tools,.stu-exports{display:flex;gap:6px;overflow-x:auto;margin:8px 0;scrollbar-width:none}
  .stu-tabs::-webkit-scrollbar,.light-presets::-webkit-scrollbar,.stu-tools::-webkit-scrollbar,.stu-exports::-webkit-scrollbar{display:none}
  .stu-tabs button,.light-presets button,.stu-tools button,.stu-exports button{flex:0 0 auto;white-space:nowrap;font-size:12.5px;padding:7px 12px;min-height:36px}
  .stu .on{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:700}
  .stage{border-radius:16px;overflow:hidden;background:var(--bg-sunk);line-height:0;touch-action:manipulation;box-shadow:var(--shadow-md)}
  .stage svg{width:100%;height:auto;display:block}
  .ly{cursor:pointer;transition:filter .28s var(--ease)}
  .ly:hover{filter:brightness(1.05)}
  .ly.sel path,.ly.sel rect,.ly.sel polygon{stroke:#fff;stroke-width:1.4;stroke-opacity:.9;paint-order:stroke}
  .stu-hint{font-size:12.5px;color:var(--ink-dim);margin:8px 2px;min-height:18px}
  .time-wrap{display:flex;align-items:center;gap:10px;padding:6px 4px}
  .time-slider{flex:1;appearance:none;height:6px;border-radius:3px;background:linear-gradient(90deg,#4a6fa5 0%,#9bb0c9 22%,#f0d9a4 50%,#e8a074 78%,#2b2d50 100%);outline:none}
  .time-slider::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:50%;background:var(--ink);border:3px solid var(--bg-elev);box-shadow:0 2px 6px rgba(0,0,0,.4)}
  .time-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--ink);border:3px solid var(--bg-elev)}
  .time-label{font-size:12px;font-weight:700;color:var(--ink-dim);direction:ltr}
  .stu-pal{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}
  .stu-pal button{background:var(--c);height:52px;border-radius:14px;border:2px solid var(--line);transition:all .16s var(--ease)}
  .stu-pal button:hover{transform:translateY(-2px)}
  .stu-pal button.on{border-color:var(--ink);box-shadow:0 0 0 3px var(--accent)}
  .stu-list .row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:12px;border:1px solid transparent}
  .stu-list .row.on{border-color:var(--accent);background:var(--glass)}
  .stu-list i{width:22px;height:22px;border-radius:7px;border:1px solid var(--line);flex:none}
  .stu-list b{flex:1;font-weight:600;font-size:13.5px}
  .stu-list .mat-sel{font-size:12px;padding:4px 6px;border-radius:8px;border:1px solid var(--line);background:var(--glass);color:inherit;min-height:30px}
  .stu-list button{padding:4px 8px;min-height:30px;font-size:12px}
  .stu-exports{flex-wrap:wrap}
  .stu-cta{flex:1 1 100%;background:var(--accent)!important;color:var(--accent-ink)!important;font-weight:800;border:0!important}
  .stu-analysis{margin-top:10px}
  .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  @media(max-width:520px){.an-grid{grid-template-columns:1fr}}
  .an-card{background:var(--glass);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
  .an-card h4{margin:0 0 8px;font-size:12.5px;font-weight:800;color:var(--ink-dim);letter-spacing:.3px}
  .an-card .bar60{display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:6px;border:1px solid var(--line)}
  .an-card .bar60 span{display:block}
  .an-card .score{font-size:12px;color:var(--ink-dim);margin-bottom:8px}
  .an-card .score b{color:var(--ink);font-size:14px}
  .an-card ul{list-style:none;margin:0;padding:0}
  .an-card li{display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;line-height:1.6}
  .an-card li .dot{width:12px;height:12px;border-radius:4px;border:1px solid var(--line);flex:none}
  .an-card li code{font-size:11px;color:var(--ink-dim)}
  .an-card li .nm{flex:1}
  .an-card li .lv{color:var(--ink-dim);font-size:11px}
  .an-card .contrast li{justify-content:space-between}
  .an-card .contrast li b{font-size:11px}
  .an-card .contrast li.ok b{color:#2ecc71}
  .an-card .contrast li.mid b{color:#f39c12}
  .an-card .contrast li.bad b{color:#e74c3c}
  .an-card .warn li{display:block}
  .an-card .warn li.ok{color:#2ecc71}
  .an-card .harm{font-size:15px;font-weight:800;margin:0}
  .harmony-actions{display:flex;gap:6px;margin-top:8px}
  .harmony-actions button{flex:1;font-size:11.5px;padding:6px 8px;min-height:32px}`;

  /* ---------- Build ---------- */
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
        <button data-a="shuffle">🎲 چیدمان هوشمند</button>
        <button data-a="undo">↶ قبلی</button>
        <button data-a="redo">↷ بعدی</button>
        <button data-a="reset">بازنشانی</button>
        <button data-a="toggle-analysis">📊 تحلیل</button>
      </div>
      <div class="stu-analysis" hidden></div>
      <div class="stu-list"></div>
      <div class="stu-exports">
        <button class="stu-cta" data-a="export">📷 ذخیره / اشتراک تصویر</button>
        <button data-a="csv">📋 CSV مشخصات</button>
        <button data-a="json">💾 JSON متریال</button>
      </div>
    </div>`;
    document.body.appendChild(root);
    stage = $('.stage', root);
    analysisEl = $('.stu-analysis', root);

    root.addEventListener('click', async (e) => {
      const t = e.target.closest('button,.ly,[data-row]');
      if (e.target === root) return close();
      if (!t) return;
      const d = t.dataset;

      if (t.classList.contains('ly')) { st.sel = d.l; haptic.select(); return paint(); }
      if (d.a === 'close') return close();
      if (d.a === 'shuffle') return shuffleSmart();
      if (d.a === 'undo' && st.h.length) { st.f.push(clone(cur())); st.as[st.tpl] = st.h.pop(); return paint(); }
      if (d.a === 'redo' && st.f.length) { st.h.push(clone(cur())); st.as[st.tpl] = st.f.pop(); return paint(); }
      if (d.a === 'reset') {
        st.lock.clear();
        const prev = clone(cur());
        autoAssign();
        const n = cur();
        st.as[st.tpl] = prev;
        return commit(n);
      }
      if (d.a === 'toggle-analysis') {
        st.analysis = !st.analysis;
        analysisEl.hidden = !st.analysis;
        if (st.analysis) renderAnalysis();
        return;
      }
      if (d.a === 'export') return exportPng().catch(() => showToast('ساخت تصویر ناموفق بود'));
      if (d.a === 'csv') return exportCSV();
      if (d.a === 'json') return exportJSON();
      if (d.tpl) {
        st.tpl = d.tpl; st.sel = null; st.h = []; st.f = []; st.lock.clear();
        if (!cur()) autoAssign();
        return paint();
      }
      if (d.light) { st.light = d.light; return paint(); }
      if (d.pick !== undefined) {
        if (!st.sel) return showToast('اول یک بخش از تصویر را انتخاب کن');
        const n = clone(cur()); n[st.sel] = +d.pick; return commit(n);
      }
      if (d.lock) {
        st.lock.has(d.lock) ? st.lock.delete(d.lock) : st.lock.add(d.lock);
        return paint();
      }
      if (d.copy) { copyText(d.copy); showToast(`${d.copy} کپی شد`); return; }
      if (d.row) { st.sel = d.row; return paint(); }
      if (d.suggest) { suggestHarmony(d.suggest); return; }
    });

    root.addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-mat]');
      if (sel) {
        st.material[sel.dataset.mat] = sel.value;
        paint();
        haptic.light();
      }
    });

    root.addEventListener('input', (e) => {
      if (e.target.classList.contains('time-slider')) {
        st.timeMin = +e.target.value;
        st.light = timeToLight(st.timeMin);
        paint();
      }
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  }

  function pickTpl(p) {
    const tags = p.tags || [];
    if (tags.includes('اتاق خواب')) return 'bedroom';
    if (tags.includes('آشپزخانه')) return 'kitchen';
    if (tags.includes('حمام')) return 'bathroom';
    if (tags.includes('اداری')) return 'office';
    if (tags.includes('کافه')) return 'cafe';
    return 'living';
  }

  function open(id) {
    const p = (window.state || state).palettes.find(x => x.id === id);
    if (!p) return;
    if (!root) build();
    Object.assign(st, {
      pal: p, tpl: pickTpl(p), as: {}, lock: new Set(),
      h: [], f: [], sel: null, light: 'noon', timeMin: 12 * 60,
      windowDir: 'S', material: {}, analysis: false,
    });
    autoAssign();
    $('#stuTitle', root).textContent = p.name;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    analysisEl.hidden = !st.analysis;
    paint();
    haptic.medium();
  }

  function close() { root.hidden = true; document.body.style.overflow = ''; }

  /* ---------- اتصال به کارت‌ها ---------- */
  function decorate() {
    $$('.pal').forEach(card => {
      const box = $('.pal-actions', card);
      if (!box || $('.act-studio', box)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act act-studio';
      b.dataset.studio = card.dataset.id;
      b.innerHTML = '<span>🎨 امتحان در فضا</span>';
      box.appendChild(b);
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-studio]');
    if (b) open(b.dataset.studio);
  });
  const list = document.getElementById('list');
  if (list) {
    new MutationObserver(decorate).observe(list, { childList: true });
    decorate();
  }
})();