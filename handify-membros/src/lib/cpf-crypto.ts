import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const key = process.env.CERTIFICATE_ENCRYPTION_KEY;
  if (!key) throw new Error("CERTIFICATE_ENCRYPTION_KEY nao configurada");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("CERTIFICATE_ENCRYPTION_KEY deve ter 32 bytes (base64 de 44 chars)");
  return buf;
}

export function encryptCpf(cpf: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(cpf, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptCpf(encryptedBase64: string): string {
  const key = getKey();
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
