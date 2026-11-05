import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Токен Instagram в базе хранится зашифрованным AES-256-GCM.
// Ключ — INSTAGRAM_TOKEN_SECRET в Vercel; без него браузер видит только шифротекст.
function key(): Buffer {
  const secret = process.env.INSTAGRAM_TOKEN_SECRET;
  if (!secret) throw new Error("INSTAGRAM_TOKEN_SECRET не задан");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(enc: string): string {
  const [iv, tag, data] = enc.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
