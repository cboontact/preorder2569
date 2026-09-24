"use client";
import { Clear as ActionClear, Trash2 as ActionTrash2, Plus as ActionPlus, Save as ActionSave, ArrowLeft as ActionArrowLeft } from "./icons";
import { TableHeading } from "./table-heading";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "./icons";
import { api } from "@/lib/client";
import type { AdvisorRoom, Teacher } from "@/lib/types";
import { Empty, Loading, Modal, Notice } from "./ui";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChalkboardUser } from "@fortawesome/free-solid-svg-icons";
const blank = { username: "", full_name: "", advisor_grade: "ม.1", advisor_room: "1", active: true, password: "" };
type Form = typeof blank & { editing?: boolean; superadmin?: boolean; extraRooms?: AdvisorRoom[] };
export function TeacherManager({ onUpdate }: { onUpdate: () => Promise<void> }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [grade, setGrade] = useState(""); const [room, setRoom] = useState(""); const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [modalError, setModalError] = useState("");
  const [search, setSearch] = useState(""); const [form, setForm] = useState<Form | null>(null);
  const [deletion, setDeletion] = useState<Teacher | null>(null); const [busy, setBusy] = useState(false);
  async function load() { try { setTeachers(await api<Teacher[]>("adminGetTeachers")); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form) return; setBusy(true); setModalError("");
    try {
      const data = { full_name: form.full_name, advisor_grade: form.advisor_grade, advisor_room: form.advisor_room, advisor_rooms: [{grade:form.advisor_grade,room:form.advisor_room},...(form.extraRooms || [])], active: form.active, ...(form.password ? { password: form.password } : {}) };
      await api(form.editing ? "updateTeacher" : "addTeacher", form.username, data);
      setForm(null); await load(); await onUpdate(); window.dispatchEvent(new Event("school-session-changed"));
    } catch (e) { setModalError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!deletion) return; setBusy(true); setModalError("");
    try { await api("deleteTeacher", deletion.username); setDeletion(null); await load(); } catch (e) { setModalError((e as Error).message); } finally { setBusy(false); }
  }
  const rooms = [...new Set(teachers.flatMap(t => t.advisor_rooms).filter(r => !grade || r.grade === grade).map(r => r.room))].sort((a,b) => Number(a)-Number(b));
  const query = search.trim().toLowerCase();
  const filtered = teachers.filter(t =>
    `${t.full_name} ${t.username} ${t.advisor_rooms.map(r => `${r.grade}/${r.room}`).join(" ")}`.toLowerCase().includes(query)
    && ((!grade && !room) || t.advisor_rooms.some(r => (!grade || r.grade === grade) && (!room || r.room === room)))
    && (!status || !!t.active === (status === "active"))
  );
  return <section className="panel"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-3"><FontAwesomeIcon className="h-5 w-5 text-sky-700" icon={faChalkboardUser} />จัดการครูที่ปรึกษา</h2><button className="btn" onClick={() => { setModalError(""); setForm({ ...blank }); }}><Plus size={18} />เพิ่มครูที่ปรึกษา</button></div>
    <Notice message={error} /><p className="muted mb-4">ครูทั่วไปดูได้เฉพาะภาพรวมและสรุปการสั่งซื้อของห้องที่ปรึกษาที่กำหนด</p>
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1"><label htmlFor="teacher-search" className="label">ค้นหาครูที่ปรึกษา</label><input id="teacher-search" className="field" placeholder="ค้นหาชื่อครู ชื่อผู้ใช้ หรือห้อง…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="w-full sm:w-auto"><label htmlFor="teacher-grade-filter" className="label">ระดับชั้น</label><select id="teacher-grade-filter" className="field" value={grade} onChange={e => { setGrade(e.target.value); setRoom(""); }}><option value="">ทุกชั้น</option>{["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"].map(g => <option key={g}>{g}</option>)}</select></div>
      <div className="w-full sm:w-auto"><label htmlFor="teacher-room-filter" className="label">ห้อง</label><select id="teacher-room-filter" className="field" value={room} onChange={e => setRoom(e.target.value)}><option value="">ทุกห้อง</option>{rooms.map(r => <option key={r}>{r}</option>)}</select></div>
      <div className="w-full sm:w-auto"><label htmlFor="teacher-status-filter" className="label">สถานะบัญชี</label><select id="teacher-status-filter" className="field" value={status} onChange={e => setStatus(e.target.value)}><option value="">ทุกสถานะ</option><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></div>
      <button type="button" className="btn-secondary" onClick={() => { setSearch(""); setGrade(""); setRoom(""); setStatus(""); }}><ActionClear className="mr-1.5" />ล้างตัวกรอง</button>
    </div>
    {!loading && <p className="muted mb-3">แสดง {filtered.length} จาก {teachers.length} บัญชี</p>}
    {loading ? <Loading /> : <><div className="overflow-x-auto"><table className="data-table"><thead><tr><TableHeading label="ครู / ชื่อผู้ใช้" /><TableHeading label="ห้องที่ปรึกษา" /><TableHeading label="สิทธิ์" /><TableHeading label="สถานะ" /><TableHeading label="จัดการ" /></tr></thead><tbody>{filtered.map(t => <tr key={t.username}><td className="min-w-48 font-medium">{t.full_name}<span className="muted block">{t.username}</span></td><td>{t.advisor_rooms.map(r=>`${r.grade}/${r.room}`).join(", ")}</td><td className="whitespace-nowrap">{t.role === "superadmin" ? "ผู้ดูแลสูงสุด" : "ครูที่ปรึกษา"}</td><td className="whitespace-nowrap">{t.active ? "ใช้งาน" : "ปิดใช้งาน"}</td><td><div className="flex gap-2"><button className="btn-secondary" aria-label={`แก้ไข ${t.full_name}`} onClick={() => { setModalError(""); setForm({ username: t.username, full_name: t.full_name, advisor_grade: t.advisor_grade, advisor_room: t.advisor_room, active: !!t.active, password: "", extraRooms: t.advisor_rooms.filter(r=>r.grade!==t.advisor_grade || r.room!==t.advisor_room), editing: true, superadmin: t.role === "superadmin" }); }}><Pencil size={16} />แก้ไข</button>{t.role !== "superadmin" && <button className="btn-danger" aria-label={`ลบ ${t.full_name}`} onClick={() => { setModalError(""); setDeletion(t); }}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>{!filtered.length && <Empty text="ไม่พบครูที่ปรึกษา" />}</>}
    {form && <Modal title={form.editing ? "แก้ไขครูที่ปรึกษา" : "เพิ่มครูที่ปรึกษา"} close={() => { if (!busy) setForm(null); }}><Notice message={modalError} /><form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor="t-name" className="label">ชื่อ–นามสกุล (รวมคำนำหน้า)</label><input id="t-name" className="field" required minLength={2} maxLength={200} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
      <div><label htmlFor="t-user" className="label">ชื่อผู้ใช้</label><input id="t-user" className="field" required readOnly={form.editing} autoComplete="off" minLength={3} maxLength={40} value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })} /><p className="muted mt-1">ใช้ a–z, 0–9, จุด, ขีดกลาง หรือขีดล่าง</p></div>
      {!form.superadmin && <div><label htmlFor="t-password" className="label">{form.editing ? "ตั้งรหัสผ่านใหม่ (ถ้าต้องการ)" : "รหัสผ่าน"}</label><input id="t-password" className="field" type="password" autoComplete="new-password" required={!form.editing} minLength={8} maxLength={256} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><p className="muted mt-1">อย่างน้อย 8 ตัวอักษร{form.editing ? " · เว้นว่างเพื่อใช้รหัสเดิม" : ""}</p></div>}
      <div><label htmlFor="t-grade" className="label">ชั้นที่ปรึกษา</label><select id="t-grade" className="field" value={form.advisor_grade} onChange={e => setForm({ ...form, advisor_grade: e.target.value })}>{["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"].map(g => <option key={g}>{g}</option>)}</select></div>
      <div><label htmlFor="t-room" className="label">ห้องที่ปรึกษา</label><input id="t-room" className="field" type="number" min={1} max={99} required value={form.advisor_room} onChange={e => setForm({ ...form, advisor_room: e.target.value })} /></div>
      <div className="sm:col-span-2 space-y-3">{(form.extraRooms || []).map((r,i)=><div className="flex flex-wrap items-center gap-3" key={i}><select aria-label={`ชั้นเพิ่มเติม ${i+1}`} className="field sm:w-auto" value={r.grade} onChange={e=>setForm({...form,extraRooms:form.extraRooms!.map((v,n)=>n===i?{...v,grade:e.target.value}:v)})}>{["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"].map(g=><option key={g}>{g}</option>)}</select><input aria-label={`ห้องเพิ่มเติม ${i+1}`} className="field sm:w-28" type="number" required min={1} max={99} value={r.room} onChange={e=>setForm({...form,extraRooms:form.extraRooms!.map((v,n)=>n===i?{...v,room:e.target.value}:v)})} /><button type="button" className="btn-danger" onClick={()=>setForm({...form,extraRooms:form.extraRooms!.filter((_,n)=>n!==i)})}><ActionTrash2 className="mr-1.5" />เอาห้องนี้ออก</button></div>)}<button type="button" className="btn-secondary" onClick={()=>setForm({...form,extraRooms:[...(form.extraRooms || []),{grade:form.advisor_grade,room:""}]})}><ActionPlus className="mr-1.5" />เพิ่มห้องที่ปรึกษา</button></div>
      {!form.superadmin && <label className="flex items-center gap-3 sm:col-span-2"><input type="checkbox" className="h-5 w-5 accent-sky-700" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />เปิดใช้งานบัญชี</label>}
      {form.editing && !form.superadmin && <p className="muted sm:col-span-2">หลังบันทึก ครูต้องเข้าสู่ระบบใหม่เพื่อใช้ข้อมูลและสิทธิ์ล่าสุด</p>}
      <button className="btn sm:col-span-2" disabled={busy}><ActionSave className="mr-1.5" />{busy ? "กำลังบันทึก…" : "บันทึกครูที่ปรึกษา"}</button>
    </form></Modal>}
    {deletion && <Modal title="ลบบัญชีครูที่ปรึกษา" close={() => { if (!busy) setDeletion(null); }}><Notice message={modalError} /><p>{deletion.full_name} ({deletion.username})</p><p className="muted mt-3">บัญชีนี้จะเข้าสู่ระบบไม่ได้อีก ข้อมูลนักเรียนและคำสั่งซื้อยังคงอยู่</p><div className="mt-5 flex gap-3"><button className="btn-danger" disabled={busy} onClick={remove}><ActionTrash2 className="mr-1.5" />ยืนยันลบบัญชี</button><button className="btn-secondary" disabled={busy} onClick={() => setDeletion(null)}><ActionArrowLeft className="mr-1.5" />กลับ</button></div></Modal>}
  </section>;
}
