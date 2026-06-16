import { buildLlmsTxt } from '@/src/app/seo';

// 빌드 타임 정적 생성 (sitemap/robots와 동일하게 SSG).
export const dynamic = 'force-static';

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
