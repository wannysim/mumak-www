import { createClient } from '@supabase/supabase-js';

import type { DashboardClient } from '@/lib/dashboard-client';
import { publicConfiguration, type PublicEnvironment } from '@/lib/public-configuration';
import { SupabaseDashboardClient, type SupabaseLike } from '@/lib/supabase-dashboard-client';

function createDashboardClient(environment: PublicEnvironment, redirectOrigin: string): DashboardClient | null {
  const config = publicConfiguration(environment);
  if (!config) return null;
  const { url, anonKey } = config;

  const supabase = createClient(url, anonKey, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return new SupabaseDashboardClient(supabase as unknown as SupabaseLike, redirectOrigin);
}

export { createDashboardClient, type PublicEnvironment };
