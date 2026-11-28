const $=s=>document.querySelector(s);
const state={today:'',durationMinutes:60,offset:0,date:null,start:null,time:null,receipt:null,busy:false,requestId:0};
const pad=n=>String(n).padStart(2,'0');
const isoPlus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const human=s=>new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
const dayname=s=>new Intl.DateTimeFormat('uk-UA',{weekday:'short',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')).replace('.','');
const hm=n=>pad(Math.floor(n/60))+':'+pad(n%60);
const toMinutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const durationLabel=n=>{const h=Math.floor(n/60),min=n%60;return h?(h+' '+(h===1?'година':h>=2&&h<=4?'години':'годин')+(min?' 30 хв':'')):'30 хвилин'};
const durationShort=n=>{const h=Math.floor(n/60),min=n%60;return h?(h+' год'+(min?' 30 хв':'')):'30 хв'};
function say(s){$('#calendar-message').textContent=s}
function error(s){$('#booking-error').textContent=s}
async function api(url,options){const response=await fetch(url,{cache:'no-store',...options});let body;try{body=await response.json()}catch{throw new Error('Сервер не повернув відповідь. Спробуй ще раз.')}if(!response.ok)throw Object.assign(new Error(body.error||'Спробуй ще раз'),{status:response.status});return body}
function chosen(){
 const begin=state.date&&state.start;
 const complete=begin&&state.time&&state.durationMinutes>=30;
 $('#range-start-label').textContent=begin?state.start:'Не обрано';
 $('#range-end-label').textContent=complete?hm(toMinutes(state.start)+state.durationMinutes):'Не обрано';
 $('#range-reset').disabled=!begin;
 $('#chosen-time').textContent=complete?human(state.date)+' · '+state.start+'–'+hm(toMinutes(state.start)+state.durationMinutes):'Обери день, початок та завершення';
 $('#chosen-end').textContent=complete?durationLabel(state.durationMinutes)+' за кермом':'';
 $('#book-button').disabled=!complete||state.busy;
}
function resetSelection(){
 state.start=null;state.time=null;state.durationMinutes=60;
 $('#end-time-panel').classList.add('hidden');
 $('#end-time-grid').replaceChildren();
 $('#time-step-heading').textContent='1. О котрій починаємо?';
 chosen();
}
async function fetchDates(){
 const run=++state.requestId,from=isoPlus(state.today,state.offset);
 const data=await api('/api/days?from='+from+'&count=7&durationMinutes=30');
 if(run!==state.requestId)return;
 const root=$('#date-list');root.replaceChildren();
 const first=data.days[0];
 $('#month-title').textContent=first?new Intl.DateTimeFormat('uk-UA',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(first.date+'T12:00:00Z')):'Вільні дні';
 $('#prev-week').disabled=state.offset<=0;$('#next-week').disabled=state.offset+7>=60;
 if(!data.days.length){say('Доступних дат немає.');$('#time-grid').replaceChildren();return}
 if(!data.days.some(d=>d.date===state.date&&d.free>0)){
  const free=data.days.find(d=>d.free>0);state.date=free?.date||data.days[0].date;
  resetSelection();
 }
 for(const day of data.days){
  const btn=document.createElement('button');btn.type='button';btn.className='date-button'+(state.date===day.date?' selected':'');btn.disabled=!day.free;
  const wd=document.createElement('span');wd.className='dow';wd.textContent=dayname(day.date);
  const number=document.createElement('strong');number.textContent=String(Number(day.date.slice(8)));
  const caption=document.createElement('small');caption.textContent=day.total===0?'Вихідний':day.free?'Є місця':'Зайнято';
  btn.append(wd,number,caption);
  btn.setAttribute('aria-label',human(day.date)+', '+caption.textContent);
  btn.setAttribute('aria-pressed',String(state.date===day.date));
  btn.onclick=()=>{state.date=day.date;resetSelection();fetchDates().catch(e=>say(e.message))};
  root.append(btn);
 }
 say(data.days.some(x=>x.free)?'Спершу натисни час початку — наприклад, 06:00. Потім вибери, коли завершити.':'На цей тиждень вільного часу немає. Обери наступний тиждень.');
 await fetchSlots(run);
}
async function fetchSlots(run=state.requestId){
 if(!state.date)return;
 const target=state.date;
 $('#selected-day-label').textContent=human(target);
 const root=$('#time-grid');root.replaceChildren();
 const loading=document.createElement('div');loading.className='empty-time';loading.textContent='Оновлюємо години…';root.append(loading);
 try{
  const data=await api('/api/slots?date='+target+'&durationMinutes=30');
  if(run!==state.requestId||target!==state.date)return;
  root.replaceChildren();
  if(!data.slots.some(x=>x.status==='free')){
   const p=document.createElement('div');p.className='empty-time';p.textContent='Вільних годин немає. Обери інший день.';root.append(p);return
  }
  for(const slot of data.slots){
   const button=document.createElement('button');
   button.type='button';button.className='time-button '+slot.status+(slot.time===state.start?' selected':'');
   button.disabled=slot.status!=='free';
   const label=document.createElement('strong');label.textContent=slot.time;
   const sub=document.createElement('small');sub.textContent=slot.status==='free'?'Вільно':slot.status==='busy'?'Зайнято':slot.status==='blocked'?'Закрито':'Недоступно';
   button.append(label,sub);
   button.setAttribute('aria-label',slot.time+', '+sub.textContent);button.setAttribute('aria-pressed',String(slot.time===state.start));
   button.onclick=()=>pickStart(slot.time);
   root.append(button);
  }
  if(state.start&&!data.slots.some(x=>x.time===state.start&&x.status==='free'))resetSelection();
  chosen();
 }catch(e){if(run!==state.requestId)return;root.replaceChildren();const p=document.createElement('div');p.className='empty-time';p.textContent='Помилка завантаження: '+e.message;root.append(p)}
}
async function pickStart(start, quickDuration=null){
 state.start=start;state.time=null;state.durationMinutes=60;
 const run=++state.requestId;chosen();
 $('#time-step-heading').textContent='1. Початок — '+start;
 $('#time-grid').querySelectorAll('.time-button').forEach(btn=>{
  const active=btn.firstElementChild?.textContent===start;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active))
 });
 const panel=$('#end-time-panel'),root=$('#end-time-grid');panel.classList.remove('hidden');root.replaceChildren();
 const loading=document.createElement('div');loading.className='empty-time';loading.textContent='Шукаємо доступне завершення…';root.append(loading);
 try{
  const result=await api('/api/ends?date='+state.date+'&start='+start);
  if(run!==state.requestId||state.start!==start)return;
  root.replaceChildren();
  if(!result.ends.length){const msg=document.createElement('div');msg.className='empty-time';msg.textContent='Тут немає доступного проміжку. Обери інший початок.';root.append(msg);return}
  let quickButton;
  for(const end of result.ends){
   const button=document.createElement('button');button.type='button';button.className='time-button end-time-button';
   const time=document.createElement('strong');time.textContent=end.time;
   const label=document.createElement('small');label.textContent=durationLabel(end.durationMinutes);
   button.append(time,label);button.setAttribute('aria-label','До '+end.time+', '+label.textContent);
   button.onclick=()=>{state.durationMinutes=end.durationMinutes;state.time=state.start;
    root.querySelectorAll('button').forEach(x=>{x.classList.toggle('selected',x===button);x.setAttribute('aria-pressed',String(x===button))});
    chosen();$('#details').scrollIntoView({behavior:'smooth',block:'start'});
   };
   root.append(button)
   if(end.durationMinutes===quickDuration)quickButton=button;
  }
  if(quickButton){quickButton.click();return true}
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(e){if(run!==state.requestId)return;root.replaceChildren();const msg=document.createElement('div');msg.className='empty-time';msg.textContent='Не вдалося завантажити завершення: '+e.message;root.append(msg)}
}
async function showQuickBooking() {
 const days = await api('/api/days?from='+state.today+'&count=7&durationMinutes=60');
 const first = days.days.find(day=>day.free>0);
 if(!first)return;
 const available = await api('/api/slots?date='+first.date+'&durationMinutes=60');
 const slot = available.slots.find(item=>item.status==='free');
 if(!slot)return;
 const quick = $('#quick-booking-button');
 const status = $('#quick-booking-status');
 quick.textContent=human(first.date)+' · '+slot.time+'–'+hm(toMinutes(slot.time)+60)+' · 1 год';
 $('#quick-booking').hidden=false;
 quick.onclick=async()=>{
  quick.disabled=true;
  status.textContent='Перевіряємо доступність…';
  try {
   state.offset=0;
   state.date=first.date;
   resetSelection();
   const calendarRequest=state.requestId+1;
   await fetchDates();
   if(calendarRequest!==state.requestId)return;
   if(state.date!==first.date||!await pickStart(slot.time,60)){
    status.textContent='Цей час уже недоступний. Обери інший у календарі.';
    return;
   }
   status.textContent='';
   $('#student-surname').focus({preventScroll:true});
  } catch {
   status.textContent='Не вдалося перевірити цей час. Спробуй ще раз.';
  } finally {
   quick.disabled=false;
  }
 };
}
async function initialize(){try{const info=await api('/api/info');state.today=info.today;showQuickBooking().catch(()=>{});await fetchDates()}catch(e){say('Не вдалося відкрити розклад: '+e.message);$('#time-grid').textContent='Помилка зв’язку. Онови сторінку.'}}
$('#range-reset').onclick=()=>{resetSelection();fetchSlots().catch(e=>say(e.message))};
$('#prev-week').onclick=()=>{state.offset=Math.max(0,state.offset-7);resetSelection();fetchDates().catch(e=>say(e.message))};
$('#next-week').onclick=()=>{state.offset=Math.min(56,state.offset+7);resetSelection();fetchDates().catch(e=>say(e.message))};
$('#booking-form').addEventListener('submit',async e=>{
 e.preventDefault();error('');if(state.busy)return;
 if(!state.date||!state.start||!state.time)return error('Обери день, час початку та завершення.');
 const surname=$('#student-surname').value.trim().replace(/\s+/g,' '),given=$('#student-name').value.trim().replace(/\s+/g,' '),phone=$('#student-phone').value.trim();
 const personPart=/^[\p{L}][\p{L}\p{M}'’\- ]{1,49}$/u;
 if(!personPart.test(surname)||!personPart.test(given))return error('Вкажи коректно прізвище та ім’я (окремо, по 2–50 символів).');
 const name=surname+' '+given;
 if(!/^\+?[0-9()\-\s]{7,24}$/.test(phone))return error('Вкажи коректний номер телефону.');
 if(!$('#policy-accepted').checked)return error('Підтвердь, що ознайомився(-лася) з правилом повідомлення за 24 години.');
 if(!$('#consent').checked)return error('Підтвердь згоду на використання контактів.');
 state.busy=true;chosen();
 try{
  const receipt=await api('/api/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,note:$('#student-note').value.trim(),website:$('#website').value,date:state.date,time:state.start,durationMinutes:state.durationMinutes,policyAccepted:$('#policy-accepted').checked})});
  state.receipt=receipt;$('#confirm-student').textContent=name;$('#confirm-date').textContent=human(receipt.date);
  $('#confirm-time').textContent=receipt.time+'—'+hm(toMinutes(receipt.time)+receipt.duration)+' · '+durationShort(receipt.duration);
  setupCalendarLinks(receipt);
  $('#booking-success').classList.remove('hidden');$('#details').classList.add('hidden');
  resetSelection();await fetchDates();$('#booking-success').scrollIntoView({behavior:'smooth',block:'center'})
 }catch(e){error(e.message);if(e.status===409){resetSelection();await fetchDates()}}
 finally{state.busy=false;chosen()}
});
const reminderText=r=>'Заняття з водіння DRIVE TIME: '+human(r.date)+', '+r.time+'–'+hm(toMinutes(r.time)+r.duration)+' (Київ). Візьми документи та приходь завчасно. Для перенесення або скасування потрібно повідомити інструктора щонайменше за 24 години; якщо залишилось менше доби, узгодь зміни особисто.';
const googleDate=r=>r.date.replaceAll('-','')+'T'+r.time.replace(':','')+'00';
const googleEnd=r=>r.date.replaceAll('-','')+'T'+hm(toMinutes(r.time)+r.duration).replace(':','')+'00';
function setupCalendarLinks(r){
 const q=new URLSearchParams({action:'TEMPLATE',text:'Заняття з водіння · DRIVE TIME',dates:googleDate(r)+'/'+googleEnd(r),ctz:'Europe/Kyiv',details:reminderText(r)});
 $('#google-calendar').href='https://calendar.google.com/calendar/render?'+q.toString();
 $('#reminder-status').textContent='Перевір налаштування сповіщень календаря. Файл .ics містить нагадування за 24 години та за 1 годину до уроку.'
}
function icsEscape(s){return String(s).replaceAll('\\','\\\\').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\n','\\n')}
$('#download-calendar').onclick=()=>{
 const r=state.receipt;if(!r)return;
 const start=googleDate(r),end=googleEnd(r);
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DRIVE TIME//Driving Lesson//UK','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+r.date.replaceAll('-','')+'-'+r.time.replace(':','')+'@drive-time-booking','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;TZID=Europe/Kyiv:'+start,'DTEND;TZID=Europe/Kyiv:'+end,'SUMMARY:'+icsEscape('Заняття з водіння · DRIVE TIME'),'DESCRIPTION:'+icsEscape(reminderText(r)),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEscape('Скоро заняття з водіння · DRIVE TIME'),'TRIGGER:-PT1H','END:VALARM','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEscape('Завтра заняття з водіння · DRIVE TIME'),'TRIGGER:-PT24H','END:VALARM','END:VEVENT','END:VCALENDAR'];
 const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='drive-time-lesson.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500)
};
$('#share-reminder').onclick=async()=>{
 if(!state.receipt)return;
 const text=reminderText(state.receipt);
 if(navigator.share){try{await navigator.share({title:'Нагадування про водіння',text});$('#reminder-status').textContent='Вибери застосунок нагадувань або повідомлень у меню телефона.';return}catch(e){if(e.name==='AbortError')return}}
 try{await navigator.clipboard.writeText(text);$('#reminder-status').textContent='Текст скопійовано. Встав його в застосунок «Нагадування» на телефоні.'}catch{$('#reminder-status').textContent=text}
};
$('#copy-reminder').onclick=async()=>{if(!state.receipt)return;const text=reminderText(state.receipt);try{await navigator.clipboard.writeText(text);$('#reminder-status').textContent='Нагадування скопійовано. Встав у програму нагадувань.'}catch{$('#reminder-status').textContent=text}};
$('#new-booking').onclick=()=>{state.receipt=null;$('#details').classList.remove('hidden');$('#booking-success').classList.add('hidden');$('#policy-accepted').checked=false;$('#consent').checked=false;$('#student-note').value='';resetSelection();$('#booking').scrollIntoView({behavior:'smooth'});fetchDates()};
initialize();
