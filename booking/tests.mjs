import {readFileSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';
const dir=new URL('.',import.meta.url);
const get=p=>readFileSync(new URL(p,dir),'utf8');
test('Public booking UX has real server booking and confirmation, not localStorage availability',()=>{
 const html=get('public/index.html'),js=get('public/app.js');
 for(const x of ['id="date-list"','id="time-grid"','id="booking-form"','id="booking-success"','id="download-calendar"'])assert.ok(html.includes(x),x);
 assert.ok(html.includes('https://drive-ready-ua.onrender.com/'));
 assert.ok(js.includes("await fetch("));
 assert.ok(js.includes("await fetch("));
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
