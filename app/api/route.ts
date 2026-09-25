import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { studentNumberSql } from "@/lib/student-number";
import { priceOrder } from "@/lib/order";
import { hashPassword, verifyPassword } from "@/lib/password";
import { periodStatus, termLabel } from "@/lib/terms";
import type { AdvisorRoom, AdminProfile, Teacher, Term, Order, OrderItem, Product, Student } from "@/lib/types";

export const dynamic = "force-dynamic";
const cookieName = "school_admin";
const envelope = z.object({ action: z.string().max(60), args: z.array(z.unknown()).max(12).default([]) });
const studentIdSchema = z.string().regex(/^\d{5}$/, "เลขประจำตัวนักเรียนต้องเป็นตัวเลข 5 หลัก");
const gradeSchema = z.enum(["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"]);
const roomSchema = z.string().regex(/^[1-9]\d?$/);
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,40}$/);
const studentSchema = z.object({ student_id: studentIdSchema, prefix: z.string().max(50), first_name: z.string().trim().min(2).max(120), last_name: z.string().trim().min(1).max(120), grade: gradeSchema, room: roomSchema });
const advisorRoomsSchema = z.array(z.object({ grade: gradeSchema, room: roomSchema })).min(1).max(100).refine(rooms => new Set(rooms.map(r => `${r.grade}/${r.room}`)).size === rooms.length, "ห้องที่ปรึกษาซ้ำกัน");
const studentFilterSchema = z.object({ grade: gradeSchema.optional(), room: roomSchema.optional(), status: z.enum(["ordered","pending"]).optional(), incomplete: z.boolean().optional(), query: z.string().trim().max(120).default("") });
const teacherSchema = z.object({ role: z.enum(["teacher","admin","superadmin"]).default("teacher"), full_name: z.string().trim().min(2).max(200), advisor_grade: gradeSchema, advisor_room: roomSchema, advisor_rooms: advisorRoomsSchema.optional(), active: z.boolean().default(true), password: z.string().min(1).max(256).optional() });
const termSchema = z.object({ academic_year: z.number().int().min(2500).max(2700), semester: z.union([z.literal(1),z.literal(2)]), opens_at: z.iso.datetime({ offset: true }), closes_at: z.iso.datetime({ offset: true }), enabled: z.boolean(), announcement: z.string().trim().max(500).default("") }).refine(t => Date.parse(t.opens_at)<Date.parse(t.closes_at), "วันปิดรับต้องอยู่หลังวันเปิดรับ");
const productSchema = z.object({ name: z.string().trim().min(3).max(255), price: z.number().positive().max(10000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8), category: z.string().trim().min(1).max(120), active: z.boolean().default(true) });
class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
const ok = (data: unknown = null, message = "ทำรายการสำเร็จ") => NextResponse.json({ success: true, data, message }, { headers: { "Cache-Control": "no-store" } });
async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if ((origin && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError("ไม่อนุญาตให้ทำรายการจากเว็บไซต์อื่น", 403);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError("รูปแบบข้อมูลไม่ถูกต้อง", 415);
    const raw = await request.text();
    if (raw.length > 32_768) throw new ApiError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new ApiError("รูปแบบข้อมูลไม่ถูกต้อง"); }
    const { action, args: a } = envelope.parse(input);
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const now = Math.floor(Date.now() / 1000);
    const token = request.cookies.get(cookieName)?.value;
    const tokenHash = token ? await digest(token) : "";
    const rows = async <T,>(sql: string, ...values: (string | number)[]) => (await db.prepare(sql).bind(...values).all<T>()).results;
    const first = async <T,>(sql: string, ...values: (string | number)[]) => db.prepare(sql).bind(...values).first<T>();
    const currentTerm = async () => {
      const term = await first<Term>("SELECT * FROM terms WHERE is_current=1");
      if (!term) throw new ApiError("ยังไม่ได้ตั้งค่าภาคเรียนปัจจุบัน",503);
      return term;
    };
    const selectTerm = async (value?: unknown) => {
      if (value === undefined || value === null || typeof value === "object") return currentTerm();
      const term = await first<Term>("SELECT * FROM terms WHERE term_id=?",z.string().min(1).max(80).parse(value));
      if (!term) throw new ApiError("ไม่พบภาคเรียน",404);
      return term;
    };
    const readProfile = async (username: string) => {
      const profile = await first<AdminProfile>("SELECT username,full_name,role,advisor_grade,advisor_room FROM staff WHERE username=? AND active=1", username);
      if (!profile) return null;
      return { ...profile, advisor_rooms: await rows<AdvisorRoom>("SELECT grade,room FROM staff_advisor_rooms WHERE username=? ORDER BY grade,CAST(room AS INTEGER)",username) };
    };
    const requireSession = async () => {
      const session = await first<{ last_activity: number; username: string }>("SELECT last_activity,username FROM admin_sessions WHERE token=?", tokenHash);
      if (!session || now - session.last_activity > 1800) throw new ApiError("กรุณาเข้าสู่ระบบอีกครั้ง", 401);
      const profile = await readProfile(session.username);
      if (!profile) throw new ApiError("บัญชีถูกปิดใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง", 401);
      await db.prepare("UPDATE admin_sessions SET last_activity=? WHERE token=?").bind(now, tokenHash).run();
      return profile;
    };
    const budgetFor = (s: Student) => {
      const budget = Number(s.level === "ม.ปลาย" ? env.BUDGET_UPPER : env.BUDGET_LOWER);
      if (!Number.isFinite(budget) || budget <= 0) throw new ApiError("ยังไม่ได้ตั้งค่างบประมาณ", 503);
      return budget;
    };
    const student = async (id: unknown) => {
      const s = await first<Student>(`SELECT s.*,${studentNumberSql} student_number FROM students s WHERE s.student_id=?`, studentIdSchema.parse(id));
      if (!s) throw new ApiError("ไม่พบข้อมูลนักเรียน กรุณาตรวจสอบเลขประจำตัว", 404);
      return s;
    };
    const getOrders = async (term: Term, id?: string, advisor?: string, filter?: { grade?: string; room?: string; incomplete?: boolean; query: string }) => {
      let where = ` WHERE o.term_id=?${id ? " AND o.student_id=?" : ""}${advisor ? " AND EXISTS(SELECT 1 FROM students s JOIN staff_advisor_rooms ar ON ar.grade=s.grade AND ar.room=s.room WHERE s.student_id=o.student_id AND ar.username=?)" : ""}`;
      const values = [term.term_id,...(id ? [id] : []),...(advisor ? [advisor] : [])];
      if (filter?.grade && filter.room) {
        where += " AND EXISTS(SELECT 1 FROM students fs WHERE fs.student_id=o.student_id AND fs.grade=? AND fs.room=?)";
        values.push(filter.grade, filter.room);
      }
      if (filter?.query) {
        where += " AND (instr(lower(o.student_name),lower(?))>0 OR instr(lower(o.student_id),lower(?))>0 OR instr(lower(o.order_id),lower(?))>0)";
        values.push(filter.query, filter.query, filter.query);
      }
      if (filter?.incomplete) where += " AND o.total_amount < o.budget";
      const orders = await rows<Order>(`SELECT o.*,(SELECT ${studentNumberSql} FROM students s WHERE s.student_id=o.student_id AND s.grade=o.grade AND s.room=o.room) student_number FROM orders o` + where + " ORDER BY o.grade,CAST(o.room AS INTEGER),student_number ASC NULLS LAST,o.student_id,o.order_id", ...values);
      if (!orders.length) return [];
      const [items, advisors] = await Promise.all([
        rows<OrderItem>("SELECT i.* FROM order_items i JOIN orders o ON o.order_id=i.order_id" + where + " ORDER BY i.item_id", ...values),
        rows<{ order_id: string; full_name: string }>("SELECT DISTINCT o.order_id,t.full_name FROM orders o JOIN staff_advisor_rooms ar ON ar.grade=o.grade AND ar.room=o.room JOIN staff t ON t.username=ar.username AND t.active=1" + where + " ORDER BY t.full_name", ...values)
      ]);
      const itemsByOrder = new Map<string, OrderItem[]>();
      for (const item of items) {
        const group = itemsByOrder.get(item.order_id);
        if (group) group.push(item); else itemsByOrder.set(item.order_id, [item]);
      }
      const advisorsByOrder = new Map<string, string[]>();
      for (const advisor of advisors) {
        const group = advisorsByOrder.get(advisor.order_id);
        if (group) group.push(advisor.full_name); else advisorsByOrder.set(advisor.order_id, [advisor.full_name]);
      }
      const label = termLabel(term);
      return orders.map(o => ({ ...o, term_label: label, advisor_names: advisorsByOrder.get(o.order_id) || [], items: itemsByOrder.get(o.order_id) || [] }));
    };

    if (action === "adminLogin") {
      const [username, password] = z.tuple([usernameSchema, z.string().min(1).max(256)]).parse(a);
      const attemptKey = `${username.toLowerCase()}:${request.headers.get("cf-connecting-ip") || "local"}`;
      const attempt = await first<{ fail_count: number; last_fail: number }>("SELECT * FROM login_attempts WHERE username=?", attemptKey);
      if (attempt && now - attempt.last_fail <= 300 && attempt.fail_count >= 5) throw new ApiError("เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณารอ 5 นาที", 429);
      const account = await first<Teacher & { password_hash: string | null }>("SELECT * FROM staff WHERE username=?", username);
      const matched = account?.password_hash ? await verifyPassword(password, account.password_hash) : username === env.ADMIN_USERNAME && !!env.ADMIN_PASSWORD && (await digest(password)) === (await digest(env.ADMIN_PASSWORD));
      if (!account || !account.active || !matched) {
        await db.prepare("INSERT INTO login_attempts(username,fail_count,last_fail) VALUES(?,1,?) ON CONFLICT(username) DO UPDATE SET fail_count=CASE WHEN ?-last_fail>300 THEN 1 ELSE fail_count+1 END,last_fail=?").bind(attemptKey, now, now, now).run();
        throw new ApiError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
      }
      const value = crypto.randomUUID() + crypto.randomUUID();
      await db.batch([
        db.prepare("DELETE FROM admin_sessions WHERE username=? OR last_activity<?").bind(username, now - 1800),
        db.prepare("INSERT INTO admin_sessions VALUES(?,?,?,?)").bind(await digest(value), username, now, new Date().toISOString()),
        db.prepare("DELETE FROM login_attempts WHERE username=? OR last_fail<?").bind(attemptKey, now - 300)
      ]);
      const response = ok({ valid: true, profile: await readProfile(username) }, "เข้าสู่ระบบสำเร็จ");
      response.cookies.set(cookieName, value, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "strict", path: "/", maxAge: 28_800 });
      return response;
    }
    if (action === "adminLogout") {
      await db.prepare("DELETE FROM admin_sessions WHERE token=?").bind(tokenHash).run();
      const response = ok(); response.cookies.delete(cookieName); return response;
    }
    if (action === "checkSession") return ok({ valid: true, profile: await requireSession() });
    if (action === "getOrderingPeriod") { const term = await currentTerm(); return ok({ ...term, status: periodStatus(term), server_now: new Date().toISOString() }); }
    if (action === "getTerms") return ok(await rows<Term>("SELECT * FROM terms ORDER BY is_current DESC,academic_year DESC,semester DESC"));
    // Apply the teacher allowlist before every data endpoint, including public student actions.
    const signedInProfile = token ? await requireSession() : null;
    if (signedInProfile?.role === "teacher" && !["adminGetSummary", "adminGetOrders", "adminGetStudents", "adminGetStudentClasses", "adminDeleteOrder", "adminUpdateOrder", "getProducts"].includes(action)) throw new ApiError("ครูดูได้เฉพาะภาพรวมและสรุปรายการสั่งซื้อของห้องที่ปรึกษา", 403);
    if (action === "getProducts") return ok(await rows<Product>("SELECT * FROM products WHERE active=1 ORDER BY product_id"));
    if (action === "getStudentById") {
      const s = await student(a[0]);
      const term = await currentTerm();
      const order = await first<{ order_id: string }>("SELECT order_id FROM orders WHERE student_id=? AND term_id=?", s.student_id,term.term_id);
      return ok({ ...s, term_id: term.term_id, budget: budgetFor(s), has_ordered: !!order, order_id: order?.order_id });
    }
    if (action === "getStudentOrder") {
      const [order] = await getOrders(await selectTerm(a[1]),studentIdSchema.parse(a[0]));
      if (!order) throw new ApiError("ไม่พบประวัติการสั่งซื้อของนักเรียน", 404);
      return ok(order);
    }
    if (action === "submitOrder") {
      const term = await currentTerm();
      if (a[3] !== term.term_id) throw new ApiError("ภาคเรียนมีการเปลี่ยนแปลง กรุณาค้นหานักเรียนและตรวจสอบรายการใหม่",409);
      const status = periodStatus(term);
      if (status !== "open") throw new ApiError(status === "scheduled" ? "ยังไม่ถึงเวลาเปิดรับคำสั่งซื้อ" : status === "closed" ? "หมดเวลารับคำสั่งซื้อแล้ว" : "ขณะนี้ปิดรับคำสั่งซื้อ",403);
      const s = await student(a[0]);
      const items = z.array(z.object({ product_id: z.number().int().positive(), quantity: z.number().int().min(1).max(999) })).min(1).max(100).parse(a[1]);
      const products = await rows<Product>("SELECT * FROM products WHERE active=1");
      let priced: ReturnType<typeof priceOrder>;
      try { priced = priceOrder(items, products, budgetFor(s)); } catch (error) { throw new ApiError((error as Error).message); }
      const underBudget = Math.round(priced.total * 100) < Math.round(budgetFor(s) * 100);
      if (underBudget && a[2] !== true) throw new ApiError("ยอดซื้อไม่ครบงบประมาณ กรุณายืนยันว่าคุณยอมรับการเสียสิทธิ์ในส่วนที่เหลือก่อนสั่งซื้อ");
      const id = `ORD-${crypto.randomUUID()}`;
      const date = new Date().toISOString();
      // D1 batch and the period trigger enforce dates/current term at commit time.
      try {
        await db.batch([
          db.prepare("INSERT INTO orders(order_id,student_id,student_name,grade,room,budget,total_amount,extra_amount,order_date,unused_budget_acknowledged,unused_budget_acknowledged_at,term_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, s.student_id, `${s.prefix || ""}${s.first_name} ${s.last_name}`, s.grade, s.room, budgetFor(s), priced.total, 0, date, underBudget ? 1 : 0, underBudget ? date : null,term.term_id),
          ...priced.lines.map(i => db.prepare("INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES(?,?,?,?,?)").bind(id, i.product_id, i.product_name, i.price, i.quantity))
        ]);
      } catch (error) {
        if (String(error).includes("ordering_period_closed")) throw new ApiError("ปิดรับคำสั่งซื้อหรือเปลี่ยนภาคเรียนแล้ว กรุณาตรวจสอบช่วงเวลาอีกครั้ง",403);
        if (String(error).includes("UNIQUE constraint failed: orders.student_id")) throw new ApiError("นักเรียนได้ทำการสั่งซื้อแล้ว กรุณาตรวจสอบรายการที่สั่ง", 409);
        throw error;
      }
      return ok((await getOrders(term,s.student_id))[0], "บันทึกคำสั่งซื้อเรียบร้อยแล้ว");
    }

    const profile = signedInProfile || await requireSession();
    if (action === "adminGetSummary") {
      const term = await selectTerm(a[0]);
      // Class membership comes from current student records, never request-supplied filters.
      const assignedRoom = "EXISTS(SELECT 1 FROM staff_advisor_rooms ar WHERE ar.username=? AND ar.grade=s.grade AND ar.room=s.room)";
      const roomScope = profile.role === "teacher" ? " WHERE " + assignedRoom : "";
      const roomValues = profile.role === "teacher" ? [profile.username] : [];
      const scope = " WHERE o.term_id=?" + (profile.role === "teacher" ? " AND " + assignedRoom : "");
      const values = [term.term_id,...roomValues];
      type RoomSummary = { grade: string; room: string; totalStudents: number; count: number; pending: number; total: number; budget: number; extra: number };
      // Reuse classroom aggregates for the cards instead of scanning students/orders again.
      const [byRoom, productSummary] = await Promise.all([
        rows<RoomSummary>("SELECT s.grade,s.room,count(*) totalStudents,count(o.order_id) count,count(*)-count(o.order_id) pending,coalesce(sum(o.total_amount),0) total,coalesce(sum(o.budget),0) budget,coalesce(sum(o.extra_amount),0) extra FROM students s LEFT JOIN orders o ON o.student_id=s.student_id AND o.term_id=?" + roomScope + " GROUP BY s.grade,s.room ORDER BY s.grade,CAST(s.room AS INTEGER)", ...values),
        rows("SELECT i.product_name name,sum(i.quantity) qty,sum(i.price*i.quantity) total FROM order_items i JOIN orders o ON o.order_id=i.order_id JOIN students s ON s.student_id=o.student_id" + scope + " GROUP BY i.product_name ORDER BY qty DESC", ...values)
      ]);
      const totals = byRoom.reduce((sum, room) => ({
        totalStudents: sum.totalStudents + room.totalStudents,
        totalOrders: sum.totalOrders + room.count,
        totalRevenue: sum.totalRevenue + room.total,
        totalBudget: sum.totalBudget + room.budget,
        totalExtra: sum.totalExtra + room.extra
      }), { totalStudents: 0, totalOrders: 0, totalRevenue: 0, totalBudget: 0, totalExtra: 0 });
      return ok({ ...totals, byRoom, productSummary });
    }
    if (action === "adminGetOrders") {
      const filter = studentFilterSchema.pick({grade:true,room:true,incomplete:true,query:true}).parse(a[1] ?? {});
      if ((filter.grade || filter.room) && !(filter.grade && filter.room)) return ok([]);
      if (!filter.query && !filter.incomplete && !(filter.grade && filter.room)) return ok([]);
      return ok(await getOrders(await selectTerm(a[0]), undefined, profile.role === "teacher" ? profile.username : undefined, filter));
    }
    if (action === "adminDeleteOrder" || action === "adminUpdateOrder") {
      const id = z.string().min(1).max(80).parse(a[0]);
      const existing = await first<Order>("SELECT * FROM orders WHERE order_id=?", id);
      if (!existing) throw new ApiError("ไม่พบคำสั่งซื้อ", 404);
      if (profile.role === "teacher") {
        const allowed = await first<{ ok: number }>("SELECT 1 ok FROM staff_advisor_rooms ar JOIN students s ON s.grade=ar.grade AND s.room=ar.room WHERE ar.username=? AND s.student_id=?", profile.username, existing.student_id);
        if (!allowed) throw new ApiError("ครูไม่มีสิทธิ์จัดการคำสั่งซื้อนี้", 403);
      }
      if (action === "adminDeleteOrder") {
        const result = await db.prepare("DELETE FROM orders WHERE order_id=?").bind(id).run();
        if (!result.meta.changes) throw new ApiError("ไม่พบคำสั่งซื้อ", 404);
        return ok();
      }
      const items = z.array(z.object({ product_id: z.number().int().positive(), quantity: z.number().int().min(1).max(999) })).min(1).max(100).parse(a[1]);
      const catalog = await rows<Product>("SELECT * FROM products");
      let priced: ReturnType<typeof priceOrder>;
      try { priced = priceOrder(items, catalog.map(p => ({ ...p, active: 1 })), existing.budget); } catch (error) { throw new ApiError((error as Error).message); }
      const date = new Date().toISOString();
      await db.batch([
        db.prepare("UPDATE orders SET total_amount=?,extra_amount=0,unused_budget_acknowledged=?,unused_budget_acknowledged_at=? WHERE order_id=?").bind(priced.total, priced.total < existing.budget ? 1 : 0, priced.total < existing.budget ? date : null, id),
        db.prepare("DELETE FROM order_items WHERE order_id=?").bind(id),
        ...priced.lines.map(i => db.prepare("INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES(?,?,?,?,?)").bind(id, i.product_id, i.product_name, i.price, i.quantity))
      ]);
      return ok((await getOrders(await selectTerm(existing.term_id), existing.student_id))[0]);
    }
    if (profile.role === "teacher" && !["adminGetStudents", "adminGetStudentClasses"].includes(action)) throw new ApiError("เฉพาะผู้ดูแลระบบเท่านั้น", 403);
    switch (action) {
      case "adminGetAllProducts": return ok(await rows<Product>("SELECT * FROM products ORDER BY product_id"));
      case "adminGetStudentClasses": return ok(await rows<AdvisorRoom>("SELECT DISTINCT grade,room FROM students ORDER BY grade,CAST(room AS INTEGER)"));
      case "adminGetStudents": {
        const filter = studentFilterSchema.parse(a[1] ?? {});
        if (!filter.grade && !filter.room && !filter.status && !filter.query) return ok([]);
        const term = await selectTerm(a[0]);
        const clauses: string[] = []; const values: string[] = [term.term_id];
        if (profile.role === "teacher") { clauses.push("EXISTS(SELECT 1 FROM staff_advisor_rooms ar WHERE ar.username=? AND ar.grade=s.grade AND ar.room=s.room)"); values.push(profile.username); }
        if (filter.grade) { clauses.push("s.grade=?"); values.push(filter.grade); }
        if (filter.room) { clauses.push("s.room=?"); values.push(filter.room); }
        if (filter.status) clauses.push(filter.status === "ordered" ? "o.order_id IS NOT NULL" : "o.order_id IS NULL");
        for (const word of filter.query.split(/\s+/).filter(Boolean)) {
          clauses.push("instr(lower(s.student_id || ' ' || s.prefix || s.first_name || ' ' || s.last_name),lower(?))>0"); values.push(word);
        }
        const students = await rows<Student>(`SELECT s.*,${studentNumberSql} student_number,o.order_id FROM students s LEFT JOIN orders o ON o.student_id=s.student_id AND o.term_id=? WHERE ` + clauses.join(" AND ") + " ORDER BY s.grade,CAST(s.room AS INTEGER),student_number",...values);
        return ok(students.map(s => ({ ...s, term_id: term.term_id, budget: budgetFor(s), has_ordered: !!s.order_id })));
      }
      case "createTerm":
      case "updateTerm": {
        const editing = action === "updateTerm";
        const id = editing ? z.string().min(1).max(80).parse(a[0]) : crypto.randomUUID();
        const t = termSchema.parse(editing ? a[1] : a[0]);
        try {
          const statement = editing
            ? db.prepare("UPDATE terms SET academic_year=?,semester=?,opens_at=?,closes_at=?,enabled=?,announcement=? WHERE term_id=?")
            : db.prepare("INSERT INTO terms(academic_year,semester,opens_at,closes_at,enabled,announcement,term_id) VALUES(?,?,?,?,?,?,?)");
          const result = await statement.bind(t.academic_year,t.semester,new Date(t.opens_at).toISOString(),new Date(t.closes_at).toISOString(),+t.enabled,t.announcement,id).run();
          if (!result.meta.changes) throw new ApiError("ไม่พบภาคเรียน",404);
        } catch (error) { if (String(error).includes("UNIQUE")) throw new ApiError("ภาคเรียนและปีการศึกษานี้มีอยู่แล้ว",409); throw error; }
        return ok({ term_id: id });
      }
      case "activateTerm": {
        const target = await selectTerm(z.string().min(1).max(80).parse(a[0]));
        await db.batch([db.prepare("UPDATE terms SET is_current=0 WHERE is_current=1"),db.prepare("UPDATE terms SET is_current=1 WHERE term_id=?").bind(target.term_id)]);
        return ok();
      }
      case "setTermEnabled": {
        const target = await selectTerm(z.string().min(1).max(80).parse(a[0]));
        await db.prepare("UPDATE terms SET enabled=? WHERE term_id=?").bind(+z.boolean().parse(a[1]),target.term_id).run();
        return ok();
      }
      case "adminGetTeachers": {
        const teachers = await rows<Teacher>("SELECT username,full_name,role,advisor_grade,advisor_room,active FROM staff ORDER BY role,full_name");
        const assignments = await rows<AdvisorRoom & { username: string }>("SELECT username,grade,room FROM staff_advisor_rooms ORDER BY grade,CAST(room AS INTEGER)");
        return ok(teachers.map(t => ({...t,advisor_rooms:assignments.filter(r=>r.username.toLowerCase()===t.username.toLowerCase()).map(({grade,room})=>({grade,room}))})));
      }
      case "addTeacher": {
        const username = usernameSchema.parse(a[0]);
        const t = teacherSchema.required({ password: true }).parse(a[1]);
        if (profile.role !== "superadmin" && t.role === "superadmin") throw new ApiError("ผู้ดูแลระบบไม่สามารถสร้างผู้ดูแลสูงสุด",403);
        const hashed = await hashPassword(t.password);
        const rooms = t.advisor_rooms || [{grade:t.advisor_grade,room:t.advisor_room}];
        try { await db.batch([
          db.prepare("INSERT INTO staff VALUES(?,?,?,?,?,?,?)").bind(username,t.full_name,t.role,rooms[0].grade,rooms[0].room,+t.active,hashed),
          ...rooms.map(r=>db.prepare("INSERT INTO staff_advisor_rooms VALUES(?,?,?)").bind(username,r.grade,r.room))
        ]); }
        catch (error) { if (String(error).includes("UNIQUE")) throw new ApiError("ชื่อผู้ใช้นี้มีอยู่แล้ว",409); throw error; }
        return ok();
      }
      case "updateTeacher": {
        const username = usernameSchema.parse(a[0]); const t = teacherSchema.parse(a[1]);
        const existing = await first<Teacher>("SELECT role FROM staff WHERE username=?",username);
        if (!existing) throw new ApiError("ไม่พบครูที่ปรึกษา",404);
        if (existing.role === "superadmin" && (profile.role !== "superadmin" || !t.active || t.role !== "superadmin")) throw new ApiError("ไม่สามารถดำเนินการกับบัญชีผู้ดูแลสูงสุด",403);
        if (profile.role !== "superadmin" && t.role === "superadmin") throw new ApiError("ผู้ดูแลระบบไม่สามารถตั้งหรือแก้ไขผู้ดูแลสูงสุด",403);
        const hashed = t.password ? await hashPassword(t.password) : null;
        const rooms = t.advisor_rooms || [{grade:t.advisor_grade,room:t.advisor_room}];
        await db.batch([
          db.prepare("UPDATE staff SET full_name=?,role=?,advisor_grade=?,advisor_room=?,active=?,password_hash=coalesce(?,password_hash) WHERE username=?").bind(t.full_name,t.role,rooms[0].grade,rooms[0].room,+t.active,hashed,username),
          db.prepare("DELETE FROM staff_advisor_rooms WHERE username=?").bind(username),
          ...rooms.map(r=>db.prepare("INSERT INTO staff_advisor_rooms VALUES(?,?,?)").bind(username,r.grade,r.room)),
          ...(existing.role === "teacher" ? [db.prepare("DELETE FROM admin_sessions WHERE username=?").bind(username)] : [])
        ]);
        return ok();
      }
      case "deleteTeacher": {
        const username = usernameSchema.parse(a[0]);
        const existing = await first<Teacher>("SELECT role FROM staff WHERE username=?",username);
        if (!existing) throw new ApiError("ไม่พบครูที่ปรึกษา",404);
        if (existing.role === "superadmin") throw new ApiError("ไม่สามารถลบบัญชีผู้ดูแลสูงสุด",403);
        await db.batch([db.prepare("DELETE FROM admin_sessions WHERE username=?").bind(username), db.prepare("DELETE FROM staff WHERE username=? AND role='teacher'").bind(username)]);
        return ok();
      }
      case "updateStudent": {
        const id = studentIdSchema.parse(a[0]); const s = studentSchema.parse(a[1]);
        if (id !== s.student_id) throw new ApiError("ไม่สามารถเปลี่ยนเลขประจำตัวนักเรียน");
        const result = await db.prepare("UPDATE students SET prefix=?,first_name=?,last_name=?,level=?,grade=?,room=? WHERE student_id=?").bind(s.prefix,s.first_name,s.last_name,Number(s.grade.slice(2))<=3?"ม.ต้น":"ม.ปลาย",s.grade,s.room,id).run();
        if (!result.meta.changes) throw new ApiError("ไม่พบนักเรียน",404);
        return ok();
      }
      case "deleteStudent": {
        const id = studentIdSchema.parse(a[0]);
        const result = await db.prepare("DELETE FROM students WHERE student_id=? AND NOT EXISTS(SELECT 1 FROM orders WHERE student_id=?)").bind(id,id).run();
        if (!result.meta.changes) throw new ApiError("ไม่พบนักเรียน หรือมีคำสั่งซื้ออยู่ กรุณายกเลิกคำสั่งซื้อก่อนลบนักเรียน",409);
        return ok();
      }
      case "addProduct": {
        const p = productSchema.parse(a[0]);
        const result = await db.prepare("INSERT INTO products(name,price,category,active) VALUES(?,?,?,?)").bind(p.name, p.price, p.category, +p.active).run();
        return ok({ product_id: result.meta.last_row_id });
      }
      case "updateProduct": {
        const id = z.number().int().positive().parse(a[0]); const p = productSchema.parse(a[1]);
        const result = await db.prepare("UPDATE products SET name=?,price=?,category=?,active=? WHERE product_id=?").bind(p.name, p.price, p.category, +p.active, id).run();
        if (!result.meta.changes) throw new ApiError("ไม่พบสินค้า", 404);
        return ok();
      }
      case "deleteProduct": {
        const result = await db.prepare("DELETE FROM products WHERE product_id=?").bind(z.number().int().positive().parse(a[0])).run();
        if (!result.meta.changes) throw new ApiError("ไม่พบสินค้า", 404);
        return ok();
      }
      case "addStudent": {
        const s = studentSchema.parse(a[0]);
        try { await db.prepare("INSERT INTO students VALUES(?,?,?,?,?,?,?)").bind(s.student_id, s.prefix, s.first_name, s.last_name, Number(s.grade.slice(2)) <= 3 ? "ม.ต้น" : "ม.ปลาย", s.grade, s.room).run(); }
        catch (error) { if (String(error).includes("UNIQUE")) throw new ApiError("เลขประจำตัวนักเรียนซ้ำ", 409); throw error; }
        return ok();
      }
      default: throw new ApiError("ไม่พบคำสั่งที่ร้องขอ", 404);
    }
  } catch (error) {
    const status = error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof ApiError ? error.message : error instanceof z.ZodError ? "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบช่องกรอกข้อมูล" : "ไม่สามารถทำรายการได้ กรุณาลองใหม่หรือติดต่อผู้ดูแล";
    if (status === 500) console.error("API operation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, data: null, message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
