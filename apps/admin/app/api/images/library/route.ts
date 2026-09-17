import { readAdminAuthConfig } from '@/src/shared/lib/admin-auth-config';
import { hasValidSession } from '@/src/shared/lib/admin-session';
import { createR2Store } from '@/src/shared/lib/r2-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  try {
    const config = readAdminAuthConfig();
    const origin = request.headers.get('origin');
    if ((origin && origin !== config.expectedOrigin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      return json({ error: '허용되지 않은 요청입니다.' }, 403);
    }
    if (!hasValidSession(request.headers, config)) return json({ error: '다시 로그인하세요.' }, 401);
    const params = new URL(request.url).searchParams;
    const cursor = params.get('cursor') ?? undefined;
    if (
      [...params.keys()].some(key => key !== 'cursor') ||
      (cursor !== undefined && (!cursor || cursor.length > 4096))
    ) {
      return json({ error: '목록 요청이 올바르지 않습니다.' }, 400);
    }
    const page = await createR2Store().listImages(cursor);
    return json({
      files: page.objects
        .filter(object => /^blog\/[0-9a-f]{64}\/content-v1\/image\.(jpg|webp)$/.test(object.key))
        .map(object => ({ ...object, url: `https://img.wannysim.com/${object.key}` })),
      cursor: page.cursor,
    });
  } catch {
    return json({ error: '이미지 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.' }, 503);
  }
}
