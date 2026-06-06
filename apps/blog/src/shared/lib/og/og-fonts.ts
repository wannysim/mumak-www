import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Satori(next/og)는 woff2/variable 폰트를 지원하지 않으므로, OG 이미지는 static
// weight별 woff 파일을 직접 로드한다. 노트/글 제목이 한국어(동적)이므로 풀셋 woff를
// 쓴다(콘텐츠 기반 subset 불가). 서버 렌더 시에만 로드되어 클라이언트로는 나가지 않는다.
const FONT_FILES = [
  { file: 'Pretendard-Regular.woff', weight: 400 as const },
  { file: 'Pretendard-SemiBold.woff', weight: 600 as const },
  { file: 'Pretendard-Bold.woff', weight: 700 as const },
];

async function readFont(file: string): Promise<ArrayBuffer> {
  const data = await readFile(join(process.cwd(), 'public', 'assets', 'fonts', file));
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

export type OgFont = {
  name: 'Pretendard';
  data: ArrayBuffer;
  style: 'normal';
  weight: 400 | 600 | 700;
};

export async function loadOgFonts(): Promise<OgFont[]> {
  return Promise.all(
    FONT_FILES.map(async ({ file, weight }) => ({
      name: 'Pretendard' as const,
      data: await readFont(file),
      style: 'normal' as const,
      weight,
    }))
  );
}
