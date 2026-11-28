(()=>{
'use strict';
const $=s=>document.querySelector(s);
const VERSION='ee8f17b052d50475cd00156b21ca7b2f3cfe8cc1';
const BASE='https://raw.githubusercontent.com/vdzerkalo/pdr-test/'+VERSION+'/';
const FALLBACK='https://cdn.jsdelivr.net/gh/vdzerkalo/pdr-test@'+VERSION+'/';
const URLS=[BASE+'data/questions.json',FALLBACK+'data/questions.json'];
const CAT={A:[40,43],B:[44,47],C:[48,51],D:[52,55],BE:[56,59],T:[60,63]};
const KEY='dru-official-quiz-v1';
let bank=[],sections=[],filtered=[],pool=[],idx=0,correct=0,wrong=0,answered=false,mode='exam',running=false,finished=false,limit=0,timer=null,sourceRoot=BASE,sourceError=false,questionStart=0,correctAnswer=null;
function read(){try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');if(s&&typeof s==='object')return s}catch{}return {}}
let dataState=read();
function store(){try{localStorage.setItem(KEY,JSON.stringify(dataState))}catch{}}
function progress(){if(!dataState.progress||typeof dataState.progress!=='object')dataState.progress={};return dataState.progress}
function savedList(name){return Array.isArray(dataState[name])?dataState[name]:[]}
function history(){return Array.isArray(dataState.history)?dataState.history:[]}
function clampStr(s){return typeof s==='string'?s:''}
function setText(sel,txt){const e=$(sel);if(e)e.textContent=String(txt)}
function visible(el,show){$(el).classList.toggle('hidden',!show)}
function category(){return CAT[$('#category').value]||CAT.B}
function major(s){return parseInt(s,10)}
function fits(q){const m=major(q.section);const c=category();return Number.isFinite(m)&&(m<=39||(m>=c[0]&&m<=c[1]))}
function shuffle(input){const out=[...input];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function validEntry(q){return q&&typeof q.id==='string'&&typeof q.text==='string'&&q.text.trim().length>0&&Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=8&&q.options.every(x=>typeof x==='string'&&x.trim())&&Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<q.options.length&&typeof q.section==='string'}
function safeImage(path){return typeof path==='string'&&/^images\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)$/i.test(path)&&!path.includes('..')}
function addImage(path){const wrap=$('#image-wrap'),image=$('#question-image'),error=$('#image-error');if(!safeImage(path)){wrap.classList.add('hidden');image.removeAttribute('src');return}wrap.classList.remove('hidden');error.classList.add('hidden');image.hidden=false;const imgpath=path.split('/').map(encodeURIComponent).join('/');image.alt='Зображення до екзаменаційного питання';image.onerror=()=>{if(image.dataset.fallback!=='1'){image.dataset.fallback='1';image.src=FALLBACK+imgpath;return}image.hidden=true;error.classList.remove('hidden')};image.dataset.fallback='0';image.src=BASE+imgpath}
function updateStudyShortcuts() {
 const knownMistakes = new Set(savedList('mistakes'));
 const remaining = filtered.filter(question => knownMistakes.has(question.id)).length;
 const diagnostic = $('#study-diagnostic');
 const retry = $('#study-mistakes');
 diagnostic.disabled = running || !filtered.length;
 retry.disabled = running || !remaining;
 setText('#study-recommendation', !bank.length ? 'Завантажуємо запитання…' :
  remaining ? 'Питань для повторення у цій категорії: ' + remaining + '.' :
  'Пройди 10 питань, щоб дізнатися, які теми варто повторити.');
}
function updateStats(){updateStudyShortcuts();const p=progress();const seen=Object.keys(p).filter(id=>p[id]&&p[id].count>0);setText('#total-seen',seen.length);const mistakes=savedList('mistakes');const favorite=savedList('favorites');setText('#mistake-count',mistakes.length);setText('#favorite-count',favorite.length);const results=history();setText('#stats-line',results.length?'Спроб: '+results.length+' · останній результат '+results.at(-1).correct+'/'+results.at(-1).answered:'Історія поки порожня')}
function setBankStatus(s){setText('#bank-status',s)}
async function fetchData(){let lastError;for(const url of URLS){try{const response=await fetch(url,{mode:'cors',credentials:'omit',cache:'default'});if(!response.ok)throw Error('HTTP '+response.status);const raw=await response.json();if(!raw||!Array.isArray(raw.questions)||!Array.isArray(raw.sections))throw Error('Невірний формат даних');const unique=new Set();bank=raw.questions.filter(q=>{if(!validEntry(q)||unique.has(q.id))return false;unique.add(q.id);return true});sections=raw.sections.filter(s=>s&&typeof s.id==='string');if(bank.length<1000)throw Error('Завантажено неповний банк');sourceRoot=url.slice(0,url.indexOf('data/'));return}catch(e){lastError=e}}throw lastError||Error('Джерело недоступне')}
function updateCategories(){filtered=bank.filter(fits);const previous=$('#topic').value;const list=new Map();for(const s of sections){const m=major(s.id),c=category();if(m<=39||(m>=c[0]&&m<=c[1]))list.set(s.id,clampStr(s.name)||clampStr(s.title)||('Розділ '+s.id))}for(const q of filtered)if(!list.has(q.section))list.set(q.section,clampStr(q.sectionName)||('Розділ '+q.section));$('#topic').replaceChildren(new Option('Усі теми', ''));for(const [key,title] of list)$('#topic').add(new Option(key+' · '+title,key));$('#topic').value=list.has(previous)?previous:'';$('#topic').disabled=$('#mode').value!=='topic';updateStudyShortcuts();setText('#bank-count',filtered.length+' питань для цієї категорії');if(bank.length===2332)setBankStatus('Відкритий набір: 2 332 питання · '+sections.length+' розділів · джерело 2026 року');else setBankStatus('Завантажено '+bank.length+' питань. Звіряй кількість із джерелом.');}
function selectMode(val){if(!['diagnostic','exam','topic','mistakes','favorites'].includes(val))return;$('#mode').value=val;$('#topic').disabled=val!=='topic'}
function filterPool(){const m=$('#mode').value;let chosen=filtered;if(m==='topic'){const t=$('#topic').value;if(t)chosen=chosen.filter(q=>q.section===t)}if(m==='mistakes'){const s=new Set(savedList('mistakes'));chosen=chosen.filter(q=>s.has(q.id))}if(m==='favorites'){const s=new Set(savedList('favorites'));chosen=chosen.filter(q=>s.has(q.id))}return shuffle(chosen)}
function examQuestions(available){const all=shuffle(available),result=[],perSection=new Map(),perTopic=new Map();for(const q of all){const n=perSection.get(q.section)||0,t=String(major(q.section)),p=perTopic.get(t)||0;if(n>=3||p>=6)continue;result.push(q);perSection.set(q.section,n+1);perTopic.set(t,p+1);if(result.length===20)break}if(result.length<20){for(const q of all){if(result.includes(q))continue;result.push(q);if(result.length===20)break}}return result}
let sessionErrors = new Map();
function start(){if(!bank.length)return;const available=filterPool();if(!available.length){alert('Для цього режиму немає питань. Обери іншу тему або розділ.');return}mode=$('#mode').value;pool=mode==='exam'?examQuestions(available):mode==='diagnostic'?examQuestions(available).slice(0,10):available;sessionErrors=new Map();idx=0;wrong=0;correct=0;answered=false;running=true;finished=false;updateStudyShortcuts();questionStart=Date.now();limit=mode==='exam'?Date.now()+20*60*1000:0;clearInterval(timer);timer=setInterval(tick,500);visible('#welcome',false);visible('#result',false);visible('#question-card',true);render();$('#question-card').scrollIntoView({behavior:'smooth',block:'start'})}
function tick(){if(!running||finished)return;if(!limit){setText('#timer','Навчання · без обмежень');return}const remaining=Math.max(0,Math.ceil((limit-Date.now())/1000));const mm=Math.floor(remaining/60),ss=String(remaining%60).padStart(2,'0');setText('#timer',mm+':'+ss);if(remaining===0)finish('timeout')}
function render(){if(!running||finished)return;if(idx>=pool.length){finish('complete');return}answered=false;const q=pool[idx];correctAnswer=q.correctIndex;setText('#question-number',(idx+1)+' / '+pool.length);$('#progress').max=pool.length;$('#progress').value=idx;setText('#section-name',clampStr(q.sectionName)||'Розділ '+q.section+' · питання '+q.number);setText('#question-text',q.text);setText('#answer-feedback','');visible('#next',false);const choices=$('#answers');choices.replaceChildren();q.options.forEach((option,j)=>{const b=document.createElement('button');b.type='button';b.className='answer';const marker=document.createElement('b');marker.textContent=String(j+1);const label=document.createElement('span');label.textContent=option;b.append(marker,label);b.onclick=()=>choose(j);choices.append(b)});const image=(Array.isArray(q.images)&&q.images.length?q.images[0]:q.image);addImage(image);const fav=savedList('favorites').includes(q.id);setText('#favorite',fav?'★':'☆');$('#favorite').setAttribute('aria-label',fav?'Прибрати з обраного':'Додати до обраного');tick()}
function choose(n){if(!running||finished||answered)return;answered=true;const q=pool[idx],ok=n===correctAnswer;if(ok)correct++;else {wrong++;sessionErrors.set(q.section,(sessionErrors.get(q.section)||0)+1)}const p=progress();const old=p[q.id]||{count:0,right:0};p[q.id]={count:(old.count||0)+1,right:(old.right||0)+(ok?1:0),last:ok?1:0,updated:new Date().toISOString()};const mistakes=savedList('mistakes');if(!ok&&!mistakes.includes(q.id))mistakes.push(q.id);if(ok&&mode==='mistakes'){const at=mistakes.indexOf(q.id);if(at!==-1)mistakes.splice(at,1)}dataState.mistakes=mistakes;store();updateStats();for(const [j,b] of [...$('#answers').children].entries()){b.disabled=true;if(j===correctAnswer)b.classList.add('correct');else if(j===n)b.classList.add('wrong')}const pFeedback=document.createElement('div');pFeedback.className='feedback';pFeedback.textContent=ok?'Правильно!':'Помилка. Правильна відповідь: '+q.options[correctAnswer];$('#answer-feedback').replaceChildren(pFeedback);if(!$('#image-wrap').classList.contains('hidden')){const practice=document.createElement('a');practice.href='intersections.html';practice.textContent='Потренуватися на схемах перехресть';$('#answer-feedback').append(practice)}visible('#next',true);if(mode==='exam'&&wrong>=3){finish('mistakes');return}if(idx===pool.length-1){$('#next').textContent='Завершити →'}else $('#next').textContent='Наступне питання →'}
function renderReview(){
 const root=$('#review-topics');
 if(!root)return;
 root.replaceChildren();
 root.hidden=!sessionErrors.size;
 if(root.hidden)return;
 const heading=document.createElement('h3');
 heading.textContent='Теми, які варто повторити';
 root.append(heading);
 for(const [section,count] of [...sessionErrors].sort((a,b)=>b[1]-a[1])){
  const option=[...$('#topic').options].find(item=>item.value===section);
  if(!option)continue;
  const button=document.createElement('button');
  button.type='button';button.className='button';
  button.textContent=option.text+' · '+count+' пом.';
  button.onclick=()=>{selectMode('topic');$('#topic').value=section;start()};
  root.append(button);
 }
 const retry=document.createElement('button');
 retry.type='button';retry.className='button primary';retry.textContent='Повторити мої помилки';
 retry.onclick=()=>{selectMode('mistakes');start()};
 root.append(retry);
}
function finish(reason='stop'){if(!running||finished)return;clearInterval(timer);timer=null;finished=true;running=false;const done=Math.min(pool.length,idx+(answered?1:0));const passed=mode==='exam'?reason==='complete'&&done===20&&wrong<=2:null;const rec={date:new Date().toISOString(),mode,category:$('#category').value,correct,wrong,answered:done,total:pool.length,passed,reason,source:'vdzerkalo/2026-08-29'};dataState.history=[...history(),rec].slice(-120);store();visible('#question-card',false);visible('#result',true);setText('#result-title',mode==='exam'?(passed?'Іспит пройдено!':'Іспит не складено'):'Тренування завершено');setText('#result-correct',correct);setText('#result-wrong',wrong);setText('#result-total',done);setText('#result-description',mode==='exam'?(passed?'20 питань пройдено, не більше двох помилок. Це лише навчальна імітація іспиту.':reason==='timeout'?'Час вичерпано. Повтори помилки й спробуй знову.':reason==='mistakes'?'Допущено третю помилку — іспит завершено.':'Іспит завершено раніше або є невиконані питання.'):'Твоя статистика збережена на цьому пристрої.');renderReview();updateStats();$('#result').scrollIntoView({behavior:'smooth'})}
function toggleFavorite(){if(!running||finished)return;const q=pool[idx],list=savedList('favorites');const at=list.indexOf(q.id);if(at<0)list.push(q.id);else list.splice(at,1);dataState.favorites=list;store();setText('#favorite',at<0?'★':'☆');$('#favorite').setAttribute('aria-label',at<0?'Прибрати з обраного':'Додати до обраного');updateStats()}
$('#start').onclick=start;$('#again').onclick=start;$('#stop').onclick=()=>finish('stop');$('#next').onclick=()=>{if(!answered||finished)return;idx++;render()};$('#favorite').onclick=toggleFavorite;$('#mode').onchange=()=>selectMode($('#mode').value);$('#category').onchange=()=>{if(running&&!confirm('Завершити поточний тест і змінити категорію?')){return}if(running)finish('stop');dataState.category=$('#category').value;store();updateCategories()};$('#go-mistakes').onclick=()=>{if(running)finish('stop');selectMode('mistakes');start()};$('#go-favorites').onclick=()=>{if(running)finish('stop');selectMode('favorites');start()};
$('#study-diagnostic').onclick=()=>{selectMode('diagnostic');start()};
$('#study-mistakes').onclick=()=>{selectMode('mistakes');start()};
$('#category').value=CAT[dataState.category]?dataState.category:'B';updateStats();
(async()=>{try{await fetchData();updateCategories();$('#start').disabled=false;setBankStatus(bank.length===2332?'2 332 питань · відкритий набір на основі документів ГСЦ МВС, збірка 16.08.2026':'Завантажено '+bank.length+' питань; звіряй із офіційним джерелом.')}catch(error){setText('#study-recommendation','Банк питань тимчасово недоступний.');setText('#bank-count','Неможливо завантажити банк питань');setBankStatus('Джерело тимчасово недоступне. Спробуй оновити сторінку. '+error.message);const p=document.createElement('a');p.className='button';p.href='quiz-training.html';p.textContent='Перейти до авторських навчальних вправ';$('#bank-status').after(p);}})();
})();