import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export const hmacHex = (key: string, data: string | Buffer) =>
  createHmac("sha256", key).update(data).digest("hex");

export const hmacBase64Url = (key: string, data: string) =>
  createHmac("sha256", key).update(data).digest("base64url");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Comparación en tiempo constante de dos strings. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
