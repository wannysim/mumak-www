import { normalizeHeadingToAnchor } from '@/src/shared/lib/wikilink';

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
/** 코드펜스 시작·끝 줄. 링크 추출(links.ts)도 같은 규칙으로 펜스를 건너뛴다. */
export const FENCE_RE = /^\s*(```|~~~)/;

export interface ContentHeading {
  /** 원문에서의 줄 번호. 섹션 구간을 잘라낼 때 쓴다. */
  index: number;
  level: number;
  text: string;
  /** mdx-components가 heading에 붙이는 id와 같은 값. */
  anchor: string;
}

/** 인라인 마크다운 표기를 걷어 표시용 순수 텍스트만 남긴다. */
export function cleanupInlineMarkdown(text: string): string {
  return (
    text
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // 위키링크는 excerpt/heading 텍스트에서 표시 텍스트만 남긴다. 렌더된 본문에서는 rehype가
      // 링크로 바꾸지만, 발췌는 원문에서 뽑기 때문에 여기서 걷지 않으면 카드에 [[slug|label]]이
      // 그대로 노출된다.
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, slug: string, label?: string) => label ?? slug)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()
  );
}

/**
 * MDX 본문의 헤딩 목록.
 *
 * 코드펜스 안은 건너뛴다. 셸 예제의 `# 주석`은 헤딩이 아닌데, 이걸 빼지 않으면
 * 유령 앵커가 생겨 위키링크 앵커 검증이 없는 섹션을 통과시키고 목차에도 올라온다.
 * 줄 번호는 원문 기준을 그대로 유지한다 — 펜스 줄을 지워 버리면 섹션 구간을 잘라
 * 쓰는 쪽(노트 임베드 미리보기)의 인덱스가 어긋난다.
 */
export function extractHeadings(content: string): ContentHeading[] {
  const headings: ContentHeading[] = [];
  let inFence = false;

  content.split('\n').forEach((line, index) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }

    const match = line.match(HEADING_RE);
    if (!match) {
      return;
    }

    const text = cleanupInlineMarkdown(match[2] ?? '');
    headings.push({ index, level: match[1]?.length ?? 1, text, anchor: normalizeHeadingToAnchor(text) });
  });

  return headings;
}
