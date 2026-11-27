(()=>{
'use strict';
const $=s=>document.querySelector(s);
const STORAGE='dru-ready360-v1';
const TYPES=[
 {id:'start',name:'Початок руху',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#n240',tip:'Перевір дзеркала, сліпі зони, подай сигнал і переконайся в безпеці початку руху.',exercise:'Відпрацюй перевірку обстановки перед початком руху та надання дороги.',topic:'Маневрування'},
 {id:'lane',name:'Вибір смуги та перестроювання',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Оціни знаки та розмітку. Перед перестроюванням дай дорогу транспортним засобам у смузі.',exercise:'Повтори вибір смуги та порядок дій перед перестроюванням.',topic:'Маневрування'},
 {id:'left',name:'Поворот ліворуч і розворот',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Визнач дозволені напрямки руху і правильне положення, перевір пріоритет.',exercise:'Виконай три умовні сценарії лівого повороту з різним пріоритетом.',topic:'Маневрування'},
 {id:'intersection',name:'Пріоритет на перехресті',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Враховуй сигнали регулювальника, світлофора та знаки пріоритету.',exercise:'Повтори регульовані й нерегульовані перехрестя.',topic:'Проїзд перехресть'},
 {id:'circle',name:'Круговий рух',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Перевір організацію руху, знаки, дорожню розмітку та безпечний виїзд.',exercise:'Повтори три навчальні ситуації в’їзду та виїзду з кільця.',topic:'Проїзд перехресть'},
 {id:'pedestrian',name:'Пішохідні переходи',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Заздалегідь оцінюй обстановку та надавай дорогу пішоходам у передбачених ПДР випадках.',exercise:'Відпрацюй зупинку перед переходом і оцінку пішоходів.',topic:'Безпека пішоходів'},
 {id:'stop',name:'Зупинка та стоянка',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Не зупиняйся у забороненому місці, навіть якщо отримав команду екзаменатора.',exercise:'Знайди безпечне дозволене місце зупинки в умовних сценаріях.',topic:'Зупинка і стоянка'},
 {id:'parking',name:'Паркування і задній хід',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Контролюй простір навколо, діюй повільно, переконайся в безпеці.',exercise:'Відпрацюй парковку й рух заднім ходом у безпечних навчальних умовах.',topic:'Маневрування'},
 {id:'tram',name:'Трамвайні колії',rule:'https://zakon.rada.gov.ua/laws/show/1306-2001-%D0%BF#Text',tip:'Перевір умови руху трамвайними коліями та пріоритет трамвая за ПДР.',exercise:'Повтори допустимість руху коліями та черговість проїзду.',topic:'Трамвайні колії'}
];
const QUESTIONS=[
 {kind:'start',q:'Перед початком руху від правого краю дороги потрібно…',a:['Переконатися в безпеці, перевірити дзеркала та сліпу зону, подати сигнал','Одразу виїхати, якщо екзаменатор дав команду','Подати звуковий сигнал і різко рушити'],ok:0,why:'Команда про початок руху не скасовує обов’язку переконатися в його безпеці.'},
 {kind:'lane',q:'Ти плануєш перестроїтися до сусідньої смуги. Що маєш зробити?',a:['Увімкнути сигнал і без перевірки перестроїтися','Перевірити вільний простір, подати сигнал і надати дорогу транспорту в смузі','Увімкнути аварійну сигналізацію'],ok:1,why:'Покажчик повороту не надає переваги під час перестроювання.'},
 {kind:'left',q:'Екзаменатор просить розворот там, де він заборонений. Твоє рішення?',a:['Розвернутися, щоб виконати команду','Знайти наступне дозволене місце й виконати безпечно','Зупинитися посеред смуги'],ok:1,why:'Маневр виконують лише там, де він не суперечить ПДР.'},
 {kind:'intersection',q:'Регулювальник показує сигнал, що відрізняється від світлофора. Що важливіше?',a:['Сигнал регулювальника','Сигнал світлофора','Порада іншого водія'],ok:0,why:'Сигнали регулювальника мають пріоритет над світлофором.'},
 {kind:'circle',q:'Перед в’їздом на кільце є знаки пріоритету. Як обираєш черговість?',a:['Ігнорую знаки, бо завжди маю перевагу','Дію відповідно до знаків і правил проїзду перехресть','Їду з максимальною швидкістю'],ok:1,why:'Потрібно оцінити конкретну організацію руху та вимоги ПДР.'},
 {kind:'pedestrian',q:'Пішохід переходить нерегульований перехід попереду. Твої дії?',a:['Проїду перед пішоходом, якщо встигаю','Дам дорогу та зупинюся за потреби','Посигналю для прискорення'],ok:1,why:'Необхідно надати дорогу пішоходам і діяти обережно.'},
 {kind:'stop',q:'Команда екзаменатора «Зупиніться» на ділянці зі знаком заборони зупинки. Твоя дія?',a:['Знайду найближче дозволене безпечне місце','Зупинюся одразу','Зупинюся на переході'],ok:0,why:'Навчальна команда не скасовує вимог дорожніх знаків.'},
 {kind:'parking',q:'Перед рухом заднім ходом потрібно…',a:['Дивитися лише вперед','Переконатися у безпеці маневру, контролювати простір','Збільшити швидкість'],ok:1,why:'Рух заднім ходом дозволений лише за безпечних умов.'},
 {kind:'tram',q:'Плануєш поворот із ділянки з трамвайними коліями. Що перевіриш?',a:['Знаки, розмітку, правила розташування й рух трамвая','Лише можливість пришвидшитися','Тільки положення заднього авто'],ok:0,why:'Трамвайні колії мають окремі правила використання й пріоритету.'}
];
const schemas={...(window.DRU_SCHEMAS||{}),...(window.DRU_KHARKIV_SCHEMAS||{})};
const centers=Array.isArray(window.DRU_CENTERS)?window.DRU_CENTERS:[];
const byCode=new Map(centers.map(c=>[String(c[2]),c]));
const sourceDefault='https://hsc.gov.ua/index/poslugi/vidacha-posvidchennya-vodiya/marshruti/';
const khSources=window.DRU_KHARKIV_SOURCES||{};
const available=Object.keys(schemas).filter(c=>schemas[c]?.length&&byCode.has(c)).sort();
const maxRecords=200;
let state,activeQuestion=null,answered=false,questionIndex=0;
const id=()=>crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2,10);
function safeRead(){try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');return raw&&typeof raw==='object'?raw:{}}catch{return {}}}
function records(){return Array.isArray(state.passports)?state.passports:[]}
function favorites(){return Array.isArray(state.favorites)?state.favorites:[]}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));return true}catch{message('Недостатньо місця в браузері для збереження. Збережи звіт у файл.');return false}}
function message(t){$('#r360-save-status').textContent=t}
function elem(tag,text,klass){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(klass)x.className=klass;return x}
function currentCenter(){return $('#r360-center').value}
function currentRoute(){return $('#r360-route').value}
function routeKey(){return currentCenter()+'#'+currentRoute()}
function updateRoutes(){
 const code=currentCenter(),list=schemas[code]||[],route=$('#r360-route'),prev=route.value;
 route.replaceChildren();
 list.forEach(([num],i)=>route.add(new Option((code==='6350'?'Схема №':'Маршрут №')+num,String(i))));
 const pref=new URLSearchParams(location.search).get('route'),val=pref!==null?list.findIndex(([n])=>n===pref):-1;
 route.value=val>=0?String(val):list[+prev]?prev:'0';renderScheme();
}
function renderScheme(){
 const code=currentCenter(),index=+currentRoute(),item=(schemas[code]||[])[index],center=byCode.get(code);
 if(!item||!center)return;
 const [number,url]=item,title='ТСЦ №'+code+' · '+center[1]+' · '+(code==='6350'?'схема №':'маршрут №')+number;
 const img=$('#r360-image'),error=$('#r360-image-error');error.classList.add('hidden');img.hidden=false;img.alt=title+' — навчальна схема';img.onerror=()=>{img.hidden=true;error.classList.remove('hidden')};img.onload=()=>{error.classList.add('hidden')};img.src=url;
 $('#r360-route-title').textContent=title;$('#r360-center-address').textContent=center[0]+' · '+center[3];
 $('#r360-source').href=khSources[code]||sourceDefault;
 const fav=favorites().includes(routeKey());$('#r360-favorite').textContent=fav?'★ Збережено':'☆ Зберегти маршрут';
 const base=new URL(location.href);base.searchParams.set('center',code);base.searchParams.set('route',number);history.replaceState(null,'',base);
 renderRecords();
}
function renderRecords(){
 const all=records(),key=routeKey(),selected=all.filter(x=>x.routeKey===key).slice().reverse();
 const pending=all.filter(x=>x.status!=='done'),done=all.filter(x=>x.status==='done');
 $('#r360-total').textContent=all.length;$('#r360-pending').textContent=pending.length;$('#r360-done').textContent=done.length;
 const root=$('#r360-passports');root.replaceChildren();
 const heading=elem('h3','Паспорт цього маршруту');root.append(heading);
 if(!selected.length)root.append(elem('p','Ще немає записів по цьому маршруту. Додай помилку після заняття.','muted'));
 selected.forEach(record=>{
  const type=TYPES.find(t=>t.id===record.kind)||TYPES[0],card=elem('article',undefined,'r360-passport'),top=elem('div',undefined,'r360-passport-top');
  top.append(elem('strong',type.name),elem('span',record.status==='done'?'Відпрацьовано':'Потрібна практика',record.status==='done'?'r360-done':'r360-pending'));
  card.append(top);
  if(record.place)card.append(elem('p','⌖ '+record.place));
  if(record.note)card.append(elem('p',record.note));
  card.append(elem('p','Рекомендація: '+type.tip,'muted'));
  const link=elem('a','Перевірити ПДР ↗','r360-rule');link.href=type.rule;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
  const actions=elem('div',undefined,'r360-passport-actions');
  const toggle=elem('button',record.status==='done'?'Повернути в роботу':'Позначити відпрацьованим','button');
  toggle.type='button';toggle.onclick=()=>{record.status=record.status==='done'?'pending':'done';record.updated=new Date().toISOString();save();renderRecords()};
  const del=elem('button','Видалити','button');del.type='button';del.onclick=()=>{if(!confirm('Видалити запис із паспорта помилок?'))return;state.passports=records().filter(x=>x.id!==record.id);save();renderRecords()};
  actions.append(toggle,del);card.append(actions);root.append(card);
 });
 const plan=$('#r360-plan');plan.replaceChildren();
 const pendingKinds=[...new Set(pending.filter(x=>x.routeKey===key).map(x=>x.kind))];
 if(!pendingKinds.length){plan.append(elem('p','Поточних помилок на цьому маршруті немає. Повтори базові маневри та перевір розмітку з інструктором.','muted'))}
 else pendingKinds.forEach((kind,n)=>{const type=TYPES.find(t=>t.id===kind);if(!type)return;const item=elem('div',undefined,'r360-plan-item');item.append(elem('span',String(n+1).padStart(2,'0'),'r360-plan-number'));const block=elem('div');block.append(elem('strong',type.name),elem('p',type.exercise));item.append(block);plan.append(item)});
}
function renderQuestion(){
 const pending=records().filter(x=>x.routeKey===routeKey()&&x.status!=='done').map(x=>x.kind),kinds=[...new Set(pending)];
 const choices=kinds.length?QUESTIONS.filter(q=>kinds.includes(q.kind)):QUESTIONS;
 activeQuestion=choices[questionIndex%choices.length];questionIndex++;answered=false;
 $('#r360-quiz-topic').textContent=TYPES.find(t=>t.id===activeQuestion.kind)?.name||'ПДР';
 $('#r360-question').textContent=activeQuestion.q;
 const root=$('#r360-answers');root.replaceChildren();$('#r360-feedback').replaceChildren();
 activeQuestion.a.forEach((answer,index)=>{const btn=elem('button',answer,'r360-answer');btn.type='button';btn.onclick=()=>answerQuestion(index);root.append(btn)});
}
function answerQuestion(index){
 if(answered||!activeQuestion)return;answered=true;const ok=index===activeQuestion.ok;
 [...$('#r360-answers').children].forEach((btn,j)=>{btn.disabled=true;if(j===activeQuestion.ok)btn.classList.add('correct');else if(j===index)btn.classList.add('wrong')});
 $('#r360-feedback').textContent=(ok?'Правильно. ':'Помилка. ')+activeQuestion.why;
 state.attempts=[...(Array.isArray(state.attempts)?state.attempts:[]),{kind:activeQuestion.kind,correct:ok,date:new Date().toISOString()}].slice(-100);save();
}
function exportData(){
 const payload={schema:'drive-ready-360',version:1,exportedAt:new Date().toISOString(),passports:records(),favorites:favorites(),attempts:Array.isArray(state.attempts)?state.attempts:[]};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='drive-ready-360.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function importData(){
 const file=$('#r360-import-file').files?.[0];if(!file){message('Обери JSON-файл з попереднього експорту.');return}
 if(file.size>2000000){message('Файл завеликий для імпорту.');return}
 let payload;try{payload=JSON.parse(await file.text())}catch{message('Невірний JSON-файл.');return}
 if(payload.schema!=='drive-ready-360'||payload.version!==1||!Array.isArray(payload.passports)){message('Це не файл експорту DRIVE READY 360°.');return}
 if(payload.passports.length>maxRecords||payload.passports.some(x=>typeof x.id!=='string'||x.id.length>100||!TYPES.some(t=>t.id===x.kind)||typeof x.routeKey!=='string'||x.routeKey.length>50||typeof x.note!=='string'||x.note.length>500||typeof x.place!=='string'||x.place.length>120||!['done','pending'].includes(x.status))){message('Файл не пройшов перевірку структури даних.');return}
 if(!confirm('Замінити поточні записи у цьому браузері даними з файлу?'))return;
 state.passports=payload.passports;state.favorites=Array.isArray(payload.favorites)?payload.favorites.filter(x=>typeof x==='string'&&x.length<60).slice(0,100):[];
 state.attempts=Array.isArray(payload.attempts)?payload.attempts.filter(x=>x&&typeof x.kind==='string'&&typeof x.correct==='boolean').slice(-100):[];
 if(save()){renderScheme();renderQuestion();message('Записи імпортовано.')}
}
function init(){
 if(!available.length){$('#r360-center').add(new Option('Поки немає підтверджених схем',''));message('Каталог схем недоступний.');return}
 state=safeRead();state.passports=Array.isArray(state.passports)?state.passports.slice(-maxRecords):[];
 const kind=$('#r360-kind');TYPES.forEach(x=>kind.add(new Option(x.name,x.id)));
 available.forEach(code=>{const c=byCode.get(code);$('#r360-center').add(new Option('ТСЦ №'+code+' · '+c[1]+' ('+c[0]+')',code))});
 const query=new URLSearchParams(location.search),requested=query.get('center');
 if(available.includes(requested))$('#r360-center').value=requested;else if(available.includes('6341'))$('#r360-center').value='6341';
 $('#r360-center').addEventListener('change',()=>{const u=new URL(location.href);u.searchParams.delete('route');history.replaceState(null,'',u);updateRoutes();renderQuestion()});
 $('#r360-route').addEventListener('change',()=>{renderScheme();renderQuestion()});
 $('#r360-favorite').addEventListener('click',()=>{const list=favorites(),key=routeKey();state.favorites=list.includes(key)?list.filter(x=>x!==key):[...list,key].slice(-100);save();renderScheme()});
 $('#r360-error-form').addEventListener('submit',e=>{e.preventDefault();if(records().length>=maxRecords){message('Досягнуто ліміту 200 записів. Експортуй і видали старі записи.');return}
 const item={id:id(),routeKey:routeKey(),kind:kind.value,severity:$('#r360-severity').value==='critical'?'critical':'practice',place:$('#r360-place').value.trim(),note:$('#r360-notes').value.trim(),status:'pending',date:new Date().toISOString()};
 state.passports.push(item);if(save()){message('Додано до паспорта помилок.');e.target.reset();renderRecords();renderQuestion()}});
 $('#r360-next').addEventListener('click',renderQuestion);
 $('#r360-export').addEventListener('click',exportData);$('#r360-print').addEventListener('click',()=>window.print());
 $('#r360-import-button').addEventListener('click',importData);
 updateRoutes();renderQuestion();
}
init();
})();