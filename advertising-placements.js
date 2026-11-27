(()=>{
'use strict';
const settings=window.DRU_AD_CONFIG||{};
const campaigns=Array.isArray(settings.campaigns)?settings.campaigns:[];
function active(c,region,slot){
 if(!c||c.approved!==true||c.slot!==slot||typeof c.title!=='string'||typeof c.url!=='string')return false;
 if(!/^https:\/\//i.test(c.url))return false;
 if(!c.title.trim()||c.title.length>90)return false;
 const now=Date.now(),start=Date.parse(c.startsAt||''),end=Date.parse(c.endsAt||'');
 if(!Number.isFinite(start)||!Number.isFinite(end)||now<start||now>=end)return false;
 if(slot==='routes'){
  if(!region)return !c.regions||c.regions.includes('all');
  if(Array.isArray(c.regions)&&!c.regions.includes('all')&&!c.regions.includes(region))return false;
 }
 return true;
}
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
function card(c,house=false){
 const article=el('article','ad-placement-card'+(house?' ad-house':''));
 const media=el('div','ad-placement-media');
 if(c&&c.image&&/^https:\/\//.test(c.image)&&/\.(png|jpe?g|webp)(\?.*)?$/i.test(c.image)){
  const img=document.createElement('img');img.loading='lazy';img.referrerPolicy='no-referrer';img.alt='Логотип рекламодавця';img.src=c.image;media.append(img);
 } else media.textContent=house?'✦':'🏫';
 const body=el('div','ad-placement-info');
 const label=el('span','ad-label',house?'Для автошкіл':'Реклама');
 const title=el('h3','',house?'Ваша автошкола може бути тут':c.title);
 const p=el('p','',house?'Покажіть свою пропозицію курсантам вашого міста. Навчання для учнів залишається безкоштовним.':String(c.description||''));
 body.append(label,title,p);
 const a=el('a','button'+(house?'':' primary'),house?'Дізнатися про рекламу ↗':'Переглянути пропозицію ↗');
 a.href=house?'ads.html':c.url;
 if(!house){a.target='_blank';a.rel='noopener noreferrer sponsored';a.referrerPolicy='no-referrer'}
 article.append(media,body,a);
 return article;
}
function render(id,region=''){
 const container=document.getElementById(id);if(!container)return;
 const slot=id==='home-ads'?'home':'routes';
 const available=campaigns.filter(c=>active(c,region,slot));
 container.replaceChildren();
 container.classList.add('ad-placement');
 // No invented listings or fabricated ads.
 container.append(card(available[0]||null,available.length===0));
}
window.DRUAds={render};
document.addEventListener('DOMContentLoaded',()=>render('home-ads'));
})();