import { cookies } from 'next/headers';

import { AccessGate } from '@/components/access-gate';
import { PracticeApp } from '@/components/practice-app';
import { readAuthConfig, validSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const config = readAuthConfig();
  const jar = await cookies();
  const sessions = config ? jar.getAll(config.cookieName) : [];
  if (!config || sessions.length !== 1 || !validSession(sessions[0]?.value, config))
    return <AccessGate configured={!!config} />;
  return <PracticeApp />;
}
