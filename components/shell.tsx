"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, Package, ReceiptText, LayoutDashboard, Users, GraduationCap, CalendarDays, LogOut, Menu, X } from "./icons";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { AdminProfile } from "@/lib/types";
const links = [ { href: "/", label: "สั่งซื้ออุปกรณ์", icon: ShoppingBag }, { href: "/history", label: "ตรวจสอบรายการที่สั่ง", icon: ReceiptText }, { href: "/admin", label: "เข้าสู่ระบบ ครูที่ปรึกษา / แอดมิน", icon: LayoutDashboard } ];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [hash, setHash] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true); setLogoutError("");
    try { await api("adminLogout"); window.location.assign("/admin"); }
    catch (e) { setLogoutError((e as Error).message); setLoggingOut(false); }
  }
  useEffect(() => {
    const refresh = () => { void api<{ profile: AdminProfile }>("checkSession").then(r => setProfile(r.profile)).catch(() => setProfile(null)); };
    const hashChange = () => setHash(location.hash);
    refresh(); hashChange();
    window.addEventListener("school-session-changed", refresh); window.addEventListener("hashchange", hashChange);
    return () => { window.removeEventListener("school-session-changed", refresh); window.removeEventListener("hashchange", hashChange); };
  }, [path]);
  useEffect(() => { if (profile?.role === "teacher" && path !== "/admin") router.replace("/admin"); }, [profile, path, router]);
  const adminLinks = [
    { href: "/admin#summary", label: "ภาพรวม", icon: LayoutDashboard },
    { href: "/admin#orders", label: "คำสั่งซื้อ", icon: ReceiptText },
    { href: "/admin#products", label: "สินค้า", icon: Package },
    { href: "/admin#students", label: "จัดการนักเรียน", icon: Users },
    { href: "/admin#teachers", label: "จัดการครูที่ปรึกษา", icon: GraduationCap },
    { href: "/admin#terms", label: "ภาคเรียน / เปิดรับ", icon: CalendarDays }
  ];
  const groups = profile
    ? profile.role !== "teacher"
      ? [{ label: "จัดการระบบ", links: adminLinks }, { label: "สำหรับนักเรียน", links: links.slice(0, 2) }]
      : [{ label: "ห้องที่ปรึกษา", links: [{ ...adminLinks[0], label: "ภาพรวมและสรุปในห้อง" }, { ...adminLinks[1], label: "คำสั่งซื้อในห้อง" }] }]
    : [{ label: "เมนูหลัก", links }];
  const isActive = (href: string) => href.includes("#") ? path + (hash || "#summary") === href : path === href && !hash;
  return <div className="min-h-screen">
    {open && <button className="no-print fixed inset-0 z-30 bg-slate-950/50 lg:hidden" aria-label="ปิดเมนู" onClick={() => setOpen(false)} />}
    <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <Link href={profile?.role === "teacher" ? "/admin" : "/"} onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-white/10 px-6 py-8"><Image src="/school-logo.png" alt="ตราโรงเรียนจอมทอง" width={48} height={48} unoptimized className="rounded-lg bg-white p-1" /><span><strong className="block text-lg">โรงเรียนจอมทอง</strong><span className="text-sm text-slate-400">ระบบสั่งซื้ออุปกรณ์</span></span></Link>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-label="เมนูหลัก">{groups.map(group => <div key={group.label}><p className="px-3 pb-2 text-xs font-semibold text-slate-400">{group.label}</p><div className="space-y-1">{group.links.map(({ href, label, icon: Icon }) => <a key={href} href={href} onClick={() => setOpen(false)} aria-current={isActive(href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium ${isActive(href) ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}><Icon size={20} className="shrink-0" />{label}</a>)}</div></div>)}</nav>
      <div className="mt-auto shrink-0 p-4">
        {profile && <><button type="button" disabled={loggingOut} onClick={logout} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"><LogOut size={18} />{loggingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>{logoutError && <p role="alert" className="mt-2 text-sm text-red-200">{logoutError}</p>}</>}
        <div className="px-2 pt-5 text-sm leading-7 text-slate-400">© 2569 โรงเรียนจอมทอง<br />Chonnatee Boonta</div>
      </div>
    </aside>
    <div className="lg:pl-64"><header className="no-print flex min-h-20 items-center gap-4 border-b border-slate-200 bg-white px-5 sm:px-8"><button aria-label={open ? "ปิดเมนู" : "เปิดเมนู"} aria-expanded={open} onClick={() => setOpen(!open)} className="p-2 lg:hidden">{open ? <X /> : <Menu />}</button><span className="font-semibold">ระบบสั่งซื้ออุปกรณ์การเรียน</span><span className="ml-auto hidden text-sm text-slate-500 sm:block">โรงเรียนจอมทอง</span></header><main className="mx-auto max-w-7xl p-4 sm:p-8">{children}</main></div>
  </div>;
}
