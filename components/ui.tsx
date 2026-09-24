"use client";
import { useEffect, useRef } from "react";
import { X, LoaderCircle } from "./icons";
export function Notice({ message }: { message: string }) { return message ? <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null; }
export function Loading() { return <div role="status" className="flex items-center justify-center gap-3 py-12 text-slate-500"><LoaderCircle className="animate-spin" size={20} />กำลังโหลดข้อมูล…</div>; }
export function Empty({ text = "ยังไม่มีข้อมูล" }: { text?: string }) { return <p className="py-12 text-center text-slate-500">{text}</p>; }
export function Modal({ title, children, close, hideTitle = false }: { title: string; children: React.ReactNode; close: () => void; hideTitle?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} className="print-host fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-slate-950/50 p-2 sm:p-4 backdrop:bg-transparent open:flex open:items-center open:justify-center">
    <section className="print-document relative min-w-0 max-h-[94dvh] sm:max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-7"><div className={hideTitle ? "no-print absolute right-3 top-3" : "mb-6 flex items-start justify-between gap-4"}>{!hideTitle && <h2>{title}</h2>}<button aria-label="ปิดหน้าต่าง" className="no-print flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100" onClick={close}><X size={20} /></button></div>{children}</section>
  </dialog>;
}
