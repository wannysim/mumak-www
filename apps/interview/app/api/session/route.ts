import { createSession, readAuthConfig, sessionCookie, validToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const config = readAuthConfig();
  if (!config) return new Response(null, { status: 503 });
  if (request.headers.get('origin') !== config.origin) return new Response(null, { status: 403 });
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ') || !validToken(header.slice(7), config)) return new Response(null, { status: 401 });
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': sessionCookie(config, createSession(config)), 'Cache-Control': 'no-store' },
  });
}

export async function DELETE(request: Request) {
  const config = readAuthConfig();
  if (!config) return new Response(null, { status: 503 });
  if (request.headers.get('origin') !== config.origin) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': sessionCookie(config, '', 0), 'Cache-Control': 'no-store' },
  });
}
