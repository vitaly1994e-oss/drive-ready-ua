(()=>{
'use strict';
const $=s=>document.querySelector(s);
const config=window.DRU_AD_CONFIG||{};
const packages={catalog:"Профіль у каталозі",routes:"Реклама біля маршрутів",home:"Банер на головній",custom:"Індивідуальне розміщення"};
let prepared=null;
const text=(el,value)=>{el.textContent=value};
const result=$('#ad-request-result');
const note=$('#ad-send-hint');
const status=$('#ad-form-status');
const form=$('#ad-request-form');
function serialize(){
  const obj={
    company:$('#ad-company').value.trim(),
    contact:$('#ad-contact').value.trim(),
    city:$('#ad-city').value.trim(),
    email:$('#ad-email').value.trim(),
    phone:$('#ad-phone').value.trim(),
    package:$('#ad-package').value,
    message:$('#ad-message').value.trim()
  };
  return obj;
}
function toText(a){
 return [
  'DRIVE READY UA — ЗАПИТ НА РЕКЛАМНЕ РОЗМІЩЕННЯ',
  'Створено: '+new Date().toLocaleString('uk-UA'),
  'Автошкола / ФОП: '+a.company,
  'Контактна особа: '+a.contact,
  'Місто: '+a.city,
  'Email: '+a.email,
  'Телефон: '+(a.phone||'не вказано'),
  'Рекламний формат: '+(packages[a.package]||a.package),
  'Коментар: '+(a.message||'без коментаря'),
  '',
  'Примітка: заявка сама по собі не є договором або підтвердженням бронювання.'
 ].join('\n');
}
function prepare(){
 if(!form.reportValidity())return;
 if(!$('#ad-consent').checked){text(status,'Підтвердьте згоду на обробку контактів.');return}
 prepared=serialize();
 const email=String(config.receiverEmail||'').trim();
 const endpoint=String(config.submissionEndpoint||'').trim();
 const configured=!!(email||endpoint);
 result.classList.remove('hidden');
 result.scrollIntoView({behavior:'smooth',block:'nearest'});
 text($('#ad-request-result-info'),'Підготовлено заявку від «'+prepared.company+'» на розміщення у місті '+prepared.city+'.');
 text(note,configured?'Якщо надсилання недоступне, скопіюйте заявку або збережіть її.':'Канал приймання заявок ще не підключено. Дані нікуди автоматично не передано. Ви можете зберегти або скопіювати текст, щоб надіслати його після отримання контактної адреси.');
 text($('#ad-send-email'),email?'Надіслати через пошту ↗':'Відкрити поштову програму ↗');
}
async function attemptPost(payload){
 const endpoint=String(config.submissionEndpoint||'').trim();
 if(!endpoint)return false;
 if(!/^https:\/\//.test(endpoint)&&!endpoint.startsWith('/api/'))throw new Error('Некоректна адреса приймання заявок');
 const response=await fetch(endpoint,{
  method:'POST',
  mode:'cors',
  credentials:'omit',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)
 });
 if(!response.ok)throw new Error('Помилка сервера: '+response.status);
 const answer=await response.json();
 if(answer.ok!==true||!answer.id)throw new Error('Відповідь сервера не підтверджує збереження заявки');
 return answer.id;
}
form.addEventListener('submit',async e=>{
 e.preventDefault();prepare();
 if(!prepared)return;
 const endpoint=String(config.submissionEndpoint||'').trim();
 if(!endpoint)return;
 $('#ad-submit').disabled=true;
 text(status,'Надсилання заявки…');
 try{
  const id=await attemptPost(prepared);
  text(status,'Заявка №'+id+' успішно прийнята сервером.');
  text($('#ad-request-result-info'),'Заявку №'+id+' отримано. Дякуємо! Очікуйте відповіді на вказаний email.');
  note.textContent='Повідомлення підтверджено сервером приймання заявок.';
 }catch(error){
  text(status,'Автоматичне надсилання не вдалося. Скористайтеся копіюванням або поштовою програмою.');
  text(note,'Заявку не підтверджено сервером: '+error.message);
 }finally{$('#ad-submit').disabled=false}
});
$('#ad-send-email').addEventListener('click',()=>{
 if(!prepared){text(note,'Спочатку заповніть заявку.');return}
 const receiver=String(config.receiverEmail||'').trim();
 const subject=encodeURIComponent('Реклама Drive Ready UA — '+prepared.company+' — '+prepared.city);
 const body=encodeURIComponent(toText(prepared));
 const href='mailto:'+(receiver?encodeURIComponent(receiver):'')+'?subject='+subject+'&body='+body;
 if(href.length>1800){text(note,'Заявка завелика для поштового посилання. Скопіюйте текст заявки.');return}
 window.location.href=href;
 text(note,receiver?'Відкрито поштову програму. Надсилання листа необхідно підтвердити в ній.':'Поштова програма відкриється з текстом заявки. Адресат на сайті поки не налаштований — виберіть потрібну контактну адресу у своїй поштовій програмі. Заявку автоматично не надіслано.');
});
$('#ad-copy').addEventListener('click',async()=>{
 if(!prepared)return;
 try{await navigator.clipboard.writeText(toText(prepared));text(note,'Текст заявки скопійовано. Тепер його можна вставити в лист.')}
 catch{
  const input=document.createElement('textarea');input.value=toText(prepared);input.style.position='fixed';input.style.left='-9999px';document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();text(note,ok?'Текст заявки скопійовано.':'Не вдалося скопіювати. Спробуйте завантажити TXT.')
 }
});
$('#ad-download').addEventListener('click',()=>{
 if(!prepared)return;
 const payload=toText(prepared);
 const blob=new Blob([payload],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='drive-ready-zayavka.txt';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2500);
 text(note,'Файл заявки збережено на вашому пристрої.');
});
document.querySelectorAll('.ads-select').forEach(btn=>btn.addEventListener('click',()=>{
 $('#ad-package').value=btn.dataset.package;
 $('#request').scrollIntoView({behavior:'smooth',block:'start'});
 $('#ad-company').focus({preventScroll:true});
}));
})();
