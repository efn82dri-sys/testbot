/* پاکار — کارگاه زنده v2 · ایزومتریک، شبیه‌ساز زمان‌بندی‌شده (۳۶ ثانیه = یک شیفت ۰۷ تا ۱۹) */
(()=>{'use strict';
const T=36,H=17,OX=330,OY=122,DX=20,DY=10,Z4=68,MX=1,MY=6.6;
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const P=(x,y,z=0)=>[OX+(x-y)*DX,OY+(x+y)*DY-z];
const f1=n=>n.toFixed(1),S=a=>a.map(p=>f1(p[0])+','+f1(p[1])).join(' ');
const pg=(a,f,x='')=>`<polygon points="${S(a)}" fill="${f}" ${x}/>`;
const Dd=a=>'M'+a.map(p=>P(...p).map(f1).join(' ')).join('L');
const pa=(a,s,w=1,x='')=>`<path d="${Dd(a)}" stroke="${s}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
const box=(x0,y0,z0,x1,y1,z1,c,x='stroke="rgba(0,0,0,.28)" stroke-width=".5" stroke-linejoin="round"')=>pg([P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1)],c[0],x)+pg([P(x0,y1,z1),P(x1,y1,z1),P(x1,y1,z0),P(x0,y1,z0)],c[1],x)+pg([P(x1,y0,z1),P(x1,y1,z1),P(x1,y1,z0),P(x1,y0,z0)],c[2],x);
const CN=['url(#lvct)','url(#lvcl)','url(#lvcr)'],WD=['#d9b07a','#a77d4c','#7d5a35'],YL=['#ffd36e','#e0a23a','#a8702a'],BL=['#8bbfe3','#4f86b3','#35607f'],WH=['#f4f4ef','#cfd2cd','#9ca29f'],OR=['#ff9a52','#e0702c','#a84f1c'],GL=['#8fd6c9','#3f8a86','#245a5a'],GY=['#8d9692','#667069','#4a534f'],LC=['#cfc7b8','#9a9183','#756d61'];
const cl=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),rp=(s,a,b)=>cl((s-a)/(b-a)),sm=v=>v*v*(3-2*v),lerp=(a,b,t)=>a+(b-a)*t;
const lp=(p,q,t)=>[lerp(p[0],q[0],t),lerp(p[1],q[1],t)];
const PH=[[0,'آرماتوربندی ستون‌ها','#6fe3c4'],[.22,'قالب‌بندی دال','#f0b85b'],[.45,'بتن‌ریزی دال','#ff8a6b'],[.74,'نماکاری و شیشه','#8fd6c9'],[.92,'بازرسی کیفیت','#b9c8ff']];
const FEED=[[0,'شروع شیفت · ۴۸ نفر در کارگاه'],[.07,'جرثقیل ۱: بار آرماتور ∅۲۰ در حال انتقال'],[.22,'تحویل ۱۲ پالت بلوک لیکا از انبار'],[.3,'قالب‌های فلزی به طبقه ۴ منتقل شد'],[.42,'کامیون بتن ۸ مترمکعبی وارد گیت شد'],[.55,'بتن C30 · اسلامپ ۱۱ · دمای ۲۴ درجه'],[.72,'عمل‌آوری بتن دال آغاز شد'],[.8,'نصب شیشه دوجداره · طبقه ۳'],[.93,'بازرسی کیفیت ✓ تأیید شد']];
const K=[[0,-40,4,118],[.03,3,7.5,104],[.07,3,7.5,10],[.105,3,7.5,104],[.17,-37,5,104],[.2,-37,5,58],[.225,-37,5,104],[.26,3,7.5,104],[.3,3,7.5,10],[.335,3,7.5,104],[.4,-37,5,104],[.43,-37,5,76],[.46,-37,5,118],[.74,-37,5,118],[.76,3,7.5,104],[.8,3,7.5,10],[.84,3,7.5,104],[.89,-15,4.15,60],[.92,-15,4.15,46],[.955,-40,4,118],[1,-40,4,118]];
let ART='';
const CK=[[290,162,232,150,'سازه و اسکلت','L'],[364,134,448,100,'هسته مرکزی','R'],[344,196,232,196,'تاسیسات مکانیکی','L'],[400,208,448,190,'نمای خارجی','R'],[310,236,232,244,'پیلوت و زیرزمین','L'],[372,270,448,262,'انبار مصالح','R']];

function extra2(){let o='';
 // نردبان تراز و اندازه‌گذاری معماری
 o+=pa([[2.6,5.6,0],[2.6,5.6,68]],'#f0b85b',.8);
 [0,17,34,51,68].forEach((z,i)=>{const p=P(2.6,5.6,z);o+=`<path d="M${f1(p[0]-4)} ${f1(p[1])}h8" stroke="#f0b85b" stroke-width=".9"/><text x="${f1(p[0]-7)}" y="${f1(p[1]+2.3)}" text-anchor="end" fill="#f0b85b" font-size="6.3" font-weight="700">${i?'+'+fa((i*3.4).toFixed(2)).replace('.','٫'):'±۰٫۰۰'}</text>`});
 const d1=P(3,6.1),d2=P(7,6.1),mx=(d1[0]+d2[0])/2,my=(d1[1]+d2[1])/2;
 o+=`<path d="M${f1(d1[0])} ${f1(d1[1])}L${f1(d2[0])} ${f1(d2[1])}M${f1(d1[0]-2)} ${f1(d1[1]-3)}l4 6M${f1(d2[0]-2)} ${f1(d2[1]-3)}l4 6" stroke="#6fe3c4" stroke-width=".8"/><text transform="translate(${f1(mx)} ${f1(my-3)}) rotate(26.57)" text-anchor="middle" fill="#6fe3c4" font-size="6.5" font-weight="700">۱۶٫۰ متر</text>`;
 // تکیه‌گاه قالب زیر دال
 let sh='';for(let x=3.4;x<7;x+=.8)for(let y=2.4;y<5;y+=.8)sh+=Dd([[x,y,51],[x,y,Z4-3]]);
 o+=`<path id="lvshr" d="${sh}" stroke="#c9a56b" stroke-width="1" fill="none"/>`;
 // بالکن و کولر نما
 for(let i=0;i<3;i++){const z=i*H;[[2.4,3.1],[4,4.7]].forEach(([a,b])=>{o+=box(7,a,z,7.45,b,z+1.3,CN)+pa([[7.45,a,z+1.3],[7.45,b,z+1.3],[7.45,b,z+5],[7.45,a,z+5],[7.45,a,z+1.3]],'#8fd6c9',.6)});o+=box(7,3.35,z+3,7.3,3.75,z+6.5,WH)+box(7,3.35,z+5.2,7.3,3.75,z+5.6,GY)}
 // جزئیات انبار مصالح
 let y='';for(let x=7.9;x<8.7;x+=.25)y+=Dd([[x,6.3,5.6],[x,7.1,5.6]]);for(let z=.6;z<2.2;z+=.55)y+=Dd([[7.6,7.8,z],[9.6,7.8,z]]);
 o+=`<path d="${y}" stroke="#6b645a" stroke-width=".6" fill="none"/>`;
 // جرثقیل دوم
 let m='';[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b])=>m+=Dd([[9+a*.12,.6+b*.12,0],[9+a*.12,.6+b*.12,110]]));for(let z=0;z<110;z+=11)m+=Dd([[8.88,.72,z],[9.12,.72,z+11],[8.88,.72,z+11]]);
 o+=`<ellipse cx="${f1(P(9,.6)[0])}" cy="${f1(P(9,.6)[1])}" rx="12" ry="5" fill="#000" opacity=".3"/><path d="${m}" stroke="#d8a23a" stroke-width="1.1" fill="none"/><path id="lvb2" fill="none" stroke="#e5b24a" stroke-width="1.6" stroke-linejoin="round"/><path id="lvb2c" stroke="#d8d8cb" stroke-width=".9"/><g id="lvb2h">${box(-.12,-.12,-.8,.12,.12,0,OR)}</g>`;
 // راهبند و باجه نگهبانی
 o+=box(9.7,4.4,0,10.3,5,5,BL)+pg([P(9.8,5,2),P(10.2,5,2),P(10.2,5,4),P(9.8,5,4)],'#25414a')+`<path id="lvbr" fill="none" stroke="#ff5a4a" stroke-width="2.2" stroke-dasharray="4 3" stroke-linecap="round"/>`;
 // جمعیت کارگران
 [[3.6,6.4,0,'#ffd45f'],[6.6,6.5,0,'#6fe3c4'],[2.4,2.6,0,'#ff9a52'],[8.8,5.8,0,'#fff'],[5,7.1,0,'#c6e84a'],[4.5,5.4,17,'#ff9a52'],[6,5.4,34,'#6fe3c4'],[3.6,5.4,34,'#ffd45f']].forEach(([x,y,z,c],i)=>{const p=P(x,y,z);o+=`<g transform="translate(${f1(p[0])} ${f1(p[1])}) scale(1.15)"><use href="#lvw" class="wk" style="color:${c};animation-delay:${i*.23}s"/></g>`});
 o+=[1,2,3].map(i=>`<g id="lvwk${i}"><use href="#lvw" style="color:${['#ffd45f','#6fe3c4','#ff9a52'][i-1]}"/></g>`).join('');
 // پلان طبقه ۴
 const Z=Z4+.4,pt=(a)=>pg(a.map(([x,y])=>P(x,y,Z)),'rgba(111,227,196,.11)','stroke="rgba(111,227,196,.3)" stroke-width=".4"');
 o+=`<g class="pn">${pt([[3,2],[4.4,2],[4.4,3.5],[3,3.5]])+pt([[3,3.5],[4.4,3.5],[4.4,5],[3,5]])+pt([[5.8,2],[7,2],[7,3.5],[5.8,3.5]])+pt([[5.8,3.5],[7,3.5],[7,5],[5.8,5]])+pt([[4.4,3.1],[5.8,3.1],[5.8,4],[4.4,4]]).replace('.11','.32')}`;
 [[4.4,2,4.4,5],[5.8,2,5.8,5],[3,3.5,4.4,3.5],[5.8,3.5,7,3.5]].forEach(([a,b,c,d])=>o+=pa([[a,b,Z],[c,d,Z]],'#6fe3c4',1.5));
 [[4.4,2.8],[4.4,4.3],[5.8,2.8],[5.8,4.3]].forEach(([x,y])=>{const q=P(x,y,Z);o+=`<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="1.8" fill="#ffc857"/>`});
 [[3.7,2.75,'خواب ۱'],[3.7,4.25,'پذیرایی'],[6.4,2.75,'خواب ۲'],[6.4,4.25,'آشپزخانه'],[5.1,3.55,'هسته']].forEach(([x,y,t])=>{const q=P(x,y,Z);o+=`<text x="${f1(q[0])}" y="${f1(q[1])}" text-anchor="middle" fill="#f4f0e8" font-size="6.2" font-weight="800" stroke="#0d1012" stroke-width=".3">${t}</text>`});
 o+='</g>';
 // جو: سایه ابر و گرد و غبار
 o+=`<ellipse class="cld" cx="0" cy="120" rx="95" ry="30" fill="#000" opacity=".2"/><ellipse class="cld c2" cx="0" cy="250" rx="80" ry="24" fill="#000" opacity=".16"/>`+[0,1,2,3].map(i=>`<circle class="dst" cx="${250+i*3}" cy="172" r="2.4" fill="#cdbf9f" style="animation-delay:${i*.6}s"/>`).join('');
 return o}

function extra3(){let o='',r=7;const rn=()=>(r=(r*9301+49297)%233280)/233280,fm=n=>fa(n.toFixed(2)).replace('.','٫');
 const ch=(x,y,t,c)=>`<rect x="${f1(x-32)}" y="${f1(y-7)}" width="64" height="13" rx="5" fill="rgba(13,16,18,.9)" stroke="${c}"/><text x="${f1(x)}" y="${f1(y+2.6)}" text-anchor="middle" fill="#f4f0e8" font-size="7.5" font-weight="700">${t}</text>`;
 for(let i=0;i<90;i++){const x=rn()*10,y=rn()*8;if(x>2.5&&x<7.7&&y>1.5&&y<5.7)continue;const p=P(x,y);o+=`<rect x="${f1(p[0])}" y="${f1(p[1])}" width="${f1(.8+rn()*1.2)}" height=".8" fill="#fff" opacity="${f1(.08+rn()*.14)}"/>`}
 [[1.6,5.3],[8.8,2.2],[6.6,7.4]].forEach(([x,y])=>{const p=P(x,y);o+=`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="9" ry="3.2" fill="#6aa7c8" opacity=".22"/><ellipse cx="${f1(p[0]-2)}" cy="${f1(p[1]-.6)}" rx="3" ry="1" fill="#fff" opacity=".25"/>`});
 o+=pa([[7.3,3.3,0],[15,3.3,0]],'#10181a',.8,'opacity=".5"')+pa([[7.3,3.7,0],[15,3.7,0]],'#10181a',.8,'opacity=".5"');
 // جزئیات نما: بالکن، نرده شیشه‌ای، کولر، مولیون، لبه‌ی سقف
 let g='';for(let i=0;i<3;i++){const z=i*17;
  g+=box(7,2.3,z,7.5,4.2,z+1.6,['#e6dfd0','#bdb4a3','#8f8778'])+pg([P(7.5,2.3,z+1.6),P(7.5,4.2,z+1.6),P(7.5,4.2,z+8),P(7.5,2.3,z+8)],'#9fe0d6','opacity=".2" stroke="#cfeee8" stroke-width=".6"')+pa([[7.5,2.3,z+8],[7.5,4.2,z+8]],'#e9f7f4',1)+box(6.9,4.78,z+1.6,7.35,5.12,z+4.4,['#dfe2df','#9aa09d','#6f7573'])+pa([[7.0,5.12,z+2.4],[7.25,5.12,z+2.4]],'#4a534f',.6)+pa([[7.0,5.12,z+3.3],[7.25,5.12,z+3.3]],'#4a534f',.6);
  for(let j=0;j<4;j++)g+=pa([[3.5+j,5,z+1],[3.5+j,5,z+14]],'#0c1517',.5,'opacity=".45"');
  for(let j=0;j<3;j++)g+=pa([[7,2.5+j,z+1],[7,2.5+j,z+14]],'#0c1517',.5,'opacity=".45"');
  g+=pa([[3,5,z+9],[7,5,z+9]],'#d9f3ee',.5,'opacity=".3"')+pa([[7,2,z+9],[7,5,z+9]],'#d9f3ee',.5,'opacity=".3"')+pa([[3,5,z+.2],[7,5,z+.2],[7,2,z+.2]],'#fff',.7,'opacity=".35"')}
 o+=`<g class="gl">${g}</g>`;
 // تراز طبقات (Level datum)
 [0,17,34,51,68].forEach((z,i)=>{const p=P(3,5,z);o+=`<path d="M${f1(p[0]-9)} ${f1(p[1])}h9" stroke="#6fe3c4" stroke-width=".7"/><text x="${f1(p[0]-11)}" y="${f1(p[1]+2.3)}" text-anchor="end" fill="#6fe3c4" font-size="6.5" font-weight="700" direction="ltr">+${fm(i*3.2)}</text>`});
 // بام: مخزن، آنتن
 const rf=P(5.2,3.5,85);
 o+=`<g id="lvrf" transform="translate(${f1(rf[0])} ${f1(rf[1])})"><rect x="-13" y="-9" width="9" height="9" fill="#9aa7a2"/><ellipse cx="-8.5" cy="-9" rx="4.5" ry="1.8" fill="#cfd8d4"/><path d="M5 0V-18" stroke="#c9d3cf" stroke-width="1"/><circle cx="5" cy="-18" r="1.7" fill="#ff5a4a" class="cw"/><path d="M0-6h10" stroke="#c9d3cf" stroke-width=".7"/></g>`;
 // ژنراتور، مخزن آب، سرویس بهداشتی، تابلو، تیرچراغ
 const ge=P(9.2,2.2),wt=P(9.4,5.1),tl=P(.8,1.2);
 o+=box(8.9,1.95,0,9.7,2.5,3.2,['#e8b04a','#c18a2c','#8f6420'])+pa([[8.95,2.5,1.6],[9.65,2.5,1.6]],'#3b3225',.8)+`<path d="M${f1(wt[0]-8)} ${f1(wt[1])}v-11a8 3.6 0 0 1 16 0v11a8 3.6 0 0 1-16 0z" fill="#5aa3d4"/><ellipse cx="${f1(wt[0])}" cy="${f1(wt[1]-11)}" rx="8" ry="3.6" fill="#a8d6f0"/><path d="M${f1(wt[0]-8)} ${f1(wt[1]-6)}a8 3.6 0 0 0 16 0" stroke="#2f6f9b" fill="none"/>`+box(.5,.9,0,1.1,1.5,6,WH)+box(1.2,.9,0,1.8,1.5,6,BL)+pa([[.8,1.5,3],[.8,1.5,5]],'#555',.8);
 [[4.2,7.6],[.5,7.3]].forEach(([x,y])=>{const p=P(x,y);o+=`<path d="M${f1(p[0])} ${f1(p[1])}V${f1(p[1]-30)}h5" stroke="#8d9692" stroke-width="1.3" fill="none"/><rect x="${f1(p[0]+3)}" y="${f1(p[1]-32)}" width="5" height="2.4" fill="#fff3b0"/>`});
 o+=`<g><rect x="468" y="212" width="58" height="24" rx="3" fill="#10181a" stroke="#6fe3c4" stroke-opacity=".7"/><path d="M476 236v10M518 236v10" stroke="#8d9692" stroke-width="1.4"/><text x="497" y="222" text-anchor="middle" fill="#f4f0e8" font-size="7" font-weight="800">پروژه مسکونی آریا</text><text x="497" y="231" text-anchor="middle" fill="#ffc857" font-size="6" font-weight="700">کلاه ایمنی الزامی است</text></g>`;
 // مصالح: بست و دسته‌میلگرد
 [8,9.3].forEach(x=>{o+=pa([[x,7.1,0],[x,7.1,5.6]],'#e8e3d8',.7,'opacity=".7"')});o+=pa([[6.65,7,0],[6.65,7,4]],'#e8e3d8',.7)+pa([[6.6,7.8,0],[6.6,7.8,6]],'#e8e3d8',.7);
 for(let i=0;i<8;i++)o+=pa([[7.7+i*.22,7.4,2.2],[7.7+i*.22,7.8,2.2]],'#d7713d',1.1);
 // آدم‌های ثابت با انیمیشن نفس
 [[6,6,0,'#ff9a52',0],[9.6,5,0,'#f0b85b',.2],[2.8,7,0,'#6fe3c4',.4],[7.4,2.8,17,'#ffffff',.1,1],[7.4,3.7,34,'#c6e84a',.3,1]].forEach(([x,y,z,c,d,sc])=>{const p=P(x,y,z);o+=`<g${sc?' class="sc"':''} transform="translate(${f1(p[0])} ${f1(p[1])}) scale(1.15)"><use href="#lvw" class="bob" style="color:${c};animation-delay:${d}s"/></g>`});
 // بیل مکانیکی: جزئیات
 const e=P(1,4);
 o+=`<g transform="translate(${f1(e[0])} ${f1(e[1])})">${[-8,-3,3,8].map(x=>`<circle cx="${x}" cy="-1.5" r="2" fill="#1a1f20" stroke="#6b7370" stroke-width=".6"/>`).join('')}<rect x="-11" y="-5.4" width="22" height="1" fill="#555d5a"/><rect x="2" y="-18" width="4.5" height="3" fill="#bfe6ef" opacity=".7"/><path d="M-6-14v-5" stroke="#555" stroke-width="1.6"/><circle cx="-6" cy="-21" r="2" fill="#fff" class="dust"/><ellipse cx="-30" cy="1" rx="9" ry="3" fill="#a8895c"/><ellipse cx="-31" cy="-.5" rx="5" ry="1.6" fill="#c4a574"/>${[0,.3,.6].map(d=>`<circle cx="${-26-d*5}" cy="-8" r="1.2" fill="#a8895c" class="dr" style="animation-delay:${d}s"/>`).join('')}</g>`;
 // ایمنی
 let sf='';sf+=pa([[.1,2.8,0],[2.5,2.8,0],[2.5,5.3,0],[.1,5.3,0],[.1,2.8,0]],'#ffb347',1.6,'stroke-dasharray="4 3"');
 [[6,6,0],[9.6,5,0],[2.8,7,0],[7.4,2.8,17],[7.4,3.7,34]].forEach(([x,y,z])=>{const p=P(x,y,z);sf+=`<rect x="${f1(p[0]-9)}" y="${f1(p[1]-33)}" width="18" height="8" rx="3" fill="#0d1012" stroke="#6fe3c4"/><text x="${f1(p[0])}" y="${f1(p[1]-27)}" text-anchor="middle" fill="#6fe3c4" font-size="6" font-weight="800">PPE ✓</text>`});
 const as=P(.8,7.5),fa2=P(7.9,1.8);
 sf+=`<circle cx="${f1(as[0])}" cy="${f1(as[1]-8)}" r="7" fill="#1f8a5b" stroke="#fff"/><text x="${f1(as[0])}" y="${f1(as[1]-6)}" text-anchor="middle" fill="#fff" font-size="5.6" font-weight="800">تجمع</text><rect x="${f1(fa2[0]-6)}" y="${f1(fa2[1]-14)}" width="12" height="12" rx="2" fill="#fff" stroke="#d9453a"/><path d="M${f1(fa2[0])} ${f1(fa2[1]-12)}v8M${f1(fa2[0]-4)} ${f1(fa2[1]-8)}h8" stroke="#d9453a" stroke-width="2.4"/>`;
 o+=`<g class="sf">${sf}</g>`;
 // تاسیسات: مسیر برق و آب + برچسب
 o+=`<g class="mep">${pa([[9.2,2.5,0],[7.4,2.6,2],[7.1,2.6,10]],'#ffc857',1.8,'class="fl"')+pa([[9.4,5.1,0],[7.5,4.9,2],[7.1,4.3,10]],'#5ec8ff',1.8,'class="fl"')}${ch(ge[0]+6,ge[1]-22,'ژنراتور ۶۰kVA','#ffc857')}${ch(wt[0]+2,wt[1]-28,'مخزن آب ۲m³','#5ec8ff')}</g>`;
 return o}
function extra(){let o='';
 [[10,2.7],[10,4.3],[10.2,2.2],[10.2,4.8]].forEach(([x,y])=>{const p=P(x,y);o+=`<path d="M${f1(p[0]-2.5)} ${f1(p[1])}L${f1(p[0])} ${f1(p[1]-6)}L${f1(p[0]+2.5)} ${f1(p[1])}z" fill="#ff7a3c"/><path d="M${f1(p[0]-1.4)} ${f1(p[1]-2.6)}h2.8" stroke="#fff" stroke-width=".9"/>`});
 [[-1.5,3],[-2,6.5],[11,7],[12.5,6.2],[-.5,-.5]].forEach(([x,y])=>{const p=P(x,y);o+=`<ellipse cx="${f1(p[0])}" cy="${f1(p[1]+1)}" rx="7" ry="2.4" fill="#000" opacity=".3"/><path d="M${f1(p[0])} ${f1(p[1])}v-8" stroke="#5a4630" stroke-width="2"/><circle cx="${f1(p[0])}" cy="${f1(p[1]-13)}" r="7" fill="#2c5a46"/><circle cx="${f1(p[0]-2)}" cy="${f1(p[1]-15)}" r="3.6" fill="#3f7a5f"/>`});
 const e=P(1,4);
 o+=`<g transform="translate(${f1(e[0])} ${f1(e[1])})"><ellipse rx="14" ry="3" fill="#000" opacity=".3"/><rect x="-11" y="-5" width="22" height="6" rx="3" fill="#2b3032"/><rect x="-7" y="-14" width="14" height="9" rx="1.5" fill="#f0b85b"/><rect x="1" y="-19" width="6.5" height="6" rx="1" fill="#25414a"/><path id="lvea" fill="none" stroke="#f0b85b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path id="lveb" d="M-2 0l4-3v5z" fill="#d8d8cb"/></g>`;
 o+=`<g id="lvfk">${box(-.35,-.2,.6,.35,.2,3.2,OR)+box(.35,-.18,.6,.8,.18,3,LC)+box(-.3,-.15,3.2,.1,.15,4.8,GY)}</g>`;
 const sp=P(6.9,2.5,56);
 o+=`<g id="lvsp" transform="translate(${f1(sp[0])} ${f1(sp[1])})">${[0,60,120,180,240,300].map(a=>`<path class="spk" d="M0 0L${f1(5*Math.cos(a*.01745))} ${f1(5*Math.sin(a*.01745))}" stroke="#ffe08a" stroke-width="1.1" stroke-linecap="round"/>`).join('')}<circle r="1.6" fill="#fff"/></g>`;
 const v=P(2.4,6.2);
 o+=`<g><path d="M${f1(v[0])} ${f1(v[1])}l-2.4-8M${f1(v[0])} ${f1(v[1])}l2.4-8M${f1(v[0])} ${f1(v[1])}v-8" stroke="#8d9692"/><rect x="${f1(v[0]-2.5)}" y="${f1(v[1]-13)}" width="5" height="4" fill="#f0b85b"/><path d="M${f1(v[0])} ${f1(v[1]-11)}L${f1(P(4.6,4.8,22)[0])} ${f1(P(4.6,4.8,22)[1])}" stroke="#ff5a4a" stroke-width=".8" class="fl" opacity=".8"/></g>`;
 o+=`<g id="lvcu"><path d="M-26 0q9-15 20-2M-8 6q10-16 22-2M10-2q9-14 20 0" transform="translate(${f1(P(5,3.5,Z4)[0])} ${f1(P(5,3.5,Z4)[1]-3)})" stroke="#7fd0ff" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round" fill="none" class="fl"/></g>`;
 o+=`<polygon id="lvdc" fill="#6fe3c4" opacity=".15"/><g class="dn"><g id="lvdn"><ellipse rx="6" ry="2" fill="#0c1517" stroke="#6fe3c4"/><path d="M-9-2.5h18" stroke="#6fe3c4" stroke-dasharray="3 2" class="fl"/><circle cy="1.4" r="1.2" fill="#ff5a4a" class="cw"/></g></g>`;
 const lg=(a,b,c)=>pa(a,c,2,'stroke-dasharray="4 5" class="fl"');
 const q=P(13,3.5),y2=P(8.2,6.2);
 o+=`<g class="lg">${lg([[15,3.5,0],[9.2,3.5,0],[8.2,5.6,0]],0,'#ffc857')+lg([[8.2,6.1,0],[7.6,5.2,0]],0,'#6fe3c4')}<rect x="${f1(q[0]-30)}" y="${f1(q[1]-9)}" width="60" height="15" rx="6" fill="rgba(13,16,18,.88)" stroke="#ffc857"/><text x="${f1(q[0])}" y="${f1(q[1]+2)}" text-anchor="middle" fill="#f4f0e8" font-size="8.5" font-weight="700">ورود کامیون</text><rect x="${f1(y2[0]-6)}" y="${f1(y2[1]+10)}" width="60" height="15" rx="6" fill="rgba(13,16,18,.88)" stroke="#6fe3c4"/><text x="${f1(y2[0]+24)}" y="${f1(y2[1]+21)}" text-anchor="middle" fill="#f4f0e8" font-size="8.5" font-weight="700">تخلیه و انبار</text></g>`;
 CK.forEach(([ax,ay,lx,ly,t,sd],i)=>{const cx=sd=='L'?lx-78:lx;o+=`<g class="ck" id="lvk${i}"><path d="M${ax} ${ay}L${sd=='L'?lx-4:lx+4} ${ly}" stroke="#6fe3c4" stroke-width=".9" opacity=".7"/><circle class="pl" cx="${ax}" cy="${ay}" r="6" fill="none" stroke="#6fe3c4"/><circle cx="${ax}" cy="${ay}" r="6.5" fill="#0d1012" stroke="#6fe3c4" stroke-width="1.2"/><text x="${ax}" y="${ay+3.2}" text-anchor="middle" fill="#6fe3c4" font-size="8.5" font-weight="800">${fa(i+1)}</text><g class="cc"><rect x="${cx}" y="${ly-9}" width="78" height="17" rx="6" fill="rgba(13,16,18,.9)" stroke="#6fe3c4" stroke-opacity=".7"/><text x="${cx+39}" y="${ly+2.6}" text-anchor="middle" fill="#f4f0e8" font-size="8.5" font-weight="700">${t}</text></g></g>`});
 return o}


function art(){
 const cols=[];for(let x=3;x<=7;x++)for(let y=2;y<=5;y++)if(x==3||x==7||y==2||y==5)cols.push([x,y]);
 cols.sort((a,b)=>a[0]+a[1]-b[0]-b[1]);
 const k=.17,cb=(x,y,a,b,p=CN,e=k)=>box(x-e,y-e,a,x+e,y+e,b,p),slab=(z,p=CN)=>box(3,2,z-3,7,5,z,p);
 const back=cols.filter(([x,y])=>(x==3&&y<5)||(y==2&&x<7)),front=cols.filter(c=>!back.includes(c));
 const pane=(f,j,i)=>{const z0=i*H+1,z1=(i+1)*H-3;let a;
  if(!f){const xa=3+j+k,xb=4+j-k;a=[P(xa,5,z0),P(xb,5,z0),P(xb,5,z1),P(xa,5,z1)]}
  else{const ya=2+j+k,yb=3+j-k;a=[P(7,ya,z0),P(7,yb,z0),P(7,yb,z1),P(7,ya,z1)]}
  return `<g${i==2?' class="p2"':''}>${pg(a,f?'#2d6667':'url(#lvgl)')}${pg([a[3],lp(a[3],a[2],.5),lp(a[0],a[1],.3),a[0]],'#fff','opacity=".14"')}${pg(a,'url(#lvsh)')}${pg(a,'#ffd27a','class="wg"')}${(()=>{const m=lp(a[0],a[1],.5),n=lp(a[3],a[2],.5);return `<path d="M${f1(m[0])} ${f1(m[1])}L${f1(n[0])} ${f1(n[1])}" stroke="#0c1517" stroke-opacity=".55" stroke-width=".8"/>`})()}}</g>`};
 let o=`<svg class="lv-art" viewBox="150 -10 440 330" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>
<linearGradient id="lvgl" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b7e0d8"/><stop offset=".5" stop-color="#3f8a86"/><stop offset="1" stop-color="#1c3d3f"/></linearGradient>
<linearGradient id="lvrd" x1="0" x2="1"><stop stop-color="#2a3232"/><stop offset="1" stop-color="#2a3232" stop-opacity="0"/></linearGradient>
<g id="lvw"><ellipse rx="5" ry="1.6" fill="#000" opacity=".35"/><path d="M-2.2-7v7M2.2-7v7" stroke="#20282a" stroke-width="2.4"/><rect x="-3.4" y="-14" width="6.8" height="8" rx="1.6" fill="currentColor"/><path d="M-3.4-10h6.8M-3.4-8h6.8" stroke="#fff4c4" stroke-width=".9" opacity=".85"/><path d="M-3.4-13l-2.2 5M3.4-13l2.2 5" stroke="#d9a77f" stroke-width="1.4" stroke-linecap="round"/><circle cy="-16" r="2.6" fill="#d9a77f"/><path d="M-3.3-16.4a3.3 3.3 0 0 1 6.6 0z" fill="#ffd45f"/></g>
<linearGradient id="lvct" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#efe8da"/><stop offset="1" stop-color="#bdb4a3"/></linearGradient>
<linearGradient id="lvcl" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#cfc6b6"/><stop offset="1" stop-color="#8b8274"/></linearGradient>
<linearGradient id="lvcr" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9b9387"/><stop offset="1" stop-color="#554f46"/></linearGradient>
<linearGradient id="lvsh" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000" stop-opacity=".55"/><stop offset=".55" stop-color="#000" stop-opacity="0"/></linearGradient>
<radialGradient id="lvgw"><stop stop-color="#6fe3c4" stop-opacity=".16"/><stop offset="1" stop-color="#6fe3c4" stop-opacity="0"/></radialGradient>
<radialGradient id="lvbc"><stop stop-color="#ff5a4a"/><stop offset="1" stop-color="#ff5a4a" stop-opacity="0"/></radialGradient>
<clipPath id="lvcp"><circle id="lvpc" r="0"/></clipPath></defs>`;
 // زمین، رافت، جاده، سایه
 o+=`<ellipse cx="330" cy="215" rx="330" ry="170" fill="url(#lvgw)"/>`;
 [[-6,1,-1,4.5,64],[-5,5,-1,8,40],[3,-6,7,-1.5,92],[7.5,-5,12,-1,58],[12,0,16,3,34]].forEach(([x0,y0,x1,y1,h])=>{o+=box(x0,y0,0,x1,y1,h,['#232c2e','#1b2224','#12181a'],'');for(let z=8;z<h;z+=9)o+=pa([[x0+.2,y1,z],[x1-.2,y1,z]],'#ffd27a',1.8,'stroke-dasharray="1.5 7" class="cw" opacity=".4"')});
  o+=pg([P(0,0),P(10,0),P(10,8),P(0,8)],'#242c2b','stroke="rgba(111,227,196,.25)"')+pg([P(0,8),P(10,8),P(10,8,-12),P(0,8,-12)],'#141a1a')+pg([P(10,0),P(10,8),P(10,8,-12),P(10,0,-12)],'#0d1212');
 let d='';for(let i=0;i<=10;i++)d+=Dd([[i,0,0],[i,8,0]]);for(let j=0;j<=8;j++)d+=Dd([[0,j,0],[10,j,0]]);
 o+=`<path d="${d}" stroke="#fff" stroke-opacity=".045" fill="none"/>`+pg([P(2.5,1.5),P(7.5,1.5),P(7.5,5.5),P(2.5,5.5)],'#38413f')+pg([P(7.2,3),P(15,3),P(15,4),P(7.2,4)],'url(#lvrd)')+pa([[7.4,3.5,0],[14,3.5,0]],'#efe2b0',1.2,'stroke-dasharray="4 5" opacity=".5" class="fl"')+pg([P(7,5),P(3,5),P(3,2),P(7,2),P(10,2.6),P(10,5.2)],'rgba(0,0,0,.3)');
 // لایه ایمنی روی زمین
 o+=`<g class="sf"><path d="${Dd([[.3,.3,0],[9.7,.3,0],[9.7,7.7,0],[.3,7.7,0],[.3,.3,0]])}" stroke="#6fe3c4" stroke-dasharray="5 4" fill="none" opacity=".6"/><ellipse id="lvdz" rx="62" ry="31" fill="rgba(217,111,85,.16)" stroke="#ff8a6b" stroke-dasharray="5 4" class="fl"/></g>`;
 // دفتر کارگاه و تپه شن
 o+=box(8.3,.6,0,9.9,1.5,7,BL)+pg([P(8.6,1.5,2.5),P(9.1,1.5,2.5),P(9.1,1.5,5.5),P(8.6,1.5,5.5)],'#25414a')+pg([P(.8,2.4),P(2.4,2.4),P(1.6,1.6,9)],'#c9b27c')+pg([P(2.4,2.4),P(1.6,1.6,9),P(2.4,1.2)],'#9a8658');
 // ساختمان
 for(let i=0;i<3;i++){const z=i*H;o+=slab(z);o+=cols.length&&back.map(([x,y])=>cb(x,y,z,z+H)).join('');
  o+=`<g class="gl">`+[0,1,2,3].map(j=>pane(0,j,i)).join('')+[0,1,2].map(j=>pane(1,j,i)).join('')+`</g>`;
  o+=front.map(([x,y])=>cb(x,y,z,z+H)).join('')}
 o+=slab(51)+box(4.6,3.1,51,5.8,4,68,CN)+`<g id="lvcore">${box(4.6,3.1,68,5.8,4,85,CN)}</g>`;
 o+=back.map(([x,y])=>cb(x,y,51,68)).join('').replace(/^/,'<g id="lvc3b">')+'</g>';
 const cage=(x,y)=>{let s='';[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b])=>s+=Dd([[x+a*.1,y+b*.1,51],[x+a*.1,y+b*.1,75]]));
  [55,60,65,70].forEach(z=>s+=Dd([[x-.1,y-.1,z],[x+.1,y-.1,z],[x+.1,y+.1,z],[x-.1,y+.1,z],[x-.1,y-.1,z]]));return `<path class="rbc" d="${s}" stroke="#bccbc4" stroke-width=".9" fill="none"/>`};
 o+=cols.map(([x,y])=>cage(x,y)).join('');
 o+=`<g id="lvfc">${cols.map(([x,y])=>cb(x,y,51,68,WD,.27)).join('')}</g><g id="lvc3">${front.map(([x,y])=>cb(x,y,51,68)).join('')}</g>`;
 let jo='';for(let y=2.5;y<5;y+=.5)jo+=Dd([[3,y,Z4],[7,y,Z4]]);
 o+=`<g id="lvdeck">${box(3,2,Z4-3,7,5,Z4,WD)}<path d="${jo}" stroke="#7d5a35" stroke-width=".8" fill="none"/></g>`;
 const top=[P(3,2,Z4),P(7,2,Z4),P(7,5,Z4),P(3,5,Z4)];
 o+=`<g id="lvwet" clip-path="url(#lvcp)">${pg(top,'#5b5953')}${pg(top,'#9b988f','opacity=".35"')}</g><g id="lvsl">${slab(Z4)}</g>`;
 o+=`<g id="lvst">${cols.map(([x,y])=>pa([[x,y,Z4],[x,y,Z4+7]],'#bccbc4',1.2)).join('')}</g>`;
 let rl='';[[3,5],[7,5],[7,2]].forEach(([x,y],i,a)=>{rl+=Dd([[x,y,Z4],[x,y,Z4+6]]);if(i)for(const z of[3,6])rl+=Dd([[a[i-1][0],a[i-1][1],Z4+z],[x,y,Z4+z]])});
 o+=`<g id="lvrl"><path d="${rl}" stroke="#ffb347" stroke-width="1.2" fill="none"/></g>`;
 // اسکلت طرح (BIM) طبقات آینده
 o+=`<g class="gh">${[85,102].map(z=>pg([P(3,2,z),P(7,2,z),P(7,5,z),P(3,5,z)],'none','stroke="#6fe3c4" stroke-dasharray="3 3"')).join('')}${pa([[3,5,Z4],[3,5,102]],'#6fe3c4',1,'stroke-dasharray="3 3"')+pa([[7,5,Z4],[7,5,102]],'#6fe3c4',1,'stroke-dasharray="3 3"')+pa([[7,2,Z4],[7,2,102]],'#6fe3c4',1,'stroke-dasharray="3 3"')}</g>`;
 // داربست
 let sc='';for(let t=3;t<=7;t++)sc+=Dd([[t,5.4,0],[t,5.4,Z4]]);for(let t=2;t<=5;t++)sc+=Dd([[7.4,t,0],[7.4,t,Z4]]);
 for(let z=0;z<=Z4;z+=H){sc+=Dd([[3,5.4,z],[7,5.4,z],[7.4,5,z],[7.4,2,z]]);if(z<Z4)for(let t=3;t<7;t++)sc+=Dd([[t,5.4,z],[t+1,5.4,z+H]]);}
 o+=`<path class="sc" d="${sc}" stroke="#b6c4be" stroke-width=".9" fill="none" opacity=".5"/>`;
 // تاسیسات
 let me='';[[4.8,3.2,'#5ec8ff'],[5.4,3.2,'#ffc857'],[5.6,3.9,'#ff8a6b']].forEach(([x,y,c])=>me+=pa([[x,y,0],[x,y,85]],c,2,'class="fl"'));
 [17,34,51].forEach(z=>me+=pa([[3.4,4.7,z-5],[6.6,4.7,z-5],[6.6,2.4,z-5]],'#5ec8ff',1.6,'class="fl"')+pa([[3.4,4.4,z-7],[6.8,4.4,z-7]],'#ffc857',1.6,'class="fl"')+pa([[3.4,4.1,z-9],[6.4,4.1,z-9]],'#ff8a6b',2.6,'class="fl"'));
 o+=`<g class="mep">${me}</g>`;
 // بالابر مصالح
 o+=pa([[7.55,4.5,0],[7.55,4.5,86]],'#9aa7a2',1.4)+pa([[7.55,4.8,0],[7.55,4.8,86]],'#9aa7a2',1.4);let lz='';for(let z=0;z<86;z+=9)lz+=Dd([[7.55,4.5,z],[7.55,4.8,z+9]]);
 o+=`<path d="${lz}" stroke="#9aa7a2" stroke-width=".7" fill="none"/><g id="lvcab">${box(7.4,4.5,1,7.95,5.05,10,YL)}</g>`;
 // کامیون بتن‌پمپ‌دار
 const dc=P(9.7,3.5,12);
 o+=`<g id="lvtk">${[[8.7,3.9],[9.9,3.9],[10.5,3.9]].map(([x,y])=>{const p=P(x,y,3);return `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="3.4" fill="#14181a" stroke="#6b7370"/>`}).join('')}${box(8.3,3.12,3,10.4,3.88,6.5,WH)+box(8.3,3.1,6.5,9.1,3.9,12,OR)+pg([P(8.45,3.9,8.4),P(8.95,3.9,8.4),P(8.95,3.9,11),P(8.45,3.9,11)],'#25414a')+box(8.95,3.2,6.5,9.5,3.8,9,GY)}<g transform="translate(${f1(dc[0])} ${f1(dc[1])}) rotate(26.57)"><ellipse rx="17" ry="8.5" fill="#e9e7e0" stroke="#9a9b94"/><ellipse id="lvdr" rx="17" ry="8.5" fill="none" stroke="#ff9a52" stroke-width="3" stroke-dasharray="7 9"/></g></g>`;
 o+=`<path id="lvboom" fill="none" stroke="#ff9a52" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path id="lvstream" class="fl" fill="none" stroke="#8b8983" stroke-width="2.4"/><ellipse id="lvrip" rx="0" ry="0" fill="none" stroke="#c9c5bb" opacity=".6"/>`;
 // محوطه مصالح (بلوک لیکا، میلگرد، قالب، شیشه)
 o+=box(7.7,6.3,0,8.7,7.1,3,LC)+box(7.7,6.3,3,8.7,7.1,5.6,LC)+box(8.9,6.3,0,9.7,7.1,4.5,LC)+box(7.6,7.4,0,9.6,7.8,2.2,GY)+box(6.4,6.2,0,7.2,7,4,WD)+box(6.3,7.3,0,7.1,7.8,6,GL);
 o+=pa([[7.7,7.1,2.8],[8.7,7.1,2.8]],'#6b645a',.8)+pa([[7.7,7.1,5.4],[8.7,7.1,5.4]],'#6b645a',.8);
 // کارگرها
 const cw=['#ff9a52','#6fe3c4','#f0b85b','#c6e84a','#8fd6c9','#ffffff'];
 o+=`<circle id="lvhl" r="11" fill="none" stroke="#ff8a6b" stroke-width="1.6" class="fl"/>`+cw.map((c,i)=>`<g id="lvw${i+1}"><use href="#lvw" style="color:${c}"/></g>`).join('');
 // برج جرثقیل
 let tw='',tz=138,w=.14;const C=[[MX-w,MY-w],[MX+w,MY-w],[MX+w,MY+w],[MX-w,MY+w]];
 o+=box(MX-.5,MY-.5,0,MX+.5,MY+.5,2.5,CN);
 C.forEach(([x,y])=>tw+=pa([[x,y,0],[x,y,tz]],'#f1b94a',1.5));
 for(let z=0,n=0;z<tz;z+=11,n++){const a=n%2?C[2]:C[3],b=n%2?C[3]:C[2];tw+=pa([[a[0],a[1],z],[b[0],b[1],z+11]],'#a9741f',.9)+pa([[C[2][0],C[2][1],z],[C[1][0],C[1][1],z+11]],'#a9741f',.9)+pa([[C[3][0],C[3][1],z],[C[2][0],C[2][1],z],[C[1][0],C[1][1],z]],'#a9741f',.8)}
 o+=tw+pa([[MX,MY,tz],[MX,MY,152]],'#f1b94a',2)+`<circle id="lvbcn" cx="${f1(P(MX,MY,154)[0])}" cy="${f1(P(MX,MY,154)[1])}" r="9" fill="url(#lvbc)"/><g id="lvcw">${box(-.45,-.3,0,.45,.3,5,GY)}</g><g id="lvcabin">${box(-.3,-.3,0,.3,.3,4,YL)}</g>`;
 o+=`<path id="lvj3" fill="none" stroke="#e9d9a8" stroke-width=".9"/><path id="lvj2" fill="none" stroke="#a9741f" stroke-width="1"/><path id="lvj1" fill="none" stroke="#f1b94a" stroke-width="2.6" stroke-linecap="round"/><g id="lvtr">${box(-.3,-.18,-1.4,.3,.18,0,YL)}</g><path id="lvcb" stroke="#d8d8cb" stroke-width="1"/><g id="lvhk">${box(-.15,-.15,-1,.15,.15,0,OR)}</g>`;
 o+=`<g id="lvl0">${box(-.7,-.14,-3,.7,.14,0,GY)+box(-.7,-.14,-5,.7,.14,-2.4,GY)+pa([[0,0,5],[-.6,0,0]],'#ddd',.7)+pa([[0,0,5],[.6,0,0]],'#ddd',.7)}</g><g id="lvl1">${box(-.55,-.55,-3,.55,.55,-1.2,WD)+box(-.55,-.55,-1.2,.55,.55,0,WD)+pa([[0,0,5],[-.5,0,0]],'#ddd',.7)+pa([[0,0,5],[.5,0,0]],'#ddd',.7)}</g><g id="lvl2">${box(-.55,-.06,-6,.55,.06,0,GL)+pa([[0,0,5],[-.5,0,0]],'#ddd',.7)+pa([[0,0,5],[.5,0,0]],'#ddd',.7)}</g>`;
 // حصار گیت‌دار
 const fz=9;const seg=(f,a,b)=>{const q=(t,z)=>f?[t,8,z]:[10,t,z];o+=pg([P(...q(a,0)),P(...q(b,0)),P(...q(b,fz)),P(...q(a,fz))],'rgba(111,227,196,.07)')+pa([q(a,fz),q(b,fz)],'#6fe3c4',1,'opacity=".5"');for(let t=Math.ceil(a);t<=b;t++)o+=pa([q(t,0),q(t,fz)],'#ff9a52',1.3,'opacity=".8"')};
 seg(0,0,3);seg(0,4,8);seg(1,0,10);
 // پین اطلاعاتی
 o+=`<g id="lvpin"><path d="M0 0L14-22" stroke="#6fe3c4"/><circle r="4.5" fill="#6fe3c4" stroke="#fff"/><rect x="14" y="-36" width="104" height="16" rx="6" fill="rgba(13,16,18,.88)" stroke="#6fe3c4" stroke-opacity=".6"/><text id="lvpt" x="66" y="-24.5" text-anchor="middle" fill="#f4f0e8" font-size="9" font-weight="700"></text></g>`;
 o+=extra2();o+=extra3();o+=extra();
 o+=`<rect x="-100" y="-100" width="840" height="560" fill="#ffb55a" style="opacity:calc(var(--w)*.13)"/><rect x="-100" y="-100" width="840" height="560" fill="#6fe3c4" style="opacity:calc(var(--f)*.3)"/><rect id="lvbeam" y="-60" width="26" height="480" fill="#6fe3c4" opacity=".28"/></svg>`;
 return o}

const shell=()=>`<section class="rw-live lv" aria-label="کارگاه زنده پاکار">
<div class="rw-live-head"><div><span class="rw-kicker"><i></i> کارگاه زنده</span><strong>مصالح، قبل از انتخاب؛ در حال زندگی‌اند.</strong></div><span class="rw-live-state"><b></b> LIVE</span></div>
<div class="rw-stage lv-stage" data-l="skin" role="img" aria-label="نمای ایزومتریک زنده از کارگاه: جرثقیل، بتن‌ریزی و نصب نما">${ART||(ART=art())}
<div class="lv-hud lv-ph"><b></b><s class="lv-tot"></s><i><u></u><u></u><u></u><u></u><u></u></i></div>
<div class="lv-hud lv-st"><span><em>باد</em><b data-k="w"></b><small>km/h</small></span><span><em>بار جرثقیل</em><b data-k="l"></b><small>تن</small></span><span><em>بتن ریخته‌شده</em><b data-k="c"></b><small>m³</small></span></div>
<div class="lv-al">⚠ نیروی کار در شعاع بار جرثقیل</div>
<div class="lv-hud lv-lad">${[8,7,6,5,4,3,2,1].map(n=>`<div><span>${fa(n)}</span><u></u><em></em></div>`).join('')}</div><div class="lv-hud lv-map"><svg viewBox="0 0 64 52"><rect x=".5" y=".5" width="63" height="51" rx="5" fill="rgba(111,227,196,.05)" stroke="rgba(111,227,196,.3)"/><rect x="18.8" y="13.2" width="22.4" height="16.8" fill="rgba(255,255,255,.14)" stroke="#6fe3c4" stroke-width=".6"/><circle cx="7.6" cy="39" r="22" fill="none" stroke="#ff8a6b" stroke-width=".6" stroke-dasharray="2 2"/><path class="rs" d="M7.6 39L7.6 17" stroke="#ff8a6b" stroke-width=".8" opacity=".7"/><path d="M63 21L40 21L46 36" stroke="#ffc857" stroke-width=".7" stroke-dasharray="2 2" fill="none"/><circle class="rk" r="2" fill="#f1b94a"/><rect class="rt2" width="4" height="2.4" fill="#ffc857"/><circle class="rw2" r="1.6" fill="#6fe3c4"/></svg><b>نقشه سایت</b></div><div class="lv-hud lv-feed"><i class="lv-trk"><u></u><u></u><u></u><u></u></i><span></span></div></div>
<div class="lv-foot">${[['skin','نما'],['struct','سازه'],['mep','تاسیسات'],['safe','ایمنی'],['lg','لجستیک'],['plan','پلان']].map(([k,t],i)=>`<button type="button" data-lv-l="${k}"${i?'':' class="on"'}>${t}</button>`).join('')}</div></section>`;

function mount(root){
 root.setAttribute('data-lv','1');
 const st=root.querySelector('.lv-stage'),svg=st.querySelector('svg'),E={};
 svg.querySelectorAll('[id^=lv]').forEach(n=>E[n.id.slice(2)]=n);
 const rbc=[...svg.querySelectorAll('.rbc')],p2=[...svg.querySelectorAll('.p2')],ph=root.querySelector('.lv-ph'),phb=ph.querySelector('b'),segs=[...ph.querySelectorAll('u')],al=root.querySelector('.lv-al'),clk=root.querySelector('.lv-clk'),ft=root.querySelector('.lv-feed time'),fs=root.querySelector('.lv-feed span');
 const kk=[...svg.querySelectorAll('.ck')],lad=[...root.querySelectorAll('.lv-lad div')],RK=root.querySelector('.rk'),RT=root.querySelector('.rt2'),RW=root.querySelector('.rw2'),trk=root.querySelector('.lv-trk'),tot=root.querySelector('.lv-tot');const hv={};root.querySelectorAll('[data-k]').forEach(n=>hv[n.dataset.k]=n);
 const tx=(n,v)=>{if(n.textContent!==v)n.textContent=v};
 const mv=(el,x,y,z=0)=>el.setAttribute('transform',`translate(${f1((x-y)*DX)} ${f1((x+y)*DY-z)})`);
 const tp=(el,x,y,z,fl=1,b=0)=>{const p=P(x,y,z);el.setAttribute('transform',`translate(${f1(p[0])} ${f1(p[1]-b)}) scale(${fl*1.3} 1.3)`)};
 const op=(el,v)=>{el.style.opacity=v<.01?0:v},pong=(t,per)=>{const m=(t/per)%2;return m<1?m:2-m};
 let pos=T*.05,run=true,vis=true,last=0,lastDraw=0,lastF=-1;
 const rm=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(rm){run=false;pos=T*.58}

 let bv=0;const rq=(x,y)=>[x*5.6+2,y*5.6+2],ld=[];
 function X(s,sec,o){
  op(E.rf,rp(s,.55,.62));const a=.95+.3*Math.sin(sec*1.3),b=a-1.6+.4*Math.sin(sec*1.3+1.2),ex=-4-14*Math.cos(a),ey=-12-14*Math.sin(a),bx=ex-10*Math.cos(b),by=ey-10*Math.sin(b);
  E.ea.setAttribute('d',`M-4 -12L${f1(ex)} ${f1(ey)}L${f1(bx)} ${f1(by)}`);E.eb.setAttribute('transform',`translate(${f1(bx)} ${f1(by)}) rotate(${f1(b*40)})`);
  mv(E.fk,lerp(6.2,9.2,pong(sec,9)),5.9,0);
  op(E.sp,rp(s,.02,.05)*(1-rp(s,.2,.24)));
  const t=sec*.35,dp=P(5+3.6*Math.cos(t),3.5+2.8*Math.sin(t),100+3*Math.sin(sec)),tq=P(5,3.5,Z4);
  E.dn.setAttribute('transform',`translate(${f1(dp[0])} ${f1(dp[1])})`);E.dc.setAttribute('points',`${f1(dp[0])},${f1(dp[1])} ${f1(tq[0]-16)},${f1(tq[1])} ${f1(tq[0]+16)},${f1(tq[1])}`);
  op(E.cu,rp(s,.72,.76)*(1-rp(s,.95,.98)));
  const act=Math.floor(sec/4.5)%6;kk.forEach((g,i)=>g.classList.toggle('a',i==act));
  let q=rq(o.hx,o.hy);RK.setAttribute('cx',f1(q[0]));RK.setAttribute('cy',f1(q[1]));
  q=rq(9.3+o.dx,3.5);RT.setAttribute('x',f1(q[0]-2));RT.setAttribute('y',f1(q[1]-1.2));RT.style.opacity=o.dx>7?0:1;
  q=rq(o.w3x,6.9);RW.setAttribute('cx',f1(q[0]));RW.setAttribute('cy',f1(q[1]));RW.style.fill=o.alert?'#ff5a4a':'#6fe3c4';
  const p4=Math.round(rp(s,.03,.95)*100);
  lad.forEach((r,i)=>{const f=8-i,v=f<4?100:f==4?p4:0;if(ld[i]!==v){ld[i]=v;r.style.setProperty('--p',v+'%');r.classList.toggle('on',f==4);r.classList.toggle('pl',f>4);tx(r.lastChild,fa(v)+'٪')}});
  tx(tot,'پیشرفت کل '+fa(62+Math.round(p4*.06))+'٪');

  op(E.shr,.7*rp(s,.22,.3)*(1-rp(s,.76,.8)));
  const ca=sec*.12+1,cJ=d=>[9+Math.cos(ca)*d,.6+Math.sin(ca)*d,112],ty=74+8*Math.sin(sec*.5),th=cJ(4+2*Math.sin(sec*.5));
  E.b2.setAttribute('d',Dd([cJ(-2.2),cJ(7.5)])+Dd([[9,.6,118],cJ(7.5)])+Dd([[9,.6,118],cJ(-2.2)]));
  E.b2c.setAttribute('d',Dd([th,[th[0],th[1],ty]]));mv(E.b2h,th[0],th[1],ty);
  [[E.wk1,2.5,7.2,6,7.2,12],[E.wk2,9.3,1.5,9.3,5.2,14],[E.wk3,1.5,2,1.5,6,16]].forEach(([el,x0,y0,x1,y1,per],i)=>{const m=pong(sec,per);tp(el,lerp(x0,x1,m),lerp(y0,y1,m),0,(sec/per)%2<1?1:-1,Math.abs(Math.sin(sec*5+i))*.8)});
  bv+=((o.dx>.2&&o.dx<6.5?1:0)-bv)*.25;E.br.setAttribute('d',Dd([[10,4.3,4],[10,3.4,lerp(4,18,bv)]]));
  trk.style.setProperty('--p',f1(100*rp(s,.3,.5))+'%');
 }
 function draw(s){
  const sec=s*T;let i=0;while(i<K.length-2&&s>K[i+1][0])i++;
  const a=K[i],b=K[i+1],u=sm(cl((s-a[0])/(b[0]-a[0]))),th=lerp(a[1],b[1],u)*Math.PI/180,r=lerp(a[2],b[2],u),hz=lerp(a[3],b[3],u);
  const ux=Math.cos(th),uy=Math.sin(th),J=(dd,z)=>[MX+ux*dd,MY+uy*dd,z];
  let z1=Dd([J(-2.8,140),J(8,140)]),z2=Dd([J(0,146),J(8,141)]),z3=Dd([[MX,MY,152],J(8,141)])+Dd([[MX,MY,152],J(-2.8,141)]),zz=[];
  for(let q=0;q<8;q++)zz.push(J(q,140),J(q+.5,lerp(146,141,q/8)));zz.push(J(8,140));
  E.j1.setAttribute('d',z1);E.j2.setAttribute('d',z2+Dd(zz));E.j3.setAttribute('d',z3);
  mv(E.cw,J(-2.5,140)[0],J(-2.5,140)[1],134);mv(E.cabin,MX,MY,140);
  op(E.bcn,.3+.7*(Math.sin(sec*5)>0?1:0));
  const hx=MX+ux*r,hy=MY+uy*r,sw=Math.sin(sec*1.4)*.1;
  mv(E.tr,hx,hy,140);E.cb.setAttribute('d',Dd([[hx,hy,139],[hx,hy,hz]]));mv(E.hk,hx,hy,hz);
  const lt=s>.065&&s<.205?0:s>.295&&s<.435?1:s>.795&&s<.925?2:-1;
  [0,1,2].forEach(n=>{E['l'+n].style.display=n==lt?'':'none'});if(lt>=0)mv(E['l'+lt],hx+sw,hy-sw,hz-5);
  // کارگرها
  const dip=1-cl(1-Math.abs(s-.435)/.012),w3q=pong(sec,7),w3x=lerp(6.4,9.4,w3q),w3d=(sec/7)%2<1?1:-1;
  tp(E.w1,7.7,6.1,0,1,Math.abs(Math.sin(sec*2))*.6);
  tp(E.w3,w3x,6.9,0,w3d,Math.abs(Math.sin(sec*6))*.8);
  const dk=s<.435?51:Z4;
  tp(E.w2,s<.435?6.3+Math.sin(sec*.8)*.3:5.6+Math.cos(sec*.5)*.6,s<.435?2.5:3.2+Math.sin(sec*.5)*.4,dk,1,Math.abs(Math.sin(sec*4))*.9);op(E.w2,dip*(1-rp(s,.86,.9)));
  tp(E.w4,lerp(4,6,pong(sec,9)),s<.435?4.2:4.4,dk,(sec/9)%2<1?1:-1,Math.abs(Math.sin(sec*5))*.8);op(E.w4,dip*(1-rp(s,.86,.9)));
  tp(E.w5,4.4,5.5,34,1,Math.abs(Math.sin(sec*3))*.7);op(E.w5,rp(s,.8,.84)*(1-rp(s,.96,.99)));
  tp(E.w6,lerp(3,6,pong(sec,6)),6.5,0,(sec/6)%2<1?1:-1,Math.abs(Math.sin(sec*5))*.8);op(E.w6,rp(s,.9,.93)*(1-rp(s,.985,1)));
  const hd=Math.hypot(hx-w3x,hy-6.9),alert=lt>=0&&hz<80&&hd<2.3;al.classList.toggle('on',alert);
  const hp=P(hx,hy,0);E.dz.setAttribute('transform',`translate(${f1(hp[0])} ${f1(hp[1])})`);
  const wp=P(w3x,6.9,0);E.hl.setAttribute('transform',`translate(${f1(wp[0])} ${f1(wp[1]-8)})`);op(E.hl,alert?1:0);
  // سازه
  const rb=rp(s,0,.04);rbc.forEach((n,q)=>op(n,rp(s,q*.012,q*.012+.03)*(1-rp(s,.36,.4))*rb));
  op(E.fc,rp(s,.22,.3)*(1-rp(s,.76,.8)));op(E.deck,rp(s,.3,.44)*(1-rp(s,.7,.76)));op(E.c3,rp(s,.62,.72));
  E.c3b&&op(E.c3b,rp(s,.62,.72));
  const pv=rp(s,.52,.7);E.pc.setAttribute('r',f1(pv*125));E.pc.setAttribute('cx',f1(P(5.2,3.5,Z4)[0]));E.pc.setAttribute('cy',f1(P(5.2,3.5,Z4)[1]));
  op(E.wet,rp(s,.5,.53));op(E.sl,rp(s,.7,.8));op(E.rl,rp(s,.78,.84));op(E.st,rp(s,.8,.86));
  E.core.style.transformBox='fill-box';E.core.style.transformOrigin='50% 100%';E.core.style.transform=`scaleY(${f1(.02+.98*rp(s,.04,.6))})`;
  p2.forEach((n,q)=>op(n,rp(s,.88+q*.012,.9+q*.012)));
  mv(E.cab,0,0,8+(1+Math.sin(sec*.9))*35);
  // کامیون و پمپ
  const arr=sm(rp(s,.4,.47)),lv=sm(rp(s,.74,.8)),dx=8*(1-arr)+8*lv;mv(E.tk,dx,0,0);op(E.tk,dx>7?0:1);
  E.dr.setAttribute('stroke-dashoffset',f1(-sec*24*(arr>0&&lv<1?1:0)));
  const e=sm(rp(s,.47,.52))-sm(rp(s,.7,.74)),J0=[9,3.5,18],bm=[[8.6,3.5,62],[6.1,3.5,76],[5.2,3.5,69]].map(p=>p.map((v,q)=>lerp(J0[q],v,e)));
  E.boom.setAttribute('d',Dd([J0,...bm]));op(E.boom,e>.01?1:0);
  const pr=pv>0&&pv<1?1:0;E.stream.setAttribute('d',Dd([bm[2],[5.2,3.5,Z4]]));op(E.stream,pr);
  const rpP=P(5.2,3.5,Z4);E.rip.setAttribute('cx',f1(rpP[0]));E.rip.setAttribute('cy',f1(rpP[1]));E.rip.setAttribute('rx',f1(4+(sec*9)%14));E.rip.setAttribute('ry',f1((4+(sec*9)%14)/2));op(E.rip,pr);
  // ضوابط پین
  let pi=0;PH.forEach((p,q)=>{if(s>=p[0])pi=q});
  const m3=Math.round(42*pv),gn=Math.min(7,Math.round(rp(s,.88,.97)*7)),A=[[6.9,2.5,56,'آرماتور ∅۲۰ · ۱۴ ستون'],[5,3.5,70,'قالب دال · ۲۴۰ m²'],[5.2,3.5,69,`بتن C30 · ${fa(m3)}/۴۲ m³`],[5,5.2,42,`شیشه دوجداره · ${fa(gn)}/۷`],[7,5,70,'بازرسی کیفیت ✓ تأیید']][pi];
  tp(E.pin,A[0],A[1],A[2]);tx(E.pt,A[3]);
  // نور و جلوه حلقه
  const n=.9*sm(rp(s,.78,.92))*(1-sm(rp(s,.975,1))),wm=Math.max(1-rp(s,0,.12),sm(rp(s,.7,.8))*(1-rp(s,.8,.9))),f=Math.max(rp(s,.975,1),1-rp(s,0,.03));
  st.style.setProperty('--n','0');st.style.setProperty('--w',f1(wm));st.style.setProperty('--f',f1(f));st.style.setProperty('--c',PH[pi][2]);
  E.beam.setAttribute('x',f1(-30+720*rp(s,.945,1)));X(s,sec,{hx,hy,w3x,dx,alert});
  // HUD
  const mins=420+Math.round(s*720),hh=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  tx(phb,PH[pi][1]);segs.forEach((u,q)=>u.style.setProperty('--p',f1(100*rp(s,PH[q][0],q<4?PH[q+1][0]:1))+'%'));
  tx(hv.w,fa(Math.round(13+4*Math.sin(s*14))));tx(hv.l,fa(([1.8,1.2,.6][lt]||0).toFixed(1)).replace('.','٫'));tx(hv.c,fa(s<.52?0:s>.7?42:m3));
  let fi=0;FEED.forEach((p,q)=>{if(s>=p[0])fi=q});tx(fs,FEED[fi][1]);
 }
 const loop=now=>{
  if(!root.isConnected)return;requestAnimationFrame(loop);
  if(!vis||document.hidden){last=now;return}
  if(run)pos=(pos+Math.min(.1,(now-last)/1000))%T;last=now;
  if(now-lastDraw<33)return;lastDraw=now;const s=pos/T;if(s!==lastF){lastF=s;draw(s)}
 };
 draw(pos/T);requestAnimationFrame(loop);
 if('IntersectionObserver'in window)new IntersectionObserver(en=>{vis=en[0].isIntersecting}).observe(root);
 root.addEventListener('click',ev=>{
  const bt=ev.target.closest('[data-lv-l]');
  if(bt){st.dataset.l=bt.dataset.lvL;root.querySelectorAll('[data-lv-l]').forEach(x=>x.classList.toggle('on',x===bt));return}
  if(ev.target.closest('.lv-stage'))run=!run;
 });
 root.__lvSeek=v=>{pos=v*T;lastF=-1;draw(v)};
}
const scan=()=>{if(document.querySelector('.lv:not([data-lv])'))document.querySelectorAll('.lv:not([data-lv])').forEach(mount)};
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',scan);scan();
window.PakarLive={html:shell};
})();
