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
 await admin.close();
 console.log('Visual UI OK: 390px mobile, 1280px desktop, range selection, promo, shared CSS.');
}finally{await browser.close()}
