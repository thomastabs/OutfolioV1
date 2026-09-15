import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // Keep module importable in tests; runtime calls fail loudly if env is absent.
}

export const supabaseAdmin = createClient(supabaseUrl ?? 'http://localhost', serviceRoleKey ?? 'missing-service-role-key', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
