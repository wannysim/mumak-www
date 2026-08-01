import { normalizeMdxInAppHref } from '@/src/shared/lib/url';

// 이미지(`![alt](...)`)는 앞의 `!`로 걸러낸다. 링크 텍스트에 대괄호가 중첩되는
// 경우는 이 저장소 콘텐츠에 없어서 다루지 않는다.
const MARKDOWN_LINK_RE = /(!?)\[[^\]]*\]\(([^)\s]+)\)/g;
const FENCE_RE = /^\s*(```|~~~)/;

/** 코드블록 안의 예시 링크가 실제 링크로 잡히지 않게 펜스 구간을 걷어낸다. */
function stripFencedCode(content: string): string {
  let inFence = false;

  return content
    .split('\n')
    .filter(line => {
      if (FENCE_RE.test(line)) {
        inFence = !inFence;
        return false;
      }
      return !inFence;
    })
    .join('\n');
}

/**
 * MDX 본문에서 사이트 내부를 가리키는 표준 마크다운 링크를 뽑는다.
 *
 * 반환값은 렌더 시점과 같은 형태로 정규화된 경로다(locale prefix 제거, `.mdx` 제거,
 * 중첩 가든 경로 평탄화). 저자는 파일 경로를 그대로 적는 습관이 있어서
 * `/ko/garden/resources/frontend/browser/x.mdx` 같은 표기가 섞이는데,
 * normalizeMdxInAppHref가 이미 그걸 `/garden/x`로 접어주므로 여기서 다시 풀지 않는다.
 * 이 값이 곧 렌더된 href라서, 그대로 두 콘텐츠 종류를 잇는 키로 쓸 수 있다.
 */
export function extractInAppLinks(content: string): string[] {
  const hrefs = [...stripFencedCode(content).matchAll(MARKDOWN_LINK_RE)]
    .filter(([, bang, href]) => bang === '' && href?.startsWith('/'))
    .map(([, , href]) => normalizeMdxInAppHref(href as string));

  return [...new Set(hrefs)];
}
