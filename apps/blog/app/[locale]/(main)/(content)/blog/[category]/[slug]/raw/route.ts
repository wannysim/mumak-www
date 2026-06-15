import { getAllPostSlugs, getPost, isValidCategory, toPostDocumentMarkdown } from '@/src/entities/post';
import { locales, type Locale } from '@/src/shared/config/i18n';

// 빌드 타임 정적 생성 (sitemap/feed.xml과 동일하게 SSG).
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap(locale => getAllPostSlugs(locale).map(({ category, slug }) => ({ locale, category, slug })));
}

interface RawRouteProps {
  params: Promise<{ locale: string; category: string; slug: string }>;
}

// 포스트의 클린 마크다운 원문. next.config.mjs의 beforeFiles rewrite가
// `/{locale}/blog/{category}/{slug}.md`를 이 핸들러로 매핑한다.
export async function GET(_request: Request, { params }: RawRouteProps) {
  const { locale, category, slug } = await params;

  if (!isValidCategory(category)) {
    return new Response('Not Found', { status: 404 });
  }

  const post = getPost(locale as Locale, category, slug);

  if (!post) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(toPostDocumentMarkdown(locale as Locale, post), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
