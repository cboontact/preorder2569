import type { Term } from "./types";
export function termLabel(term: Pick<Term, "academic_year" | "semester">) {
  return term.academic_year && term.semester ? `ภาคเรียนที่ ${term.semester}/${term.academic_year}` : "ข้อมูลเดิม (ยังไม่ระบุภาคเรียน)";
}
export function periodStatus(term: Term, now = Date.now()) {
  if (!term.is_current || !term.enabled) return "paused" as const;
  if (term.opens_at && now < Date.parse(term.opens_at)) return "scheduled" as const;
  if (term.closes_at && now >= Date.parse(term.closes_at)) return "closed" as const;
  return "open" as const;
}
export const thaiDateTime = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
// datetime-local always represents Bangkok time in this app, regardless of browser time zone.
export const toThaiInput = (value: string | null) => value ? new Date(Date.parse(value) + 7 * 3600_000).toISOString().slice(0, 16) : "";
export const fromThaiInput = (value: string) => new Date(`${value}:00+07:00`).toISOString();
