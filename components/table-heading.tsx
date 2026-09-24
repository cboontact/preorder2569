import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faCalendarDays, faChalkboardUser, faCircleCheck, faClock, faCoins, faFileInvoice, faGear, faHashtag, faIdCard, faList, faSchool, faTag, faTags, faUser, faUserGraduate, faUserShield } from "@fortawesome/free-solid-svg-icons";

const headerIcons = {
  "ลำดับ": faHashtag,
  "เลขที่": faHashtag,
  "ชั้น / ห้อง": faSchool,
  "สั่งซื้อแล้ว": faCircleCheck,
  "ยังไม่สั่งซื้อ": faClock,
  "ยอดรวม (บาท)": faCoins,
  "อุปกรณ์": faBoxOpen,
  "จำนวน": faHashtag,
  "รวม (บาท)": faCoins,
  "เลขที่ / วันที่": faFileInvoice,
  "นักเรียน": faUserGraduate,
  "ชั้น": faSchool,
  "ยอดรวม": faCoins,
  "จัดการ": faGear,
  "ชื่ออุปกรณ์": faBoxOpen,
  "หมวดหมู่": faTags,
  "ราคา (บาท)": faTag,
  "สถานะ": faCircleCheck,
  "เลขประจำตัว": faIdCard,
  "ชื่อ–นามสกุล": faUser,
  "ใบสั่งซื้อ": faFileInvoice,
  "ครู / ชื่อผู้ใช้": faChalkboardUser,
  "ห้องที่ปรึกษา": faSchool,
  "สิทธิ์": faUserShield,
  "รายการ": faList,
  "ราคา": faTag,
  "ภาคเรียน": faCalendarDays,
  "ช่วงเวลาเปิด–ปิด": faClock,
};

export function TableHeading({ label }: { label: keyof typeof headerIcons }) {
  return <th scope="col" title={label === "ลำดับ" ? label : undefined}><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={headerIcons[label]} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className={label === "ลำดับ" ? "sr-only" : undefined}>{label}</span></span></th>;
}
