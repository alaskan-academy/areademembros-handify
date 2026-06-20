import { createClient } from "@supabase/supabase-js";

// Cliente com service_role — NUNCA expor no client, usar apenas em Server Actions/API routes
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
