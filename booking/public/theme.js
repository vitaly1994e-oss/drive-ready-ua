/* Shared DRIVE TIME theme. Saved only on the visitor's device. */
(()=>{
 const key='drive-time-theme';
 let selected='light';
 try{const saved=localStorage.getItem(key);if(saved==='dark'||saved==='light')selected=saved;else if(matchMedia('(prefers-color-scheme: dark)').matches)selected='dark'}catch{}
 const apply=mode=>{
  document.documentElement.dataset.theme=mode;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=mode==='dark'?'#0c1719':'#f5f5ef';
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>{
   const dark=mode==='dark';b.setAttribute('aria-pressed',String(dark));b.setAttribute('aria-label',dark?'Увімкнути світлу тему':'Увімкнути темну тему');
   b.innerHTML=(dark?'☀':'☾')+' <span>'+(dark?'Світла тема':'Темна тема')+'</span>';
  });
 };
 apply(selected);
 document.addEventListener('DOMContentLoaded',()=>{
  apply(document.documentElement.dataset.theme);
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.addEventListener('click',()=>{
   const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
   apply(next);try{localStorage.setItem(key,next)}catch{}
  }));
 });
})();