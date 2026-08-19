import { randomUUID } from 'node:crypto';

import { ImageUploadError, processImageUpload } from '@/src/entities/image/image-upload';
import { authorizeUploadRequest, readUploadRuntimeConfig } from '@/src/shared/lib/upload-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ERROR_STATUS = {
  collision: 500,
  corruption: 500,
  insufficient_storage: 507,
  invalid_configuration: 500,
  invalid_image: 422,
  missing_body: 422,
  payload_too_large: 413,
  pixel_limit_exceeded: 413,
  public_verification_failed: 503,
  storage_failure: 500,
  unsupported_media_type: 415,
  upload_aborted: 499,
  upload_busy: 429,
  upload_timeout: 408,
} as const;

const PUBLIC_MESSAGES = {
  collision: '이미지 식별자 충돌을 확인해야 합니다.',
  corruption: '저장된 이미지 무결성을 확인해야 합니다.',
  insufficient_storage: '이미지를 안전하게 저장할 공간이 부족합니다.',
  invalid_configuration: '서버 설정을 확인해야 합니다.',
  invalid_image: '손상되었거나 지원하지 않는 JPEG입니다.',
  missing_body: 'JPEG 파일이 필요합니다.',
  payload_too_large: '파일이 32 MiB 제한을 넘었습니다.',
  pixel_limit_exceeded: '이미지가 50 MP 제한을 넘었습니다.',
  public_verification_failed: '발행 후 공개 URL을 검증하지 못했습니다.',
  storage_failure: '이미지를 저장하지 못했습니다.',
  unsupported_media_type: 'JPEG 파일만 업로드할 수 있습니다.',
  upload_aborted: '업로드 연결이 종료되었습니다.',
  upload_busy: '다른 이미지를 처리 중입니다. 잠시 후 다시 시도하세요.',
  upload_timeout: '업로드 제한 시간을 넘었습니다.',
} as const;

function json(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = performance.now();

  try {
    const config = readUploadRuntimeConfig();
    const authorization = authorizeUploadRequest(request, config);
    if (!authorization.authorized) {
      logResult({ requestId, result: authorization.code, startedAt });
      return json({ error: '요청을 인증하지 못했습니다.', code: authorization.code }, authorization.status);
    }

    if (request.headers.get('content-type')?.split(';', 1)[0] !== 'application/octet-stream') {
      logResult({ requestId, result: 'unsupported_media_type', startedAt });
      return json({ error: PUBLIC_MESSAGES.unsupported_media_type, code: 'unsupported_media_type' }, 415);
    }

    const result = await processImageUpload({
      body: request.body,
      signal: request.signal,
      storageRoot: config.storageRoot,
      minFreeBytes: config.minFreeBytes,
      limits: { timeoutMs: config.timeoutMs },
    });

    logResult({
      requestId,
      result: result.duplicate ? 'duplicate' : 'published',
      assetId: result.assetId,
      bytes: result.bytes,
      dimensions: { width: result.width, height: result.height },
      startedAt,
    });
    return json(result, result.duplicate ? 200 : 201);
  } catch (error) {
    const uploadError =
      error instanceof ImageUploadError ? error : new ImageUploadError('invalid_configuration', error);
    const status = ERROR_STATUS[uploadError.code];

    logResult({ requestId, result: uploadError.code, startedAt });
    return json(
      { error: PUBLIC_MESSAGES[uploadError.code], code: uploadError.code },
      status,
      uploadError.code === 'upload_busy' ? { 'Retry-After': '5' } : undefined
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
}

function logResult({
  requestId,
  result,
  assetId,
  bytes,
  dimensions,
  startedAt,
}: {
  requestId: string;
  result: string;
  assetId?: string;
  bytes?: { source: number; jpeg: number; webp: number };
  dimensions?: { width: number; height: number };
  startedAt: number;
}) {
  console.info(
    JSON.stringify({
      event: 'image-upload',
      requestId,
      result,
      ...(assetId ? { assetId } : {}),
      ...(bytes ? { bytes } : {}),
      ...(dimensions ? { dimensions } : {}),
      durationMs: Math.round(performance.now() - startedAt),
    })
  );
}
