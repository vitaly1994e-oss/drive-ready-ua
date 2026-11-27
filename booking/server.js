import express from 'express';
import pg from 'pg';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=express();
const PORT=Number(process.env.PORT||10000);
const DB_URL=process.env.DATABASE_URL||'';
const PASSWORD=process.env.ADMIN_PASSWORD||'';
const SECRET=process.env.SESSION_SECRET||'';
if(!DB_URL||PASSWORD.length<12||SECRET.length<32){console.error('Missing DATABASE_URL, ADMIN_PASSWORD or SESSION_SECRET; refusing to start');process.exit(1)}
const pool=new pg.Pool({connectionString:DB_URL,ssl:DB_URL.includes('localhost')?false:{rejectUnauthorized:false},max:7,connectionTimeoutMillis:15000,idleTimeoutMillis:30000});
app.set('trust proxy',1);
app.disable('x-powered-by');
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('X-Frame-Options','DENY');res.set('Referrer-Policy','strict-origin-when-cross-origin');res.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");next()});
app.use(express.json({limit:'12kb'}));
const here=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(here,'public'),{extensions:['html'],fallthrough:true,dotfiles:'deny',maxAge:'5m'}));
const TIME_ZONE='Europe/Kyiv';
const m=(s)=>{const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s||''));return match?Number(match[1])*60+Number(match[2]):null};
const hhmm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const dt=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const dateAdd=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const weekday=d=>{const x=new Date(d+'T00:00:00Z').getUTCDay();return x||7};
function nowKyiv(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,minutes:Number(p.hour)*60+Number(p.minute)}}
function validateDate(d){if(!dt(d))return false;const today=nowKyiv().date;return d>=today&&d<=dateAdd(today,60)}
const txt=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const errs=(res,code,message)=>res.status(code).json({error:message});
const ipTrack=new Map();function limit(key,max,windowMs){const now=Date.now();if(ipTrack.size>5000){for(const [k,v] of ipTrack)if(now>v.until)ipTrack.delete(k)}const o=ipTrack.get(key)||{count:0,until:now+windowMs};if(now>o.until){o.count=0;o.until=now+windowMs}o.count++;ipTrack.set(key,o);return o.count>max}
const asInt=(v,defaultValue)=>Number.isInteger(v)?v:defaultValue;
const validHours=(a,b,duration)=>Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&a<=1260&&b>=60&&b<=1440&&a+duration<=b;
const lockDay=(client,day)=>client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[day]);
const bookingDuration=(v)=>Number.isInteger(v)&&v>=30&&v<=900&&v%30===0?v:null;
const bookingEnd=(start,duration)=>start+duration;
const overlap=(a,b,c,d)=>a<d&&b>c;
function cookieAuth(req){const item=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dr_admin='));if(!item)return false;const raw=item.slice(9),parts=raw.split('.');if(parts.length!==2)return false;const exp=Number(parts[0]);if(!Number.isFinite(exp)||exp<Date.now()||exp>Date.now()+8*86400000)return false;const hash=crypto.createHmac('sha256',SECRET).update(parts[0]+':'+crypto.createHash('sha256').update(PASSWORD).digest('hex')).digest('base64url');return parts[1].length===hash.length&&crypto.timingSafeEqual(Buffer.from(parts[1]),Buffer.from(hash))}
function admin(req,res,next){if(!cookieAuth(req))return errs(res,401,'Потрібен вхід адміністратора');next()}
function origin(req,res,next){if(!['POST','PATCH','DELETE','PUT'].includes(req.method))return next();const ori=req.get('Origin');const expected=req.protocol+'://'+req.get('host');if(ori&&ori!==expected)return errs(res,403,'Невірне джерело запиту');if(!req.is('application/json'))return errs(res,415,'Очікуємо JSON');next()}
app.use('/api',origin);
async function setting(client=pool){const r=await client.query('SELECT duration FROM booking_settings WHERE id=1');return r.rows[0]?.duration||60}
async function schedule(date,client=pool){const [week,override,duration]=await Promise.all([
 client.query('SELECT enabled,start_min,end_min FROM booking_weekly WHERE dow=$1',[weekday(date)]),
 client.query('SELECT closed,start_min,end_min FROM booking_overrides WHERE day=$1',[date]),
 setting(client)
]);const w=week.rows[0],o=override.rows[0];return {enabled:o? !o.closed:!!w?.enabled,start:o?.start_min??w?.start_min??360,end:o?.end_min??w?.end_min??1260,duration}}
async function slots(date,client=pool,desiredMinutes=null,excludeId=null){
 const s=await schedule(date,client),now=nowKyiv();if(!s.enabled)return [];
 const requested=bookingDuration(desiredMinutes)||s.duration;
 const [taken,blocked]=await Promise.all([
 client.query("SELECT start_min,duration_min FROM booking_appointments WHERE day=$1 AND status='confirmed' AND ($2::bigint IS NULL OR id<>$2)",[date,excludeId]),
 client.query('SELECT start_min,duration_min FROM booking_blocks WHERE day=$1',[date])
 ]);
 const out=[];
 for(let start=s.start;start+s.duration<=s.end;start+=s.duration){
  const end=bookingEnd(start,requested);
  const tooSoon=date===now.date&&start<now.minutes+30;
  const isBusy=taken.rows.some(x=>overlap(start,end,x.start_min,x.start_min+x.duration_min));
  const isBlocked=blocked.rows.some(x=>overlap(start,end,x.start_min,x.start_min+x.duration_min));
  out.push({time:hhmm(start),end:hhmm(end),status:isBusy?'busy':isBlocked?'blocked':end>s.end?'too_long':tooSoon?'past':'free'});
 }
 return out;
}
async function init(){const c=await pool.connect();try{await c.query('BEGIN');
 await c.query(`CREATE TABLE IF NOT EXISTS booking_settings(id integer PRIMARY KEY CHECK(id=1),duration integer NOT NULL CHECK(duration IN(30,45,60,90,120)))`);
 await c.query('INSERT INTO booking_settings(id,duration) VALUES(1,60) ON CONFLICT(id) DO NOTHING');
 await c.query(`CREATE TABLE IF NOT EXISTS booking_weekly(dow integer PRIMARY KEY CHECK(dow BETWEEN 1 AND 7), enabled boolean NOT NULL DEFAULT true, start_min integer NOT NULL DEFAULT 360,end_min integer NOT NULL DEFAULT 1260)`);
 await c.query('INSERT INTO booking_weekly(dow,enabled,start_min,end_min) SELECT i,true,360,1260 FROM generate_series(1,7) AS i ON CONFLICT DO NOTHING');
 await c.query(`CREATE TABLE IF NOT EXISTS booking_overrides(day date PRIMARY KEY,closed boolean NOT NULL DEFAULT false,start_min integer,end_min integer)`);
 await c.query(`CREATE TABLE IF NOT EXISTS booking_blocks(day date NOT NULL,start_min integer NOT NULL, duration_min integer NOT NULL DEFAULT 60, PRIMARY KEY(day,start_min))`);
 await c.query('ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS duration_min integer NOT NULL DEFAULT 60');
 await c.query(`CREATE TABLE IF NOT EXISTS booking_appointments(id bigserial PRIMARY KEY,day date NOT NULL,start_min integer NOT NULL,duration_min integer NOT NULL DEFAULT 60,student_name varchar(80) NOT NULL,phone varchar(30) NOT NULL,note varchar(300) NOT NULL DEFAULT '',code varchar(36) NOT NULL UNIQUE,status varchar(16) NOT NULL DEFAULT 'confirmed',created_at timestamptz DEFAULT now(),CHECK(status IN('confirmed','cancelled')))`);
 await c.query('ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS duration_min integer NOT NULL DEFAULT 60');
 await c.query('ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS policy_24h_accepted_at timestamptz');
 await c.query('ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS updated_at timestamptz');
 await c.query(`CREATE TABLE IF NOT EXISTS booking_events(id bigserial PRIMARY KEY, appointment_id bigint NOT NULL REFERENCES booking_appointments(id), action varchar(25) NOT NULL, prior_day date,prior_start integer,new_day date,new_start integer,performed_by varchar(20) NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`);
 await c.query("CREATE UNIQUE INDEX IF NOT EXISTS uq_active_appointment ON booking_appointments(day,start_min) WHERE status='confirmed'");
 await c.query('COMMIT');console.log('Booking database ready')
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
app.get('/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true})}catch{res.status(503).json({ok:false})}});
app.get('/api/info',async(req,res)=>{try{const c=nowKyiv(),d=await setting();res.json({timezone:TIME_ZONE,today:c.date,duration:d,horizon:60})}catch{errs(res,503,'Календар тимчасово недоступний')}});
app.get('/api/days',async(req,res)=>{try{const today=nowKyiv().date,from=txt(req.query.from,10)||today;if(!validateDate(from))return errs(res,400,'Невірна дата');const desired=bookingDuration(Number(req.query.durationMinutes))||60;const n=Math.min(Math.max(Number.parseInt(req.query.count)||14,1),31);const days=[];for(let i=0;i<n;i++){const day=dateAdd(from,i);if(!validateDate(day))break;const list=await slots(day,pool,desired);days.push({date:day,free:list.filter(x=>x.status==='free').length,total:list.length})}res.set('Cache-Control','no-store');res.json({days})}catch(e){console.error('days failed',e.message);errs(res,503,'Календар тимчасово недоступний')}});
app.get('/api/slots',async(req,res)=>{const date=txt(req.query.date,10);if(!validateDate(date))return errs(res,400,'Невірна дата');try{res.set('Cache-Control','no-store');res.json({date,slots:await slots(date,pool,bookingDuration(Number(req.query.durationMinutes))||60)})}catch(e){console.error('slots failed',e.message);errs(res,503,'Графік тимчасово недоступний')}});
app.get('/api/ends',async(req,res)=>{
 const date=txt(req.query.date,10),start=m(req.query.start);
 if(!validateDate(date)||start===null)return errs(res,400,'Невірні дата або час');
 try{
  const sc=await schedule(date),now=nowKyiv(),all=[];
  if(!sc.enabled||start<sc.start||(start-sc.start)%sc.duration!==0||start+30>sc.end||(date===now.date&&start<now.minutes+30))
   return res.json({date,start:hhmm(start),ends:[]});
  const [taken,blocked]=await Promise.all([
   pool.query("SELECT start_min,duration_min FROM booking_appointments WHERE day=$1 AND status='confirmed'",[date]),
   pool.query("SELECT start_min,duration_min FROM booking_blocks WHERE day=$1",[date])
  ]);
  for(let d=30;d<=900&&start+d<=sc.end;d+=30){
   const end=start+d;
   const clash=taken.rows.some(x=>overlap(start,end,x.start_min,x.start_min+x.duration_min))||
     blocked.rows.some(x=>overlap(start,end,x.start_min,x.start_min+x.duration_min));
   if(clash)break;
   all.push({time:hhmm(end),durationMinutes:d});
  }
  res.set('Cache-Control','no-store');res.json({date,start:hhmm(start),ends:all});
 }catch(e){console.error('end options failed',e.message);errs(res,503,'Не вдалося перевірити вільний проміжок')}
});
app.post('/api/book',async(req,res)=>{
 if(limit('book:'+req.ip,12,3600000))return errs(res,429,'Забагато спроб. Повтори пізніше');
 if(req.body.website)return errs(res,400,'Заявку відхилено');
 const name=txt(req.body.name,80),phone=txt(req.body.phone,30),note=txt(req.body.note,300),date=txt(req.body.date,10),start=m(req.body.time),duration=bookingDuration(req.body.durationMinutes??60);
 const nameParts=name.split(/\s+/).filter(Boolean);
 const personPart=/^[\p{L}][\p{L}\p{M}'’\-]{1,49}$/u;
 if(name.length>80||nameParts.length<2||!nameParts.every(personPart.test.bind(personPart))||!/^\+?[0-9()\-\s]{7,24}$/.test(phone)||!validateDate(date)||start===null||duration===null)return errs(res,400,'Перевір прізвище, ім’я, дату та телефон');
 if(req.body.policyAccepted!==true)return errs(res,400,'Потрібне підтвердження правила перенесення або скасування за 24 години');
 const c=await pool.connect();
 try{await c.query('BEGIN');await lockDay(c,date);
 const daySlots=await slots(date,c,duration),picked=daySlots.find(x=>m(x.time)===start);
 if(!picked){await c.query('ROLLBACK');return errs(res,400,'Такий час не доступний у графіку')}
 if(picked.status!=='free'){await c.query('ROLLBACK');return errs(res,409,'Цей час уже зайнятий. Обери інший')}
 const code=crypto.randomBytes(5).toString('hex').toUpperCase();
 const r=await c.query("INSERT INTO booking_appointments(day,start_min,duration_min,student_name,phone,note,code,status,policy_24h_accepted_at) VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed',now()) RETURNING id",[date,start,duration,name,phone,note,code]);
 await c.query('COMMIT');res.status(201).json({ok:true,date,time:hhmm(start),duration,timezone:TIME_ZONE})
 }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('book failed',e.code||e.message);errs(res,e.code==='23505'?409:503,e.code==='23505'?'Цей час уже зайнятий':'Не вдалося підтвердити запис')}finally{c.release()}
});

const phoneDigits=v=>String(v||'').replace(/\D/g,'');
const studentPhoneKey=v=>{
 const digits=String(v||'').replace(/\D/g,'');
 if(/^380\d{9}$/.test(digits)||/^0\d{9}$/.test(digits)||/^\d{9}$/.test(digits))return digits.slice(-9);
 return null;
};
app.post('/api/my-lessons',async(req,res)=>{
 if(limit('phone-lookup:'+req.ip,8,3600000))return errs(res,429,'Забагато перевірок. Спробуй через годину');
 const key=studentPhoneKey(req.body?.phone);
 if(!key)return errs(res,400,'Вкажи український номер телефону, наприклад +380 67 123 45 67');
 try{
  const today=nowKyiv().date;
  const r=await pool.query("SELECT to_char(day,'YYYY-MM-DD') AS day,start_min,duration_min FROM booking_appointments WHERE status='confirmed' AND day BETWEEN $1::date AND ($1::date + interval '60 days') AND right(regexp_replace(phone,'[^0-9]','','g'),9)=$2 ORDER BY day,start_min LIMIT 80",[today,key]);
  // Phone-only lookup is intentionally read-only: never return names, private notes, reference codes or database IDs.
  res.set('Cache-Control','no-store');
  res.json({lessons:r.rows.map(x=>({date:x.day,time:hhmm(x.start_min),end:hhmm(x.start_min+x.duration_min),duration:x.duration_min})),notice:'Для перенесення або скасування повідом інструктора щонайменше за 24 години'});
 }catch(e){console.error('student lookup failed',e.message);errs(res,503,'Не вдалося завантажити заняття')}
});

const validManage=body=>/^[A-F0-9]{10}$/.test(String(body?.code||'').toUpperCase())&&phoneDigits(body?.phone).length>=9&&phoneDigits(body?.phone).length<=15;
const kyivOffsetMinutes=(date)=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,timeZoneName:'shortOffset'}).formatToParts(new Date(date+'T12:00:00Z')).find(x=>x.type==='timeZoneName')?.value||'GMT+2';const z=/GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(p);return z?(z[1]==='-'?-1:1)*(Number(z[2])*60+Number(z[3]||0)):120};
const startsAtMillis=(day,start)=>Date.parse(day+'T00:00:00Z')+start*60000-kyivOffsetMinutes(day)*60000;
const hoursBefore=(day,start)=>Math.floor((startsAtMillis(day,start)-Date.now())/3600000*10)/10;
const canManage=row=>row.status==='confirmed'&&startsAtMillis(row.day,row.start_min)-Date.now()>=24*3600000;
const getManage=async(client,body,lock=false)=>{
 const q=await client.query("SELECT id::text,code,phone,student_name,to_char(day,'YYYY-MM-DD') AS day,start_min,duration_min,status FROM booking_appointments WHERE code=$1"+(lock?" FOR UPDATE":""),[String(body.code).toUpperCase()]);
 const row=q.rows[0];if(!row||phoneDigits(body.phone)!==phoneDigits(row.phone))return null;return row;
};
const manageCheck=(req,res,next)=>{if(limit('manage:'+req.ip,16,3600000))return errs(res,429,'Забагато спроб. Повтори пізніше');if(!validManage(req.body))return errs(res,400,'Перевір код запису та номер телефону');next()};
app.post('/api/manage/lookup',manageCheck,async(req,res)=>{
 try{const row=await getManage(pool,req.body);if(!row)return errs(res,404,'Запис не знайдено. Перевір код та телефон');
 res.set('Cache-Control','no-store');
 res.json({ok:true,booking:{name:row.student_name,date:row.day,time:hhmm(row.start_min),end:hhmm(row.start_min+row.duration_min),duration:row.duration_min,status:row.status,canChange:canManage(row),hoursLeft:Math.max(0,hoursBefore(row.day,row.start_min))}});
 }catch(e){console.error('manage lookup',e.message);errs(res,503,'Не вдалося відкрити запис')}
});
app.post('/api/manage/cancel',manageCheck,async(req,res)=>{
 const c=await pool.connect();try{await c.query('BEGIN');const row=await getManage(c,req.body,true);
 if(!row){await c.query('ROLLBACK');return errs(res,404,'Запис не знайдено')}
 if(!canManage(row)){await c.query('ROLLBACK');return errs(res,409,'Самостійне скасування доступне щонайменше за 24 години. Зв’яжись з інструктором')}
 await lockDay(c,row.day);
 await c.query("UPDATE booking_appointments SET status='cancelled',updated_at=now() WHERE id=$1",[row.id]);
 await c.query("INSERT INTO booking_events(appointment_id,action,prior_day,prior_start,performed_by) VALUES($1,'cancelled',$2,$3,'student')",[row.id,row.day,row.start_min]);
 await c.query('COMMIT');res.json({ok:true,message:'Запис скасовано. Час звільнено'});
 }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('manage cancel',e.message);errs(res,503,'Не вдалося скасувати запис')}finally{c.release()}
});
app.post('/api/manage/reschedule',manageCheck,async(req,res)=>{
 const day=txt(req.body.date,10),start=m(req.body.time),duration=bookingDuration(req.body.durationMinutes);
 if(!validateDate(day)||start===null||duration===null)return errs(res,400,'Обери доступні дату, час і тривалість');
 const c=await pool.connect();
 try{await c.query('BEGIN');const row=await getManage(c,req.body,true);
 if(!row){await c.query('ROLLBACK');return errs(res,404,'Запис не знайдено')}
 if(!canManage(row)){await c.query('ROLLBACK');return errs(res,409,'Самостійне перенесення доступне щонайменше за 24 години. Зв’яжись з інструктором')}
 for(const d of [...new Set([row.day,day])].sort())await lockDay(c,d);
 const available=await slots(day,c,duration,row.id);
 if(!available.some(x=>x.time===hhmm(start)&&x.status==='free')){await c.query('ROLLBACK');return errs(res,409,'Обраний час уже недоступний. Спробуй інший')}
 await c.query('UPDATE booking_appointments SET day=$1,start_min=$2,duration_min=$3,updated_at=now() WHERE id=$4',[day,start,duration,row.id]);
 await c.query("INSERT INTO booking_events(appointment_id,action,prior_day,prior_start,new_day,new_start,performed_by) VALUES($1,'rescheduled',$2,$3,$4,$5,'student')",[row.id,row.day,row.start_min,day,start]);
 await c.query('COMMIT');res.json({ok:true,date:day,time:hhmm(start),duration,code:row.code,timezone:TIME_ZONE});
 }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('manage reschedule',e.message);errs(res,e.code==='23505'?409:503,e.code==='23505'?'Час уже зайнятий':'Не вдалося перенести запис')}finally{c.release()}
});
app.get('/api/admin/calendar.ics',admin,async(req,res)=>{
 try{
  const today=nowKyiv().date;
  const entries=await pool.query("SELECT to_char(day,'YYYY-MM-DD') AS day,start_min,duration_min,student_name,code FROM booking_appointments WHERE status='confirmed' AND day BETWEEN $1::date AND ($1::date + interval '180 days') ORDER BY day,start_min",[today]);
  const esc=v=>String(v||'').replaceAll('\\','\\\\').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\n','\\n');
  const stamps=r=>r.day.replaceAll('-','')+'T'+hhmm(r.start_min).replace(':','')+'00';
  const end=r=>r.day.replaceAll('-','')+'T'+hhmm(r.start_min+r.duration_min).replace(':','')+'00';
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','PRODID:-//DRIVE TIME//Instructor Appointments//UK'];
  for(const row of entries.rows)lines.push('BEGIN:VEVENT','UID:lesson-'+row.code+'@drive-time-booking','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;TZID=Europe/Kyiv:'+stamps(row),'DTEND;TZID=Europe/Kyiv:'+end(row),'SUMMARY:'+esc('Водіння: '+row.student_name),'DESCRIPTION:'+esc('DRIVE TIME · '+row.code),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Заняття з водіння','TRIGGER:-PT1H','END:VALARM','END:VEVENT');
  lines.push('END:VCALENDAR');
  res.set('Cache-Control','private, no-store');res.type('text/calendar; charset=utf-8');res.set('Content-Disposition','attachment; filename="drive-time-schedule.ics"');res.send(lines.join('\r\n')+'\r\n');
 }catch(e){console.error('calendar export',e.message);errs(res,503,'Календар недоступний')}
});
app.post('/api/admin/login',(req,res)=>{
 if(limit('login:'+req.ip,8,900000))return errs(res,429,'Забагато спроб. Повтори через 15 хв');
 const provided=typeof req.body.password==='string'?req.body.password:'';
 const a=crypto.createHash('sha256').update(provided).digest(),b=crypto.createHash('sha256').update(PASSWORD).digest();
 if(!crypto.timingSafeEqual(a,b))return errs(res,401,'Неправильний пароль');
 const exp=String(Date.now()+7*86400000),sig=crypto.createHmac('sha256',SECRET).update(exp+':'+b.toString('hex')).digest('base64url');
 res.cookie('dr_admin',exp+'.'+sig,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:7*86400000});res.json({ok:true})
});
app.post('/api/admin/logout',admin,(req,res)=>{res.clearCookie('dr_admin',{path:'/',secure:true,sameSite:'strict'});res.json({ok:true})});
app.get('/api/admin/state',admin,async(req,res)=>{try{
 const [weekly,overrides,blocks,bookings,configuration]=await Promise.all([
 pool.query('SELECT dow,enabled,start_min,end_min FROM booking_weekly ORDER BY dow'),
 pool.query("SELECT to_char(day,'YYYY-MM-DD') as day,closed,start_min,end_min FROM booking_overrides WHERE day>=CURRENT_DATE-1 ORDER BY day LIMIT 150"),
 pool.query("SELECT to_char(day,'YYYY-MM-DD') as day,start_min,duration_min FROM booking_blocks WHERE day>=CURRENT_DATE-1 ORDER BY day,start_min LIMIT 1000"),
 pool.query("SELECT id::text,to_char(day,'YYYY-MM-DD') as day,start_min,duration_min,student_name,phone,note,code,status,created_at FROM booking_appointments WHERE day>=CURRENT_DATE-15 ORDER BY day,start_min LIMIT 1000"),
 setting()
 ]);res.set('Cache-Control','no-store');res.json({weekly:weekly.rows,overrides:overrides.rows,blocks:blocks.rows,bookings:bookings.rows,duration:configuration,timezone:TIME_ZONE})
 }catch(e){console.error('admin-state',e.message);errs(res,503,'Помилка читання розкладу')}});
app.put('/api/admin/weekly',admin,async(req,res)=>{
 const hours=req.body.days,duration=asInt(req.body.duration,60);
 if(!Array.isArray(hours)||hours.length!==7||![30,45,60,90,120].includes(duration)||hours.some(x=>!Number.isInteger(x.dow)||x.dow<1||x.dow>7||typeof x.enabled!=='boolean'||!validHours(x.start,x.end,duration))||new Set(hours.map(x=>x.dow)).size!==7)return errs(res,400,'Невірні години або тривалість');
 const c=await pool.connect();try{await c.query('BEGIN');for(const d of hours)await c.query('UPDATE booking_weekly SET enabled=$2,start_min=$3,end_min=$4 WHERE dow=$1',[d.dow,d.enabled,d.start,d.end]);await c.query('UPDATE booking_settings SET duration=$1 WHERE id=1',[duration]);await c.query('COMMIT');res.json({ok:true,note:'Існуючі записи не скасовано — перевір календар після зміни тривалості.'})}catch(e){await c.query('ROLLBACK').catch(()=>{});errs(res,503,'Не вдалося змінити графік')}finally{c.release()}
});
app.put('/api/admin/override',admin,async(req,res)=>{const date=txt(req.body.date,10),closed=req.body.closed,start=asInt(req.body.start,360),end=asInt(req.body.end,1260);if(!dt(date)||date<dateAdd(nowKyiv().date,-1)||date>dateAdd(nowKyiv().date,365)||typeof closed!=='boolean'||!validHours(start,end,30))return errs(res,400,'Невірні дані дня');try{await pool.query('INSERT INTO booking_overrides(day,closed,start_min,end_min) VALUES($1,$2,$3,$4) ON CONFLICT(day) DO UPDATE SET closed=$2,start_min=$3,end_min=$4',[date,closed,start,end]);res.json({ok:true,note:'Існуючі записи залишаються — за потреби скасуйте їх окремо.'})}catch{errs(res,503,'Не вдалося змінити день')}});
app.delete('/api/admin/override',admin,async(req,res)=>{const day=txt(req.body.date,10);if(!dt(day))return errs(res,400,'Невірна дата');try{await pool.query('DELETE FROM booking_overrides WHERE day=$1',[day]);res.json({ok:true})}catch{errs(res,503,'Не вдалося видалити виняток')}});
app.put('/api/admin/block',admin,async(req,res)=>{const date=txt(req.body.date,10),start=m(req.body.time),blocked=req.body.blocked;if(!dt(date)||start===null||typeof blocked!=='boolean')return errs(res,400,'Невірний час');try{if(blocked){const size=await setting();await pool.query('INSERT INTO booking_blocks(day,start_min,duration_min) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[date,start,size])}else await pool.query('DELETE FROM booking_blocks WHERE day=$1 AND start_min=$2',[date,start]);res.json({ok:true})}catch{errs(res,503,'Не вдалося змінити слот')}});
app.post('/api/admin/cancel',admin,async(req,res)=>{const id=String(req.body.id||'');if(!/^\d+$/.test(id))return errs(res,400,'Невірний номер запису');try{const result=await pool.query("UPDATE booking_appointments SET status='cancelled' WHERE id=$1 AND status='confirmed' RETURNING id",[id]);if(!result.rowCount)return errs(res,404,'Активний запис не знайдено');res.json({ok:true})}catch{errs(res,503,'Не вдалося скасувати запис')}});
app.get('/api/admin/export',admin,async(req,res)=>{try{const result=await pool.query("SELECT to_char(day,'YYYY-MM-DD') as day,start_min,duration_min,student_name,phone,note,code,status FROM booking_appointments ORDER BY day DESC,start_min DESC LIMIT 5000");const escape=s=>'"'+String(s??'').replaceAll('"','""')+'"';const lines=[['Дата','Початок','Кінець','Тривалість, хв','Курсант','Телефон','Примітка','Код','Статус'].map(escape).join(',')];for(const r of result.rows)lines.push([r.day,hhmm(r.start_min),hhmm(r.start_min+r.duration_min),r.duration_min,r.student_name,r.phone,r.note,r.code,r.status].map(escape).join(','));res.type('text/csv; charset=utf-8');res.set('Content-Disposition','attachment; filename="drive-bookings.csv"');res.send('\uFEFF'+lines.join('\r\n'))}catch{errs(res,503,'Експорт недоступний')}});
app.get('*',(req,res)=>res.status(404).sendFile(path.join(here,'public','index.html')));
init().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log('Booking portal listening on '+PORT))).catch(e=>{console.error('Database initialization failed',e.message);process.exit(1)});
