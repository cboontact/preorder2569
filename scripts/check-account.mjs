import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const expectedEmail = "doitgict@chomthong.ac.th";
const expectedAccount = "b20270559daf6d8d48c3a649fd13ad32";
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const result = execFileSync("npx", ["wrangler", "whoami"], { encoding: "utf8" });
if (!result.toLowerCase().includes(`email ${expectedEmail}`) || !result.includes(expectedAccount) || config.account_id !== expectedAccount || process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== expectedAccount) {
  throw new Error(`Deploy blocked: log in to Cloudflare as ${expectedEmail} and use the verified account ID.`);
}
if (config.d1_databases.some(db => db.database_id === "00000000-0000-0000-0000-000000000000")) throw new Error("Create the D1 database and set database_id before deploying.");
console.log(`Verified Cloudflare account: ${expectedEmail}`);
