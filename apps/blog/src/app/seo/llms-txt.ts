import { getNotes } from '@/src/entities/note';
import { getPosts } from '@/src/entities/post';
import { locales, type Locale } from '@/src/shared/config/i18n/config';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
};

// 마크다운 링크 텍스트에서 `]`가 링크를 깨지 않게 escape한다.
function escapeLinkText(value: string): string {
  return value.replace(/\]/g, '\\]');
}

function listItem(title: string, url: string, note?: string): string {
  const suffix = note?.trim() ? `: ${note.trim().replace(/\s+/g, ' ')}` : '';
  return `- [${escapeLinkText(title)}](${url})${suffix}`;
}

function blogSection(locale: Locale): string {
  const posts = getPosts(locale);
  if (posts.length === 0) return '';

  const items = posts
    // 블로그 포스트는 `.md` 원문(frontmatter 제거 + wikilink→일반 링크)을 안내한다.
    .map(post => listItem(post.title, `${BASE_URL}/${locale}/blog/${post.category}/${post.slug}.md`, post.description))
    .join('\n');

  return `## Blog (${LOCALE_LABELS[locale]})\n\n${items}`;
}

function gardenSection(locale: Locale): string {
  const notes = getNotes(locale);
  if (notes.length === 0) return '';

  const items = notes
    .map(note => listItem(note.title, `${BASE_URL}/${locale}/garden/${note.slug}`, note.excerpt))
    .join('\n');

  return `## Garden (${LOCALE_LABELS[locale]})\n\n${items}`;
}

// AI 에이전트에게 사이트 구조와 콘텐츠 목록을 마크다운으로 안내한다(llms.txt 컨벤션).
// sitemap.ts/feed.xml과 동일하게 콘텐츠 API를 재사용하며 빌드 타임에 정적 생성된다.
export function buildLlmsTxt(): string {
  const intro = [
    '# Wan Sim',
    '',
    '> 생각과 기록을 담는 블로그와 Digital Garden. A space for thoughts and records — blog and digital garden.',
    '',
    '한국어(`/ko`)와 영어(`/en`)로 콘텐츠를 제공합니다. 각 블로그 포스트는 URL 끝에 `.md`를 붙이면 frontmatter가 제거되고 wikilink가 일반 링크로 치환된 클린 마크다운 원문을 받을 수 있습니다.',
    'Content is published in Korean (`/ko`) and English (`/en`). Append `.md` to any blog post URL for clean markdown source (frontmatter stripped, wikilinks resolved to plain links).',
  ].join('\n');

  const sections = locales.flatMap(locale => {
    const typedLocale = locale as Locale;
    return [blogSection(typedLocale), gardenSection(typedLocale)];
  });

  return [intro, ...sections.filter(Boolean)].join('\n\n') + '\n';
}
