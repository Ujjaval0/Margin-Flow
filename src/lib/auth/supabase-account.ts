import type { User } from "@supabase/supabase-js";
import { query } from "@/lib/db";
import type { AccountType } from "@/domain/types";

const ACCOUNT_TYPES: AccountType[] = ["BRAND_OWNER", "SUPPLIER", "WHOLESALER"];

function getAccountType(value: unknown): AccountType {
  return typeof value === "string" && ACCOUNT_TYPES.includes(value as AccountType)
    ? (value as AccountType)
    : "BRAND_OWNER";
}

function getDisplayName(user: User): string {
  const metadata = user.user_metadata || {};
  const name = metadata.full_name || metadata.name || metadata.display_name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : "MarginFlow User";
}

export async function ensureMarginFlowAccount(user: User, preferredAccountType?: unknown) {
  const authUserId = user.id;
  const email = user.email?.trim().toLowerCase();

  if (!email || !user.email_confirmed_at) {
    throw new Error("A confirmed Supabase email is required to create a MarginFlow account.");
  }

  const mapped = await query(
    `SELECT id, auth_user_id, name, email, account_type, company_name, created_at
     FROM user_accounts
     WHERE auth_user_id = $1
     LIMIT 1`,
    [authUserId]
  );
  if (mapped.rows.length) {
    const account = mapped.rows[0];
    if (String(account.email).toLowerCase() !== email) {
      const updated = await query(
        `UPDATE user_accounts
         SET email = $1, updated_at = NOW()
         WHERE auth_user_id = $2
         RETURNING id, auth_user_id, name, email, account_type, company_name, created_at`,
        [email, authUserId]
      );
      if (updated.rows.length) return { account: updated.rows[0], isNewUser: false };
    }
    return { account, isNewUser: false };
  }

  // Link an existing MarginFlow account only after Supabase has verified the same email.
  const existing = await query(
    `SELECT id FROM user_accounts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  if (existing.rows.length) {
    const linked = await query(
      `UPDATE user_accounts
       SET auth_user_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, auth_user_id, name, email, account_type, company_name, created_at`,
      [authUserId, existing.rows[0].id]
    );
    if (linked.rows.length) return { account: linked.rows[0], isNewUser: false };
  }

  const created = await query(
    `INSERT INTO user_accounts (auth_user_id, name, email, account_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, auth_user_id, name, email, account_type, company_name, created_at`,
    [authUserId, getDisplayName(user), email, getAccountType(preferredAccountType ?? user.user_metadata?.accountType)]
  );
  return { account: created.rows[0], isNewUser: true };
}
