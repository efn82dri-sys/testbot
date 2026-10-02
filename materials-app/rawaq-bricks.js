/* رواق — Bricklings v1.1 (final)  |  کارگاه آجری رواق
   بدون هیچ فایل تصویری/ویدئویی: SVG + CSS با حرکت پله‌ای (استاپ‌موشن). حدود ۶KB.
   نصب: <script src="/materials/rawaq-bricks.js" defer></script> بعد از script.js
   هیچ تغییری در script.js لازم نیست؛ خودش .empty-icon ها را جایگزین می‌کند. */
(() => {
  const Y = '#F2B84B', R = '#E0654B', B = '#5B8DEF', G = '#5FBF9A', SK = '#F3CBA0', D = '#3D4660';
  const css = `
.bk{display:block;width:100%;max-width:210px;height:auto;margin:0 auto 8px;overflow:visible;color:var(--ink,#222)}
.bk *{animation-play-state:paused}.bk.on *{animation-play-state:running}
.bk [class^=a-]{transform-box:fill-box;transform-origin:50% 8%;animation-timing-function:steps(1);animation-iteration-count:infinite}
.bk .a-swing{animation:sw .9s}.bk .a-scr{animation:sc .8s}.bk .a-upl{animation:ul .7s}.bk .a-upr{animation:ur .7s}
.bk .a-bob{transform-origin:50% 100%;animation:bo .7s}.bk .a-nod{transform-origin:50% 100%;animation:no 1.2s}
.bk .a-drop{animation:dr 2.4s}.bk .a-beam{transform-origin:50% 50%;animation:be 1.8s}
.bk .a-wob{transform-origin:50% 50%;animation:wo 1.1s}.bk .a-q{transform-origin:50% 50%;animation:qq 1s}
.bk .a-scan{transform-origin:50% 100%;animation:sn 1.4s}.bk .a-glint{animation:gl 1.4s}.bk .a-fall{animation:fa 1.8s}
@keyframes sw{0%{transform:rotate(-30deg)}33%{transform:rotate(10deg)}66%{transform:rotate(-55deg)}}
@keyframes sc{0%{transform:rotate(125deg)}50%{transform:rotate(150deg)}}
@keyframes ul{0%{transform:rotate(140deg)}50%{transform:rotate(168deg)}}
@keyframes ur{0%{transform:rotate(-140deg)}50%{transform:rotate(-168deg)}}
@keyframes bo{0%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes no{0%{transform:rotate(0)}33%{transform:rotate(7deg)}66%{transform:rotate(-5deg)}}
@keyframes dr{0%{transform:translateY(-36px);opacity:0}15%{transform:translateY(-26px);opacity:1}30%{transform:translateY(-14px)}45%{transform:translateY(-4px)}55%,100%{transform:translateY(0)}}
@keyframes be{0%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes wo{0%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes qq{0%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes sn{0%{transform:rotate(-14deg)}50%{transform:rotate(12deg)}}
@keyframes gl{0%,60%{opacity:0}70%,100%{opacity:1}}
@keyframes fa{0%{transform:translateY(-8px);opacity:0}20%{transform:translateY(8px);opacity:1}40%{transform:translateY(32px)}60%{transform:translateY(56px)}80%{transform:translateY(80px);opacity:.4}}
.bk-pop{position:fixed;z-index:99;pointer-events:none;font:800 13px Vazirmatn,sans-serif;color:#fff;background:${R};padding:3px 8px;border-radius:8px;animation:pp .9s steps(6) forwards}
@keyframes pp{to{transform:translateY(-34px);opacity:0}}
@media (prefers-reduced-motion:reduce){.bk *{animation:none!important}}`;

  const brick = (x, y, c, cls = '') => `<g transform="translate(${x} ${y})"><g class="${cls}"><rect x="4" y="-3" width="6" height="4" rx="1.5" fill="${c}"/><rect x="14" y="-3" width="6" height="4" rx="1.5" fill="${c}"/><rect width="24" height="12" rx="2" fill="${c}"/><rect width="24" height="12" rx="2" fill="none" stroke="#0003"/></g></g>`;
  const fig = (x, y, shirt, [l, r] = ['', ''], head = '') => `<g transform="translate(${x} ${y})">
<rect x="6" y="44" width="10" height="14" rx="2" fill="${D}"/><rect x="20" y="44" width="10" height="14" rx="2" fill="${D}"/>
<rect class="${l}" x="-3" y="28" width="8" height="17" rx="4" fill="${shirt}"/><rect class="${r}" x="31" y="28" width="8" height="17" rx="4" fill="${shirt}"/>
<rect x="3" y="26" width="30" height="20" rx="5" fill="${shirt}"/><rect x="3" y="38" width="30" height="3" fill="#fff" opacity=".45"/>
<g class="${head}"><rect x="7" y="4" width="22" height="20" rx="6" fill="${SK}"/><circle cx="14" cy="14" r="1.7" fill="#2a2a2a"/><circle cx="22" cy="14" r="1.7" fill="#2a2a2a"/><path d="M14 19q4 3 8 0" stroke="#2a2a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M5 10a13 13 0 0 1 26 0z" fill="${Y}"/><rect x="13" y="-3" width="10" height="4" rx="2" fill="${Y}"/></g></g>`;
  const ground = '<rect x="8" y="98" width="144" height="4" rx="2" fill="currentColor" opacity=".15"/>';

  const SCENES = {
    build: () => ground + brick(96, 86, B) + brick(120, 86, Y) + brick(108, 74, R) + brick(108, 62, G, 'a-drop') + fig(46, 40, R, ['', 'a-swing']),
    lost: () => ground + fig(58, 40, B, ['a-scr', '']) + '<text class="a-q" x="40" y="30" font-size="22" font-weight="800" fill="currentColor">؟</text>' +
      '<g transform="translate(120 76) rotate(180)"><g class="a-wob"><rect x="-14" y="-18" width="28" height="36" rx="2" fill="#cfe3ff"/><path d="M-8-10h16M-8-3h10M-8 4h16M-8 11h7" stroke="#5B8DEF" stroke-width="1.6"/></g></g>',
    inspect: () => ground + fig(22, 40, G) + brick(104, 86, Y) + brick(128, 86, Y) + brick(116, 74, Y) +
      '<g transform="translate(78 80)"><g class="a-scan"><circle cx="0" cy="-12" r="11" fill="#bfe3ff55" stroke="currentColor" stroke-width="3"/><path d="M0 0v14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></g></g>' +
      `<path class="a-glint" d="M140 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${Y}"/>`,
    weigh: () => ground + fig(10, 40, Y, ['', ''], 'a-nod') + '<rect x="108" y="64" width="6" height="34" fill="' + D + '"/>' +
      '<g transform="translate(111 62)"><g class="a-beam"><rect x="-46" y="-2" width="92" height="4" rx="2" fill="' + D + '"/>' + brick(-58, -14, R) + brick(34, -14, B) + brick(34, -26, B) + '</g></g>',
    quote: () => ground + fig(8, 40, B, ['', 'a-swing']) + fig(116, 40, R, ['a-scr', '']) +
      '<rect x="62" y="72" width="36" height="26" rx="3" fill="' + D + '"/><rect x="66" y="75" width="28" height="8" rx="1.5" fill="#bfe3ff"/><path d="M68 88h4M76 88h4M84 88h4M68 93h4M76 93h4M84 93h4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      `<g transform="translate(80 40)"><g class="a-glint"><circle r="13" fill="none" stroke="${G}" stroke-width="3"/><path d="M-6 0l4 5 8-10" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>`,
    cheer: () => ground + '<g class="a-bob">' + fig(62, 42, Y, ['a-upl', 'a-upr']) + '</g>' +
      [[22, R, 0], [46, B, .5], [118, G, .2], [138, Y, .8], [96, R, 1.1]].map(([x, c, d]) => `<g style="animation-delay:${d}s" class="a-fall" transform="translate(${x} 0)"><rect width="10" height="6" rx="1.5" fill="${c}"/></g>`).join('')
  };
  const ICON = { '⌕': 'inspect', '⇄': 'weigh', '🧮': 'lost', '♡': 'lost', '📐': 'build', '📚': 'build', '↗': 'weigh', '⌖': 'quote', '✅': 'cheer', '✓': 'cheer', '📄': 'build' };

  const svg = (scene, label = '') => `<svg class="bk" viewBox="0 0 160 110" role="img" aria-label="${label}">${(SCENES[scene] || SCENES.lost)()}</svg>`;

  /* برج کاربر: هر مرحله‌ی چک‌لیست انجام‌شده = یک آجر. */
  const count = () => { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('rq.guide.check.')) n += (JSON.parse(localStorage.getItem(k)) || []).length; } } catch (e) {} return n; };
  const tower = (n = count()) => {
    const cols = [R, B, Y, G], shown = Math.min(n, 14), h = 40 + shown * 13;
    let b = ''; for (let i = 0; i < shown; i++) b += brick(48 + (i % 2 ? 4 : -2), h - 14 - i * 13, cols[i % 4], i === shown - 1 ? 'a-drop' : '');
    return `<svg class="bk" viewBox="0 0 120 ${h}" role="img" aria-label="برج تو: ${n} آجر"><rect x="22" y="${h - 10}" width="76" height="6" rx="2" fill="${D}"/>${b}</svg>`;
  };

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('on', e.isIntersecting)), { threshold: .2 }) : null;
  const arm = el => { el.classList.add(io ? 'bk-w' : 'on'); io && io.observe(el); };
  const enhance = (root = document) => root.querySelectorAll('.empty-icon:not([data-bk])').forEach(el => {
    const sc = ICON[el.textContent.trim()]; if (!sc) return;
    el.dataset.bk = 1; el.innerHTML = svg(sc); el.style.fontSize = '0'; arm(el.firstElementChild);
  });
  const profile = () => { const pc = document.querySelector('.profile-card'); if (!pc || pc.nextElementSibling?.classList.contains('bk-tower')) return;
    const n = count(), d = document.createElement('section'); d.className = 'profile-card bk-tower'; d.style.textAlign = 'center';
    d.innerHTML = `<span class="eyebrow">برج من</span>${tower(n)}<p style="margin:0;font-size:13px;opacity:.75">${n ? n.toLocaleString('fa') + ' آجر؛ هر مرحله‌ی انجام‌شده‌ی پرونده‌ی اجرا یک آجر است' : 'هنوز آجری نداری؛ مراحل پرونده‌ی اجرا را تیک بزن'}</p>`;
    pc.after(d); arm(d.querySelector('.bk')); };
  const hp = t => { try { Telegram.WebApp.HapticFeedback.impactOccurred(t); } catch (e) {} };
  const note = t => { try { Telegram.WebApp.HapticFeedback.notificationOccurred(t); } catch (e) {} };

  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('bk-off', document.hidden));
  document.addEventListener('change', e => {            /* هر مرحله‌ی چک‌لیست = یک آجر + لرزش */
    const c = e.target; if (!c.matches || !c.matches('[data-guide-check]')) return;
    hp(c.checked ? 'medium' : 'light');
    if (c.checked) {
      const r = c.getBoundingClientRect(), p = document.createElement('div');
      p.className = 'bk-pop'; p.textContent = '+۱ 🧱'; p.style.cssText = `left:${r.left}px;top:${r.top}px`; document.body.appendChild(p); setTimeout(() => p.remove(), 900);
      const all = c.closest('.guide-steps'); if (all && [...all.querySelectorAll('[data-guide-check]')].every(x => x.checked)) setTimeout(() => note('success'), 180);
    }
  });
  let q; new MutationObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(() => { enhance(); profile(); }); }).observe(document.body, { childList: true, subtree: true });
  enhance();
  window.Bricks = { svg, tower, count, enhance, arm, hp, note };
})();
