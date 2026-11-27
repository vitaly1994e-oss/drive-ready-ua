const $=s=>document.querySelector(s);
const human=d=>new Intl.DateTimeFormat('uk-UA',{dateStyle:'full',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const el=(tag,content,klass)=>{const x=document.createElement(tag);if(content!==undefined)x.textContent=content;if(klass)x.className=klass;return x};
$('#lookup-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const phone=$('#manage-phone').value.trim(),error=$('#lookup-error'),button=$('#lookup-submit'),list=$('#my-lessons-list');
 error.textContent='';
 if(!/^(?:\+?380|0)?[\s()\-\d]{9,19}$/.test(phone)||phone.replace(/\D/g,'').length<9){error.textContent='Перевір номер телефону, наприклад +380 67 123 45 67';return}
 button.disabled=true;button.textContent='Шукаємо заняття…';
 try{
  const response=await fetch('/api/my-lessons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone}),cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Не вдалося завантажити розклад');
  list.replaceChildren();
  if(!data.lessons.length)list.append(el('div','За цим номером немає майбутніх занять. Перевір номер або звернись до інструктора.','empty-time'));
  $('#lessons-summary').textContent=data.lessons.length?'Знайдено занять: '+data.lessons.length+'. Найближче заняття — перше у списку.':'';
  for(const [index,lesson] of data.lessons.entries()){
   const item=el('article',undefined,'manage-ticket');
   item.append(el('span',index===0?'Найближче заняття':'Підтверджено','manage-chip'),el('h2',human(lesson.date)),el('strong',lesson.time+'–'+lesson.end),el('small','Тривалість: '+lesson.duration+' хв'));
   list.append(item);
  }
  $('#booking-details-panel').classList.remove('hidden');
  $('#booking-details-panel').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(ex){list.replaceChildren();$('#booking-details-panel').classList.add('hidden');error.textContent=ex.message}
 finally{button.disabled=false;button.textContent='Показати мої заняття ↗'}
});
