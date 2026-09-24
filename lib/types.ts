export interface Product { product_id: number; name: string; price: number; category: string; active: number; }
export interface AdvisorRoom { grade: string; room: string; }
export interface AdminProfile { username: string; full_name: string; role: "superadmin" | "teacher"; advisor_grade: string; advisor_room: string; advisor_rooms: AdvisorRoom[]; }
export interface Teacher extends AdminProfile { active: number; }
export interface Term { term_id: string; academic_year: number | null; semester: number | null; opens_at: string | null; closes_at: string | null; enabled: number; is_current: number; announcement: string; }
export interface OrderingPeriod extends Term { status: "open" | "paused" | "scheduled" | "closed"; server_now: string; }
export interface Student { student_number: number; student_id: string; prefix: string; first_name: string; last_name: string; level: string; grade: string; room: string; budget: number; term_id: string; has_ordered: boolean; order_id?: string; }
export interface OrderItem { item_id: number; order_id: string; product_id: number; product_name: string; price: number; quantity: number; }
export interface Order { student_number: number | null; advisor_names: string[]; order_id: string; term_id: string; term_label: string; student_id: string; student_name: string; grade: string; room: string; budget: number; total_amount: number; extra_amount: number; order_date: string; unused_budget_acknowledged: number; unused_budget_acknowledged_at: string | null; items: OrderItem[]; }
export interface Summary { totalOrders: number; totalRevenue: number; totalBudget: number; totalExtra: number; totalStudents: number; byRoom: { grade: string; room: string; totalStudents: number; pending: number; count: number; total: number; budget: number; extra: number }[]; productSummary: { name: string; qty: number; total: number }[]; }
export const money = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);
export const fullName = (s: Student) => `${s.prefix || ""}${s.first_name} ${s.last_name}`;
export const orderNumber = (id: string) => {
  const uuid = /^ORD-([0-9a-f]{8})-[0-9a-f-]{27}$/i.exec(id);
  return uuid ? `ORD-${uuid[1].toUpperCase()}` : id.toUpperCase();
};
