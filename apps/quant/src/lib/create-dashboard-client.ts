import { createClient } from '@supabase/supabase-js';

import type { DashboardClient } from '@/lib/dashboard-client';
import { SupabaseOperationsClient, type SupabaseOperationsLike } from '@/lib/operations-client';
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
  return new SupabaseDashboardClient(
    supabase as unknown as SupabaseLike,
    redirectOrigin,
    new SupabaseOperationsClient(supabase as unknown as SupabaseOperationsLike)
  );
}

export { createDashboardClient, type PublicEnvironment };
