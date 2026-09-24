"use client";
import { useEffect, useState } from "react";
import { api } from "./client";
import { periodStatus } from "./terms";
import type { OrderingPeriod } from "./types";
export function useOrderingPeriod() {
  const [period,setPeriod] = useState<OrderingPeriod | null>(null);
  const [error,setError] = useState("");
  const [open,setOpen] = useState(false);
  useEffect(()=>{
    let alive = true;
    let latest: OrderingPeriod | null = null;
    let offset = 0;
    const updateStatus = () => {
      if (alive) setOpen(!!latest && periodStatus(latest, Date.now() + offset) === "open");
    };
    const refresh = async () => {
      try {
        const value = await api<OrderingPeriod>("getOrderingPeriod");
        if (!alive) return;
        latest = value; offset = Date.parse(value.server_now) - Date.now();
        setPeriod(value); setError(""); updateStatus();
      } catch {
        if (alive) setError("ไม่สามารถตรวจสอบช่วงรับคำสั่งซื้อได้ กรุณารอสักครู่หรือลองโหลดหน้าใหม่");
      }
    };
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") { updateStatus(); void refresh(); }
    };
    void refresh();
    const interval = setInterval(visibleRefresh, 30_000);
    // React skips updates when this boolean stays unchanged, avoiding a full-page render each second.
    const clockTimer = setInterval(() => {
      if (document.visibilityState === "visible") updateStatus();
    }, 1000);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      alive = false; clearInterval(interval); clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", visibleRefresh);
    };
  },[]);
  return { period, error, canOrder: !!period && !error && open };
}
