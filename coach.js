(()=>{'use strict';const $=s=>document.querySelector(s),D=window.DRU;
const questions=[
['city','Перед початком руху від краю дороги екзаменатор каже: «Починайте рух».',['Різко виїхати, якщо позаду нікого не видно','Перевірити дзеркала й сліпу зону, подати сигнал та поступитися дорогою'],1,'Починаючи рух, слід переконатися в його безпеці та не створити перешкод.'],
['city','Команда: «На наступному перехресті поверніть ліворуч».',['Заздалегідь обрати дозволене положення, перевірити знаки й надати дорогу','Повернути ліворуч із будь-якої смуги'],0,'Перед поворотом займи дозволене положення з урахуванням знаків і розмітки.'],
['city','Попереду нерегульований пішохідний перехід, пішохід уже переходить дорогу.',['Дати дорогу, за необхідності зупинитися','Сигналити, щоб швидше пройшов'],0,'Пішоходам потрібно дати дорогу.'],
['city','Команда: «Зупиніться біля тротуару за можливості». Перед вами знак заборони зупинки.',['Зупинитися одразу, адже це іспит','Продовжити до дозволеного безпечного місця'],1,'Команда екзаменатора не скасовує заборони ПДР.'],
['city','Екзаменатор просить перестроїтися праворуч. У сусідній смузі їде авто.',['Показати сигнал і одразу зайняти смугу','Увімкнути сигнал і дочекатися безпечної можливості, надати дорогу'],1,'Покажчик повороту не надає переваги.'],
['city','Команда: «Виконайте розворот». На ділянці розворот заборонений.',['Знайти наступне дозволене місце','Зробити розворот, бо це команда'],0,'Безпечний і законний маневр завжди важливіший за негайне виконання команди.'],
['city','Автомобіль завершив рух, ти збираєшся вийти.',['Перевірити дорогу та відчинити двері без перешкод іншим','Відчинити двері відразу'],0,'Не створюй небезпеку іншим учасникам руху.'],
['cross','Світлофор показує зелений, але при повороті перед тобою пішоходи на переході.',['Продовжити без зниження швидкості','Надати дорогу пішоходам'],1,'Дозволений сигнал не звільняє від обов’язку пропускати пішоходів у передбачених випадках.'],
['cross','Під’їжджаєш до нерегульованого перехрестя зі знаком «Дати дорогу».',['Дати дорогу тим, хто має перевагу','Проїхати першим, бо нема світлофора'],0,'Знаки пріоритету визначають черговість.'],
['cross','На перехресті є регулювальник і світлофор.',['Дотримуватися сигналів регулювальника','Орієнтуватися лише на світлофор'],0,'Сигнали регулювальника мають пріоритет перед сигналами світлофора.'],
['cross','Перед нерегульованим пішохідним переходом зупинилося інше авто.',['Уважно оцінити ситуацію та виконати вимоги ПДР щодо проїзду переходу','Об’їхати його, не зменшуючи швидкість'],0,'Перед пішохідним переходом потрібно проявляти особливу обережність.'],
['park','Команда: «Припаркуйтеся». Місце перекриває виїзд із двору.',['Шукати дозволене місце без блокування виїзду','Зупинитися й залишити авто тут'],0,'Не паркуйся там, де це заборонено або перешкоджає руху.'],
['park','Перед рухом заднім ходом у дворі потрібно:',['Оглянути зону руху, переконатися в безпеці','Дивитися лише вперед'],0,'Рух заднім ходом дозволений, якщо він безпечний і не заважає іншим.'],
['park','Під час паркування під кутом ти наближаєшся до сусіднього автомобіля.',['Зменшити швидкість і за потреби зупинитися, скоригувати маневр','Продовжити, не контролюючи відстань'],0,'Постійний контроль простору — основа безпечного маневру.'],
['park','Після завершення паркування необхідно:',['Зафіксувати транспортний засіб від самовільного руху','Одразу вийти без перевірки'],0,'Автомобіль не повинен самовільно рухатися.']
];
const plan=[
['День 1','Повтори дорожні знаки й виконай тематичний тест.'],
['День 2','Відпрацюй початок руху, дзеркала та перестроювання.'],
['День 3','Повтори регульовані й нерегульовані перехрестя.'],
['День 4','Перевір правила кругового руху та пішохідні переходи.'],
['День 5','Відпрацюй зупинку, стоянку, паркування й розвороти.'],
['День 6','Переглянь підтверджені маршрути свого ТСЦ та складні місця.'],
['День 7','Пройди навчальний практичний сценарій та переглянь помилки.']
];
let current=[],idx=0,correct=0,errors=[],answered=false,finished=true,voiceTimer=null;
const planRoot=$('#prep-days'),done=D.load('prep-days',[]);
plan.forEach(([day,task],i)=>{const label=document.createElement('label');label.className='card';label.style.display='flex';label.style.gap='12px';label.style.alignItems='start';const input=document.createElement('input');input.type='checkbox';input.checked=Array.isArray(done)&&!!done[i];input.onchange=()=>{const a=plan.map((_,j)=>!!planRoot.querySelectorAll('input')[j].checked);D.store('prep-days',a)};const text=document.createElement('span');const strong=document.createElement('strong');strong.textContent=day;text.append(strong,document.createElement('br'),document.createTextNode(task));label.append(input,text);planRoot.append(label)});
$('#plan-reset').onclick=()=>{if(confirm('Скинути виконані завдання плану?')){planRoot.querySelectorAll('input').forEach(x=>x.checked=false);D.store('prep-days',[])}};const voice=window.DRUVoice;let voiceActivated=false;
voice.init(message=>{$('#coach-voice-status').textContent=message});
function speak(){if(finished||!current[idx]||$('#speech-choice').value==='no')return;voice.speak(current[idx][1],{rate:.95})}
function testVoice(){voiceActivated=true;voice.speak(current[idx]?.[1]||'Вітаю! Голосовий екзаменатор Drive Ready UA працює.',{rate:.95})}

function render(){clearTimeout(voiceTimer);voice.stop();if(finished)return;answered=false;const item=current[idx];if(!item){finish();return}$('#exam-progress').textContent='Ситуація '+(idx+1)+' із '+current.length;$('#exam-errors').textContent='Помилок: '+errors.length;$('#exam-bar').max=current.length;$('#exam-bar').value=idx;$('#exam-prompt').textContent=item[1];$('#exam-options').replaceChildren();$('#exam-feedback').textContent='';$('#exam-next').classList.add('hidden');item[2].forEach((answer,j)=>{const b=document.createElement('button');b.className='answer';b.textContent=answer;b.onclick=()=>choose(j);$('#exam-options').append(b)});if(voiceActivated&&$('#speech-choice').value==='yes')voiceTimer=setTimeout(speak,100)}
function choose(n){if(finished||answered)return;answered=true;const q=current[idx],ok=n===q[3];if(ok)correct++;else errors.push({question:q[1],explanation:q[4]});[...$('#exam-options').children].forEach((b,j)=>{b.disabled=true;if(j===q[3])b.classList.add('correct');else if(j===n)b.classList.add('wrong')});$('#exam-feedback').textContent=(ok?'Правильно. ':'Помилка. ')+q[4];$('#exam-feedback').className='feedback';$('#exam-next').classList.remove('hidden')}
function finish(){if(finished)return;finished=true;clearTimeout(voiceTimer);voice.stop();const result={date:new Date().toISOString(),scenario:$('#scenario').value,correct,total:current.length,completed:idx+(answered?1:0),errors};D.store('coach-last',result);const h=D.load('coach-history',[]);D.store('coach-history',[...(Array.isArray(h)?h:[]),result].slice(-50));$('#exam-box').classList.add('hidden');last()}
function last(){const r=D.load('coach-last',null);$('#last-exam').textContent=r?'Відповідей правильно: '+r.correct+' із '+r.completed+' виконаних ситуацій. Помилок: '+r.errors.length+'. Результат — навчальна самооцінка, не прогноз реального іспиту.':'Поки немає завершених сценаріїв.'}
$('#test-voice').onclick=testVoice;$('#speech-choice').onchange=()=>{if($('#speech-choice').value==='no')voice.stop()};$('#start-exam').onclick=()=>{voiceActivated=$('#speech-choice').value==='yes';current=questions.filter(q=>q[0]===$('#scenario').value);idx=0;correct=0;errors=[];answered=false;finished=false;$('#exam-box').classList.remove('hidden');render();$('#exam-box').scrollIntoView({behavior:'smooth'})};$('#exam-next').onclick=()=>{if(!answered||finished)return;idx++;if(idx===current.length)finish();else render()};$('#exam-repeat').onclick=()=>{voiceActivated=true;speak()};$('#exam-stop').onclick=finish;last();
})();