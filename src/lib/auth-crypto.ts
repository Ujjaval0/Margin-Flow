import crypto from "crypto";
import { promisify } from "util";

const deriveKey = promisify(crypto.pbkdf2);
const PASSWORD_ITERATIONS = 220_000;

/**
 * Hashes a plain-text password using Node.js pbkdf2 with a random salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, PASSWORD_ITERATIONS, 64, "sha512")).toString("hex");
  return `pbkdf2-sha512:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

/**
 * Verifies a plain-text password against a stored salt:hash string.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (typeof password !== "string" || typeof storedHash !== "string") return false;
  const parts = storedHash.split(":");
  // Verify existing hashes only to upgrade them after a successful login.
  const legacy = parts.length === 2;
  if (!legacy && (parts.length !== 4 || parts[0] !== "pbkdf2-sha512")) return false;
  const iterations = legacy ? 1000 : Number(parts[1]);
  const salt = legacy ? parts[0] : parts[2];
  const expectedKey = legacy ? parts[1] : parts[3];
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 1_000_000 ||
      !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(expectedKey)) return false;
  const actual = await deriveKey(password, salt, iterations, 64, "sha512");
  return crypto.timingSafeEqual(actual, Buffer.from(expectedKey, "hex"));
}
