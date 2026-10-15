import "server-only";

import { createClient } from "@supabase/supabase-js";

// Optional trusted backend client. Never import from clinic/client workflows.
export function createOperationsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_OPERATIONS_KEY;
  if (!url || !key) throw new Error("Operations backend is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
