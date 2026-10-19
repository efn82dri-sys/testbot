(() => {
  'use strict';
  const KEY='pakar.enterprise.v1';
  const state=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}};
  const save=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}};
  const core=()=>window.PakarCore;
  const esc=s=>core()?.esc?core().esc(s):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fa=n=>core()?.fa?core().fa(n):Number(n||0).toLocaleString('fa-IR');
  const products=()=>{const c=core()?.D?.companies||[];const a=[];c.forEach(co=>(co.products||[]).forEach(p=>a.push({c:co,p})));return a};
  const price=p=>core()?.validPrice?core().validPrice(p):((typeof p.price==='number'&&p.price>0)?p.price:null);
  const score=p=>{
    let s=0, specs=(p.specs||[]).filter(x=>x?.k&&String(x.v||'').trim());
    s+=Math.min(specs.length,6)*3; if(p.source)s+=12;if(p.lastVerified)s+=8;
    s+=({verified:15,datasheet:14,field:10,experience:8,review:4}[p.confidence]||0);
    if(p.install?.steps?.length)s+=8;if(p.install?.mistakes?.length)s+=4;
    if(p.standards?.length)s+=6;if(p.techCert?.no)s+=4;if(p.sourceImageUrl||(p.images||[]).length)s+=5;
    if((p.docs||[]).length)s+=3;if(price(p)!==null)s+=5;
    return Math.max(0,Math.min(100,Math.round(s)));
  };
  function logEvent(name,data={}){
    const s=state();s.events=s.events||[];s.events.push({name,data,t:Date.now()});if(s.events.length>500)s.events=s.events.slice(-500);save(s);
  }
  function toast(t){core()?.toast?.(t)}
  function sheet(html){
    if(core()?.sheet)return core().sheet(html);
    const p=document.querySelector('#sdPanel'),s=document.querySelector('#sd');if(!p||!s)return;
    p.innerHTML=html;s.hidden=false;s.classList.add('open');
  }
  function csv(rows){
    const escv=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    return rows.map(r=>r.map(escv).join(',')).join('\n');
  }
  function download(name,text,type='text/plain;charset=utf-8'){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  }
  function injectSEO(){
    const meta=(n,c)=>{let e=document.querySelector(`meta[name="${n}"]`);if(!e){e=document.createElement('meta');e.name=n;document.head.appendChild(e)}e.content=c};
    meta('description','پاکار؛ دستیار هوشمند انتخاب، مقایسه، برآورد و اجرای مصالح ساختمانی با شناسنامه فنی و داده قابل اعتماد.');
    let ld=document.getElementById('pakar-jsonld');if(!ld){ld=document.createElement('script');ld.id='pakar-jsonld';ld.type='application/ld+json';document.head.appendChild(ld)}
    ld.textContent=JSON.stringify({"@context":"https://schema.org","@type":"WebApplication","name":"پاکار","alternateName":"Pakar","applicationCategory":"BusinessApplication","operatingSystem":"Web, Android, iOS","inLanguage":"fa-IR","description":"دستیار هوشمند انتخاب و اجرای مصالح ساختمانی"});
  }
  function projectCenter(){
    const C=core(), rows=(C?.estimateLines?.()||[]).filter(x=>x.p).map(x=>({e:{q:x.q,line:x.l},p:x.p,c:x.c,line:x.l}));
    const lp=x=>(x.line&&x.line.price>0)?x.line.price:price(x.p);
    const total=rows.reduce((n,x)=>n+(lp(x)||0)*Number(x.e.q||0),0);
    const html=`<div class="pe-shell"><span class="pe-kicker">PROJECT INTELLIGENCE</span><h2>مرکز فرمان پروژه</h2><p class="pe-muted">مقدار، هزینه و لیست خرید پروژه را در یک مسیر مدیریت کن.</p>
      <div class="pe-metrics"><div><b>${fa(rows.length)}</b><small>قلم پروژه</small></div><div><b>${fa(total)}</b><small>هزینه دارای قیمت</small></div><div><b>${fa(rows.filter(x=>lp(x)===null).length)}</b><small>نیازمند استعلام</small></div></div>
      <div class="pe-section"><div class="pe-section-head"><h3>لیست خرید</h3><div><button class="act act-primary" data-pe-share>ارسال در تلگرام</button><button class="act" data-pe-copy>کپی لیست</button><button class="act" data-pe-export>فایل CSV</button></div></div>
      ${rows.length?`<div class="pe-table"><table><thead><tr><th>محصول</th><th>مقدار</th><th>واحد</th><th>قیمت</th><th>جمع</th><th>وضعیت</th></tr></thead><tbody>${rows.map(x=>{const pr=lp(x),q=Number(x.e.q||0),sum=pr===null?null:pr*q;return `<tr><td>${esc(x.p.name)}</td><td>${fa(q)}</td><td>${esc((x.line&&x.line.unit)||x.p.unit||'واحد')}</td><td>${pr===null?'استعلام':fa(pr)}</td><td>${sum===null?'—':fa(sum)}</td><td><span class="pe-status ${pr===null?'warn':''}">${pr===null?'نیازمند استعلام':'قیمت ثبت‌شده'}</span></td></tr>`}).join('')}</tbody></table></div>`:'<div class="pe-empty">هنوز قلمی به پروژه اضافه نشده است. از شناسنامه هر محصول «افزودن به پروژه» را بزن.</div>'}</div>
      <div class="pe-section"><h3>فرآیند پروژه</h3><div class="pe-flow"><span>نیاز</span><i>→</i><span>متره</span><i>→</i><span>برآورد</span><i>→</i><span>لیست خرید</span><i>→</i><span>استعلام</span><i>→</i><span>اجرا</span></div></div></div>`;
    sheet(html);logEvent('project_center_open');
    const panel=document.querySelector('#sdPanel');if(!panel)return;
    panel.onclick=e=>{
      const csvRows=()=>[['محصول','مقدار','واحد','قیمت','جمع','وضعیت'],...rows.map(x=>{const pr=lp(x),q=Number(x.e.q||0);return[x.p.name,q,(x.line&&x.line.unit)||x.p.unit||'واحد',pr??'',pr===null?'':pr*q,pr===null?'استعلام':'قیمت ثبت‌شده']})];
      const text=()=>core().estimateSummary?core().estimateSummary():rows.map(x=>x.p.name+' × '+x.e.q).join('\n');
      if(e.target.closest('[data-pe-share]')){logEvent('shopping_list_share');core().shareText(text());}
      if(e.target.closest('[data-pe-copy]')){logEvent('shopping_list_copy');const t=text();const done=()=>toast('لیست کپی شد ✓');try{navigator.clipboard.writeText(t).then(done,()=>{throw 0});}catch(_){const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();try{document.execCommand('copy');done();}catch(__){toast('کپی انجام نشد');}a.remove();}}
      if(e.target.closest('[data-pe-export]')){download('pakar-shopping-list.csv','\uFEFF'+csv(csvRows()),'text/csv;charset=utf-8');logEvent('shopping_list_export');toast('فایل CSV آماده شد؛ اگر دانلود نشد از «کپی لیست» استفاده کن');}
    };
  }
  function priceCenter(){
    const rows=products().filter(x=>(x.p.priceLog||[]).length||price(x.p)!==null);
    const html=`<div class="pe-shell"><span class="pe-kicker">MARKET INTELLIGENCE</span><h2>مرکز قیمت و تأمین</h2><p class="pe-muted">فقط قیمت‌هایی که واقعاً در پرونده محصول ثبت شده‌اند نمایش داده می‌شوند؛ داده ساختگی تولید نمی‌شود.</p>
    <div class="pe-section"><div class="pe-section-head"><h3>آخرین قیمت‌های ثبت‌شده</h3><span class="pe-note">${fa(rows.length)} محصول دارای داده قیمت</span></div>
    ${rows.length?`<div class="pe-table"><table><thead><tr><th>محصول</th><th>قیمت</th><th>واحد</th><th>آخرین ثبت</th><th>منبع</th></tr></thead><tbody>${rows.map(x=>{const h=(x.p.priceLog||[]).filter(v=>price(v)!==null).slice(-1)[0];const pr=h?price(h):price(x.p);return `<tr><td>${esc(x.p.name)}</td><td>${pr===null?'استعلام':fa(pr)}</td><td>${esc(x.p.unit||'واحد')}</td><td>${esc(h?.date||x.p.lastVerified||'ثبت نشده')}</td><td>${esc(h?.source||x.p.source||'ثبت نشده')}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="pe-empty">هنوز قیمت معتبر در داده فعلی ثبت نشده است.</div>'}</div>
    <div class="pe-section"><h3>قواعد اعتماد قیمت</h3><ul class="pe-list"><li>هر قیمت باید واحد، تاریخ و منبع داشته باشد.</li><li>قیمت بدون تاریخ، «قیمت فعلی بازار» محسوب نمی‌شود.</li><li>پاکار قیمت یا موجودی را بدون منبع معتبر تأییدشده نمایش نمی‌دهد.</li></ul></div></div>`;
    sheet(html);logEvent('price_center_open');
  }
  function analytics(){
    const ev=state().events||[], counts={};ev.forEach(x=>counts[x.name]=(counts[x.name]||0)+1);
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12);
    const html=`<div class="pe-shell"><span class="pe-kicker">PRODUCT ANALYTICS</span><h2>تحلیل استفاده از پاکار</h2><p class="pe-muted">این داشبورد برای رویدادهای محلی همین دستگاه است؛ برای Analytics واقعی کاربران باید سرویس تحلیلی سمت سرور متصل شود.</p>
    <div class="pe-metrics"><div><b>${fa(ev.length)}</b><small>رویداد ثبت‌شده</small></div><div><b>${fa(new Set(ev.map(x=>x.name)).size)}</b><small>نوع رویداد</small></div><div><b>${fa(products().length)}</b><small>محصول</small></div></div>
    <div class="pe-section"><h3>رویدادهای پرتکرار</h3>${top.length?top.map(([n,c])=>`<div class="pe-event"><span>${esc(n)}</span><b>${fa(c)}</b></div>`).join(''):'<div class="pe-empty">هنوز رویدادی ثبت نشده است.</div>'}</div>
    <div class="pe-section"><button class="act" data-pe-clear-events>پاک‌کردن داده محلی Analytics</button><button class="act" data-pe-export-events>خروجی JSON</button></div></div>`;
    sheet(html);logEvent('analytics_open');
    const panel=document.querySelector('#sdPanel');if(!panel)return;
    panel.onclick=e=>{
      if(e.target.closest('[data-pe-clear-events]')){const s=state();s.events=[];save(s);toast('داده Analytics محلی پاک شد');analytics()}
      if(e.target.closest('[data-pe-export-events]'))download('pakar-analytics.json',JSON.stringify(state().events||[],null,2),'application/json'); 
    };
  }
  function contentStudio(){
    const s=state();s.workflow=s.workflow||{};const rows=products().slice(0,80);
    const statuses=['draft','review','approved','published','archived'], labels={draft:'پیش‌نویس',review:'در بررسی',approved:'تأییدشده',published:'منتشرشده',archived:'بایگانی'};
    const html=`<div class="pe-shell"><span class="pe-kicker">CONTENT GOVERNANCE</span><h2>استودیو محتوای پاکار</h2><p class="pe-muted">چرخه انتشار محصول را کنترل کن. وضعیت‌ها روی این دستگاه ذخیره می‌شوند؛ تأیید امنیتی واقعی باید سمت سرور اعمال شود.</p>
    <div class="pe-workflow">${statuses.map(st=>`<span>${labels[st]}</span>`).join('<i>→</i>')}</div>
    <div class="pe-section"><div class="pe-section-head"><h3>پرونده محصولات</h3><span class="pe-note">Audit Log فعال</span></div>${rows.map(x=>{const st=s.workflow[x.p.id]||'draft';return `<div class="pe-content-row"><div><b>${esc(x.p.name)}</b><small>${esc(x.c.name)} · ${fa(score(x.p))}/۱۰۰</small></div><select data-pe-status="${esc(x.p.id)}">${statuses.map(v=>`<option value="${v}" ${v===st?'selected':''}>${labels[v]}</option>`).join('')}</select></div>`}).join('')}</div>
    <div class="pe-section"><h3>Audit Log</h3>${(s.audit||[]).slice(-12).reverse().map(a=>`<div class="pe-event"><span>${esc(a.product)} · ${esc(labels[a.status]||a.status)}</span><small>${new Date(a.t).toLocaleString('fa-IR')}</small></div>`).join('')||'<div class="pe-empty">هنوز تغییری ثبت نشده است.</div>'}</div></div>`;
    sheet(html);logEvent('content_studio_open');
    const panel=document.querySelector('#sdPanel');if(!panel)return;
    panel.onchange=e=>{const id=e.target.dataset.peStatus;if(!id)return;const ss=state();ss.workflow=ss.workflow||{};ss.audit=ss.audit||[];const x=products().find(z=>z.p.id===id);ss.workflow[id]=e.target.value;ss.audit.push({product:x?.p.name||id,status:e.target.value,t:Date.now()});save(ss);toast('وضعیت پرونده ذخیره شد');contentStudio()};
  }
  function notifications(){
    const rows=products().map(x=>{const stale=!x.p.lastVerified;const missingPrice=price(x.p)===null;const noInstall=!(x.p.install?.steps||[]).length;let n=0;if(stale)n++;if(missingPrice)n++;if(noInstall)n++;return {...x,n,items:[stale?'تاریخ بررسی ندارد':'',missingPrice?'قیمت معتبر ندارد':'',noInstall?'راهنمای اجرا ندارد':''].filter(Boolean)}}).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,20);
    sheet(`<div class="pe-shell"><span class="pe-kicker">NOTIFICATION ENGINE</span><h2>مرکز اعلان‌های هوشمند</h2><p class="pe-muted">هشدارها بر اساس وضعیت واقعی داده فعلی ساخته می‌شوند.</p>${rows.map(x=>`<div class="pe-alert"><b>${esc(x.p.name)}</b><span>${x.items.map(esc).join(' · ')}</span><button class="act" data-pro-open="${esc(x.p.id)}">بررسی محصول</button></div>`).join('')||'<div class="pe-empty">هشدار مهمی وجود ندارد.</div>'}</div>`);logEvent('notifications_open');
  }
  function marketplace(){
    sheet(`<div class="pe-shell"><span class="pe-kicker">MARKETPLACE READY</span><h2>استعلام و تأمین</h2><p class="pe-muted">ساختار بازار پاکار آماده است؛ تأمین‌کننده واقعی فقط پس از اتصال Backend/Provider نمایش داده می‌شود.</p><div class="pe-market-grid"><div><b>استعلام چندفروشنده</b><small>ارسال یک درخواست به چند نمایندگی</small></div><div><b>مقایسه پیشنهادها</b><small>قیمت، فاصله، زمان تحویل و اعتبار فروشنده</small></div><div><b>Lead Management</b><small>ثبت و پیگیری درخواست‌های خرید</small></div><div><b>Sponsored شفاف</b><small>تبلیغ هرگز با امتیاز فنی پاکار مخلوط نمی‌شود.</small></div></div><div class="pe-section"><h3>قانون رتبه‌بندی</h3><p class="pe-muted">Sponsored ≠ Best. امتیاز فنی، اعتماد داده و محبوبیت کاربر باید مستقل از پرداخت تبلیغاتی بمانند.</p></div></div>`);
  }
  function hub(){
    logEvent('pro_hub_open');
    sheet(`<div class="pe-shell"><span class="pe-kicker">PAKAR ENTERPRISE</span><h2>مرکز حرفه‌ای پاکار</h2><p class="pe-muted">تمام لایه‌های تصمیم‌گیری، پروژه، داده و عملیات در یک فضای واحد.</p>
      <div class="pe-hub-grid">
       <button data-pe-tool="intel"><b>مرکز هوشمند مصالح</b><small>شناسنامه، امتیاز اعتماد و انتخاب</small></button>
       <button data-pe-tool="project"><b>مرکز فرمان پروژه</b><small>لیست خرید از برآورد واقعی پروژه</small></button>
       <button data-pe-tool="price"><b>قیمت و تأمین</b><small>فقط قیمت‌های ثبت‌شده با منبع</small></button>
       <button data-pe-tool="notifications"><b>اعلان‌های داده</b><small>نقص داده و بازبینی</small></button>
       <button data-pe-tool="health"><b>سلامت داده</b><small>کامل بودن کاتالوگ</small></button>
       ${core()?.S?.admin?'<button data-pe-tool="exp-admin"><b>مدیریت تجربه‌ها</b><small>تأیید، رد، نشان کارشناس، حذف</small></button>':''}
      </div>
      
    </div>`);
    const panel=document.querySelector('#sdPanel');if(!panel)return;
    panel.onclick=e=>{const b=e.target.closest('[data-pe-tool]');if(!b)return;const n=b.dataset.peTool;
      if(n==='project')projectCenter();else if(n==='price')priceCenter();else if(n==='analytics')analytics();else if(n==='content')contentStudio();else if(n==='notifications')notifications();else if(n==='market')marketplace();else if(n==='health')window.PakarPro?.health?.();else if(n==='exp-admin'){core().closeSheet?.();setTimeout(()=>core().action('community-admin'),320);}else if(n==='intel')window.PakarPro?.intel?.();
    };
  }
  function init(){
    // capture meaningful product events without changing existing behavior
    document.addEventListener('click',e=>{
      const p=e.target.closest('[data-prod],[data-pro-open],[data-proaction]');
      if(p)logEvent(p.dataset.proaction||'view_product',{id:p.dataset.prod||p.dataset.propid||p.dataset.proOpen||''});
    },true);
    const hero=document.querySelector('.hero');
    if(hero&&!document.getElementById('peEnterpriseBtn')){
      const b=document.createElement('button');b.id='peEnterpriseBtn';b.className='act pe-enterprise-btn';b.textContent='مرکز حرفه‌ای پاکار';b.setAttribute('aria-label','مرکز حرفه‌ای پاکار');b.onclick=hub;
      hero.appendChild(b);
    }
    window.PakarEnterprise={hub,projectCenter,priceCenter,notifications,score};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();