import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const LYRICS_PAYLOAD_EXTENSIONS = new Set(['.ass', '.json', '.lrc', '.srt', '.txt', '.vtt', '.yaml', '.yml']);
const ALLOWED_LICENSE_NOTICES = new Set(['licenses/noto-serif-jp-ofl.txt', 'licenses/pretendard-ofl.txt']);

export function filesRecursively(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(entryPath) : [entryPath];
  });
}

function isLicenseNotice(rootDirectory, filePath) {
  const relativePath = path.relative(rootDirectory, filePath).split(path.sep).join('/');
  return ALLOWED_LICENSE_NOTICES.has(relativePath);
}

/**
 * 명시적인 lyrics 디렉터리와 가사 배포에 흔히 쓰이는 데이터 파일을 함께 막는다.
 * 라이선스 고지의 일반 텍스트만 예외로 둔다.
 */
export function findForbiddenLyricsFiles(rootDirectory) {
  const directLyricsFiles = filesRecursively(path.join(rootDirectory, 'lyrics'));
  const dataFiles = filesRecursively(rootDirectory).filter(filePath => {
    if (isLicenseNotice(rootDirectory, filePath)) return false;
    return LYRICS_PAYLOAD_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  });

  return [...new Set([...directLyricsFiles, ...dataFiles])].toSorted();
}

export function assertNoShippedLyrics(rootDirectory, label = path.basename(rootDirectory)) {
  const forbiddenFiles = findForbiddenLyricsFiles(rootDirectory);
  if (forbiddenFiles.length === 0) return;

  const relativeFiles = forbiddenFiles.map(filePath => path.relative(rootDirectory, filePath)).join(', ');
  throw new Error(`${label}에 배포 금지 가사 파일 ${forbiddenFiles.length}개가 있습니다: ${relativeFiles}`);
}
