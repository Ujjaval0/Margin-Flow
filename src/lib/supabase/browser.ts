import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "./config";

export function createSupabaseBrowserClient() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient(url, key);
}
