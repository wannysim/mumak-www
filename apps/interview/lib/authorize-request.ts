import { cookies } from 'next/headers';

import { readAuthConfig, validSession } from '@/lib/auth';

export async function authorizeRequest(request: Request) {
  const config = readAuthConfig();
  if (!config) return 503;
  const sessions = (await cookies()).getAll(config.cookieName);
  if (sessions.length !== 1 || !validSession(sessions[0]?.value, config)) return 401;
  if (request.method !== 'GET' && request.headers.get('origin') !== config.origin) return 403;
  return 200;
}
