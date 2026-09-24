/// <reference types="@cloudflare/workers-types" />
interface CloudflareEnv {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_FULL_NAME: string;
  ADMIN_ROLE: "superadmin";
  ADVISOR_GRADE: string;
  ADVISOR_ROOM: string;
  BUDGET_LOWER: string;
  BUDGET_UPPER: string;
}
