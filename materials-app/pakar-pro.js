(() => {
  'use strict';
  const C = () => window.PakarCore;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => C().esc(s);
  const fa = n => C().fa(n);
  const safe = u => C().safe(u);
  const allProducts = () => { const a=[]; (C().D.companies||[]).forEach(c=>(c.products||[]).forEach(p=>a.push({c,p}))); return a; };
  const normalize = s => C().nz(s);
  const price = p => C().validPrice(p);

  function scoreProduct(p){
    let s=0;
    const specs=(p.specs||[]).filter(x=>x&&x.k&&String(x.v||'').trim());
    if(specs.length>=1)s+=10; if(specs.length>=3)s+=7; if(specs.length>=6)s+=3;
    if(p.source)s+=12; if(p.lastVerified)s+=8;
    const conf={verified:15,datasheet:14,field:10,experience:8,review:4}; s+=conf[p.confidence]||0;
    if((p.install?.steps||[]).length)s+=8; if((p.install?.mistakes||[]).length)s+=4;
    if((p.standards||[]).length)s+=6; if(p.techCert?.no)s+=4;
    if((p.images||[]).length || p.sourceImageUrl)s+=5; if((p.docs||[]).length)s+=3;
    if(price(p)!==null)s+=5;
    return Math.max(0,Math.min(100,Math.round(s)));
  }
  function trustLabel(p){
    const s=scoreProduct(p); if(s>=82)return ['اعتماد بالا','ok']; if(s>=60)return ['قابل استفاده با بررسی','warn']; return ['اطلاعات نیازمند تکمیل','bad'];
  }
  function staleText(p){
    if(!p.lastVerified)return 'تاریخ بررسی ثبت نشده';
    const d=C().staleDays(p.lastVerified); if(d==null)return `بررسی: ${p.lastVerified}`;
    if(d>180)return `بررسی ${fa(d)} روز قبل`;
    if(d>90)return `بررسی ${fa(d)} روز قبل · نیازمند بازبینی`;
    return `بررسی ${fa(d)} روز قبل`;
  }
  function related(p){
    const terms=normalize([p.group,p.name,...(p.features||[])].join(' ')).split(' ').filter(x=>x.length>2).slice(0,12);
    return allProducts().map(x=>({x,n:terms.reduce((n,t)=>n+(normalize([x.p.group,x.p.name,...(x.p.features||[])].join(' ')).includes(t)?1:0),0)})).filter(x=>x.x.p.id!==p.id&&x.n>0).sort((a,b)=>b.n-a.n).slice(0,4).map(x=>x.x);
  }
  function productIntel(p,c){
    const score=scoreProduct(p), [label,state]=trustLabel(p), specs=(p.specs||[]).filter(x=>x&&x.k&&String(x.v||'').trim());
    const apps=(p.features||[]).slice(0,5), noUse=(p.notSuitableFor||p.notSuitable||[]).slice?.(0,4)||[];
    const hist=(p.priceLog||[]).filter(x=>x&&price(x)!==null).slice(-6);
    const scoreCopy=score>=82?'پرونده محصول از نظر داده، منبع و شواهد در وضعیت خوبی است.':score>=60?'اطلاعات کاربردی است، اما برای تصمیم نهایی چند بخش باید تکمیل یا بازبینی شود.':'برای تصمیم حرفه‌ای، ابتدا منبع و مشخصات فنی را بررسی و تکمیل کن.';
    return `<section class="px-product-intel">
      <div class="px-product-score-row"><div class="px-score-big"><div><b>${fa(score)}</b><small>/ ۱۰۰</small></div></div><div class="px-product-score-copy"><b>امتیاز اعتماد پرونده پاکار · ${esc(label)}</b><p>${esc(scoreCopy)}</p></div></div>
      <div class="px-progress" aria-label="امتیاز اعتماد"><i style="--w:${score}%"></i></div>
      <div class="px-trust-grid"><div class="px-trust-cell"><b>${fa(specs.length)}</b><small>مشخصه فنی</small></div><div class="px-trust-cell"><b>${fa((p.standards||[]).length)}</b><small>استاندارد</small></div><div class="px-trust-cell"><b>${fa((p.docs||[]).length)}</b><small>فایل اجرایی</small></div></div>
      <div class="px-trust"><span class="px-dot ${state==='warn'?'warn':state==='bad'?'bad':''}"></span>${esc(staleText(p))} · منبع: ${esc(p.source||'ثبت نشده')}</div>
      ${apps.length||noUse.length?`<div class="px-use-grid">${apps.length?`<div class="px-use"><b>مناسب برای</b><ul>${apps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}${noUse.length?`<div class="px-use"><b>برای این موارد مناسب نیست</b><ul>${noUse.map(x=>`<li>${esc(typeof x==='string'?x:x.text||x.title||'—')}</li>`).join('')}</ul></div>`:''}</div>`:''}
      <div class="px-action-grid"><button class="act" data-proaction="addproject" data-propid="${esc(p.id)}">＋ افزودن به پروژه</button><button class="act" data-proaction="compare" data-propid="${esc(p.id)}">مقایسه حرفه‌ای</button><button class="act" data-proaction="recommend" data-propid="${esc(p.id)}">چرا این محصول؟</button><button class="act" data-proaction="assistant" data-propid="${esc(p.id)}">از پاکار بپرس</button></div>
      ${hist.length?`<div class="grp">روند قیمت ثبت‌شده</div><div class="px-price-bars">${hist.map((x,i)=>{const vals=hist.map(y=>price(y)||0),mx=Math.max(...vals)||1,v=price(x)||0;return `<div title="${esc(x.date||'')} · ${fa(v)} تومان"><i style="height:${Math.max(8,Math.round(v/mx*100))}%"></i><small>${esc(String(x.date||'').slice(-5))}</small></div>`}).join('')}</div>`:''}
    </section>`;
  }

  /* افزودن «شناسنامه هوشمند» به شیت اصلی محصول؛ شیت اصلی (تب‌ها، تجربه‌ها، چک‌لیست، ارسال فایل، استعلام، ویرایش مدیر) دست‌نخورده می‌ماند */
  function decorate(pid){
    const pair=C().find(pid); if(!pair||!pair[1])return; const [c,p]=pair;
    const host=document.querySelector('#sdPanel .sd-scroll'); if(!host||host.querySelector('.px-embedded'))return;
    let intel=productIntel(p,c)
      .replace(/<button class="act" data-proaction="addproject"[^>]*>[^<]*<\/button>/,'')
      .replace(/<button class="act" data-proaction="compare"[^>]*>[^<]*<\/button>/,'');
    const rel=related(p);
    const wrap=document.createElement('div'); wrap.className='px-pro-product px-embedded';
    wrap.innerHTML=intel+(rel.length?`<div class="grp">محصولات مرتبط</div><div class="px-related">${rel.map(x=>`<button type="button" class="px-related-card" data-pro-open="${esc(x.p.id)}"><b>${esc(x.p.name)}</b><small>${esc(x.c.name)} · امتیاز ${fa(scoreProduct(x.p))}</small></button>`).join('')}</div>`:'');
    const grp=[...host.querySelectorAll('.grp')].find(g=>/مشخصات فنی/.test(g.textContent));
    if(grp)grp.parentNode.insertBefore(wrap,grp); else { const a=host.querySelector('.product-summary')||host.firstElementChild; a?a.insertAdjacentElement('afterend',wrap):host.appendChild(wrap); }
  }

  function productSearch(q){
    const words=normalize(q).split(/\s+/).filter(Boolean);
    if(!words.length)return allProducts().slice(0,8);
    const aliases={
      'عایق':'حرارتی صوتی عایق', 'سبک':'سبکدانه سبک سازی', 'رطوبت':'آب رطوبت ضدآب', 'کف':'کف سازی کف', 'نما':'نما facade', 'بلوک':'بلوک دیوار', 'سریع':'سرعت اجرا', 'ارزان':'اقتصادی قیمت'
    };
    const expanded=words.flatMap(w=>(aliases[w]||w).split(/\s+/));
    return allProducts().map(x=>{const hay=normalize([x.c.name,x.c.cat,x.p.name,x.p.group,x.p.desc,...(x.p.features||[]),(x.p.specs||[]).map(s=>s.k+' '+s.v)].join(' '));let s=0;expanded.forEach(w=>{if(hay.includes(w))s+=w.length>3?2:1});if(normalize(x.p.name).startsWith(words[0]))s+=4;return {...x,s}}).filter(x=>x.s>0).sort((a,b)=>b.s-scoreProduct(b.p)/100-a.s+scoreProduct(a.p)/100).slice(0,12);
  }
  function resultCard(x){const [label,state]=trustLabel(x.p);return `<article class="px-result"><div class="px-result-head"><div><b>${esc(x.p.name)}</b><small>${esc(x.c.name)} · ${esc(x.p.group||x.c.cat||'مصالح')}</small></div><div class="px-score">${fa(scoreProduct(x.p))}<em>اعتماد</em></div></div><div class="px-tags"><span class="px-tag">${esc(label)}</span>${price(x.p)!==null?`<span class="px-tag">${fa(price(x.p))} تومان</span>`:''}${x.p.availability?`<span class="px-tag">${esc(x.p.availability)}</span>`:''}</div><div class="px-trust"><span class="px-dot ${state==='warn'?'warn':state==='bad'?'bad':''}"></span>${esc(staleText(x.p))}</div><div class="ft"><button class="act act-primary" data-pro-open="${esc(x.p.id)}">مشاهده شناسنامه حرفه‌ای</button><button class="act" data-proaction="compare" data-propid="${esc(x.p.id)}">مقایسه</button></div></article>`}

  function openIntel(initial=''){
    const results=productSearch(initial);
    const html=`<div class="px-intel-shell"><div class="px-intel-hero"><span class="px-pro-kicker">PAKAR INTELLIGENCE</span><h2>قبل از خرید، مطمئن انتخاب کن.</h2><p>محصول را بر اساس کاربرد، مشخصات، منبع، تازگی اطلاعات و تجربه اجرایی بررسی کن؛ نه فقط نام و قیمت.</p><div class="px-intel-search"><input id="pxSearch" value="${esc(initial)}" placeholder="مثلاً: بلوک سبک برای دیوار داخلی…" autocomplete="off"><button class="act act-primary" data-prosearch>جست‌وجو</button></div></div><div class="px-intel-grid"><button class="px-intel-tile" data-protool="wizard"><b>راهنمای انتخاب</b><small>نیاز پروژه را بگو تا گزینه‌های مناسب را پیدا کنیم.</small></button><button class="px-intel-tile" data-protool="assistant"><b>پاکار هوشمند</b><small>سؤال فنی‌ات را بر اساس دیتای پاکار بررسی کن.</small></button><button class="px-intel-tile" data-protool="compare"><b>مقایسه حرفه‌ای</b><small>دو یا چند محصول را کنار هم تصمیم‌محور ببین.</small></button><button class="px-intel-tile" data-protool="health"><b>سلامت داده</b><small>تازگی و کامل بودن اطلاعات محصولات را ببین.</small></button></div><div id="pxIntelResults" class="px-intel-section"><h3>${initial?'نتایج پیشنهادی':'محصولات منتخب برای شروع'}</h3>${results.length?results.map(resultCard).join(''):'<div class="empty"><p>نتیجه‌ای پیدا نشد. عبارت دیگری مثل «کف»، «عایق» یا نام محصول را امتحان کن.</p></div>'}</div></div>`;
    C().sheet(html);
  }

  function openWizard(){
    const st={climate:'mixed',location:'wall',problem:'thermal',budget:'mid',priority:'balance'};
    const options=(k,items)=>items.map(([v,l])=>`<button data-wk="${k}" data-wv="${v}" class="${st[k]===v?'on':''}">${l}</button>`).join('');
    const renderW=()=>{const picked=allProducts().map(x=>{let s=0,h=normalize([x.p.name,x.p.group,x.p.desc,...(x.p.features||[]),(x.p.specs||[]).map(a=>a.k+' '+a.v)].join(' ')); if(st.problem==='moisture'&&/رطوبت|آب|ضدآب|زیرزمین/.test(h))s+=5;if(st.problem==='thermal'&&/حرارت|عایق|سبک/.test(h))s+=5;if(st.problem==='sound'&&/صدا|آکوستیک/.test(h))s+=5;if(st.location==='floor'&&/کف|floor/.test(h))s+=4;if(st.location==='wall'&&/دیوار|بلوک/.test(h))s+=4;if(st.budget==='economy'&&price(x.p)!==null)s+=Math.max(0,5-scoreProduct(x.p)/25);if(st.priority==='trust')s+=scoreProduct(x.p)/20;return {...x,s}}).sort((a,b)=>b.s-a.s).slice(0,5);return `<div class="px-wizard"><span class="px-pro-kicker">SELECTION ENGINE</span><h2>راهنمای انتخاب پاکار</h2><p class="hint">نیاز واقعی پروژه را انتخاب کن؛ نتیجه بر اساس داده ثبت‌شده پیشنهاد می‌شود.</p><div class="px-step"><h4>۱. مسئله اصلی چیست؟</h4><div class="px-choice">${options('problem',[['thermal','عایق حرارتی'],['moisture','رطوبت'],['sound','عایق صوتی'],['speed','سرعت اجرا']])}</div></div><div class="px-step"><h4>۲. محل مصرف</h4><div class="px-choice">${options('location',[['wall','دیوار'],['floor','کف'],['roof','سقف'],['facade','نما']])}</div></div><div class="px-step"><h4>۳. بودجه</h4><div class="px-choice">${options('budget',[['economy','اقتصادی'],['mid','متعادل'],['pro','حرفه‌ای']])}</div></div><div class="px-step"><h4>۴. اولویت</h4><div class="px-choice">${options('priority',[['balance','تعادل'],['trust','اطمینان داده'],['speed','سرعت اجرا']])}</div></div><div class="px-intel-section"><h3>پیشنهادهای پاکار</h3>${picked.length?picked.map(resultCard).join(''):'<div class="empty"><p>با داده فعلی محصول مناسبی پیدا نشد.</p></div>'}</div></div>`};
    C().sheet(renderW());
    const panel=$('#sdPanel'); if(!panel)return;
    panel.addEventListener('click',function onW(e){const b=e.target.closest('[data-wk]');if(!b)return;st[b.dataset.wk]=b.dataset.wv;const current=panel.querySelector('.px-wizard');if(current){current.outerHTML=renderW();}else{panel.innerHTML=renderW();}});
  }

  function openAssistant(pid){
    const pair=pid?C().find(pid):null; const p=pair&&pair[1];
    const starter=p?`درباره «${p.name}» سؤال کن؛ مثلاً برای چه کاربردی مناسب است یا چه نکته اجرایی مهمی دارد.`:'سؤال فنی‌ات را بنویس؛ پاکار بر اساس اطلاعات ثبت‌شده در کاتالوگ پاسخ می‌دهد.';
    const html=`<div class="px-assistant"><span class="px-pro-kicker">PAKAR COPILOT · OFFLINE READY</span><h2 style="margin:4px 0">پاکار هوشمند</h2><p class="hint">پاسخ‌ها فقط از داده‌های ثبت‌شده در پاکار ساخته می‌شوند. برای تصمیم سازه‌ای یا ایمنی، دیتاشیت و مسئول فنی پروژه مرجع نهایی است.</p><div class="px-chat" id="pxChat"><div class="px-bubble bot">${esc(starter)}</div></div><div class="px-chatbar"><input id="pxAsk" placeholder="مثلاً این محصول برای کف مناسب است؟"><button class="act act-primary" data-proask>بپرس</button></div></div>`;
    C().sheet(html);
    const panel=$('#sdPanel');
    const answer=(q)=>{const qq=normalize(q), rows=productSearch(qq);let text='اطلاعات کافی برای پاسخ دقیق پیدا نکردم.';if(p){if(/مناسب|کاربرد|کجا/.test(qq))text=`برای «${p.name}»، کاربردهای ثبت‌شده: ${(p.features||[]).join('، ')||'ثبت نشده'}.`;else if(/مشخص|فنی|ضریب|چگالی/.test(qq))text=`در شناسنامه ${p.specs?.length||0} مشخصه ثبت شده است: ${(p.specs||[]).slice(0,4).map(x=>x.k+' = '+x.v).join('؛ ')||'مشخصات کافی ثبت نشده'}.`;else if(/قیمت|هزینه/.test(qq))text=price(p)!==null?`قیمت ثبت‌شده فعلی: ${fa(price(p))} تومان / ${p.unit||'واحد'}؛ تاریخ و منبع قیمت را در شناسنامه بررسی کن.`:'قیمت معتبر ثبت نشده و باید استعلام شود.';else if(/اجرا|نصب/.test(qq))text=`مراحل اجرای ثبت‌شده: ${(p.install?.steps||[]).slice(0,4).join('، ')||'راهنمای اجرا ثبت نشده است.'}`;}
      else if(rows.length) text=`نزدیک‌ترین نتایج: ${rows.slice(0,3).map(x=>x.p.name).join('، ')}. برای انتخاب نهایی شناسنامه هرکدام را باز کن.`; const chat=$('#pxChat',panel);if(chat){chat.insertAdjacentHTML('beforeend',`<div class="px-bubble user">${esc(q)}</div><div class="px-bubble bot">${esc(text)}</div>`);chat.scrollTop=chat.scrollHeight;}};
    panel.addEventListener('click',e=>{if(e.target.closest('[data-proask]')){const i=$('#pxAsk',panel);if(i&&i.value.trim()){answer(i.value.trim());i.value='';}}});
    panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='pxAsk'){const i=e.target;if(i.value.trim()){answer(i.value.trim());i.value='';}}});
  }

  function openCompare(pid){
    const ids=[pid,...(C().S.cmp||[])].filter(Boolean);const unique=[...new Set(ids)].slice(0,4);const rows=unique.map(id=>{const x=C().find(id);return x&&x[1]?{c:x[0],p:x[1]}:null}).filter(Boolean);
    if(rows.length<2){C().toast('برای مقایسه، حداقل دو محصول را انتخاب کن');return openIntel(pid?'': '');}
    const keys=[...new Set(rows.flatMap(x=>(x.p.specs||[]).map(s=>s.k)))].slice(0,12);
    const html=`<div class="px-intel-shell"><span class="px-pro-kicker">DECISION MATRIX</span><h2>مقایسه تصمیم‌محور</h2><p class="hint">اعداد و مشخصات فقط وقتی نمایش داده می‌شوند که در پرونده محصول ثبت شده باشند.</p><div class="px-compare-table"><table class="spt"><thead><tr><th>معیار</th>${rows.map(x=>`<th>${esc(x.p.name)}</th>`).join('')}</tr></thead><tbody><tr><td>امتیاز اعتماد</td>${rows.map(x=>`<td><b>${fa(scoreProduct(x.p))}</b>/۱۰۰</td>`).join('')}</tr><tr><td>قیمت</td>${rows.map(x=>`<td>${price(x.p)!==null?fa(price(x.p))+' تومان':'استعلام'}</td>`).join('')}</tr>${keys.map(k=>`<tr><td>${esc(k)}</td>${rows.map(x=>{const s=(x.p.specs||[]).find(y=>y.k===k);return `<td>${s?esc(s.v):'—'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div><div class="ft">${rows.map(x=>`<button class="act" data-pro-open="${esc(x.p.id)}">شناسنامه ${esc(x.p.name)}</button>`).join('')}</div></div>`;
    C().sheet(html);
  }

  function health(){
    const rows=allProducts(); const total=rows.length||1; const avg=Math.round(rows.reduce((n,x)=>n+scoreProduct(x.p),0)/total);const priced=rows.filter(x=>price(x.p)!==null).length;const verified=rows.filter(x=>['verified','datasheet'].includes(x.p.confidence)).length;const install=rows.filter(x=>(x.p.install?.steps||[]).length).length;
    const card=(n,l)=>`<div class="px-health-card"><b>${fa(n)}</b><small>${l}</small><div class="px-health-bar"><i style="--w:${Math.round(n/total*100)}%"></i></div></div>`;
    C().sheet(`<div class="px-intel-shell"><span class="px-pro-kicker">DATA TRUST CENTER</span><h2>سلامت داده‌های پاکار</h2><p class="hint">این داشبورد کیفیت و کامل بودن پرونده‌ها را نشان می‌دهد؛ نه کیفیت ذاتی محصولات.</p><div class="px-health"><div class="px-health-card"><b>${fa(avg)}</b><small>میانگین امتیاز اعتماد</small><div class="px-health-bar"><i style="--w:${avg}%"></i></div></div>${card(priced,'محصول دارای قیمت ثبت‌شده')}${card(verified,'محصول دارای منبع تأییدشده')}${card(install,'محصول دارای راهنمای اجرا')}</div><div class="grp">اولویت‌های تکمیل</div><div class="empty"><p>قیمت، تاریخ بازبینی، استاندارد و راهنمای اجرا مهم‌ترین نقاطی هستند که با تکمیل آن‌ها اعتماد به کاتالوگ بالاتر می‌رود.</p></div></div>`);
  }

  function launchMarkup(){return `<section class="px-pro-launch" id="pxProLaunch"><div class="px-pro-card"><span class="px-pro-kicker">PAKAR PRO</span><h3>قبل از خرید، تصمیم بگیر.</h3><p>شناسنامه فنی، اعتبار داده، مقایسه و پیشنهاد انتخاب؛ حالا در یک مسیر واحد.</p><div class="px-pro-actions"><button class="act act-primary" data-protool="intel">مرکز هوشمند مصالح</button><button class="act" data-protool="wizard">راهنمای انتخاب</button></div></div><div class="px-pro-mini"><span class="px-pro-kicker">DATA TRUST</span><div class="px-pro-metrics"><div class="px-pro-metric"><b id="pxMetricProducts">—</b><small>محصول</small></div><div class="px-pro-metric"><b id="pxMetricTrusted">—</b><small>پرونده معتبر</small></div></div><button class="act" style="margin-top:9px;width:100%" data-protool="health">مشاهده سلامت داده</button></div></section>`}
  function refreshLaunch(){
    const hero=$('.hero'); if(!hero)return;let el=$('#pxProLaunch');if(!el){hero.insertAdjacentHTML('beforeend',launchMarkup());el=$('#pxProLaunch');}
    const rows=allProducts(), trusted=rows.filter(x=>scoreProduct(x.p)>=82).length;const a=$('#pxMetricProducts'),b=$('#pxMetricTrusted');if(a)a.textContent=fa(rows.length);if(b)b.textContent=fa(trusted);
  }
  function routeTool(name){if(name==='intel')return openIntel();if(name==='wizard')return openWizard();if(name==='assistant')return openAssistant();if(name==='compare')return openCompare();if(name==='health')return health();}
  function handleAction(e){
    const tool=e.target.closest('[data-protool]');if(tool){e.preventDefault();return routeTool(tool.dataset.protool);}
    const search=e.target.closest('[data-prosearch]');if(search){const q=$('#pxSearch')?.value||'';const res=productSearch(q);const box=$('#pxIntelResults');if(box)box.innerHTML=`<h3>${q?'نتایج جست‌وجو':'محصولات منتخب'}</h3>${res.length?res.map(resultCard).join(''):'<div class="empty"><p>نتیجه‌ای پیدا نشد.</p></div>'}`;return;}
    const po=e.target.closest('[data-pro-open]');if(po){e.preventDefault();return C().openProd(po.dataset.proOpen);}
    const act=e.target.closest('[data-proaction]');if(act){const id=act.dataset.propid;const a=act.dataset.proaction;if(a==='addproject'){C().addToEstimate(id);}else if(a==='compare'){C().toggleCompare(id);}else if(a==='recommend'){openWizard();}else if(a==='assistant'){openAssistant(id);}return;}
    if(e.target.closest('[data-pro-close]')){const p=$('#sd');if(p){p.classList.remove('open');p.hidden=true;}}
  }
  window.PakarPro = { health, intel: openIntel, wizard: openWizard, assistant: openAssistant, compare: openCompare, product: pid=>C().openProd(pid), decorate, refresh: refreshLaunch };
  function init(){
        refreshLaunch(); let tries=0; const t=setInterval(()=>{tries++; try{ if(C()&&C().D&&(C().D.companies||[]).length){refreshLaunch();clearInterval(t);} }catch(_){} if(tries>40)clearInterval(t);},500);
    document.addEventListener('click',handleAction,true);
    window.addEventListener('online',()=>refreshLaunch());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
