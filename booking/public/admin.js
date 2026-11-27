const $=s=>document.querySelector(s);
let state=null,today=null,selectedTab='bookings';
const weekdays=['','Понеділок','Вівторок','Середа','Четвер','П’ятниця','Субота','Неділя'];
const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const minutes=v=>{const [h,m]=String(v).split(':').map(Number);return h*60+m};
const dateAdd=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
async function api(path,options={}){const response=await fetch(path,{cache:'no-store',...options});let body;try{body=await response.json()}catch{throw new Error('Сервер тимчасово недоступний')};if(!response.ok)throw Object.assign(new Error(body.error||'Не вдалося виконати дію'),{status:response.status});return body}
const put=(path,body)=>api(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const post=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const del=(path,body)=>api(path,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const say=s=>{$('#admin-message').textContent=s};
const el=(tag,content,klass)=>{const x=document.createElement(tag);if(content!=null)x.textContent=String(content);if(klass)x.className=klass;return x};
async function sync(){state=await api('/api/admin/state');today=(await api('/api/info')).today;$('#admin-login').classList.add('hidden');$('#admin-dashboard').classList.remove('hidden');renderAll()}
function renderAll(){
 const active=state.bookings.filter(x=>x.status==='confirmed');
 $('#stats-total').textContent=active.length;
 $('#stats-today').textContent=active.filter(x=>x.day===today).length;
 $('#stats-week').textContent=active.filter(x=>x.day>=today&&x.day<dateAdd(today,7)).length;
 renderBookings();renderWeekly();renderOverrides();renderBlocks();
 if(!$('#exception-date').value)$('#exception-date').value=today;
 if(!$('#block-date').value)$('#block-date').value=today;
}
function selectTab(name){
 selectedTab=name;document.querySelectorAll('.admin-tabs button').forEach(btn=>{const yes=btn.dataset.tab===name;btn.classList.toggle('active',yes);btn.setAttribute('aria-selected',String(yes))});
 for(const t of ['bookings','weekly','exceptions','blocks'])$('#tab-'+t).classList.toggle('hidden',name!==t);
 if(name==='blocks')renderBlocks();
}
function renderBookings(){
 const tbody=$('#bookings-body');tbody.replaceChildren();
 const date=$('#booking-filter-date').value,status=$('#booking-filter-status').value;
 const entries=state.bookings.filter(b=>(!date||b.day===date)&&(status==='all'||b.status===status)).sort((a,b)=>(a.day+' '+time(a.start_min)).localeCompare(b.day+' '+time(b.start_min)));
 if(!entries.length){const tr=el('tr');const td=el('td','Записів за обраними умовами немає.');td.colSpan=7;td.className='empty-admin';tr.append(td);tbody.append(tr);return}
 for(const b of entries){
  const row=el('tr');
  const items=[b.day,time(b.start_min),b.student_name,b.phone,b.note||'—',b.status==='confirmed'?'Підтверджено':'Скасовано'];
  items.forEach((v,i)=>{const td=el('td',v,i===5&&b.status==='cancelled'?'cancelled':'');row.append(td)});
  const last=el('td');
  if(b.status==='confirmed'){const btn=el('button','Скасувати','danger');btn.onclick=async()=>{if(!confirm('Скасувати заняття '+b.day+' о '+time(b.start_min)+' для '+b.student_name+'? Час знову стане вільним.'))return;try{await post('/api/admin/cancel',{id:b.id});await sync();say('Запис скасовано. Годину звільнено.')}catch(e){say(e.message)}};last.append(btn)}
  row.append(last);tbody.append(row)
 }
}
function renderWeekly(){
 const root=$('#weekly-rows');root.replaceChildren();$('#lesson-duration').value=String(state.duration);
 for(const day of state.weekly){
  const row=el('div',null,'weekly-row');row.dataset.dow=day.dow;
  const name=el('b',weekdays[day.dow]);
  const label=el('label');const check=document.createElement('input');check.type='checkbox';check.checked=day.enabled;check.className='day-enabled';label.append(check,el('span','Працюю'));
  const start=document.createElement('input');start.type='time';start.className='day-start';start.value=time(day.start_min);start.setAttribute('aria-label',weekdays[day.dow]+' початок');
  const end=document.createElement('input');end.type='time';end.className='day-end';end.value=time(day.end_min);end.setAttribute('aria-label',weekdays[day.dow]+' кінець');
  row.append(name,label,start,end);root.append(row);
 }
}
function renderOverrides(){
 const root=$('#exceptions-list');root.replaceChildren();
 if(!state.overrides.length){root.append(el('p','Окремих змін поки немає.','admin-note'));return}
 for(const item of state.overrides){
  const row=el('div',null,'override-chip');row.append(el('span',item.day+' · '+(item.closed?'Вихідний':time(item.start_min)+'–'+time(item.end_min))));
  const btn=el('button','Прибрати','mini-btn');btn.type='button';btn.onclick=async()=>{try{await del('/api/admin/override',{date:item.day});await sync();say('Повернуто звичайний графік на '+item.day)}catch(e){say(e.message)}};row.append(btn);root.append(row)
 }
}
async function renderBlocks(){
 const date=$('#block-date').value||today;if(!date)return;
 const root=$('#admin-block-slots');root.replaceChildren();
 try{
  const data=await api('/api/slots?date='+date);
  if(!data.slots.length){root.append(el('p','На цю дату робочих слотів немає.','admin-note'));return}
  for(const slot of data.slots){
   const btn=el('button',slot.time+' · '+(slot.status==='busy'?'Зайнято':slot.status==='blocked'?'Заблоковано':slot.status==='free'?'Вільно':'Минуло'),'admin-slot '+slot.status);
   btn.type='button';btn.disabled=slot.status==='busy';
   btn.onclick=async()=>{
    const blocked=slot.status!=='blocked';
    try{await put('/api/admin/block',{date,time:slot.time,blocked});await sync();say(blocked?'Годину '+slot.time+' заблоковано':'Годину '+slot.time+' відкрито')}catch(e){say(e.message)}
   };root.append(btn)
  }
 }catch(e){root.append(el('p',e.message,'admin-note'))}
}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();$('#login-error').textContent='';const pass=$('#login-password').value;
 try{await post('/api/admin/login',{password:pass});$('#login-password').value='';await sync()}catch(e){$('#login-error').textContent=e.message}
});
$('#admin-logout').onclick=async()=>{try{await post('/api/admin/logout',{});}catch{}location.reload()};
document.querySelectorAll('.admin-tabs button').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
$('#booking-filter-date').onchange=renderBookings;$('#booking-filter-status').onchange=renderBookings;$('#booking-filter-clear').onclick=()=>{$('#booking-filter-date').value='';renderBookings()};
$('#admin-refresh').onclick=async()=>{try{await sync();say('Дані оновлено.')}catch(e){say(e.message)}};
$('#save-weekly').onclick=async()=>{
 const duration=Number($('#lesson-duration').value);
 const days=[...document.querySelectorAll('.weekly-row')].map(row=>({dow:Number(row.dataset.dow),enabled:row.querySelector('.day-enabled').checked,start:minutes(row.querySelector('.day-start').value),end:minutes(row.querySelector('.day-end').value)}));
 try{const r=await put('/api/admin/weekly',{duration,days});await sync();say('Тижневий графік збережено. '+(r.note||''))}catch(e){say(e.message)}
};
$('#exception-closed').onchange=()=>{$('#exception-start').disabled=$('#exception-closed').checked;$('#exception-end').disabled=$('#exception-closed').checked};
$('#exception-save').onclick=async()=>{
 const date=$('#exception-date').value,closed=$('#exception-closed').checked,start=minutes($('#exception-start').value),end=minutes($('#exception-end').value);
 try{const r=await put('/api/admin/override',{date,closed,start,end});await sync();say('Графік на '+date+' збережено. '+(r.note||''))}catch(e){say(e.message)}
};
$('#block-date').onchange=renderBlocks;$('#reload-blocks').onclick=renderBlocks;
(async()=>{try{await sync()}catch(e){if(e.status!==401)$('#login-error').textContent='Не вдалося завантажити кабінет: '+e.message}})();
