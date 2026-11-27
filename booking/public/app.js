const $=s=>document.querySelector(s);
const state={today:'',durationMinutes:60,offset:0,date:null,time:null,receipt:null,busy:false,requestId:0};
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
 const on=state.date&&state.time;
 $('#chosen-time').textContent=on?human(state.date)+' · '+state.time:'Вибери день і час вище';
 $('#chosen-end').textContent=on?'До '+hm(toMinutes(state.time)+state.durationMinutes)+' · '+durationLabel(state.durationMinutes):'';
 $('#book-button').disabled=!on||state.busy
}
function showDuration(){
 $('#duration-label').textContent=durationLabel(state.durationMinutes);
 $('#duration-subtitle').textContent=state.durationMinutes+' хвилин практики';
 $('#duration-minus').disabled=state.durationMinutes<=30;
 $('#duration-plus').disabled=state.durationMinutes>=900;
 document.querySelectorAll('[data-duration]').forEach(b=>{const selected=Number(b.dataset.duration)===state.durationMinutes;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))})
}
async function changeDuration(n){
 const next=Math.max(30,Math.min(900,n));if(next===state.durationMinutes)return;
 state.durationMinutes=next;state.time=null;showDuration();chosen();
 if(state.today){try{await fetchDates()}catch(e){say('Помилка оновлення днів: '+e.message)}}
}
async function fetchDates(){
 const run=++state.requestId;
 const from=isoPlus(state.today,state.offset),data=await api('/api/days?from='+from+'&count=7&durationMinutes='+state.durationMinutes);
 if(run!==state.requestId)return;
 const root=$('#date-list');root.replaceChildren();
 const first=data.days[0];$('#month-title').textContent=first?new Intl.DateTimeFormat('uk-UA',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(first.date+'T12:00:00Z')):'Вільні дні';
 $('#prev-week').disabled=state.offset<=0;$('#next-week').disabled=state.offset+7>=60;
 if(!data.days.length){say('Доступних дат у цьому періоді немає.');$('#time-grid').replaceChildren();return}
 const available=data.days.some(d=>d.date===state.date&&d.free>0);
 if(!available){const next=data.days.find(x=>x.free>0);state.date=next?.date||data.days[0].date;state.time=null}
 for(const day of data.days){
  const btn=document.createElement('button');btn.type='button';btn.className='date-button'+(state.date===day.date?' selected':'');
  btn.disabled=day.free===0;const weekday=document.createElement('span');weekday.className='dow';weekday.textContent=dayname(day.date);
  const n=document.createElement('strong');n.textContent=String(Number(day.date.slice(8)));
  const badge=document.createElement('small');badge.textContent=day.total===0?'Вихідний':day.free?'Вільно '+day.free:'Зайнято';
  btn.append(weekday,n,badge);btn.setAttribute('aria-label',human(day.date)+', '+badge.textContent);btn.setAttribute('aria-pressed',String(day.date===state.date));
  btn.onclick=()=>{state.date=day.date;state.time=null;chosen();fetchDates().catch(e=>say(e.message))};
  root.append(btn)
 }
 say(data.days.some(x=>x.free)?'Обери вільний початок уроку — ми зарезервуємо увесь обраний час.':'Для такої тривалості цього тижня немає вільних годин. Спробуй коротший урок або інший тиждень.');
 await fetchSlots(run)
}
async function fetchSlots(run=state.requestId){
 if(!state.date)return;const targetDate=state.date;
 $('#selected-day-label').textContent=human(targetDate);const root=$('#time-grid');root.replaceChildren();
 const loading=document.createElement('div');loading.className='empty-time';loading.textContent='Перевіряємо доступність…';root.append(loading);
 try{
  const data=await api('/api/slots?date='+targetDate+'&durationMinutes='+state.durationMinutes);
  if(run!==state.requestId||state.date!==targetDate)return;
  root.replaceChildren();const available=data.slots.filter(x=>x.status==='free');
  if(!available.length){const e=document.createElement('div');e.className='empty-time';e.textContent='Немає вільних годин для '+durationLabel(state.durationMinutes)+'. Обери інший день або тривалість.';root.append(e);state.time=null;chosen();return}
  for(const slot of data.slots){
   const btn=document.createElement('button');btn.type='button';btn.className='time-button '+slot.status+(slot.time===state.time?' selected':'');btn.disabled=slot.status!=='free';
   const start=document.createElement('strong');start.textContent=slot.time;
   const end=document.createElement('small');end.textContent=slot.status==='free'?'До '+slot.end:slot.status==='busy'?'Зайнято':slot.status==='blocked'?'Закрито':slot.status==='too_long'?'Не вміщується':'Минуло';
   btn.append(start,end);btn.setAttribute('aria-label',slot.time+' до '+slot.end+', '+end.textContent);
   btn.setAttribute('aria-pressed',String(slot.time===state.time));
   btn.onclick=()=>{state.time=slot.time;root.querySelectorAll('button').forEach(x=>{x.classList.toggle('selected',x===btn);x.setAttribute('aria-pressed',String(x===btn))});chosen();$('#details').scrollIntoView({behavior:'smooth',block:'start'})};
   root.append(btn)
  }
  if(state.time&&!available.some(x=>x.time===state.time))state.time=null;chosen()
 }catch(e){if(run!==state.requestId)return;root.replaceChildren();const p=document.createElement('div');p.className='empty-time';p.textContent='Не вдалося оновити час. '+e.message;root.append(p)}
}
async function initialize(){showDuration();try{const info=await api('/api/info');state.today=info.today;await fetchDates()}catch(e){say('Не вдалося отримати розклад. '+e.message);$('#time-grid').textContent='Розклад тимчасово недоступний. Онови сторінку.'}}
$('#duration-minus').onclick=()=>changeDuration(state.durationMinutes-30);
$('#duration-plus').onclick=()=>changeDuration(state.durationMinutes+30);
document.querySelectorAll('[data-duration]').forEach(btn=>btn.onclick=()=>changeDuration(Number(btn.dataset.duration)));
$('#prev-week').onclick=()=>{state.offset=Math.max(0,state.offset-7);state.time=null;chosen();fetchDates().catch(e=>say(e.message))};
$('#next-week').onclick=()=>{state.offset=Math.min(56,state.offset+7);state.time=null;chosen();fetchDates().catch(e=>say(e.message))};
$('#booking-form').addEventListener('submit',async e=>{
 e.preventDefault();error('');if(state.busy)return;
 if(!state.date||!state.time)return error('Спочатку обери вільний день і час.');
 const name=$('#student-name').value.trim(),phone=$('#student-phone').value.trim();
 if(name.length<2)return error('Вкажи ім’я (принаймні 2 символи).');
 if(!/^\+?[0-9()\-\s]{7,24}$/.test(phone))return error('Вкажи коректний номер телефону.');
 if(!$('#consent').checked)return error('Підтвердь згоду на використання контактів.');
 state.busy=true;chosen();
 try{
  const receipt=await api('/api/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,note:$('#student-note').value.trim(),website:$('#website').value,date:state.date,time:state.time,durationMinutes:state.durationMinutes})});
  state.receipt=receipt;$('#confirm-date').textContent=human(receipt.date);
  $('#confirm-time').textContent=receipt.time+'—'+hm(toMinutes(receipt.time)+receipt.duration)+' · '+durationShort(receipt.duration);
  $('#confirm-code').textContent=receipt.code;setupCalendarLinks(receipt);
  $('#booking-success').classList.remove('hidden');$('#details').classList.add('hidden');
  state.time=null;await fetchDates();$('#booking-success').scrollIntoView({behavior:'smooth',block:'center'})
 }catch(e){error(e.message);if(e.status===409){state.time=null;await fetchDates()}}
 finally{state.busy=false;chosen()}
});
const reminderText=r=>'Заняття з водіння DRIVE TIME: '+human(r.date)+', '+r.time+'–'+hm(toMinutes(r.time)+r.duration)+' (Київ). Код: '+r.code+'. Візьми документи та приходь завчасно.';
const googleDate=r=>r.date.replaceAll('-','')+'T'+r.time.replace(':','')+'00';
const googleEnd=r=>r.date.replaceAll('-','')+'T'+hm(toMinutes(r.time)+r.duration).replace(':','')+'00';
function setupCalendarLinks(r){
 const q=new URLSearchParams({action:'TEMPLATE',text:'Заняття з водіння · DRIVE TIME',dates:googleDate(r)+'/'+googleEnd(r),ctz:'Europe/Kyiv',details:reminderText(r)});
 $('#google-calendar').href='https://calendar.google.com/calendar/render?'+q.toString();
 $('#reminder-status').textContent='У календарній події вже є нагадування за годину до уроку.'
}
function icsEscape(s){return String(s).replaceAll('\\','\\\\').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\n','\\n')}
$('#download-calendar').onclick=()=>{
 const r=state.receipt;if(!r)return;
 const start=googleDate(r),end=googleEnd(r);
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DRIVE TIME//Driving Lesson//UK','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+r.code+'@drive-time-booking','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;TZID=Europe/Kyiv:'+start,'DTEND;TZID=Europe/Kyiv:'+end,'SUMMARY:'+icsEscape('Заняття з водіння · DRIVE TIME'),'DESCRIPTION:'+icsEscape(reminderText(r)),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEscape('Скоро заняття з водіння · DRIVE TIME'),'TRIGGER:-PT1H','END:VALARM','END:VEVENT','END:VCALENDAR'];
 const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='drive-time-lesson.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500)
};
$('#share-reminder').onclick=async()=>{
 if(!state.receipt)return;
 const text=reminderText(state.receipt);
 if(navigator.share){try{await navigator.share({title:'Нагадування про водіння',text});$('#reminder-status').textContent='Вибери застосунок нагадувань або повідомлень у меню телефона.';return}catch(e){if(e.name==='AbortError')return}}
 try{await navigator.clipboard.writeText(text);$('#reminder-status').textContent='Текст скопійовано. Встав його в застосунок «Нагадування» на телефоні.'}catch{$('#reminder-status').textContent=text}
};
$('#copy-reminder').onclick=async()=>{if(!state.receipt)return;const text=reminderText(state.receipt);try{await navigator.clipboard.writeText(text);$('#reminder-status').textContent='Нагадування скопійовано. Встав у програму нагадувань.'}catch{$('#reminder-status').textContent=text}};
$('#new-booking').onclick=()=>{state.receipt=null;$('#details').classList.remove('hidden');$('#booking-success').classList.add('hidden');$('#booking-form').reset();$('#booking').scrollIntoView({behavior:'smooth'});fetchDates()};
initialize();
