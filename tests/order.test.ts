import { test } from "node:test";
import assert from "node:assert/strict";
import { priceOrder } from "../lib/order";
import type { Product } from "../lib/types";
const products: Product[] = [{ product_id: 1, name: "สมุด", price: 20, active: 1, category: "เครื่องเขียน" }, { product_id: 2, name: "ปากกา", price: 7, active: 0, category: "เครื่องเขียน" }];
test("uses database prices and names even when the client supplies forged values", () => {
  const item = { product_id: 1, quantity: 13, price: 0.01, product_name: "forged" };
  const result = priceOrder([item], products, 260);
  assert.equal(result.total, 260); assert.equal(result.lines[0].product_name, "สมุด"); assert.equal(result.lines[0].price, 20);
});
test("rejects over-budget, inactive, missing, duplicate, empty and invalid quantities", () => {
  for (const items of [[], [{ product_id: 1, quantity: 14 }], [{ product_id: 2, quantity: 1 }], [{ product_id: 99, quantity: 1 }], [{ product_id: 1, quantity: 1 }, { product_id: 1, quantity: 1 }], ...[0, -1, 1.5, Infinity, NaN, 1000].map(quantity => [{ product_id: 1, quantity }])]) assert.throws(() => priceOrder(items, products, 260));
});
test("calculates currency in satang without floating point over-budget errors", () => {
  assert.equal(priceOrder([{ product_id: 1, quantity: 3 }], [{ ...products[0], price: 0.1 }], 0.3).total, 0.3);
});
