"use client";
import { Plus as ActionPlus, Settings as ActionSettings, CheckCircle2 as ActionCheckCircle2, Pause as ActionPause, Play as ActionPlay, Save as ActionSave, ArrowLeft as ActionArrowLeft } from "./icons";
import { TableHeading } from "./table-heading";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Term } from "@/lib/types";
import { fromThaiInput, periodStatus, termLabel, thaiDateTime, toThaiInput } from "@/lib/terms";
import { Empty, Loading, Modal, Notice } from "./ui";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faCircleCheck, faClock, faCirclePause, faCircleXmark } from "@fortawesome/free-solid-svg-icons";
type Form = { term_id?: string; academic_year: string; semester: string; opens_at: string; closes_at: string; enabled: boolean; announcement: string };
export function TermManager({ onUpdate }: { onUpdate: () => Promise<void> }) {
  const [terms,setTerms] = useState<Term[]>([]); const [loading,setLoading] = useState(true);
  const [form,setForm] = useState<Form | null>(null); const [target,setTarget] = useState<Term | null>(null);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [modalError,setModalError] = useState("");
  async function load() { try { setTerms(await api<Term[]>("getTerms")); } catch(e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void load(); },[]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form) return; setBusy(true); setModalError("");
    try {
      const values = { academic_year:Number(form.academic_year),semester:Number(form.semester),opens_at:fromThaiInput(form.opens_at),closes_at:fromThaiInput(form.closes_at),enabled:form.enabled,announcement:form.announcement };
      if (Date.parse(values.closes_at)<=Date.parse(values.opens_at)) throw new Error("วันปิดรับต้องอยู่หลังวันเปิดรับ");
      if (form.term_id) await api("updateTerm",form.term_id,values); else await api("createTerm",values);
      setForm(null); await load(); await onUpdate();
    } catch(e) { setModalError((e as Error).message); } finally { setBusy(false); }
  }
  async function activate() {
    if (!target) return; setBusy(true); setModalError("");
    try { await api("activateTerm",target.term_id); setTarget(null); await load(); await onUpdate(); } catch(e) { setModalError((e as Error).message); } finally { setBusy(false); }
  }
  async function toggle(t: Term) {
    setBusy(true); setError("");
    try { await api("setTermEnabled",t.term_id,!t.enabled); await load(); await onUpdate(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="muted">เปิดรับครั้งละ 1 ภาคเรียน · เวลาไทย</p><button className="btn" onClick={()=>{setModalError("");setForm({academic_year:String(new Date().getFullYear()+543),semester:"1",opens_at:"",closes_at:"",enabled:false,announcement:""});}}><ActionPlus className="mr-1.5" />เพิ่มภาคเรียน</button></div><Notice message={error} />
    {loading ? <Loading /> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><TableHeading label="ภาคเรียน" /><TableHeading label="ช่วงเวลาเปิด–ปิด" /><TableHeading label="สถานะ" /><TableHeading label="จัดการ" /></tr></thead><tbody>{terms.map(t=><tr key={t.term_id}><td className="min-w-48"><strong>{termLabel(t)}</strong>{!!t.is_current && <span className="badge mt-2 block w-fit"><FontAwesomeIcon icon={faCalendarDays} className="mr-1.5 inline-block h-3.5 w-3.5 align-middle" aria-hidden="true" />ปัจจุบัน</span>}</td><td className="min-w-56">{t.opens_at ? thaiDateTime(t.opens_at) : "ยังไม่กำหนด"}<br />ถึง {t.closes_at ? thaiDateTime(t.closes_at) : "ยังไม่กำหนด"}</td><td><TermStatus term={t} /></td><td><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={busy} onClick={()=>{setModalError("");setForm({term_id:t.term_id,academic_year:String(t.academic_year || new Date().getFullYear()+543),semester:String(t.semester || 1),opens_at:toThaiInput(t.opens_at),closes_at:toThaiInput(t.closes_at),enabled:!!t.enabled,announcement:t.announcement});}}><ActionSettings className="mr-1.5" />ตั้งค่า</button>{!t.is_current ? <button className="btn-secondary" disabled={busy} onClick={()=>{setModalError("");setTarget(t);}}><ActionCheckCircle2 className="mr-1.5" />ใช้เป็นภาคเรียนปัจจุบัน</button> : <button className={t.enabled ? "btn-danger" : "btn"} disabled={busy} onClick={()=>toggle(t)}>{t.enabled ? <ActionPause className="mr-1.5" /> : <ActionPlay className="mr-1.5" />}{t.enabled ? "หยุดรับชั่วคราว" : "เปิดตามกำหนดเวลา"}</button>}</div></td></tr>)}</tbody></table>{!terms.length && <Empty />}</div>}
    {form && <Modal title={form.term_id ? "ตั้งค่าภาคเรียน" : "เพิ่มภาคเรียน"} close={()=>{if(!busy)setForm(null);}}><Notice message={modalError} /><form onSubmit={save} className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="term-year" className="label">ปีการศึกษา (พ.ศ.)</label><input id="term-year" type="number" className="field" min={2500} max={2700} required value={form.academic_year} onChange={e=>setForm({...form,academic_year:e.target.value})} /></div><div><label htmlFor="term-semester" className="label">ภาคเรียน</label><select id="term-semester" className="field" value={form.semester} onChange={e=>setForm({...form,semester:e.target.value})}><option value="1">ภาคเรียนที่ 1</option><option value="2">ภาคเรียนที่ 2</option></select></div><div><label htmlFor="term-opens" className="label">วัน–เวลาเปิดรับ (เวลาไทย)</label><input id="term-opens" type="datetime-local" className="field" required value={form.opens_at} onChange={e=>setForm({...form,opens_at:e.target.value})} /></div><div><label htmlFor="term-closes" className="label">วัน–เวลาปิดรับ (เวลาไทย)</label><input id="term-closes" type="datetime-local" className="field" required min={form.opens_at} value={form.closes_at} onChange={e=>setForm({...form,closes_at:e.target.value})} /></div><p className="muted sm:col-span-2">ระบบปิดทันทีเมื่อถึงเวลาที่กำหนด เช่น ต้องการรับตลอดวันที่ 30 ให้ตั้งปิดวันที่ 1 ของเดือนถัดไป เวลา 00:00</p><div className="sm:col-span-2"><label htmlFor="term-note" className="label">ข้อความแจ้งนักเรียน (ถ้ามี)</label><textarea id="term-note" className="field" rows={3} maxLength={500} value={form.announcement} onChange={e=>setForm({...form,announcement:e.target.value})} /></div><label className="flex items-center gap-3 sm:col-span-2"><input type="checkbox" className="h-5 w-5 accent-sky-700" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})} />อนุญาตให้รับคำสั่งซื้อตามช่วงเวลาที่ตั้งไว้</label>{!form.term_id && <p className="muted sm:col-span-2">หลังบันทึก กด “ใช้เป็นภาคเรียนปัจจุบัน” เพื่อเริ่มใช้ภาคเรียนนี้</p>}<button className="btn sm:col-span-2" disabled={busy}><ActionSave className="mr-1.5" />{busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button></form></Modal>}
    {target && <Modal title="เปลี่ยนภาคเรียนปัจจุบัน" close={()=>{if(!busy)setTarget(null);}}><Notice message={modalError} /><p>ใช้ {termLabel(target)} เป็นภาคเรียนปัจจุบัน</p><p className="muted mt-3">นักเรียนจะใช้สิทธิ์สั่งซื้อของภาคเรียนนี้ ข้อมูลภาคเรียนก่อนยังเปิดดูย้อนหลังได้ โดยเริ่มรับตามวัน–เวลาและสถานะที่ตั้งไว้</p><div className="mt-5 flex gap-3"><button className="btn" disabled={busy} onClick={activate}><ActionCheckCircle2 className="mr-1.5" />ยืนยันเปลี่ยนภาคเรียน</button><button className="btn-secondary" disabled={busy} onClick={()=>setTarget(null)}><ActionArrowLeft className="mr-1.5" />กลับ</button></div></Modal>}
  </section>;
}

function TermStatus({ term }: { term: Term }) {
  const status = periodStatus(term);
  const styles = {
    open: { label: "เปิดรับคำสั่งซื้อ", icon: faCircleCheck, color: "bg-emerald-50 text-emerald-700" },
    scheduled: { label: "ยังไม่ถึงเวลาเปิด", icon: faClock, color: "bg-amber-50 text-amber-800" },
    closed: { label: "หมดเวลาเปิดรับ", icon: faCircleXmark, color: "bg-slate-100 text-slate-600" },
    paused: { label: term.is_current ? "หยุดรับชั่วคราว" : "ไม่ได้ใช้งาน", icon: faCirclePause, color: "bg-slate-100 text-slate-600" },
  }[status];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm ${styles.color}`}><FontAwesomeIcon icon={styles.icon} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{styles.label}</span>;
}
