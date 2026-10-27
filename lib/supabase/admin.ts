import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Alleen voor app/api/auth/reset/route.ts. Nergens anders gebruiken — zie de rollenprompt en
// de livegangprompt: de secret key mag nooit naar de browser en nooit via NEXT_PUBLIC_*.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
