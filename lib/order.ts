import type { Product } from "./types";
export function priceOrder(items: { product_id: number; quantity: number }[], products: Product[], budget: number) {
  if (!items.length || items.length > 100) throw new Error("กรุณาเลือกอุปกรณ์ 1–100 รายการ");
  const ids = new Set<number>();
  const lines = items.map(item => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || ids.has(item.product_id)) throw new Error("จำนวนอุปกรณ์ไม่ถูกต้องหรือมีรายการซ้ำ");
    ids.add(item.product_id);
    const product = products.find(p => p.product_id === item.product_id && p.active === 1);
    if (!product) throw new Error("อุปกรณ์บางรายการไม่เปิดจำหน่าย กรุณาเลือกใหม่");
    return { product_id: product.product_id, product_name: product.name, price: product.price, quantity: item.quantity };
  });
  const cents = lines.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
  if (cents > Math.round(budget * 100)) throw new Error(`ยอดสั่งซื้อเกินงบประมาณ ${budget} บาท กรุณาลดรายการ`);
  return { lines, total: cents / 100 };
}
