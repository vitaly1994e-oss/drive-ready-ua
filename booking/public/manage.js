const $=s=>document.querySelector(s);
const ctx={code:'',phone:'',booking:null,start:null,time:null,duration:null,selectedDate:null,serial:0};
const human=d=>new Intl.DateTimeFormat('uk-UA',{dateStyle:'full',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const pad=n=>String(n).padStart(2,'0');
const time=n=>pad(Math.floor(n/60))+':'+pad(n%60);
const mins=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const addDays=(s,n)=>{const x=new Date(s+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
function el(tag,content,cls){const a=document.createElement(tag);if(content!==undefined)a.textContent=content;if(cls)a.className=cls;return a}
const data={code:()=>ctx.code,phone:()=>ctx.phone};
async function api(path,body=null){const res=await fetch(path,body===null?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});let d;try{d=await res.json()}catch{throw Error('Не вдалось зв’язатися із сервером')};if(!res.ok)throw Error(d.error||'Спробуй ще раз');return d}
function feedback(s){$('#manage-action-status').textContent=s}
function setBooking(b){
 ctx.booking=b;$('#booking-details-panel').classList.remove('hidden');
 $('#manage-status').textContent=b.status==='confirmed'?'Підтверджено':'Скасовано';
 $('#manage-status').classList.toggle('cancelled',b.status!=='confirmed');
 $('#manage-date').textContent=human(b.date);
 $('#manage-time').textContent=b.time+'–'+b.end;
 $('#manage-student').textContent=b.name;
 $('#manage-duration').textContent='Тривалість: '+b.duration+' хв';
 $('#manage-actions').classList.toggle('hidden',!b.canChange);
 $('#manage-policy-state').textContent=b.status!=='confirmed'?'Це заняття вже скасовано.':b.canChange?'Можеш самостійно змінити або скасувати запис зараз.':'Менше 24 годин до заняття: звернися до інструктора для погодження змін.';
 $('#reschedule-panel').classList.add('hidden');
 feedback('');
}
async function lookup(){
 $('#lookup-error').textContent='';
 const code=$('#manage-code').value.trim().toUpperCase(),phone=$('#manage-phone').value.trim();
 if(!/^[A-F0-9]{10}$/.test(code))return $('#lookup-error').textContent='Код має містити 10 символів (цифри та літери A–F).';
 if(phone.replace(/\D/g,'').length<9)return $('#lookup-error').textContent='Вкажи номер телефону з бронювання.';
 ctx.code=code;ctx.phone=phone;
 try{const d=await api('/api/manage/lookup',{code,phone});setBooking(d.booking)}catch(e){$('#booking-details-panel').classList.add('hidden');$('#lookup-error').textContent=e.message}
}
$('#lookup-form').addEventListener('submit',e=>{e.preventDefault();lookup()});
$('#cancel-booking').onclick=async()=>{
 if(!ctx.booking?.canChange)return;
 if(!confirm('Скасувати заняття '+ctx.booking.date+' о '+ctx.booking.time+'? Час стане доступним іншим курсантам.'))return;
 try{await api('/api/manage/cancel',{code:ctx.code,phone:ctx.phone});const d=await api('/api/manage/lookup',{code:ctx.code,phone:ctx.phone});setBooking(d.booking);feedback('Заняття скасовано. Час звільнено.') }catch(e){feedback(e.message)}
};
$('#show-reschedule').onclick=async()=>{
 $('#reschedule-panel').classList.remove('hidden');
 const info=await api('/api/info');const field=$('#new-date');
 field.min=info.today;field.max=addDays(info.today,info.horizon);
 field.value=ctx.booking.date>=info.today?ctx.booking.date:info.today;
 ctx.selectedDate=field.value;await loadStarts();$('#reschedule-panel').scrollIntoView({behavior:'smooth',block:'start'});
};
$('#hide-reschedule').onclick=()=>$('#reschedule-panel').classList.add('hidden');
$('#new-date').onchange=async()=>{ctx.selectedDate=$('#new-date').value;await loadStarts()};
function resetTarget(){ctx.start=null;ctx.time=null;ctx.duration=null;$('#confirm-reschedule').disabled=true;$('#new-interval').textContent='Новий час ще не обрано';$('#new-ends').replaceChildren(el('div','Спочатку обери початок','empty-time'))}
async function loadStarts(){
 const serial=++ctx.serial;resetTarget();
 const root=$('#new-starts');root.replaceChildren(el('div','Завантаження…','empty-time'));
 if(!ctx.selectedDate)return;
 try{const d=await api('/api/slots?date='+ctx.selectedDate+'&durationMinutes=30');
  if(serial!==ctx.serial)return;root.replaceChildren();
  const starts=d.slots.filter(x=>x.status==='free');
  if(!starts.length){root.append(el('div','Немає вільних годин','empty-time'));return}
  for(const slot of starts){
   const button=el('button',slot.time,'time-button');button.type='button';
   button.onclick=()=>chooseStart(slot.time,button);root.append(button);
  }
 }catch(e){if(serial===ctx.serial)root.replaceChildren(el('div',e.message,'empty-time'))}
}
async function chooseStart(start,btn){
 const serial=++ctx.serial;ctx.start=start;ctx.time=null;ctx.duration=null;$('#confirm-reschedule').disabled=true;
 $('#new-starts').querySelectorAll('button').forEach(n=>n.classList.toggle('selected',n===btn));
 const root=$('#new-ends');root.replaceChildren(el('div','Перевіряємо вільний час…','empty-time'));
 try{const d=await api('/api/ends?date='+ctx.selectedDate+'&start='+start);if(serial!==ctx.serial)return;
  root.replaceChildren();
  if(!d.ends.length){root.append(el('div','Немає доступного завершення','empty-time'));return}
  for(const entry of d.ends){
   const button=el('button',entry.time+' · '+entry.durationMinutes+' хв','time-button');button.type='button';
   button.onclick=()=>{ctx.time=start;ctx.duration=entry.durationMinutes;
    root.querySelectorAll('button').forEach(n=>n.classList.toggle('selected',n===button));
    $('#new-interval').textContent=human(ctx.selectedDate)+' · '+start+'–'+entry.time;
    $('#confirm-reschedule').disabled=false;
   };
   root.append(button);
  }
 }catch(e){if(serial===ctx.serial)root.replaceChildren(el('div',e.message,'empty-time'))}
}
$('#confirm-reschedule').onclick=async()=>{
 if(!ctx.time||!ctx.duration)return;
 if(!confirm('Перенести заняття на '+ctx.selectedDate+' з '+ctx.time+' на '+ctx.duration+' хв?'))return;
 const button=$('#confirm-reschedule');button.disabled=true;
 try{const d=await api('/api/manage/reschedule',{code:ctx.code,phone:ctx.phone,date:ctx.selectedDate,time:ctx.time,durationMinutes:ctx.duration});
  const current=await api('/api/manage/lookup',{code:ctx.code,phone:ctx.phone});setBooking(current.booking);
  feedback('Заняття перенесено на '+human(d.date)+' о '+d.time+'. Онови запис у своєму календарі.');
 }catch(e){feedback(e.message)}finally{button.disabled=false}
};
