// Share only concurrent reads; never retain completed results or share mutations.
const readActions = new Set([
  "checkSession", "getTerms", "getOrderingPeriod", "getProducts", "getStudentById",
  "getStudentOrder", "adminGetSummary", "adminGetOrders", "adminGetAllProducts",
  "adminGetStudentClasses", "adminGetStudents", "adminGetTeachers"
]);
const pendingReads = new Map<string, Promise<unknown>>();
export function api<T>(action: string, ...args: unknown[]): Promise<T> {
  const body = JSON.stringify({ action, args });
  const read = readActions.has(action);
  if (read) {
    const pending = pendingReads.get(body);
    if (pending) return pending as Promise<T>;
  } else {
    // Reads started before a mutation must not be reused afterward.
    pendingReads.clear();
  }
  const request = (async () => {
    try {
      const response = await fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const result = await response.json() as { success: boolean; data: T; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถทำรายการได้ กรุณาลองใหม่");
      return result.data;
    } finally {
      if (!read) pendingReads.clear();
    }
  })();
  if (!read) return request;
  const tracked = request.finally(() => {
    if (pendingReads.get(body) === tracked) pendingReads.delete(body);
  });
  pendingReads.set(body, tracked);
  return tracked;
}
