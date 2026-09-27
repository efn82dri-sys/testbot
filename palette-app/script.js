const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); }

function textColor(hex){
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  return yiq >= 150 ? '#1A1A16' : '#F3EEE7';
}

async function loadPalettes(){
  const list = document.getElementById('list');
  try{
    const res = await fetch('/palettes/data/palettes.json', { cache: 'no-store' });
    const palettes = await res.json();
    list.innerHTML = '';
    palettes.forEach((p, i) => {
      const sec = document.createElement('section');
      sec.className = 'pal';
      sec.style.animationDelay = `${i * 70}ms`;
      sec.innerHTML = `
        <div class="pal-head">
          <h2>${p.name}</h2>
          <span class="idx">${String(i + 1).padStart(2, '0')} / ${palettes.length}</span>
        </div>
        <p class="desc">${p.desc}</p>
        <div class="swatches">
          ${p.colors.map(c => `
            <button class="sw" style="background:${c};color:${textColor(c)}" data-c="${c}">
              <span class="lab">رنگ</span><span class="hex">${c}</span>
              <span class="check"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>کپی شد</span>
            </button>`).join('')}
        </div>`;
      list.appendChild(sec);
    });
  }catch(err){
    list.innerHTML = '<p style="color:var(--ink-dim)">بارگذاری پالت‌ها ممکن نشد. دوباره تلاش کن.</p>';
  }
}

document.getElementById('list').addEventListener('click', e => {
  const btn = e.target.closest('.sw');
  if (!btn) return;
  const val = btn.dataset.c;
  const done = () => {
    btn.classList.add('copied');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    setTimeout(() => btn.classList.remove('copied'), 1300);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(val).then(done).catch(fallback);
  else fallback();
  function fallback(){
    try {
      const t = document.createElement('textarea');
      t.value = val; document.body.appendChild(t); t.select();
      document.execCommand('copy'); t.remove(); done();
    } catch (e) {}
  }
});

document.getElementById('themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const cur = root.getAttribute('data-theme');
  root.setAttribute('data-theme', cur === 'light' ? 'dark' : 'light');
});

loadPalettes();
