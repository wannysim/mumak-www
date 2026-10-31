import { cookies } from 'next/headers';

import { readAuthConfig, validSession } from '@/lib/auth';
import { parseProgressWrite } from '@/lib/cloud-progress';
import { MAX_BACKUP_BYTES } from '@/lib/progress';
import { readCloudProgress, writeCloudProgress } from '@/lib/progress-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
async function authorize(request: Request) {
  const config = readAuthConfig();
  if (!config) return 503;
  const sessions = (await cookies()).getAll(config.cookieName);
  if (sessions.length !== 1 || !validSession(sessions[0]?.value, config)) return 401;
  if (request.method !== 'GET' && request.headers.get('origin') !== config.origin) return 403;
  return 200;
}
export async function GET(request: Request) {
  const status = await authorize(request);
  if (status !== 200) return json({ error: 'unavailable' }, status);
  try {
    return json(await readCloudProgress());
  } catch {
    return json({ error: 'storage_unavailable' }, 503);
  }
}
export async function PUT(request: Request) {
  const status = await authorize(request);
  if (status !== 200) return json({ error: 'unavailable' }, status);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'invalid' }, 415);
  let write;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BACKUP_BYTES + 512) {
        await reader.cancel();
        return json({ error: 'too_large' }, 413);
      }
      chunks.push(value);
    }
    write = parseProgressWrite(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  try {
    const result = await writeCloudProgress(write);
    return json(result.document, result.accepted ? 200 : 409);
  } catch {
    return json({ error: 'storage_unavailable' }, 503);
  }
}
