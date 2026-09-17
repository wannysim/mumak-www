import { ImageUploadError } from '@/src/entities/image/image-upload';
import { createR2Uploader, R2UploadError } from '@/src/entities/image/r2-upload';
import { readAdminAuthConfig } from '@/src/shared/lib/admin-auth-config';
import { createR2Store } from '@/src/shared/lib/r2-store';
import { authorizeUploadRequest } from '@/src/shared/lib/upload-request';

export async function handleR2Upload(request: Request, operation: 'issue' | 'publish') {
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const config = readAdminAuthConfig();
    const authorization = authorizeUploadRequest(request, config);
    if (!authorization.authorized)
      return json(
        { error: '로그인이 만료되었습니다. 다시 로그인하세요.', code: authorization.code },
        authorization.status
      );
    if (request.headers.get('content-type')?.split(';', 1)[0] !== 'application/json')
      return json({ error: 'JSON 요청이 필요합니다.' }, 415);
    const reader = request.body?.getReader();
    if (!reader) throw new R2UploadError('invalid_upload');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024) throw new R2UploadError('invalid_upload');
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof body !== 'object' || body === null) throw new R2UploadError('invalid_upload');
    const uploader = createR2Uploader(createR2Store());
    if (operation === 'issue') {
      if (!('bytes' in body) || typeof body.bytes !== 'number') throw new R2UploadError('invalid_upload');
      return json(await uploader.issue(body.bytes), 201);
    }
    if (!('ticketId' in body) || typeof body.ticketId !== 'string') throw new R2UploadError('invalid_ticket');
    const result = await uploader.publish(body.ticketId);
    return json(result, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof R2UploadError) {
      const messages = {
        daily_limit: '오늘의 업로드 제한(20회)에 도달했습니다. 내일 다시 시도하세요.',
        storage_limit: '안전한 저장량 한도에 도달했습니다. 저장량을 점검해야 합니다.',
        upload_busy: '다른 업로드를 처리 중입니다. 잠시 후 다시 시도하세요.',
        invalid_ticket: '업로드 요청이 만료되었거나 유효하지 않습니다. 다시 업로드하세요.',
        invalid_upload: '32 MiB 이하의 이미지 파일로 다시 업로드하세요.',
      };
      return json(
        { error: messages[error.code], code: error.code },
        error.code === 'storage_limit' ? 507 : ['daily_limit', 'upload_busy'].includes(error.code) ? 429 : 400
      );
    }
    if (error instanceof SyntaxError) return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
    const code = error instanceof ImageUploadError ? error.code : 'storage_failure';
    console.error(JSON.stringify({ event: 'r2-upload', operation, code }));
    const message =
      code === 'animated_image'
        ? '움직이는 이미지는 지원하지 않습니다. 정적 이미지로 다시 업로드하세요.'
        : ['invalid_image', 'unsupported_media_type', 'pixel_limit_exceeded', 'payload_too_large'].includes(code)
          ? '32 MiB, 50 MP 이하의 JPEG·PNG·WebP·AVIF·정적 GIF 파일이 필요합니다.'
          : // 재시도가 상태를 더 망가뜨리는 코드는 재시도를 권하지 않는다. runbook 대조가 필요하다.
            ['collision', 'corruption'].includes(code)
            ? '저장된 이미지와 일치하지 않는 상태를 발견했습니다. 다시 시도하지 말고 저장소를 확인해야 합니다.'
            : '이미지 발행을 완료하지 못했습니다. 잠시 후 다시 업로드하세요.';
    const status =
      code === 'public_verification_failed'
        ? 503
        : code === 'upload_busy'
          ? 429
          : ['collision', 'corruption', 'storage_failure', 'invalid_configuration'].includes(code)
            ? 500
            : 422;
    return json({ error: message, code }, status);
  }
}
