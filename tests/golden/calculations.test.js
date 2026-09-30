'use strict';
const assert = require('node:assert/strict');
const C = require('../../materials-app/calc-core.js');
const near = (actual, expected, label, eps=1e-6) => assert.ok(Math.abs(actual-expected)<=eps, `${label}: expected ${expected}, got ${actual}`);
let passed=0;
function test(name, fn){ fn(); passed++; console.log('PASS',name); }

test('۱. هندسه اتاق ۴×۵×۳ با بازشوی ۱×۱×۲',()=>{
 const g=C.geom({L:'4',W:'5',H:'3',dn:'1',dw:'1',dh:'2'});
 near(g.floor,20,'floor'); near(g.wall,52,'net wall');
});
test('۲. بلوک‌چینی با بند ۱۰ میلی‌متر و ضایعات ۵٪',()=>{
 const r=C.calcRun('block',{A:'10',o:'0',bl:'40',bh:'20',bt:'15',j:'10',w:'5'});
 const q=r.find(x=>x.l==='تعداد بلوک (با ضایعات)'); assert.equal(q.v,122);
});
test('۳. گچ‌کاری ۲۰ مترمربع، ۱۰ میلی‌متر، مصرف مرجع ۸، ضایعات ۱۰٪',()=>{
 const r=C.calcRun('gyp',{A:'20',t:'10',ref:'8',bag:'25',w:'10'});
 near(r.find(x=>x.l==='وزن گچ (با ضایعات)').v,176,'gypsum kg');
 assert.equal(r.find(x=>x.l==='تعداد کیسه').v,8); near(r.find(x=>x.l==='مازاد وزن').v,24,'surplus kg');
});
test('۴. کف سبک ۲۰ مترمربع با ضخامت ۵ سانتی‌متر',()=>{
 const r=C.calcRun('floor',{A:'20',T:'5',dl:'400',bag:'50',w:'5'});
 near(r.find(x=>x.l==='حجم سبکدانه (با ضایعات)').v,1.05,'volume');
 assert.equal(r.find(x=>x.l==='تعداد کیسه').v,21);
});
test('۵. کاشی: سطح ۲۰ مترمربع با ضایعات ۵٪',()=>{
 const q=C.itemQty({L:'4',W:'5',H:''},{on:'floor',per:'1'},{mode:'area',surf:'floor',perM2:1},5);
 near(q,21,'tile area');
});
test('۶. رنگ: سطح دیوار ۴۵ مترمربع، پوشش ۰٫۱۲ لیتر بر مترمربع، ضایعات ۱۰٪',()=>{
 const q=C.itemQty({L:'4',W:'3.5',H:'3'},{on:'wall',per:'0.12'},{mode:'area',surf:'wall',perM2:0.12},10);
 near(q,5.94,'paint quantity');
});
test('۷. سبکدانه حجمی: سطح ۵۰ مترمربع، ضخامت ۷ سانتی‌متر، ضایعات ۸٪',()=>{
 const q=C.itemQty({L:'10',W:'5',H:''},{on:'floor',th:'7'},{mode:'vol',surf:'floor',def:7},8);
 near(q,3.78,'aggregate volume');
});
test('۸. پانل: ۱۲ مترمربع، ابعاد ۰٫۶×۲٫۴ متر، ضایعات ۵٪',()=>{
 const r=C.calcRun('gyp',{Ap:'12',pw:'0.6',ph:'2.4',po:'0',w:'5'});
 assert.equal(r.find(x=>x.l==='تعداد پانل').v,9); near(r.find(x=>x.l==='مازاد پانل').v,0.36,'panel surplus');
});
test('۹. گرد کردن واحد فروش: ۱۷ عدد در بسته‌های ۶تایی',()=>{
 const r=C.roundToSalesUnit(17,6); assert.equal(r.units,3); assert.equal(r.roundedQuantity,18); assert.equal(r.surplus,1);
});
test('۱۰. ورودی حیاتی خالی هرگز مقدار ساختگی نمی‌دهد',()=>{
 assert.equal(C.itemQty({L:'4',W:'5',H:''},{on:'floor',per:''},{mode:'area',surf:'floor',perM2:null},null),null);
 assert.equal(C.itemQty({L:'4',W:'5',H:''},{q:''},{mode:'count'},0),null);
 assert.equal(C.calcRun('floor',{A:'20',T:'5',dl:'400',w:''}).some(x=>x.l==='حجم سبکدانه (با ضایعات)'),false);
 assert.equal(C.calcRun('block',{A:'10',bl:'40',bh:'20',j:'',w:'5'}).some(x=>x.l==='تعداد بلوک (با ضایعات)'),false);
});
test('۱۱. ارقام فارسی و عربی در ورودی عددی',()=>{
 near(C.num('۴٫۵'),4.5,'Persian digits'); near(C.num('٤٫٥'),4.5,'Arabic digits');
});
console.log(`\n${passed} golden tests passed.`);
