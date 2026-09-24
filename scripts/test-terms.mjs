// Only local Workers/D1. Restores the original current semester in finally.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base="http://localhost:8787";
const password=readFileSync('.dev.vars','utf8').match(/^ADMIN_PASSWORD=(.+)$/m)[1];
const admin=JSON.parse(readFileSync('wrangler.jsonc','utf8')).vars.ADMIN_USERNAME;
let cookie='',originalTerm,studentCreated=false,teacherCreated=false;
const ids=[];const sid='99021';const teacher='test_term_advisor';
async function call(action,args=[],session=cookie) {
  const r=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Cookie:session}:{})},body:JSON.stringify({action,args})});
  return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const now=Date.now();
const config=(semester,extra={})=>({academic_year:2699,semester,opens_at:new Date(now-60_000).toISOString(),closes_at:new Date(now+3600_000).toISOString(),enabled:true,announcement:'ทดสอบภาคเรียน',...extra});
try {
  originalTerm=(await call('getOrderingPeriod')).body.data.term_id;
  const login=await call('adminLogin',[admin,password]);assert.equal(login.status,200);cookie=login.cookie;
  assert(!(await call('getTerms')).body.data.some(t=>t.academic_year===2699),'Fixture year must not exist');
  assert.equal((await call('createTerm',[config(1)],'')).status,401);
  assert.equal((await call('createTerm',[config(1,{closes_at:new Date(now-120_000).toISOString()})])).status,400);
  for(const semester of [1,2]) {const result=await call('createTerm',[config(semester)]);assert.equal(result.status,200);ids.push(result.body.data.term_id);}
  assert.equal((await call('createTerm',[config(1)])).status,409);
  assert.equal((await call('getStudentById',[sid])).status,404);
  assert.equal((await call('addStudent',[{student_id:sid,prefix:'นาย',first_name:'ทดสอบ',last_name:'ภาคเรียน',grade:'ม.6',room:'99'}])).status,200);studentCreated=true;
  const products=(await call('getProducts')).body.data;const product=products.find(p=>p.price<=260);
  const submit=term=>call('submitOrder',[sid,[{product_id:product.product_id,quantity:1}],true,term],'');
  assert.equal((await call('activateTerm',[ids[0]])).status,200);
  assert.equal((await call('getOrderingPeriod')).body.data.status,'open');
  assert.equal((await submit(originalTerm)).status,409,'Stale carts cannot land in another semester');
  assert.equal((await call('submitOrder',[sid,[{product_id:product.product_id,quantity:1}],true],'')).status,409,'Term identifier is required');
  const first=await submit(ids[0]);assert.equal(first.status,200);assert.equal(first.body.data.term_id,ids[0]);
  assert.equal((await submit(ids[0])).status,409,'Duplicate in same term blocked');
  assert.equal((await call('activateTerm',[ids[1]])).status,200);
  assert.equal((await call('getStudentById',[sid])).body.data.has_ordered,false);
  assert.equal((await call('adminGetSummary',[ids[1]])).body.data.totalOrders,0);
  assert.equal((await call('adminGetSummary',[ids[0]])).body.data.totalOrders,1);
  assert.equal((await call('getStudentOrder',[sid,ids[0]])).body.data.order_id,first.body.data.order_id);
  assert.equal((await call('setTermEnabled',[ids[1],false])).status,200);assert.equal((await submit(ids[1])).status,403);
  assert.equal((await call('updateTerm',[ids[1],config(2,{opens_at:new Date(now+1800_000).toISOString()})])).status,200);
  assert.equal((await call('getOrderingPeriod')).body.data.status,'scheduled');assert.equal((await submit(ids[1])).status,403);
  assert.equal((await call('updateTerm',[ids[1],config(2,{opens_at:new Date(now-3600_000).toISOString(),closes_at:new Date(now-60_000).toISOString()})])).status,200);
  assert.equal((await call('getOrderingPeriod')).body.data.status,'closed');assert.equal((await submit(ids[1])).status,403);
  // Database trigger also rejects a write that bypasses the HTTP validation.
  let triggerRejected=false;
  try {execFileSync('npx',['wrangler','d1','execute','DB','--local','--command',`INSERT INTO orders(order_id,student_id,student_name,grade,room,budget,total_amount,extra_amount,order_date,term_id) VALUES('TEST_TERM_TRIGGER','${sid}','test','ม.6','99',260,10,0,'2026-01-01','${ids[1]}');`],{stdio:'pipe'});} catch(error) {triggerRejected=String(error.stderr)+String(error.stdout);}
  assert.match(String(triggerRejected),/ordering_period_closed/);
  assert.equal((await call('updateTerm',[ids[1],config(2)])).status,200);
  const second=await submit(ids[1]);assert.equal(second.status,200);assert.notEqual(second.body.data.order_id,first.body.data.order_id);
  assert.equal((await call('adminGetOrders',[ids[0]])).body.data.length,1);assert.equal((await call('adminGetOrders',[ids[1]])).body.data.length,1);
  assert((await call('adminGetStudents',[ids[0],{query:sid}])).body.data.find(s=>s.student_id===sid).has_ordered);
  const teacherPassword='Test-'+crypto.randomUUID();
  assert.equal((await call('addTeacher',[teacher,{full_name:'ครูทดสอบ ภาคเรียน',advisor_grade:'ม.6',advisor_room:'99',active:true,password:teacherPassword}])).status,200);teacherCreated=true;
  const teacherLogin=await call('adminLogin',[teacher,teacherPassword]);assert.equal(teacherLogin.status,200);
  for(const action of ['createTerm','updateTerm','activateTerm','setTermEnabled'])assert.equal((await call(action,[],teacherLogin.cookie)).status,403);
  for(const id of ids)assert.equal((await call('adminGetSummary',[id],teacherLogin.cookie)).body.data.totalOrders,1);
  console.log('PASS: term validation, access control, scheduled/paused/closed periods, DB deadline guard, stale carts, one order per semester, and separate historical reports');
} finally {
  const cleanup=[];
  if(originalTerm)cleanup.push(`UPDATE terms SET is_current=0; UPDATE terms SET is_current=1 WHERE term_id='${originalTerm}';`);
  if(studentCreated)cleanup.push(`DELETE FROM orders WHERE student_id='${sid}'; DELETE FROM students WHERE student_id='${sid}';`);
  if(teacherCreated)cleanup.push(`DELETE FROM admin_sessions WHERE username='${teacher}'; DELETE FROM staff WHERE username='${teacher}';`);
  for(const id of ids)cleanup.push(`DELETE FROM terms WHERE term_id='${id}';`);
  if(cleanup.length)execFileSync('npx',['wrangler','d1','execute','DB','--local','--command',cleanup.join(' ')],{stdio:'pipe'});
  if(cookie)await call('adminLogout');
}
