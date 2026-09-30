// Lazy glossary view. All definitions are generic and explicitly require specialist review.
export const glossaryTerms = Object.freeze([
 {term:'ضریب هدایت حرارتی',definition:'شاخصی برای توصیف انتقال گرما از ماده؛ مقدار و واحد را از دیتاشیت همان محصول بخوان.'},
 {term:'مقاومت فشاری',definition:'نتیجه‌ی آزمون تحمل فشار نمونه؛ روش آزمون و شرایط نمونه باید همراه عدد بررسی شود.'},
 {term:'چگالی',definition:'جرم بر واحد حجم؛ حالت خشک/مرطوب و روش اندازه‌گیری می‌تواند بر مقدار اثر بگذارد.'},
 {term:'مصرف مرجع',definition:'مقدار محصول برای واحد سطح یا حجم در شرایط تعریف‌شده‌ی سازنده.'},
 {term:'ضایعات',definition:'مقدار اضافه‌ی برآوردی برای برش، شکست یا پرت اجرا؛ بدون نظر متخصص مقدار پیش‌فرض ندارد.'}
]);
export function renderGlossary(escapeHtml){
 const esc=typeof escapeHtml==='function'?escapeHtml:(x=>String(x??''));
 return `<div class="tools-intro"><h2>واژه‌نامه‌ی فنی</h2><p>تعریف‌ها عمومی‌اند و منبع تخصصی اختصاصی برای این واژه‌نامه پیوست نشده؛ همه‌ی موارد نیازمند بازبینی متخصص رواق‌اند.</p></div>${glossaryTerms.map(x=>`<div class="ln"><h4><span>${esc(x.term)}</span><em>نیازمند بازبینی متخصص</em></h4><p>${esc(x.definition)}</p></div>`).join('')}`;
}
