import { getPosts } from '@/src/entities/post';
import { isValidLocale, locales, type Locale } from '@/src/shared/config/i18n';
import { type SearchIndex, type SearchIndexPost } from '@/src/shared/lib/search';

// 빌드 타임 정적 생성 (sitemap/feed와 동일하게 SSG). 검색창을 열 때만 클라이언트가 1회 fetch한다.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    return new Response('Not Found', { status: 404 });
  }

  // getPosts는 draft 노출 정책(E2E_INCLUDE_DRAFT 포함)을 이미 적용한다. 인덱스도 같은 소스를
  // 쓰므로 페이지 목록과 검색 인덱스의 노출 범위가 자동으로 일치한다.
  const posts: SearchIndexPost[] = getPosts(locale as Locale).map(post => ({
    title: post.title,
    description: post.description,
    category: post.category,
    slug: post.slug,
    tags: post.tags ?? [],
  }));

  const index: SearchIndex = { posts };

  return Response.json(index, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
