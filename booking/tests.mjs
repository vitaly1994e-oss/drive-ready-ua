import {readFileSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';
const dir=new URL('.',import.meta.url);
const get=p=>readFileSync(new URL(p,dir),'utf8');
test('Public booking UX has real server booking and confirmation, not localStorage availability',()=>{
 const html=get('public/index.html'),js=get('public/app.js');
 for(const x of ['id="date-list"','id="time-grid"','id="booking-form"','id="booking-success"','id="download-calendar"'])assert.ok(html.includes(x),x);
 assert.ok(html.includes('https://drive-ready-ua.onrender.com/'));
 assert.ok(js.includes("await fetch("));
 assert.ok(js.includes("/api/book"));
 assert.doesNotMatch(js,/localStorage|sessionStorage/);
});
test('Admin access is enforced by server API and server-side database',()=>{
 const src=get('server.js');
 assert.match(src,/cookieAuth/);assert.ok(src.includes("function admin("));assert.match(src,/pg\.Pool/);
 assert.match(src,/pg_advisory_xact_lock/);assert.match(src,/uq_active_appointment/);
 assert.match(src,/api\/admin\/login/);assert.match(src,/api\/admin\/weekly/);
 assert.match(src,/api\/admin\/override/);assert.match(src,/api\/admin\/block/);
 assert.match(src,/api\/admin\/cancel/);
 assert.match(src,/httpOnly:true/);assert.match(src,/sameSite:'strict'/);
 assert.doesNotMatch(src,/ADMIN_PASSWORD\s*\|\|\s*'[^']{12,}'/);
});
test('Schedule defaults to all days 06-21 with one hour lessons',()=>{
 const src=get('server.js');
 assert.match(src,/VALUES\(1,60\)/);
 assert.match(src,/SELECT i,true,360,1260 FROM generate_series\(1,7\)/);
});
test('Admin offers weekly edits, day-off controls and booked learner details',()=>{
 const html=get('public/admin.html'),js=get('public/admin.js');
 for(const x of ['id="weekly-rows"','id="exception-closed"','id="admin-block-slots"','id="bookings-body"','id="lesson-duration"'])assert.ok(html.includes(x),x);
 for(const p of ['/api/admin/state','/api/admin/weekly','/api/admin/override','/api/admin/block'])assert.ok(js.includes(p));
});

test('Pupil chooses start and end directly in the calendar, and advert is visible near booking',()=>{
 const html=get('public/index.html'),ui=get('public/app.js'),server=get('server.js'),css=get('public/booking-v3.css'),admin=get('public/admin.html');
 for(const x of ['id="range-start-label"','id="range-end-label"','id="range-reset"','id="end-time-grid"','id="time-grid"','id="google-calendar"','id="share-reminder"','id="copy-reminder"','id="download-calendar"'])assert.ok(html.includes(x),x);
 assert.ok(!html.includes('id="duration-minus"')&&!html.includes('id="duration-plus"'),'no confusing duration +/- buttons');
 assert.ok(html.includes('href="/booking-v3.css"'));
 assert.ok(admin.includes('href="/booking-v3.css"'));
 assert.ok(html.includes('promo-side')&&html.includes('cross-promo'));
 assert.ok(html.includes('https://drive-ready-ua.onrender.com/'));
 for(const x of ['/api/ends','pickStart','durationMinutes','BEGIN:VALARM','TRIGGER:-PT1H','navigator.share','calendar.google.com'])assert.ok(ui.includes(x),x);
 assert.ok(server.includes("app.get('/api/ends'"));
 assert.ok(server.includes('pg_advisory_xact_lock'));
 assert.ok(css.includes('.range-choice')&&css.includes('.end-time-panel')&&css.includes('.promo-side')&&css.includes('.cross-promo'));
});

test('24-hour rescheduling rule visible before and after booking',()=>{const html=get('public/index.html');const js=get('public/app.js');const server=get('server.js');assert.ok(html.includes('id="policy-accepted"'));assert.ok(html.includes('confirmation-policy'));assert.ok(js.includes('policyAccepted'));assert.ok(server.includes('policy_24h_accepted_at'));});

test('Student can find future lessons by phone without any booking reference code',()=>{
 const html=get('public/manage.html'),client=get('public/manage.js'),server=get('server.js'),home=get('public/index.html'),calendar=get('public/app.js');
 assert.ok(html.includes('id="manage-phone"')&&html.includes('id="my-lessons-list"'));
 assert.ok(!html.includes('id="manage-code"')&&!html.includes('id="cancel-booking"'));
 assert.ok(!html.includes('id="confirm-reschedule"'));
 assert.ok(client.includes('/api/my-lessons'));assert.ok(!client.includes('/api/manage/cancel'));
 assert.ok(server.includes("app.post('/api/my-lessons'"));
 assert.ok(server.includes("limit('phone-lookup:'"));
 assert.ok(home.includes('href="/manage.html"'));
 assert.ok(!home.includes('id="confirm-code"'));
 assert.ok(!calendar.includes('r.code'));
 assert.ok(calendar.includes('TRIGGER:-PT24H')&&calendar.includes('TRIGGER:-PT1H'));
 assert.ok(get('public/admin.html').includes('id="export-ics"'));
});

test('Surname and given name are both required without a student access code',()=>{
 const html=get('public/index.html'),ui=get('public/app.js'),server=get('server.js');
 for(const field of ['id="student-surname"','id="student-name"','autocomplete="family-name"','autocomplete="given-name"'])assert.ok(html.includes(field),field);
 assert.ok(ui.includes("const name=surname+' '+given"));
 assert.ok(server.includes('nameParts.length<2'));
 assert.ok(html.includes('id="confirm-student"'));
 assert.ok(!html.includes('id="student-code"'));
});

test('Theme switch is available on every booking screen and uses persistent independent mode',()=>{
 for(const page of ['public/index.html','public/manage.html','public/admin.html']){
  const html=get(page);
  assert.ok(html.includes('data-theme-toggle'),page);
  assert.ok(html.includes('/theme.js')&&html.includes('/dark-theme.css'),page);
  assert.ok(html.includes('https://drive-ready-ua.onrender.com/'),page);
 }
 const script=get('public/theme.js'),css=get('public/dark-theme.css');
 assert.ok(script.includes('localStorage.setItem')&&script.includes('data-theme'));
 assert.ok(css.includes('html[data-theme="dark"]')&&css.includes('.booking-policy'));
});

test('Distinct Ukrainian educational visual identity and kinetic booking design are present',()=>{
 const homepage=get('../index.html');
 assert.ok(homepage.includes('brand-ua.css')&&homepage.includes('ukraine-ribbon')&&homepage.includes('edu-ticker'));
 const eduStyle=get('../brand-ua.css');
 assert.ok(eduStyle.includes('#ffdb42')&&eduStyle.includes('#071e49')&&eduStyle.includes('prefers-reduced-motion'));
 for(const page of ['public/index.html','public/manage.html','public/admin.html'])assert.ok(get(page).includes('/kinetic-studio.css'));
 const bookingStyle=get('public/kinetic-studio.css');
 assert.ok(bookingStyle.includes('#ff6e49')&&bookingStyle.includes('html[data-theme=dark]'));
});
