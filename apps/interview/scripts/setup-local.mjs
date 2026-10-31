import { createHash, randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local') || existsSync('.local-access-key')) {
  throw new Error('기존 접속 설정이 있어 중단했습니다. 기존 파일을 확인하세요.');
}
const token = randomBytes(32).toString('base64url');
writeFileSync(
  '.env.local',
  [
    `INTERVIEW_ORIGIN=${process.env.INTERVIEW_ORIGIN || 'http://localhost:3008'}`,
    `INTERVIEW_TOKEN_SHA256=${createHash('sha256').update(token).digest('hex')}`,
    `INTERVIEW_SESSION_SECRET=${randomBytes(32).toString('hex')}`,
    '',
  ].join('\n'),
  { mode: 0o600, flag: 'wx' }
);
writeFileSync('.local-access-key', `${token}\n`, { mode: 0o600, flag: 'wx' });
console.log('로컬 설정 완료. 접속 키는 apps/interview/.local-access-key에 저장했습니다.');
