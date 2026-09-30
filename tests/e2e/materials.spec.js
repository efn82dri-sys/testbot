const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.confirm = () => false;
    window.prompt = () => null;
    window.Telegram = { WebApp: { initData: 'mock-init-data', initDataUnsafe: { user: { id: 1001, first_name: 'تست', username: 'ravaq_test' } }, ready(){}, expand(){}, HapticFeedback:{impactOccurred(){}}, openTelegramLink(){}, close(){} } };
  });
});

test('five primary tabs are reachable and accessible', async ({ page }) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/materials');
  await expect(page.locator('#list')).toBeVisible();
  const tabs=page.locator('#bottomNav [role="tab"]');
  await expect(tabs).toHaveCount(5);
  for (const tab of await tabs.all()) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected','true');
    await expect(tab).toHaveAttribute('aria-controls','list');
  }
  expect(errors).toEqual([]);
});

test('search, glossary and room example work', async ({ page }) => {
  await page.goto('/materials');
  await page.locator('#search').fill('بلوک');
  await expect(page.locator('#list')).toContainText('بلوک');
  await page.locator('#bottomNav [data-tab="tools"]').click();
  await page.locator('#list [data-tab="glossary"]').click();
  await expect(page.locator('#list')).toContainText('واژه‌نامه‌ی فنی');
  await page.locator('#bottomNav [data-tab="tools"]').click();
  await page.locator('#list [data-tab="room"]').click();
  await page.locator('#list [data-x="room-example"]').click();
  await expect(page.locator('#list')).toContainText('مثال اتاق ۴×۵');
});

test('simple/pro mode persists locally and review queue opens', async ({ page }) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/materials');
  await page.locator('#bottomNav [data-tab="profile"]').click();
  await page.locator('[data-x="set-mode"][data-mode="pro"]').click();
  await expect(page.locator('html')).toHaveClass(/pro-mode/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('rq.mat.mode'))).toBe('pro');
  await page.locator('[data-tab="manage"]').click();
  await page.locator('[data-x="review-queue"]').click();
  await expect(page.locator('#sdPanel')).toContainText('صف تأیید محصول و مجوز رسانه');
  await expect(page.locator('#reviewBrand')).toBeVisible();
  await page.locator('#sdPanel [data-x="scok"]').click();
  expect(errors).toEqual([]);
});

test('slow-4G LCP and first-party JavaScript bytes are measurable', async ({ page }) => {
  const client=await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions',{offline:false,latency:562,downloadThroughput:180*1024/8,uploadThroughput:80*1024/8,connectionType:'cellular3g'});
  await page.addInitScript(()=>{window.__lcp=0;try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__lcp=Math.max(window.__lcp,e.startTime)}).observe({type:'largest-contentful-paint',buffered:true})}catch(e){}});
  await page.goto('/materials');
  await page.waitForTimeout(3000);
  const result=await page.evaluate(()=>({lcp:window.__lcp,resources:performance.getEntriesByType('resource').filter(r=>/\/materials\/(script|calc-core)\./.test(r.name)).map(r=>({name:r.name,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}))}));
  expect(result.resources.length).toBeGreaterThan(0);
  console.log('Slow-4G metrics:',JSON.stringify(result));
});

test('cached catalog paints before a delayed network response (<500ms)', async ({ page }) => {
  const fs=require('node:fs'); const path=require('node:path');
  const seed=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../materials-app/data/materials.json'),'utf8'));
  seed.companies.forEach(c=>{c.products=(c.products||[]).filter(p=>p.sourceImageUrl||(p.images||[]).length||p.cdnImageUrl);});
  await page.addInitScript((data)=>{
    localStorage.setItem('rq.mat.catalog.cache',JSON.stringify(data));
    window.__firstCatalogAt=null;
    new MutationObserver(()=>{if(window.__firstCatalogAt===null&&document.querySelector('.mc'))window.__firstCatalogAt=performance.now();}).observe(document,{childList:true,subtree:true});
    const original=window.fetch.bind(window);
    window.fetch=(input,init)=>String(input).includes('/materials/api/data')?new Promise((resolve,reject)=>setTimeout(()=>original(input,init).then(resolve,reject),1000)):original(input,init);
  },seed);
  await page.goto('/materials');
  await expect(page.locator('.mc').first()).toBeVisible();
  const ms=await page.evaluate(()=>window.__firstCatalogAt);
  console.log('Cached catalog first paint (ms):',ms);
  expect(ms).not.toBeNull();
  expect(ms).toBeLessThan(500);
});

test('visible buttons across primary tabs expose an action hook (dead-button audit)', async ({ page }) => {
  await page.goto('/materials');
  const tabs=page.locator('#bottomNav [role="tab"]');
  const dead=[]; const counts={};
  for (const tab of await tabs.all()) {
    const tabName=await tab.getAttribute('data-tab');
    await tab.click();
    const result=await page.locator('#list button:visible').evaluateAll(buttons=>({
      count:buttons.length,
      dead:buttons.filter(b=>!b.disabled&&!b.getAttribute('href')&&!b.hasAttribute('onclick')&&!['submit','reset'].includes(b.type)&&!Array.from(b.attributes).some(a=>a.name.startsWith('data-')&&a.name!=='data-testid')).map(b=>({text:(b.innerText||'').trim().slice(0,80),html:b.outerHTML.slice(0,180)}))
    }));
    counts[tabName]=result.count;
    dead.push(...result.dead.map(x=>({...x,tab:tabName})));
  }
  console.log('Button audit counts:',JSON.stringify(counts));
  console.log('Buttons without a declared interaction hook:',JSON.stringify(dead));
  expect(dead).toEqual([]);
});


test('tablist has valid relationships and RTL keyboard navigation', async ({ page }) => {
  await page.goto('/materials');
  const tabs=page.locator('#bottomNav [role="tab"]');
  await expect(page.locator('#bottomNav')).toHaveAttribute('role','tablist');
  await expect(page.locator('#list')).toHaveAttribute('role','tabpanel');
  await expect(page.locator('#list')).toHaveAttribute('tabindex','-1');
  await tabs.first().focus(); await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#list')).toBeFocused();
  await tabs.first().focus(); await page.keyboard.press('End'); await expect(tabs.last()).toHaveAttribute('aria-selected','true');
  await tabs.last().focus(); await page.keyboard.press('Home'); await expect(tabs.first()).toHaveAttribute('aria-selected','true');
  for (const tab of await tabs.all()) {
    const controls=await tab.getAttribute('aria-controls');
    expect(controls).toBeTruthy(); await expect(page.locator('#'+controls)).toHaveAttribute('role','tabpanel');
  }
});

test('Slow-4G LCP budget is reported and asserted when browser timing is available', async ({ page }) => {
  const client=await page.context().newCDPSession(page); await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions',{offline:false,latency:562,downloadThroughput:180*1024/8,uploadThroughput:80*1024/8,connectionType:'cellular3g'});
  await page.addInitScript(()=>{window.__ravaqLcp=0;try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__ravaqLcp=Math.max(window.__ravaqLcp,e.startTime)}).observe({type:'largest-contentful-paint',buffered:true})}catch(e){}});
  await page.goto('/materials'); await page.waitForTimeout(3500);
  const metrics=await page.evaluate(()=>({lcp:window.__ravaqLcp,js:performance.getEntriesByType('resource').filter(x=>/\/materials\/.*\.js/.test(x.name)).map(x=>({url:x.name,bytes:x.encodedBodySize||x.transferSize||0}))}));
  console.log('Slow-4G LCP assertion metrics:',JSON.stringify(metrics));
  expect(metrics.lcp).toBeGreaterThan(0); expect(metrics.lcp).toBeLessThanOrEqual(2500); expect(metrics.js.length).toBeGreaterThan(0);
});


test('verification and media-license actions open explicit forms with required fields', async ({ page }) => {
  await page.goto('/materials');
  await page.locator('#bottomNav [data-tab="profile"]').click();
  await page.locator('[data-tab="manage"]').click();
  await page.locator('[data-x="review-queue"]').click();
  const verify=page.locator('#sdPanel [data-x="verify-product"]').first();
  if(await verify.count()){
    await verify.click();
    await expect(page.locator('#verifyUrl')).toBeVisible(); await expect(page.locator('#verifyPage')).toBeVisible();
    await expect(page.locator('#verifyDate')).toBeVisible(); await expect(page.locator('#verifyReviewer')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-x="review-queue"]').click();
  const license=page.locator('#sdPanel [data-x="approve-license"]').first();
  if(await license.count()){
    await license.click(); await expect(page.locator('#licenseSource')).toBeVisible();
    await expect(page.locator('#licenseHolder')).toBeVisible(); await expect(page.locator('#licenseDate')).toBeVisible();
  }
});
