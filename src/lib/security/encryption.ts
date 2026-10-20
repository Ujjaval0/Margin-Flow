import crypto from "crypto";

/**
 * Server-Side Cryptographic Vault
 * Enforces zero-trust AES-256-GCM encryption for marketplace tokens and merchant secrets.
 *
 * INVARIANT: This module MUST NEVER execute in a client/browser environment.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: encryption.ts was imported into a client-side bundle. Cryptographic keys and decryption routines must remain strictly server-side."
  );
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit initialization vector recommended by NIST SP 800-38D
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag

/**
 * Derives a deterministic 256-bit (32-byte) key buffer.
 * Strictly prohibits hardcoded static fallbacks in production.
 */
function getMasterKey(): Buffer {
  const envKey = process.env.ENCRYPTION_MASTER_KEY;
  if (envKey && /^[0-9a-fA-F]{64}$/.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  if (envKey && envKey.trim().length >= 16) {
    return crypto.createHash("sha256").update(envKey.trim()).digest();
  }

  throw new Error("ENCRYPTION_MASTER_KEY must be configured with a stable server-only key before saving store credentials.");
}

/**
 * Encrypts arbitrary credential dictionary using AES-256-GCM authenticated cipher.
 * Returns a serialized string format: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export function encryptPayload(data: Record<string, any>): string {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid payload: data must be a non-null object.");
  }
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext blob, verifying the 128-bit MAC tag.
 * Throws an error if the payload was tampered with or corrupted.
 */
export function decryptPayload<T = Record<string, any>>(encryptedBlob: string): T {
  if (!encryptedBlob || typeof encryptedBlob !== "string") {
    throw new Error("Invalid encrypted blob: expected non-empty string.");
  }

  const parts = encryptedBlob.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted blob: expected 'iv:authTag:ciphertext'.");
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Corrupted cryptographic envelope lengths.");
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
