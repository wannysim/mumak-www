import { createHash, timingSafeEqual } from 'node:crypto';
import { isAbsolute, normalize, parse } from 'node:path';

type UploadRuntimeConfig = {
  expectedOrigin: string;
  tokenHash: Buffer;
  storageRoot: string;
  minFreeBytes: number;
  timeoutMs: number;
};

type AuthorizationResult =
  | { authorized: true }
  | { authorized: false; status: 401 | 403; code: 'invalid-origin' | 'unauthorized' };

type Environment = Readonly<Record<string, string | undefined>>;

function required(env: Environment, name: string) {
  const value = env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function positiveInteger(env: Environment, name: string) {
  const value = required(env, name);
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`Invalid ${name}`);

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${name}`);
  return parsed;
}

function readUploadRuntimeConfig(env: Environment = process.env): UploadRuntimeConfig {
  const expectedOrigin = required(env, 'MEDIA_ADMIN_ORIGIN');
  const originUrl = new URL(expectedOrigin);
  const isLocalHttp =
    originUrl.protocol === 'http:' && (originUrl.hostname === 'localhost' || originUrl.hostname.endsWith('.localhost'));
  if (originUrl.origin !== expectedOrigin || (originUrl.protocol !== 'https:' && !isLocalHttp)) {
    throw new Error('Invalid MEDIA_ADMIN_ORIGIN');
  }

  const tokenHashHex = required(env, 'MEDIA_ADMIN_TOKEN_SHA256');
  if (!/^[0-9a-f]{64}$/.test(tokenHashHex)) throw new Error('Invalid MEDIA_ADMIN_TOKEN_SHA256');

  const configuredRoot = required(env, 'MEDIA_ROOT');
  const storageRoot = normalize(configuredRoot);
  if (!isAbsolute(storageRoot) || storageRoot === parse(storageRoot).root) {
    throw new Error('Invalid MEDIA_ROOT');
  }

  return {
    expectedOrigin,
    tokenHash: Buffer.from(tokenHashHex, 'hex'),
    storageRoot,
    minFreeBytes: positiveInteger(env, 'MEDIA_MIN_FREE_BYTES'),
    timeoutMs: positiveInteger(env, 'MEDIA_UPLOAD_TIMEOUT_MS'),
  };
}

function authorizeUploadRequest(
  request: Pick<Request, 'headers'>,
  config: Pick<UploadRuntimeConfig, 'expectedOrigin' | 'tokenHash'>
): AuthorizationResult {
  if (request.headers.get('origin') !== config.expectedOrigin) {
    return { authorized: false, status: 403, code: 'invalid-origin' };
  }

  const authorization = request.headers.get('authorization');
  if (!authorization || authorization.length > 519 || !authorization.startsWith('Bearer ')) {
    return { authorized: false, status: 401, code: 'unauthorized' };
  }

  const token = authorization.slice(7);
  if (!token || /\s/.test(token)) {
    return { authorized: false, status: 401, code: 'unauthorized' };
  }

  const suppliedHash = createHash('sha256').update(token, 'utf8').digest();
  return timingSafeEqual(suppliedHash, config.tokenHash)
    ? { authorized: true }
    : { authorized: false, status: 401, code: 'unauthorized' };
}

export { authorizeUploadRequest, readUploadRuntimeConfig };
export type { AuthorizationResult, UploadRuntimeConfig };
