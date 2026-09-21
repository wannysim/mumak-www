type PublicEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

// Exposure guard only: Supabase, not this decoder, authenticates signed JWTs.
function isPublicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const decoded: unknown = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded === 'object' && decoded !== null && 'role' in decoded && decoded.role === 'anon';
  } catch {
    return false;
  }
}

function publicConfiguration(environment: PublicEnvironment) {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const anonKey = environment.VITE_SUPABASE_ANON_KEY?.trim();
  if (anonKey && !isPublicKey(anonKey)) {
    throw new Error('Only an anon/publishable key may enter the public build.');
  }
  if (!url || !anonKey) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !isPublicKey(anonKey)) {
    throw new Error(
      'Expected a Supabase project HTTPS URL and an anon/publishable key; privileged keys are forbidden.'
    );
  }
  return { url, anonKey };
}

export { publicConfiguration, type PublicEnvironment };
