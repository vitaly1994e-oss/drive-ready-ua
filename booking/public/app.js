const $=s=>document.querySelector(s);
const state={today:'',duration:60,offset:0,date:null,time:null,receipt:null,busy:false};
const pad=n=>String(n).padStart(2,'0');
const isoPlus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const human=s=>new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
const dayname=s=>new Intl.DateTimeFormat('uk-UA',{weekday:'short',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')).replace('.','');
function say(s){$('#calendar-message').textContent=s}
function error(s){$('#booking-error').textContent=s}
async function api(url,options){const response=await fetch(url,{cache:'no-store',...options});let body;try{body=await response.json()}catch{throw new Error('Сервер не повернув відповідь. Спробуй ще раз.')}if(!response.ok)throw Object.assign(new Error(body.error||'Спробуй ще раз'),{status:response.status});return body}
function chosen(){const on=state.date&&state.time;$('#chosen-time').textContent=on?human(state.date)+' · '+state.time:'Спочатку вибери дату й час';$('#book-button').disabled=!on||state.busy}
async function fetchDates(){
 const from=isoPlus(state.today,state.offset),data=await api('/api/days?from='+from+'&count=7');
 const root=$('#date-list');root.replaceChildren();
 const first=data.days[0];$('#month-title').textContent=first?new Intl.DateTimeFormat('uk-UA',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(first.date+'T12:00:00Z')):'Вільні дні';
 $('#prev-week').disabled=state.offset<=0;$('#next-week').disabled=state.offset+7>=60;
 if(!data.days.length){say('Доступних дат у цьому періоді немає.');return}
 for(const day of data.days){
  const btn=document.createElement('button');btn.type='button';btn.className='date-button'+(state.date===day.date?' selected':'');
  btn.disabled=day.free===0;
  const wd=document.createElement('span');wd.className='dow';wd.textContent=dayname(day.date);
  const num=document.createElement('strong');num.textContent=String(Number(day.date.slice(8)));
  const count=document.createElement('small');count.textContent=day.total===0?'Вихідний':day.free?'Вільно '+day.free:'Зайнято';
  btn.append(wd,num,count);btn.setAttribute('aria-label',human(day.date)+', '+count.textContent);
  btn.setAttribute('aria-pressed',String(state.date===day.date));
  btn.onclick=()=>selectDate(day.date);root.append(btn);
 }
 const within=data.days.some(d=>d.date===state.date&&d.free>0);
 if(!within){const free=data.days.find(x=>x.free>0);state.date=free?.date||data.days[0].date;state.time=null}
 root.querySelectorAll('button').forEach((b,i)=>{const chosen=data.days[i].date===state.date;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen))});
 say(data.days.some(x=>x.free)?'Зеленим виділено вибраний день. Обери вільну годину.':'У цьому тижні немає вільних годин — перейди до наступного.');
 await fetchSlots();
}
async function selectDate(day){state.date=day;state.time=null;chosen();await fetchDates()}
async function fetchSlots(){
 if(!state.date)return;$('#selected-day-label').textContent=human(state.date);
 const root=$('#time-grid');root.replaceChildren();const loading=document.createElement('div');loading.className='empty-time';loading.textContent='Перевіряємо доступність…';root.append(loading);
 try{
  const data=await api('/api/slots?date='+state.date);root.replaceChildren();
  if(!data.slots.length){const p=document.createElement('div');p.className='empty-time';p.textContent='У цей день заняття не проводяться. Обери інший.';root.append(p)}
  for(const slot of data.slots){
   const btn=document.createElement('button');btn.type='button';btn.className='time-button '+(slot.status==='free'?'free':slot.status)+(slot.time===state.time?' selected':'');
   btn.disabled=slot.status!=='free';
   const hour=document.createElement('strong');hour.textContent=slot.time;
   const label=document.createElement('small');label.textContent=slot.status==='free'?'Вільно':slot.status==='busy'?'Зайнято':slot.status==='blocked'?'Недоступно':'Минуло';
   btn.append(hour,label);btn.setAttribute('aria-pressed',String(slot.time===state.time));
   btn.onclick=()=>{state.time=slot.time;root.querySelectorAll('button').forEach(x=>{x.classList.toggle('selected',x===btn);x.setAttribute('aria-pressed',String(x===btn))});chosen();$('#details').scrollIntoView({behavior:'smooth',block:'start'})};
   root.append(btn);
  }
  if(state.time&&!data.slots.some(x=>x.time===state.time&&x.status==='free'))state.time=null;
  chosen();
 }catch(e){root.replaceChildren();const p=document.createElement('div');p.className='empty-time';p.textContent='Не вдалося оновити час. '+e.message;root.append(p)}
}
async function initialize(){
 try{const info=await api('/api/info');state.today=info.today;state.duration=info.duration;await fetchDates()}
 catch(e){say('Не вдалося отримати розклад. '+e.message);$('#time-grid').textContent='Сервер тимчасово недоступний. Онови сторінку.'}
}
$('#prev-week').onclick=async()=>{state.offset=Math.max(0,state.offset-7);state.time=null;chosen();await fetchDates()};
$('#next-week').onclick=async()=>{state.offset=Math.min(56,state.offset+7);state.time=null;chosen();await fetchDates()};
$('#booking-form').addEventListener('submit',async e=>{
 e.preventDefault();error('');
 if(state.busy)return;
 if(!state.date||!state.time)return error('Спочатку обери вільний день і час.');
 const name=$('#student-name').value.trim(),phone=$('#student-phone').value.trim();
 if(name.length<2)return error('Вкажи ім’я (принаймні 2 символи).');
 if(!/^\+?[0-9()\-\s]{7,24}$/.test(phone))return error('Вкажи номер телефону у правильному форматі.');
 if(!$('#consent').checked)return error('Підтвердь згоду на використання контактів.');
 state.busy=true;chosen();
 try{
  const receipt=await api('/api/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,note:$('#student-note').value.trim(),website:$('#website').value,date:state.date,time:state.time})});
  state.receipt=receipt;$('#confirm-date').textContent=human(receipt.date);$('#confirm-time').textContent=receipt.time+' · '+receipt.duration+' хв';$('#confirm-code').textContent=receipt.code;
  $('#booking-success').classList.remove('hidden');$('#details').classList.add('hidden');
  state.time=null;await fetchDates();$('#booking-success').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){error(e.message);if(e.status===409){state.time=null;await fetchDates()}}
 finally{state.busy=false;chosen()}
});
function icsEscape(s){return String(s).replaceAll('\\','\\\\').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\n','\\n')}
$('#download-calendar').onclick=()=>{
 const r=state.receipt;if(!r)return;
 const start=r.date.replaceAll('-','')+'T'+r.time.replace(':','')+'00';
 const min=Number(r.time.slice(0,2))*60+Number(r.time.slice(3))+r.duration;
 const end=r.date.replaceAll('-','')+'T'+pad(Math.floor(min/60))+pad(min%60)+'00';
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Drive Time//Driving Lesson//UK','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+r.code+'@drive-time-booking','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'').replace('Z','Z'),'DTSTART;TZID=Europe/Kyiv:'+start,'DTEND;TZID=Europe/Kyiv:'+end,'SUMMARY:'+icsEscape('Заняття з водіння'),'DESCRIPTION:'+icsEscape('DRIVE TIME. Код бронювання: '+r.code),'END:VEVENT','END:VCALENDAR'];
 const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='drive-time-lesson.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500)
};
$('#new-booking').onclick=()=>{state.receipt=null;$('#details').classList.remove('hidden');$('#booking-success').classList.add('hidden');$('#booking-form').reset();$('#booking').scrollIntoView({behavior:'smooth'});fetchDates()};
initialize();
