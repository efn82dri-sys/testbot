/* رواق — سفر مصالح: از خاک تا دیوار (اسکرول‌محور) */
(() => {
'use strict';
const fa = n => Number(n || 0).toLocaleString('fa-IR');
const CH = [
 ['معدن', 'همه‌چیز از خاک شروع می‌شود', 'رس مناسب استخراج، خشک و دانه‌بندی می‌شود. کیفیت محصول نهایی از همین‌جا تعیین می‌شود.'],
 ['کوره', 'پختن در بیش از هزار درجه', 'داخل کوره‌ی دوار، دانه‌های رس منبسط می‌شوند و هسته‌ای پر از حفره‌های ریز می‌سازند؛ نتیجه سبک و عایق است.'],
 ['آزمون', 'قبل از بسته‌بندی، سنجیده می‌شود', 'وزن، جذب آب و مقاومت فشاری نمونه‌ها اندازه‌گیری می‌شود. برگه‌ی مشخصات فنی از همین آزمون‌ها می‌آید.'],
 ['حمل', 'پالت‌بندی و ارسال', 'محصول روی پالت بسته می‌شود و به انبار یا کارگاه می‌رسد. شرط‌های حمل و تاریخ تولید را همان‌جا بررسی کن.'],
 ['اجرا', 'رج به رج، سر کارگاه', 'بلوک‌ها با ملات چیده می‌شوند. جرثقیل بار را بالا می‌برد و دیوار هر روز کمی بلندتر می‌شود.'],
 ['ساختمان', 'دیوار تمام شد؛ حالا از داخل', 'وزن مرده کمتر، عایق بهتر و فضای داخلی آرام‌تر. حالا مصالح واقعی را در کاتالوگ ببین.']
];
const rows = Array.from({ length: 8 }, (_, r) => Array.from({ length: 6 }, (_, c) => `<rect class="row" style="--r:${7 - r}" x="${(r % 2 ? 70 : 90) + c * 40}" y="${70 + r * 20}" width="38" height="18" rx="2" fill="${(r + c) % 3 ? 'var(--c-blk)' : 'var(--c-blk2)'}"/>`).join('')).join('');
const pts = Array.from({ length: 9 }, (_, i) => `<circle class="pt" style="--k:${(0.4 + (i % 4) * .22).toFixed(2)}" cx="${120 + i * 18}" cy="${186 + (i % 3) * 9}" r="${3 + i % 3}"/>`).join('');
const gr = Array.from({ length: 7 }, (_, i) => `<circle class="gr" cx="${32 + (i % 3) * 14}" cy="${196 + (i % 2) * 6}" r="6" style="transform:translateY(calc(var(--l)*${34 + i * 3}px))"/>`).join('');
const dl = Array.from({ length: 9 }, (_, i) => `<rect class="dl" x="${50 + i * 40 - 40}" y="118" width="12" height="90" fill="rgba(255,255,255,.12)"/>`).join('');
const blks = [0, 1, 2, 3].map(i => `<rect x="${86 + i * 36}" y="128" width="32" height="22" rx="3" fill="var(--c-blk)"/><rect x="${86 + i * 36}" y="${128}" width="32" height="6" rx="3" fill="var(--c-blk2)" opacity=".6"/>`).join('');
const SCENE = `<svg viewBox="0 0 400 270" role="img" aria-label="مسیر ساخت مصالح از خاک تا ساختمان">
<defs><clipPath id="jrd"><rect x="70" y="118" width="260" height="90" rx="45"/></clipPath><clipPath id="jrw"><rect x="70" y="70" width="260" height="160"/></clipPath></defs>
<g class="st st0"><ellipse class="gnd" cx="200" cy="236" rx="180" ry="26"/><path d="M40 236 130 140 190 186 262 104 360 236Z" fill="var(--c-earth)"/><path d="M262 104 360 236 280 236Z" fill="var(--c-earth2)"/><path d="M130 140 190 186 152 236H40Z" fill="var(--c-earth2)" opacity=".55"/><ellipse cx="200" cy="228" rx="46" ry="9" fill="#000" opacity=".35"/>${pts}</g>
<g class="st st1"><ellipse class="gnd" cx="200" cy="244" rx="180" ry="22"/><path d="M130 244l14-44h24l-8 44zM260 244l-14-44h-24l8 44z" fill="var(--c-steel2)"/><g transform="rotate(-9 200 163)"><rect x="70" y="118" width="260" height="90" rx="45" fill="var(--c-steel)"/><g clip-path="url(#jrd)">${dl}</g><rect x="150" y="118" width="9" height="90" fill="var(--c-steel2)"/><rect x="250" y="118" width="9" height="90" fill="var(--c-steel2)"/></g><path class="flame" d="M66 188c-26-4-40 10-44 24 20-2 30 2 44 6z"/>${gr}</g>
<g class="st st2"><ellipse class="gnd" cx="190" cy="240" rx="180" ry="22"/><rect x="90" y="206" width="200" height="22" rx="7" fill="var(--c-steel)"/><rect x="150" y="146" width="88" height="60" fill="var(--c-blk)"/><path d="M150 146l22-16h88l-22 16z" fill="var(--c-blk2)" opacity=".7"/><path d="M238 146l22-16v60l-22 16z" fill="var(--c-blk2)"/><g fill="var(--c-blk2)" opacity=".7"><rect x="172" y="162" width="14" height="30" rx="3"/><rect x="196" y="162" width="14" height="30" rx="3"/></g><circle cx="332" cy="110" r="44" fill="var(--bg-elev)" stroke="var(--line)" stroke-width="2"/><path d="M299 135A44 44 0 1 1 365 135" fill="none" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/><line class="needle" x1="332" y1="110" x2="332" y2="76" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><circle cx="332" cy="110" r="6" fill="var(--accent)"/><path class="chk" pathLength="1" d="M156 96l16 16 32-34" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
<g class="st st3"><ellipse class="gnd" cx="200" cy="244" rx="190" ry="20"/><rect x="0" y="238" width="400" height="6" fill="var(--c-steel2)"/><g class="trk"><rect x="60" y="130" width="184" height="86" rx="7" fill="var(--c-steel)"/>${blks}<path d="M244 216V152h40l24 30v34z" fill="var(--c-steel2)"/><path d="M254 160h24l16 22h-40z" fill="var(--bg-elev)" opacity=".8"/>${[100, 190, 276].map(x => `<circle cx="${x}" cy="222" r="17" fill="#1b1d20"/><circle cx="${x}" cy="222" r="6" fill="var(--c-steel)"/>`).join('')}</g></g>
<g class="st st4"><ellipse class="gnd" cx="200" cy="244" rx="180" ry="22"/><rect x="262" y="34" width="12" height="206" fill="var(--c-steel)"/><rect x="92" y="34" width="210" height="9" fill="var(--c-steel)"/><rect x="274" y="43" width="30" height="22" fill="var(--c-steel2)"/><rect class="cab" x="139" y="43" width="2.5" height="100" fill="var(--ink-dim)"/><g class="hk"><rect x="124" y="143" width="32" height="22" rx="3" fill="var(--c-blk)"/></g>${[0, 1, 2].map(i => `<rect x="${96 + i * 36}" y="214" width="34" height="22" rx="3" fill="var(--c-blk)"/>`).join('')}${[0, 1].map(i => `<rect x="${114 + i * 36}" y="192" width="34" height="22" rx="3" fill="var(--c-blk2)"/>`).join('')}</g>
<g class="st st5"><ellipse class="gnd" cx="200" cy="244" rx="190" ry="20"/><rect x="60" y="50" width="280" height="20" rx="4" fill="var(--c-steel)"/><g clip-path="url(#jrw)">${rows}</g><g class="win"><rect x="162" y="104" width="76" height="68" rx="4" fill="#FFD58A"/><path d="M200 104v68M162 138h76" stroke="var(--c-steel)" stroke-width="3"/></g></g></svg>`;
let host, built, off;
function build(D) {
  const prod = D.companies.reduce((n, c) => n + c.products.length, 0);
  host.innerHTML = `<div class="jr" data-s="0"><div class="jr-pin"><div class="jr-stage"><div class="jr-floor"></div><div class="jr-fl">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 96};--y:${(i * 53) % 90};--v:${0.4 + (i % 4) * .3}"></i>`).join('')}</div><div class="jr-plane">${SCENE}</div></div>
<div class="jr-info">${CH.map((c, i) => `<div class="jr-ch ${i ? '' : 'on'}"><small>مرحله ${fa(i + 1)} از ${fa(CH.length)} · ${c[0]}</small><h2>${c[1]}</h2><p>${c[2]}</p>${i === CH.length - 1 ? `<button type="button" class="jr-go" data-jr="go">دیدن ${fa(prod)} محصول از ${fa(D.companies.length)} برند</button>` : ''}</div>`).join('')}</div>
<div class="jr-rail" role="tablist" aria-label="مراحل">${CH.map((c, i) => `<button type="button" data-jr="${i}" aria-label="${c[0]}"></button>`).join('')}</div><span class="jr-hint">برای دیدن مسیر، اسکرول کن</span></div><button type="button" class="jr-skip" data-jr="go">رد شدن و رفتن به کاتالوگ</button></div>`;
  host.onclick = e => {
    const b = e.target.closest('[data-jr]'); if (!b) return; const v = b.dataset.jr, jr = host.querySelector('.jr');
    if (v === 'go') { const f = document.getElementById('filters'); f && f.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const top = jr.getBoundingClientRect().top + scrollY, span = jr.offsetHeight - innerHeight;
    scrollTo({ top: top + span * (Number(v) + .5) / CH.length, behavior: 'smooth' });
  };
}
function listen() {
  const jr = host.querySelector('.jr'), chs = [...jr.querySelectorAll('.jr-ch')], bars = [...jr.querySelectorAll('.jr-rail button')];
  let raf = 0, last = -1;
  const tick = () => {
    raf = 0; const r = jr.getBoundingClientRect(), span = Math.max(1, r.height - innerHeight);
    const p = Math.min(1, Math.max(0, -r.top / span)), x = p * CH.length, s = Math.min(CH.length - 1, Math.floor(x)), l = Math.min(1, x - s);
    jr.style.setProperty('--p', p.toFixed(4)); jr.style.setProperty('--l', (s === CH.length - 1 ? Math.min(1, l * 1.0) : l).toFixed(4));
    bars.forEach((b, i) => b.style.setProperty('--f', i < s ? 1 : i === s ? l.toFixed(3) : 0));
    if (p > .01) jr.classList.add('moved');
    if (s !== last) { last = s; jr.dataset.s = s; chs.forEach((c, i) => c.classList.toggle('on', i === s)); bars.forEach((b, i) => b.setAttribute('aria-selected', i === s)); }
  };
  const on = () => { raf || (raf = requestAnimationFrame(tick)); };
  addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); tick();
  return () => { removeEventListener('scroll', on); removeEventListener('resize', on); raf && cancelAnimationFrame(raf); };
}
window.RQJourney = {
  sync(D, show) {
    host = host || document.getElementById('journey'); if (!host || !D) return;
    if (show && !built) { build(D); built = true; }
    host.hidden = !show || !built;
    if (show && !off) off = listen(); else if (!show && off) { off(); off = null; }
  }
};
})();