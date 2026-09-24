// Mutates test fixtures only, against localhost and local D1 only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = "http://localhost:8787";
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const rootPassword = readFileSync(".dev.vars", "utf8").match(/^ADMIN_PASSWORD=(.+)$/m)[1];
const teachers = ["test_advisor_one", "test_advisor_two"];
const ids = ["99011", "99012", "99013"];
const createdTeachers = [], createdStudents = [];
const password = `Local-${crypto.randomUUID()}`;
let rootCookie = "", productId;
let currentTermId = "legacy";
async function call(action, args = [], cookie = "") {
  if (action === "submitOrder" && args[3] === undefined) args[3] = currentTermId;
  const response = await fetch(`${base}/api`, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ action, args }) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const staff = (room, extra = {}) => ({ full_name: "ครูทดสอบ สิทธิ์", advisor_grade: "ม.4", advisor_room: room, active: true, ...extra });
const student = (id, grade, room) => ({ student_id: id, prefix: "นาย", first_name: "ทดสอบ", last_name: "ห้องเรียน", grade, room });
try {
  currentTermId = (await call("getOrderingPeriod")).body.data.term_id;
  const login = await call("adminLogin", [config.vars.ADMIN_USERNAME, rootPassword]);
  assert.equal(login.status, 200); rootCookie = login.cookie;
  const list = (await call("adminGetTeachers", [], rootCookie)).body.data;
  assert(!list.some(t => "password_hash" in t || "password" in t));
  assert(!list.some(t => teachers.includes(t.username)), "Fixture accounts must not exist");
  for (let i = 0; i < teachers.length; i++) {
    assert.equal((await call("addTeacher", [teachers[i], staff(String(i + 1), { password, role: "superadmin" })], rootCookie)).status, 200);
    createdTeachers.push(teachers[i]);
  }
  const pupils = [student(ids[0], "ม.4", "1"), student(ids[1], "ม.4", "2"), student(ids[2], "ม.5", "1")];
  for (const pupil of pupils) {
    assert.equal((await call("getStudentById", [pupil.student_id])).status, 404);
    assert.equal((await call("addStudent", [pupil], rootCookie)).status, 200); createdStudents.push(pupil.student_id);
  }
  assert.deepEqual((await call("adminGetStudents", [], rootCookie)).body.data, [], "No roster without a filter");
  assert.deepEqual((await call("adminGetStudents", [null, {query:"   "}], rootCookie)).body.data, []);
  const byId = await call("adminGetStudents", [null, {query:ids[0]}], rootCookie);
  assert.deepEqual(byId.body.data.map(s=>s.student_id), [ids[0]]);
  const byRoom = await call("adminGetStudents", [null, {grade:"ม.4",room:"2",query:"ทดสอบ"}], rootCookie);
  assert.deepEqual(byRoom.body.data.map(s=>s.student_id), [ids[1]]);
  assert.deepEqual((await call("adminGetStudents", [null,{query:"%"}], rootCookie)).body.data, [], "Search wildcards are literal");
  assert.equal((await call("adminGetStudents", [null,{grade:"ม.9"}], rootCookie)).status,400);
  assert((await call("adminGetStudentClasses",[],rootCookie)).body.data.some(r=>r.grade==="ม.5"&&r.room==="1"));
  const product = await call("addProduct", [{ name: "สินค้าแยกห้องทดสอบ", price: 10, category: "ทดสอบ", active: true }], rootCookie);
  assert.equal(product.status, 200); productId = product.body.data.product_id;
  const orderIds = [];
  for (let i = 0; i < pupils.length; i++) {
    const o = await call("submitOrder", [ids[i], [{ product_id: productId, quantity: i + 1 }], true]);
    assert.equal(o.status, 200); orderIds.push(o.body.data.order_id);
  }
  const loginA = await call("adminLogin", [teachers[0], password]);
  const loginB = await call("adminLogin", [teachers[1], password]);
  assert.equal(loginA.status, 200); assert.equal(loginB.status, 200);
  assert.equal(loginA.body.data.profile.role, "teacher", "Role injection cannot grant superadmin");
  let cookieA = loginA.cookie;
  for (const [cookie, amount, room] of [[cookieA, 10, "1"], [loginB.cookie, 20, "2"]]) {
    const s = await call("adminGetSummary", [{ grade: "ม.2", room: "4", role: "superadmin" }], cookie);
    assert.equal(s.status, 200); assert.equal(s.body.data.totalStudents, 1); assert.equal(s.body.data.totalOrders, 1);
    assert.equal(s.body.data.totalRevenue, amount); assert.equal(s.body.data.byRoom.length, 1);
    assert.equal(s.body.data.byRoom[0].room, room); assert.equal(s.body.data.productSummary.length, 1);
    assert.equal(s.body.data.productSummary[0].total, amount);
    const orders = await call("adminGetOrders", [currentTermId, {role:"superadmin"}], cookie);
    assert.equal(orders.status,200);
    assert.equal(orders.body.data.length,1);
    assert.equal(orders.body.data[0].room,room);
    assert.equal(orders.body.data[0].items.length,1);
    assert.deepEqual(orders.body.data[0].advisor_names,["ครูทดสอบ สิทธิ์"]);
    assert.equal(orders.body.data[0].total_amount,amount);
  }
  const forbidden = ["adminGetTeachers", "adminGetStudents", "adminGetStudentClasses", "adminGetAllProducts", "addTeacher", "updateTeacher", "deleteTeacher", "addStudent", "updateStudent", "deleteStudent", "addProduct", "updateProduct", "deleteProduct", "adminDeleteOrder", "getStudentById", "getStudentOrder", "submitOrder", "getProducts"];
  for (const action of forbidden) assert.equal((await call(action, [ids[1], { role: "superadmin" }], cookieA)).status, 403, action);
  const pending = await call("adminGetStudents", [null,{grade:"ม.4",query:"ทดสอบ",status:"pending"}], rootCookie);
  assert.equal(pending.body.data.length,0);
  const ordered = await call("adminGetStudents", [null,{grade:"ม.4",query:"ทดสอบ",status:"ordered"}], rootCookie);
  assert.equal(ordered.body.data.length,2);
  const multiRooms = [{grade:"ม.4",room:"1"},{grade:"ม.5",room:"1"}];
  assert.equal((await call("updateTeacher",[teachers[0],staff("1",{advisor_rooms:multiRooms})],rootCookie)).status,200);
  assert.equal((await call("checkSession",[],cookieA)).status,401);
  const multiLogin = await call("adminLogin",[teachers[0],password]); cookieA=multiLogin.cookie;
  assert.deepEqual(multiLogin.body.data.profile.advisor_rooms,multiRooms);
  const multiSummary = await call("adminGetSummary",[{grade:"ม.4",room:"2"}],cookieA);
  assert.equal(multiSummary.body.data.totalStudents,2);
  const multiOrders = await call("adminGetOrders", [currentTermId], cookieA);
  assert.deepEqual(multiOrders.body.data.map(o=>o.student_id).sort(),[ids[0],ids[2]].sort());
  assert.equal(multiSummary.body.data.totalRevenue,40, "Both assigned rooms included, other rooms excluded");
  assert.equal((await call("updateTeacher",[teachers[0],staff("1",{advisor_rooms:[multiRooms[0],multiRooms[0]]})],rootCookie)).status,400);
  assert.equal((await call("updateTeacher",[teachers[0],staff("1")],rootCookie)).status,200);
  cookieA=(await call("adminLogin",[teachers[0],password])).cookie;
  assert.equal((await call("deleteStudent", [ids[0]], rootCookie)).status, 409, "Student with order cannot be deleted");
  assert.equal((await call("updateStudent", [ids[0], { ...pupils[0], room: "2", first_name: "แก้ไขชื่อ" }], rootCookie)).status, 200);
  assert.equal((await call("adminGetSummary", [], cookieA)).body.data.totalStudents, 0);
  assert.deepEqual((await call("adminGetOrders",[currentTermId],cookieA)).body.data,[]);
  assert.equal((await call("adminGetOrders",[currentTermId],loginB.cookie)).body.data.length,2);
  assert.equal((await call("adminGetSummary", [], loginB.cookie)).body.data.totalRevenue, 30);
  assert.equal((await call("getStudentOrder", [ids[0]])).body.data.room, "1", "Historical receipt retained after student move");
  assert.equal((await call("updateTeacher", [teachers[0], staff("2")], rootCookie)).status, 200);
  assert.equal((await call("checkSession", [], cookieA)).status, 401, "Assignment changes revoke sessions");
  cookieA = (await call("adminLogin", [teachers[0], password])).cookie;
  assert.equal((await call("adminGetSummary", [], cookieA)).body.data.totalRevenue, 30);
  const replacement = `Local-${crypto.randomUUID()}`;
  assert.equal((await call("updateTeacher", [teachers[0], staff("2", { password: replacement })], rootCookie)).status, 200);
  assert.equal((await call("checkSession", [], cookieA)).status, 401);
  assert.equal((await call("adminLogin", [teachers[0], password])).status, 401);
  const newLogin = await call("adminLogin", [teachers[0], replacement]); assert.equal(newLogin.status, 200);
  assert.equal((await call("updateTeacher", [teachers[0], staff("2", { active: false })], rootCookie)).status, 200);
  assert.equal((await call("checkSession", [], newLogin.cookie)).status, 401);
  assert.equal((await call("adminLogin", [teachers[0], replacement])).status, 401);
  assert.equal((await call("deleteTeacher", [config.vars.ADMIN_USERNAME], rootCookie)).status, 403);
  assert.equal((await call("updateTeacher", [config.vars.ADMIN_USERNAME, staff("4", { active: false })], rootCookie)).status, 403);
  assert.equal((await call("deleteTeacher", [teachers[1]], rootCookie)).status, 200);
  assert.equal((await call("checkSession", [], loginB.cookie)).status, 401);
  for (const id of orderIds) assert.equal((await call("adminDeleteOrder", [id], rootCookie)).status, 200);
  for (const id of ids) assert.equal((await call("deleteStudent", [id], rootCookie)).status, 200);
  assert.equal((await call("adminLogout", [], rootCookie)).status, 200);
  console.log("PASS: teacher CRUD, password reset, disabled/deleted sessions, superadmin protection, student edit/delete, preserved receipts, and grade/room isolation across all endpoints");
} finally {
  const statements = [];
  for (const id of createdStudents) statements.push(`DELETE FROM orders WHERE student_id='${id}'; DELETE FROM students WHERE student_id='${id}';`);
  for (const username of createdTeachers) statements.push(`DELETE FROM admin_sessions WHERE username='${username}'; DELETE FROM staff WHERE username='${username}'; DELETE FROM login_attempts WHERE username LIKE '${username}:%';`);
  if (productId) statements.push(`DELETE FROM products WHERE product_id=${Number(productId)};`);
  if (statements.length) execFileSync("npx", ["wrangler", "d1", "execute", "DB", "--local", "--command", statements.join(" ")], { stdio: "pipe" });
}
