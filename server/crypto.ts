// Provider API keys are encrypted at rest with AES-256-GCM using a server-only key
// (env CREDENTIALS_ENCRYPTION_KEY: 32 random bytes, base64). Replaces Supabase Vault.
//
// Ciphertext format: "v1:<iv base64>:<ciphertext+16-byte tag base64>". The owner's user id is bound
// as additional authenticated data, so a ciphertext copied onto another user's row will not decrypt.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

export class EncryptionKeyError extends Error {}

export function loadKey(raw: string | undefined = process.env.CREDENTIALS_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new EncryptionKeyError("CREDENTIALS_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) throw new EncryptionKeyError("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (base64)");
  return key;
}

const aad = (userId: string) => Buffer.from(`tokeny:credential:${userId}`, "utf8");

export function encryptSecret(plain: string, userId: string, key: Buffer = loadKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(userId));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}:${iv.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(payload: string, userId: string, key: Buffer = loadKey()): string {
  const [v, ivB64, ctB64] = payload.split(":");
  if (v !== VERSION || !ivB64 || !ctB64) throw new Error("Unsupported ciphertext format");
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(ctB64, "base64");
  if (iv.length !== 12 || data.length < 17) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad(userId));
  decipher.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8");
}
