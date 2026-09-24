// Read-only verification; login/logout create and revoke only this test session.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const rows=JSON.parse(execFileSync('python3',['-c',"import csv,json,sys\nwith open(sys.argv[1],encoding='utf-8-sig',newline='') as f: print(json.dumps(list(csv.DictReader(f))))",process.argv[2]],{encoding:'utf8'}));
const pupils=JSON.parse(execFileSync('python3',['-c',"import csv,json,sys\nwith open(sys.argv[1],encoding='utf-8-sig',newline='') as f: print(json.dumps([[r['ระดับชั้น'].strip(),r['ห้อง'].strip()] for r in csv.DictReader(f)]))",process.argv[3]],{encoding:'utf8'}));
const expected=new Map();
for(const r of rows){const username=r.Username.trim();const key=username.toLowerCase();const t=expected.get(key)||{username,name:r['ชื่อ-นามสกุล'].trim().replace(/\s+/g,' '),rooms:[]};const room={grade:r['ระดับชั้น'].trim(),room:r['ห้อง'].trim()};if(!t.rooms.some(v=>v.grade===room.grade&&v.room===room.room))t.rooms.push(room);expected.set(key,t);}
const base='https://chomthong-school-supplies.doitgict.workers.dev';let cookie='';
async function call(action,args=[],status=200){const r=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,args})});assert.equal(r.status,status,action);const data=await r.json();if(action==='adminLogin'&&r.ok)cookie=r.headers.get('set-cookie').split(';')[0];return data.data;}
const roomKey=r=>`${r.grade}/${r.room}`;
try{
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));const password=readFileSync('.dev.vars','utf8').match(/^ADMIN_PASSWORD=(.+)$/m)[1];
 await call('adminLogin',[config.vars.ADMIN_USERNAME,password]);
 const teachers=await call('adminGetTeachers');assert.equal(teachers.length,expected.size);
 for(const t of teachers){const e=expected.get(t.username.toLowerCase());assert(e);assert.equal(t.full_name,e.name);assert.deepEqual(t.advisor_rooms.map(roomKey).sort(),e.rooms.map(roomKey).sort());assert.equal(t.role,t.username.toLowerCase()==='cboonta'?'superadmin':'teacher');assert.equal(t.active,1);assert(!('password_hash' in t));}
 assert.deepEqual(await call('adminGetStudents'),[]);
 assert.equal((await call('adminGetStudentClasses')).length,75);
 const filtered=await call('adminGetStudents',[null,{grade:'ม.6',room:'11'}]);assert.equal(filtered.length,pupils.filter(([g,r])=>g==='6'&&r==='11').length);assert(filtered.every(s=>s.grade==='ม.6'&&s.room==='11'));
 assert.equal((await call('adminGetStudents',[null,{query:filtered[0].student_id}])).length,1);
 await call('adminLogout');cookie='';
 const samples=new Map();for(const grade of ['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6']){const t=[...expected.values()].find(t=>t.username.toLowerCase()!=='cboonta'&&t.rooms.some(r=>r.grade===grade));samples.set(t.username,t);}
 for(const t of expected.values())if(t.rooms.length>1||t.username!==t.username.toLowerCase())samples.set(t.username,t);
 for(const t of samples.values()){
  const login=await call('adminLogin',[t.username,t.username]);assert.equal(login.profile.role,'teacher');assert.deepEqual(login.profile.advisor_rooms.map(roomKey).sort(),t.rooms.map(roomKey).sort());
  const summary=await call('adminGetSummary',[{grade:'ม.1',room:'99',role:'superadmin'}]);
  assert.equal(summary.totalStudents,pupils.filter(([g,r])=>t.rooms.some(a=>a.grade===`ม.${g}`&&a.room===r)).length);
  await call('adminGetStudents',[null,{status:'pending'}],403);await call('adminGetStudentClasses',[],403);
  await call('adminLogout');cookie='';
 }
 console.log(`PASS live: ${teachers.length} accounts and all class assignments match CSV; ${samples.size} username=password logins checked across all grades, mixed-case usernames and the shared ม.6/11–ม.6/12 account; teacher isolation and student filters passed.`);
}finally{if(cookie)await call('adminLogout');}
