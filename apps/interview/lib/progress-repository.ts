import { emptyCloudProgress, parseCloudProgress, type ProgressWrite } from '@/lib/cloud-progress';

// One atomic primary operation: a stale device can never overwrite a newer revision.
// The client-generated revision also makes an acknowledgement lost in transit safe to retry.
const WRITE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local revision = ''
if raw then revision = cjson.decode(raw).revision end
if revision == ARGV[2] then return {1, raw} end
if revision ~= ARGV[1] then return {0, raw or ''} end
redis.call('SET', KEYS[1], ARGV[3])
return {1, ARGV[3]}
`;
async function command(parts: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token || new URL(url).protocol !== 'https:') throw new Error('Storage unavailable');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Storage unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('result' in body) || 'error' in body)
    throw new Error('Storage unavailable');
  return body.result;
}
function key() {
  const value = process.env.INTERVIEW_STORE_KEY;
  if (!value || !/^[a-zA-Z0-9:_-]{1,100}$/.test(value)) throw new Error('Storage not configured');
  return value;
}
function decode(value: unknown) {
  if (value === null || value === '') return emptyCloudProgress();
  if (typeof value !== 'string') throw new Error('Invalid stored record');
  return parseCloudProgress(JSON.parse(value));
}
export async function readCloudProgress() {
  // EVAL reads the primary, avoiding a replica returning a stale revision after a save.
  return decode(await command(['EVAL', "return redis.call('GET', KEYS[1])", 1, key()]));
}
export async function writeCloudProgress(write: ProgressWrite) {
  const document = { revision: write.revision, progress: write.progress };
  const result = await command([
    'EVAL',
    WRITE_SCRIPT,
    1,
    key(),
    write.baseRevision ?? '',
    write.revision,
    JSON.stringify(document),
  ]);
  if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]))
    throw new Error('Invalid storage response');
  return { accepted: result[0] === 1, document: decode(result[1]) };
}
