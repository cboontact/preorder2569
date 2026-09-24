import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
export const metadata: Metadata = {
  title: "ระบบสั่งซื้ออุปกรณ์การเรียน • โรงเรียนจอมทอง",
  description: "สั่งซื้ออุปกรณ์การเรียน ตรวจสอบรายการ และจัดการคำสั่งซื้อ โรงเรียนจอมทอง",
  icons: {
    icon: [{ url: "/school-logo.png", type: "image/png" }],
    shortcut: "/school-logo.png",
    apple: "/school-logo.png"
  },
  robots: { index: false, follow: false }
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body><Shell>{children}</Shell></body></html>;
}
