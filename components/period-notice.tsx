"use client";
import { periodStatus, termLabel, thaiDateTime } from "@/lib/terms";
import type { Term } from "@/lib/types";
export function PeriodNotice({ term, now = Date.now() }: { term: Term; now?: number }) {
  const status = periodStatus(term,now);
  const label = { open: "เปิดรับคำสั่งซื้อ", scheduled: "ยังไม่ถึงเวลาเปิดรับ", closed: "หมดเวลารับคำสั่งซื้อแล้ว", paused: "ปิดรับคำสั่งซื้อ" }[status];
  return <section className={`mb-5 rounded-xl border p-4 ${status === "open" ? "border-sky-200 bg-sky-50 text-sky-950" : "border-amber-200 bg-amber-50 text-amber-950"}`} aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{termLabel(term)}</strong><span className="text-sm font-semibold">{label}</span></div><p className="mt-2 text-sm leading-7">{term.opens_at ? `เปิด ${thaiDateTime(term.opens_at)}` : "ยังไม่กำหนดวันเปิด"} · {term.closes_at ? `ปิด ${thaiDateTime(term.closes_at)}` : "ยังไม่กำหนดวันปิด"} (เวลาไทย)</p>{term.announcement && <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{term.announcement}</p>}</section>;
}
