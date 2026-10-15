import crypto from "crypto";
import { query } from "../db";

if (typeof window !== "undefined") throw new Error("OAuth state is server-only.");
export interface OAuthBinding { clientId: string; redirectUri: string }

export async function createOAuthState(
  userId: string, marketplace: string, ttlMs = 10 * 60 * 1000, binding?: OAuthBinding,
): Promise<string> {
  if (!userId || !binding?.clientId || !binding.redirectUri) throw new Error("OAuth transaction binding is required.");
  const state = crypto.randomBytes(32).toString("hex");
  await query(
    `INSERT INTO oauth_states (state, user_id, marketplace, expires_at, client_id, redirect_uri)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [state, userId, marketplace, new Date(Date.now() + ttlMs), binding.clientId, binding.redirectUri],
  );
  return state;
}

export async function verifyAndConsumeOAuthState(
  state: string, marketplace: string, userId?: string | null, binding?: OAuthBinding,
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!/^[a-f0-9]{64}$/.test(state) || !userId || !binding?.clientId || !binding.redirectUri) {
    return { valid: false, error: "Missing OAuth transaction binding." };
  }
  // Atomic single-use consumption across replicas. Wrong bindings cannot consume state.
  const result = await query(
    `DELETE FROM oauth_states WHERE state = $1 AND marketplace = $2 AND user_id = $3
       AND client_id = $4 AND redirect_uri = $5 AND expires_at > NOW()
     RETURNING user_id`,
    [state, marketplace, userId, binding.clientId, binding.redirectUri],
  );
  return result.rows.length === 1 ? { valid: true, userId: result.rows[0].user_id }
    : { valid: false, error: "Invalid, expired, or already consumed OAuth state." };
}
