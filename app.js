(()=>{
'use strict';
const $=s=>document.querySelector(s);
const store=(k,v)=>{try{localStorage.setItem('dru-'+k,JSON.stringify(v))}catch{}};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem('dru-'+k))??d}catch{return d}};
window.DRU={store,load,$};
const theme=load('theme','light')==='light'?'light':'dark';document.documentElement.dataset.theme=theme;
if(!document.querySelector('link[href="brand-ua.css"]')){const brandStyle=document.createElement('link');brandStyle.rel='stylesheet';brandStyle.href='brand-ua.css';document.head.append(brandStyle)}
const links=[
["index.html","Головна"],["quiz.html","Тести ПДР"],["routes.html","Маршрути"],["practice.html","Практика"],
["coach.html","Іспит"],["intersections.html","Перехрестя"],["official-questions.html","Питання МВС"],
["exam-checklist.html","Чекліст"],["instructor.html","Інструктору"],["profile.html","Мій прогрес"],
["ads.html","Автошколам"],["https://drive-time-booking-ov62.onrender.com/","Запис на водіння"]
];
const main=links.slice(0,5),more=links.slice(5);
function navLink([href,label]){const a=document.createElement('a');a.href=href;a.textContent=label;const path=location.pathname.split('/').pop()||'index.html';if(href===path)a.setAttribute('aria-current','page');return a}
function menu(){const header=$('#site-header');if(!header)return;
const bar=document.createElement('div');bar.className='topbar';
const wrap=document.createElement('div');wrap.className='container nav';
const brand=document.createElement('a');brand.href='index.html';brand.className='brand';brand.setAttribute('aria-label','Drive Ready UA — на головну');
brand.innerHTML='<span class="brand-mark"><svg width="28" height="28" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M9 27 27 9m-13 0h13v13" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 17v10h10" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></span><span class="brand-wordmark">DRIVE<span>READY</span><small>UA</small></span>';
const nav=document.createElement('nav');nav.className='links';nav.id='nav-links';nav.setAttribute('aria-label','Головна навігація');
main.forEach(l=>nav.append(navLink(l)));
const details=document.createElement('details');details.className='nav-more';
const summary=document.createElement('summary');summary.textContent='Більше';details.append(summary);
const submenu=document.createElement('div');submenu.className='submenu';more.forEach(l=>submenu.append(navLink(l)));details.append(submenu);nav.append(details);
const extra=document.createElement('div');extra.className='nav-mobile-extra';more.forEach(l=>extra.append(navLink(l)));nav.append(extra);
const actions=document.createElement('div');actions.className='nav-actions';
const themeButton=document.createElement('button');themeButton.type='button';themeButton.className='icon-btn theme-btn';themeButton.id='theme-toggle';themeButton.setAttribute('aria-label','Перемкнути світлу або темну тему');themeButton.title='Змінити тему';
const updateThemeIcon=()=>{themeButton.innerHTML=document.documentElement.dataset.theme==='dark'?'☀':'☾'};
updateThemeIcon();themeButton.onclick=()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;store('theme',next);updateThemeIcon()};
const cta=document.createElement('a');cta.href='https://drive-time-booking-ov62.onrender.com/';cta.className='button primary nav-cta';cta.textContent='Запис на водіння ↗';cta.setAttribute('aria-label','Онлайн-запис на практичне заняття з водіння DRIVE TIME');
const toggle=document.createElement('button');toggle.type='button';toggle.id='menu-toggle';toggle.className='icon-btn menu-btn';toggle.setAttribute('aria-controls','nav-links');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Відкрити меню');toggle.textContent='☰';
toggle.onclick=()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Закрити меню':'Відкрити меню');toggle.textContent=open?'✕':'☰'};
nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰'}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';details.open=false}});
document.addEventListener('click',e=>{if(!details.contains(e.target))details.open=false});
actions.append(themeButton,cta,toggle);wrap.append(brand,nav,actions);bar.append(wrap);
header.replaceChildren(bar);
}
function footer(){const el=$('#site-footer');if(!el)return;el.className='footer';
const container=document.createElement('div');container.className='container premium-footer';
const left=document.createElement('div');left.className='footer-intro';
left.innerHTML='<a class="brand" href="index.html"><span class="brand-mark">↗</span><span class="brand-wordmark">DRIVE<span>READY</span><small>UA</small></span></a><p>Безкоштовна підготовка до іспитів з водіння. Теорія, практика та маршрути — в одному місці.</p>';
const columns=document.createElement('div');columns.className='footer-columns';
const groups=[['Підготовка',[["quiz.html","Тести ПДР"],["routes.html","Маршрути МВС"],["coach.html","Пробний іспит"],["intersections.html","Перехрестя"]]],['Про платформу',[["profile.html","Мій прогрес"],["instructor.html","Інструкторам"],["ads.html","Автошколам"],["https://drive-time-booking-ov62.onrender.com/","Запис на водіння"],["privacy.html","Конфіденційність"],["terms.html","Умови"]]]];
for(const [name,list] of groups){const col=document.createElement('div');const h=document.createElement('strong');h.textContent=name;col.append(h);for(const item of list)col.append(navLink(item));columns.append(col)}
container.append(left,columns);const bottom=document.createElement('div');bottom.className='container footer-bottom';bottom.innerHTML='<span>© 2026 Drive Ready UA. Незалежний освітній проєкт.</span><span>Не є офіційним сайтом МВС України</span>';
el.replaceChildren(container,bottom)}
document.addEventListener('DOMContentLoaded',()=>{menu();footer();const share=document.querySelector('#share-platform');if(share)share.addEventListener('click',async()=>{const url='https://drive-ready-ua.onrender.com/';try{if(navigator.share){await navigator.share({title:'DRIVE READY UA — безкоштовна підготовка до іспиту',text:'Тести ПДР, маршрути та практичні ситуації — безкоштовно',url});return}if(navigator.clipboard){await navigator.clipboard.writeText(url);share.textContent='Посилання скопійовано ✓';return}throw Error('clipboard unavailable')}catch(e){if(e.name!=='AbortError')share.textContent='Скопіюй адресу сайту: '+url}});const observer=window.IntersectionObserver?new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}}},{threshold:.08}):null;if(observer&&matchMedia('(prefers-reduced-motion: reduce)').matches===false){document.querySelectorAll('.hero,.card,.panel,.section-head,.feature-row').forEach(x=>{x.classList.add('reveal');observer.observe(x)})}});
})();