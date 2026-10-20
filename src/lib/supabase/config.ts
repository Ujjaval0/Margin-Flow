export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Sign-in is temporarily unavailable. Please contact support.");
    this.name = "SupabaseConfigurationError";
  }
}

/** Both values are public project configuration; never substitute a server secret key. */
export function supabasePublicConfig() {
  // Keep explicit NEXT_PUBLIC references so Next.js can inline browser configuration.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  let privateKey = key?.startsWith("sb_secret_");
  try {
    const encoded = key?.split(".")[1];
    if (encoded) privateKey ||= JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role";
  } catch { /* SDK validates malformed public credentials; never log key contents. */ }
  if (!url || !key || privateKey) throw new SupabaseConfigurationError();
  return { url, key };
}
