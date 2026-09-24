"use client";
import { TableHeading } from "./table-heading";
import Image from "next/image";
import { Printer } from "./icons";
import type { Order } from "@/lib/types";
import { money, orderNumber } from "@/lib/types";
export function Receipt({ order }: { order: Order }) {
  return <div>
    <header className="mb-4 border-b border-slate-200 pb-4">
      <div className="flex items-center gap-3 pr-7 print:pr-0">
        <Image src="/school-logo.png" alt="ตราโรงเรียนจอมทอง" width={56} height={56} unoptimized loading="eager" className="h-14 w-14 shrink-0 object-contain" />
        <div className="min-w-0 flex-1"><h2 className="text-lg font-bold leading-snug">ใบสั่งซื้ออุปกรณ์การเรียน</h2><p className="mt-1 text-sm text-slate-600">โรงเรียนจอมทอง · {order.term_label}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base font-semibold">{order.student_name}</p>
        <p className="text-sm font-semibold text-slate-600" title={order.order_id}>เลขที่ {orderNumber(order.order_id)}</p>
      </div>
      <p className="mt-1 text-sm text-slate-600">เลขประจำตัว {order.student_id} · ชั้น {order.grade}/{order.room} · เลขที่ {order.student_number ?? "—"}</p>
      <p className="mt-1 text-sm">ครูที่ปรึกษา: {order.advisor_names?.join(" / ") || "ยังไม่ระบุครูที่ปรึกษา"}</p>
    </header>
    <div className="overflow-x-auto"><table className="data-table receipt-table">
      <thead><tr><TableHeading label="ลำดับ" /><TableHeading label="รายการ" /><TableHeading label="ราคา" /><TableHeading label="จำนวน" /><TableHeading label="รวม (บาท)" /></tr></thead>
      <tbody>{order.items.map((item, index) => <tr key={item.item_id || index}><td className="tabular-nums">{index + 1}</td><td>{item.product_name}</td><td>{money(item.price)}</td><td>{item.quantity}</td><td>{money(item.price * item.quantity)}</td></tr>)}</tbody>
      <tfoot>
        <tr><th scope="row" colSpan={4}>งบประมาณ</th><td>{money(order.budget)}</td></tr>
        <tr className="text-lg font-bold text-sky-800"><th scope="row" colSpan={4}>ยอดรวม</th><td>{money(order.total_amount)}</td></tr>
        <tr className="text-slate-500"><th scope="row" colSpan={4}>{order.unused_budget_acknowledged ? "ส่วนที่เสียสิทธิ์" : "คงเหลือ"}</th><td>{money(Math.max(0, order.budget - order.total_amount))}</td></tr>
        {order.extra_amount > 0 && <tr><th scope="row" colSpan={4}>ส่วนเกิน</th><td>{money(order.extra_amount)}</td></tr>}
      </tfoot>
    </table></div>
    {!!order.unused_budget_acknowledged && <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">นักเรียนยืนยันรับทราบการเสียสิทธิ์ในส่วนที่เหลือ {money(order.budget - order.total_amount)} บาทแล้ว</p>}
    <div className="mt-10 hidden justify-between print:flex"><span>ผู้รับอุปกรณ์ ....................................</span><span>ผู้จ่ายอุปกรณ์ ....................................</span></div>
    <div className="no-print mt-7 flex justify-end"><button className="btn" onClick={() => window.print()}><Printer size={18} />พิมพ์ใบสั่งซื้อ</button></div>
  </div>;
}
