import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const url='http://127.0.0.1:10000';
try{
 for(const vp of [{width:390,height:844,isMobile:true,deviceScaleFactor:1},{width:1280,height:800,isMobile:false,deviceScaleFactor:1}]){
  const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},isMobile:vp.isMobile,deviceScaleFactor:vp.deviceScaleFactor});
  const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.locator('.date-button:not([disabled])').first().waitFor();
  const appearance=await page.evaluate(()=>{
   const e=document.querySelector('.calendar');
   return {bg:getComputedStyle(e).backgroundColor,width:document.documentElement.scrollWidth,viewport:innerWidth,css:!![...document.styleSheets].find(s=>s.href?.includes('booking-v3.css'))}
  });
  assert.ok(appearance.css,'New unique CSS loaded');
  assert.ok(!['rgba(0, 0, 0, 0)','rgb(0, 0, 0)'].includes(appearance.bg),'Calendar has styled white background');
  assert.ok(appearance.width<=appearance.viewport+1,'No mobile horizontal overflow');
  assert.equal(await page.locator('#duration-plus').count(),0,'No +/- counter');
  assert.equal(await page.locator('.promo-side').count(),1,'Ad visible beside calendar');
  assert.match(await page.locator('.promo-side').getAttribute('href'),/drive-ready-ua/);
  await page.locator('#quick-booking-button').click();
  await page.locator('#book-button:enabled').waitFor();
  assert.match(await page.locator('#chosen-end').innerText(),/1 година/);
  await page.locator('#range-reset').click();
  await page.locator('.time-button.free').first().click();
  await page.locator('#end-time-panel:not(.hidden)').waitFor();
  await page.locator('.end-time-button').nth(1).click();
  assert.match(await page.locator('#chosen-time').innerText(),/–/);
  assert.equal(await page.locator('#book-button').isDisabled(),false);
  assert.equal(jsErrors.length,0,jsErrors.join('\n'));
  await page.screenshot({path:'/tmp/drive-time-'+vp.width+'.png',fullPage:true});
  await page.close();
 }
 const admin=await browser.newPage({viewport:{width:390,height:844}});
 await admin.goto(url+'/admin.html',{waitUntil:'networkidle'});
 assert.ok((await admin.locator('link[rel=stylesheet][href="/booking-v3.css"]').getAttribute('href')).includes('booking-v3.css'));
 assert.equal(await admin.locator('#admin-login').isVisible(),true);
 await admin.route('**/api/admin/state',route=>route.fulfill({json:{
  duration:60,weekly:[],overrides:[],bookings:[
   {id:'1',day:'2026-11-29',start_min:600,duration_min:60,student_name:'Тестовий учень',phone:'+380000000000',note:'Навчальний запис',status:'confirmed'},
   {id:'2',day:'2026-11-29',start_min:540,duration_min:60,student_name:'Скасований запис',status:'cancelled'},
  ],
 }}));
 await admin.route('**/api/info',route=>route.fulfill({json:{today:'2026-11-28'}}));
 await admin.route('**/api/admin/blocks?*',route=>route.fulfill({json:{slots:[]}}));
 await admin.reload({waitUntil:'domcontentloaded'});
 await admin.locator('#admin-dashboard').waitFor();
 assert.equal(await admin.locator('.agenda-lesson').count(),1);
 assert.match(await admin.locator('.agenda-lesson').innerText(),/10:00–11:00.*Тестовий учень/s);
 assert.equal(await admin.locator('.agenda-lesson a').getAttribute('href'),'tel:+380000000000');
 await admin.locator('#agenda-today').click();
 assert.equal(await admin.locator('#booking-filter-date').inputValue(),'2026-11-28');
 await admin.locator('#agenda-block').click();
 assert.equal(await admin.locator('#tab-blocks').isVisible(),true);
 assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await admin.close();
 console.log('Visual UI OK: 390px mobile, 1280px desktop, range selection, promo, shared CSS.');
}finally{await browser.close()}
