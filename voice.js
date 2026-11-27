/* Drive Ready UA — безкоштовне озвучення засобами браузера.
   Відсутність встановленого українського голосу не повинна призводити до тихої відмови. */
window.DRUVoice=(()=>{
  const available=()=>('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window);
  const synth=()=>window.speechSynthesis;
  let active=null;
  let voices=[];
  let onStatus=()=>{};
  function refreshVoices(){if(!available())return [];try{voices=synth().getVoices()||[]}catch{voices=[]}return voices}
  function setStatus(text){try{onStatus(text)}catch{}}
  function init(statusCallback){
    if(typeof statusCallback==='function')onStatus=statusCallback;
    if(!available()){setStatus('Цей браузер не підтримує голосове відтворення. Спробуй Chrome, Edge або Safari.');return false}
    refreshVoices();
    if(synth().addEventListener)synth().addEventListener('voiceschanged',refreshVoices);
    return true;
  }
  function stop(){if(!available())return;active=null;try{synth().cancel()}catch{}}
  function speak(text,{rate=1,enabled=true}={}){
    if(!enabled)return false;
    if(!available()){setStatus('Озвучення недоступне в цьому браузері.');return false}
    if(!text)return false;
    stop();
    refreshVoices();
    const ukrainian=voices.find(v=>/^uk(?:-|$)/i.test(v.lang))||null;
    const selected=ukrainian||voices.find(v=>/^ru(?:-|$)/i.test(v.lang))||voices.find(v=>/^en(?:-|$)/i.test(v.lang))||voices[0]||null;
    const speech=new SpeechSynthesisUtterance(String(text));
    speech.lang=selected?.lang||'uk-UA';
    // Якщо українського голосу немає, дозволяємо браузеру обрати голос за uk-UA.
    if(selected)speech.voice=selected;
    speech.rate=Number.isFinite(+rate)?Math.max(.65,Math.min(1.4,+rate)):1;
    speech.pitch=1;
    speech.volume=1;
    const token={};
    active=token;
    speech.onstart=()=>{if(active===token)setStatus(ukrainian?'🔊 Озвучення українською':'🔊 Відтворення доступним голосом браузера (український голос не встановлено)')};
    speech.onend=()=>{if(active===token){active=null;setStatus('✓ Команду озвучено')}};
    speech.onerror=e=>{if(active===token){active=null;setStatus('Не вдалося відтворити голос ('+(e.error||'помилка')+'). Натисни «Перевірити голос» або перевір звук у браузері.')}};
    try{
      synth().cancel();
      synth().resume();
      synth().speak(speech);
      setStatus(ukrainian?'Запускаємо український голос…':selected?'Запускаємо резервний голос '+selected.lang+'. Для правильної вимови встанови український голос у системі.':'У браузері немає встановлених голосів. Спробуй браузер Chrome, Edge або Safari та налаштування синтезу мовлення.');
      return true;
    }catch(error){
      active=null;
      setStatus('Браузер заблокував озвучення. Натисни «Увімкнути голос» і перевір дозволи браузера.');
      return false;
    }
  }
  function supported(){return available()}
  return {init,speak,stop,supported,refreshVoices};
})();