import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function createClient() {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build/SSR without env vars, return a placeholder that will be replaced on client
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === "undefined") {
      // SSR/build time - return a mock that won't be used
      return null as unknown as SupabaseClient;
    }
    console.error("Supabase environment variables are not set");
    throw new Error("Supabase URL and API key are required");
  }

  cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}
