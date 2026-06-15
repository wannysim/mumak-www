import type { Locale } from '@/src/shared/config/i18n';
import { markdownToHtml } from '@/src/shared/lib/content';
import { buildAnchorSuffix, transformWikilinksToMarkdown } from '@/src/shared/lib/wikilink';

import type { Post } from './posts';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

// 본문 내 wikilink를 절대 URL의 일반 마크다운 링크로 치환한다. 마크다운 원문(.md)과
// RSS content:encoded 모두 사이트 밖에서 소비되므로 절대 URL을 쓴다. 현재 blog
// 포스트에는 wikilink가 없지만, 추가되더라도 끊기지 않도록 방어적으로 변환한다.
function bodyToMarkdown(locale: Locale, content: string): string {
  return transformWikilinksToMarkdown(content, {
    hrefFor: ({ slug, heading, blockId }) => {
      const anchor = buildAnchorSuffix({ heading, blockId });
      return slug ? `${BASE_URL}/${locale}/garden/${slug}${anchor}` : anchor;
    },
  });
}

// AI 에이전트/리트리버용 클린 마크다운 문서. 제목(H1) + 설명 + canonical 링크 +
// wikilink가 일반 링크로 치환된 본문.
export function toPostDocumentMarkdown(locale: Locale, post: Post): string {
  const { meta, content } = post;
  const canonical = `${BASE_URL}/${locale}/blog/${meta.category}/${meta.slug}`;

  return `# ${meta.title}\n\n${meta.description}\n\n[${canonical}](${canonical})\n\n${bodyToMarkdown(locale, content)}\n`;
}

// RSS content:encoded용 본문 HTML. 제목/설명은 채널 item의 title/description이
// 따로 담으므로 본문만 변환한다.
export function toPostContentHtml(locale: Locale, post: Post): string {
  return markdownToHtml(bodyToMarkdown(locale, post.content));
}
