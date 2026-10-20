/* Pakar Experiences local utilities; no network or external dependencies. */
(function(){
 'use strict';
 const KEY='pakar.experiences.bookmarks.v2';
 const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.map(String):[]}catch(_){return[]}};
 window.PakarExperiences={
  getBookmarks:read,
  toggleBookmark(id){try{const key=String(id),items=read(),i=items.indexOf(key);if(i>=0)items.splice(i,1);else items.unshift(key);localStorage.setItem(KEY,JSON.stringify(items.slice(0,500)));return true}catch(_){return false}},
  observe(root){const nodes=(root||document).querySelectorAll('.exp-post:not(.in)');if(!('IntersectionObserver'in window)){nodes.forEach(n=>n.classList.add('in'));return}const io=new IntersectionObserver(entries=>entries.forEach((e,i)=>{if(!e.isIntersecting)return;e.target.style.transitionDelay=Math.min(i,5)*40+'ms';e.target.classList.add('in');io.unobserve(e.target)}),{rootMargin:'0px 0px -5% 0px'});nodes.forEach(n=>io.observe(n))}
 };
 document.addEventListener('DOMContentLoaded',()=>{const p=new URLSearchParams(location.search).get('startapp')||'';const m=p.match(/^exp_(.+)$/);if(m)window.__PAKAR_EXP_DEEPLINK__=m[1]});
})();
