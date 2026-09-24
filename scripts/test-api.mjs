// Integration tests run only against local Workers/D1. Never point this at production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = "http://localhost:8787";
const password = readFileSync(".dev.vars", "utf8").match(/^ADMIN_PASSWORD=(.+)$/m)?.[1];
const configured = JSON.parse(readFileSync("wrangler.jsonc", "utf8")).vars;
assert(password, "Configure .dev.vars before testing");
let cookie = "", createdStudent = false, productId;
const sid = "99001";
let currentTermId = "legacy";
async function call(action, args = [], authenticated = false) {
  if (action === "submitOrder" && args[3] === undefined) args[3] = currentTermId;
  const response = await fetch(`${base}/api`, { method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: cookie } : {}) }, body: JSON.stringify({ action, args }) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
}
try {
  currentTermId = (await call("getOrderingPeriod")).body.data.term_id;
  for (const path of ["/", "/history", "/admin"]) {
    const response = await fetch(base + path); assert.equal(response.status, 200); assert.match(await response.text(), /โรงเรียนจอมทอง/);
  }
  assert.equal((await call("adminGetOrders")).status, 401);
  const cross = await fetch(`${base}/api`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://other.example" }, body: JSON.stringify({ action: "getProducts" }) });
  assert.equal(cross.status, 403);
  const login = await call("adminLogin", [configured.ADMIN_USERNAME, password]);
  assert.equal(login.status, 200); assert.match(login.cookie, /HttpOnly/i); assert.match(login.cookie, /SameSite=strict/i);
  assert.equal(login.body.data.profile.full_name, "นายชลนที บุญทา");
  assert.equal(login.body.data.profile.role, "superadmin");
  assert.equal(login.body.data.profile.advisor_grade, "ม.3");
  assert.equal(login.body.data.profile.advisor_room, "4");
  cookie = login.cookie.split(";")[0];
  const original = (await call("adminGetSummary", [], true)).body.data;
  assert.equal(original.totalStudents, 29); assert.equal(original.totalOrders, 29);
  const orders = (await call("adminGetOrders", [], true)).body.data;
  assert.equal(orders.reduce((s,o) => s + o.items.length, 0), 188);
  assert.equal((await call("getStudentOrder", [orders[0].student_id])).body.data.items.length, orders[0].items.length);
  assert.equal((await call("getStudentById", [sid])).status, 404, "Fixture ID must not exist");
  const fixtureStudent = { student_id: sid, prefix: "นาย", first_name: "ทดสอบ", last_name: "-", grade: "ม.4", room: "1" };
  const added = await call("addStudent", [fixtureStudent], true);
  assert.equal(added.status, 200); createdStudent = true;
  assert.equal((await call("updateStudent", [sid, fixtureStudent], true)).status, 200, "Imported dash surnames remain editable");
  assert.equal((await call("getStudentById", [sid])).body.data.last_name, "-");
  assert.equal((await call("updateStudent", [sid, { ...fixtureStudent, last_name: " " }], true)).status, 400, "Blank surnames still rejected");
  assert.equal((await call("getStudentById", [sid])).body.data.budget, 260);
  const product = await call("addProduct", [{ name: "อุปกรณ์ทดสอบ", price: 20, category: "ทดสอบ", active: true }], true);
  assert.equal(product.status, 200); productId = product.body.data.product_id;
  assert.equal((await call("submitOrder", [sid, [{ product_id: productId, quantity: 14, price: 0.01 }]])).status, 400);
  assert.equal((await call("submitOrder", [sid, [{ product_id: productId, quantity: -1 }]])).status, 400);
  await call("updateProduct", [productId, { name: "อุปกรณ์ทดสอบ", price: 20, category: "ทดสอบ", active: false }], true);
  assert.equal((await call("submitOrder", [sid, [{ product_id: productId, quantity: 1 }]])).status, 400);
  await call("updateProduct", [productId, { name: "อุปกรณ์ทดสอบ", price: 20, category: "ทดสอบ", active: true }], true);
  for (const ack of [undefined, false, "true", 1]) {
    const denied = await call("submitOrder", [sid, [{ product_id: productId, quantity: 1 }], ack]);
    assert.equal(denied.status, 400); assert.match(denied.body.message, /เสียสิทธิ์/);
  }
  assert.equal((await call("getStudentById", [sid])).body.data.has_ordered, false);
  assert.equal((await call("submitOrder", [sid, [{ product_id: productId, quantity: 14 }], true])).status, 400, "Acknowledgement never permits overspending");
  const below = await call("submitOrder", [sid, [{ product_id: productId, quantity: 1 }], true]);
  assert.equal(below.status, 200); assert.equal(below.body.data.total_amount, 20);
  assert.equal(below.body.data.unused_budget_acknowledged, 1);
  assert(below.body.data.unused_budget_acknowledged_at);
  assert.equal((await call("adminDeleteOrder", [below.body.data.order_id], true)).status, 200);
  const concurrent = await Promise.all([1,2].map(() => call("submitOrder", [sid, [{ product_id: productId, quantity: 13, price: 0.01, product_name: "forged" }]])));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200,409]);
  const order = concurrent.find(r => r.status === 200).body.data;
  assert.equal(order.unused_budget_acknowledged, 0); assert.equal(order.unused_budget_acknowledged_at, null); assert.equal(order.total_amount, 260); assert.equal(order.items[0].product_name, "อุปกรณ์ทดสอบ");
  assert.equal((await call("deleteProduct", [productId], true)).status, 200); productId = undefined;
  assert.equal((await call("getStudentOrder", [sid])).body.data.items[0].price, 20, "Receipt survives deletion of product");
  assert.equal((await call("adminDeleteOrder", [order.order_id], true)).status, 200);
  assert.equal((await call("getStudentById", [sid])).body.data.has_ordered, false);
  for (let i=0;i<5;i++) assert.equal((await call("adminLogin", ["ratecheck", "invalid-password"])).status, 401);
  assert.equal((await call("adminLogin", ["ratecheck", "invalid-password"])).status, 429);
  assert.equal((await call("adminLogout", [], true)).status, 200);
  assert.equal((await call("adminGetStudents", [], true)).status, 401);
  console.log("PASS: pages, imported data, auth, CSRF, products, students, server pricing, budget, concurrent duplicate orders, cancellation, preserved receipts, login limits and logout");
} finally {
  // Explicit local-only cleanup restricted to test fixtures.
  const statements = [];
  if (createdStudent) statements.push(`DELETE FROM orders WHERE student_id='${sid}'; DELETE FROM students WHERE student_id='${sid}';`);
  if (productId) statements.push(`DELETE FROM products WHERE product_id=${Number(productId)};`);
  statements.push("DELETE FROM login_attempts WHERE username LIKE 'ratecheck:%';");
  execFileSync("npx", ["wrangler", "d1", "execute", "DB", "--local", "--command", statements.join(" ")], { stdio: "pipe" });
}
