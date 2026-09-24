const iterations = 100_000; // Workers Web Crypto PBKDF2 iteration limit.
const hex = (data: Uint8Array) => Array.from(data, x => x.toString(16).padStart(2, "0")).join("");
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256)));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${hex(salt)}$${await derive(password, salt)}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, rounds, saltHex, expected] = encoded.split("$");
  if (algorithm !== "pbkdf2-sha256" || Number(rounds) !== iterations || !/^[0-9a-f]{32}$/.test(saltHex || "") || !/^[0-9a-f]{64}$/.test(expected || "")) return false;
  const salt = Uint8Array.from(saltHex.match(/../g)!, value => parseInt(value, 16));
  const actual = await derive(password, salt);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
