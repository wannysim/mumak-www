import { expect, test } from '@playwright/test';

// Helper to get JSON-LD by type
async function getJsonLdByType(page: import('@playwright/test').Page, type: string) {
  const scripts = await page.locator('script[type="application/ld+json"]').all();
  for (const script of scripts) {
    const content = await script.textContent();
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed['@type'] === type) {
        return parsed;
      }
    }
  }
  return null;
}

test.describe('SEO - JSON-LD Structured Data', () => {
  test('should have WebSite JSON-LD on home page', async ({ page }) => {
    await page.goto('/ko');

    const jsonLd = await getJsonLdByType(page, 'WebSite');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('WebSite');
    expect(jsonLd.name).toBe('Wan Sim');
    expect(jsonLd.inLanguage).toBe('ko-KR');
  });

  test('should have WebSite JSON-LD in English', async ({ page }) => {
    await page.goto('/en');

    const jsonLd = await getJsonLdByType(page, 'WebSite');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd.inLanguage).toBe('en-US');
  });

  test('should have SearchAction in WebSite JSON-LD for sitelinks searchbox', async ({ page }) => {
    await page.goto('/ko');

    const jsonLd = await getJsonLdByType(page, 'WebSite');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd.potentialAction).toBeDefined();
    expect(jsonLd.potentialAction['@type']).toBe('SearchAction');
    expect(jsonLd.potentialAction.target).toBeDefined();
    expect(jsonLd.potentialAction['query-input']).toBe('required name=search_term_string');
  });

  test('should have SiteNavigationElement JSON-LD on home page', async ({ page }) => {
    await page.goto('/ko');

    const jsonLd = await getJsonLdByType(page, 'SiteNavigationElement');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd.hasPart).toBeDefined();
    expect(Array.isArray(jsonLd.hasPart)).toBe(true);
    expect(jsonLd.hasPart.length).toBeGreaterThan(0);

    // Check navigation items
    const navNames = jsonLd.hasPart.map((item: { name: string }) => item.name);
    expect(navNames).toContain('블로그');
    expect(navNames).toContain('가든');
  });

  test('should have BlogPosting JSON-LD on post page', async ({ page }) => {
    await page.goto('/ko/blog/essay/first');

    const jsonLd = await getJsonLdByType(page, 'BlogPosting');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd['@type']).toBe('BlogPosting');
    expect(jsonLd.headline).toBeTruthy();
    expect(jsonLd.datePublished).toBeTruthy();
    expect(jsonLd.author['@type']).toBe('Person');
  });
});

test.describe('SEO - BreadcrumbList JSON-LD', () => {
  test('should have BreadcrumbList on blog post page', async ({ page }) => {
    await page.goto('/ko/blog/essay/first');

    const jsonLd = await getJsonLdByType(page, 'BreadcrumbList');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement).toBeDefined();
    expect(Array.isArray(jsonLd.itemListElement)).toBe(true);

    // Blog post should have 4 breadcrumb items: Home > Blog > Category > Post
    expect(jsonLd.itemListElement.length).toBe(4);

    // Check structure of each item
    jsonLd.itemListElement.forEach(
      (item: { '@type': string; position: number; name: string; item: string }, index: number) => {
        expect(item['@type']).toBe('ListItem');
        expect(item.position).toBe(index + 1);
        expect(item.name).toBeTruthy();
        expect(item.item).toMatch(/^https?:\/\//);
      }
    );

    // Check specific breadcrumb names
    expect(jsonLd.itemListElement[0].name).toBe('홈');
    expect(jsonLd.itemListElement[1].name).toBe('블로그');
  });

  test('should have BreadcrumbList on garden note page', async ({ page }) => {
    await page.goto('/ko/garden/what-is-digital-garden');

    const jsonLd = await getJsonLdByType(page, 'BreadcrumbList');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement).toBeDefined();

    // Garden note under a PARA category has 4 breadcrumb items: Home > Garden > Category > Note
    // (what-is-digital-garden lives under resources/, so the category step is present)
    expect(jsonLd.itemListElement.length).toBe(4);

    // Check specific breadcrumb names
    expect(jsonLd.itemListElement[0].name).toBe('홈');
    expect(jsonLd.itemListElement[1].name).toBe('가든');
    expect(jsonLd.itemListElement[2].name).toBe('Resources');
    expect(jsonLd.itemListElement[3].name).toBeTruthy();
  });

  test('should have correct breadcrumb URLs', async ({ page }) => {
    await page.goto('/ko/blog/essay/first');

    const jsonLd = await getJsonLdByType(page, 'BreadcrumbList');

    expect(jsonLd).not.toBeNull();

    // Check URL patterns
    expect(jsonLd.itemListElement[0].item).toContain('/ko');
    expect(jsonLd.itemListElement[1].item).toContain('/ko/blog');
    expect(jsonLd.itemListElement[2].item).toContain('/ko/blog/essay');
    expect(jsonLd.itemListElement[3].item).toContain('/ko/blog/essay/first');
  });

  test('should have BreadcrumbList in English', async ({ page }) => {
    await page.goto('/en/blog/essay/first');

    const jsonLd = await getJsonLdByType(page, 'BreadcrumbList');

    expect(jsonLd).not.toBeNull();

    // Check English breadcrumb names
    expect(jsonLd.itemListElement[0].name).toBe('Home');
    expect(jsonLd.itemListElement[1].name).toBe('Blog');
  });
});

test.describe('SEO - Open Graph', () => {
  test('should have OG meta tags on home page', async ({ page }) => {
    await page.goto('/ko');

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');

    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
    expect(ogType).toBe('website');
  });

  test('should have Twitter meta tags', async ({ page }) => {
    await page.goto('/ko');

    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');
  });

  test('should advertise the default OG image on the home page', async ({ page }) => {
    await page.goto('/ko');

    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute('content');
    expect(ogImage).toMatch(/\/ko\/opengraph-image/);

    const ogImageType = await page.locator('meta[property="og:image:type"]').first().getAttribute('content');
    expect(ogImageType).toBe('image/png');
  });

  test('should advertise and serve a per-post OG image', async ({ page, request }) => {
    await page.goto('/ko/blog/articles/react-compiler-rust-port');

    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute('content');
    expect(ogImage).toMatch(/\/blog\/.+\/opengraph-image/);

    // 해시 세그먼트가 바뀌어도 깨지지 않도록 메타 URL에서 경로를 그대로 가져온다.
    const { pathname, search } = new URL(ogImage!);
    const response = await request.get(`${pathname}${search}`);

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    // 폰트·텍스트가 실제로 렌더되면 빈 배경 이미지보다 훨씬 크다.
    const body = await response.body();
    expect(body.length).toBeGreaterThan(5000);
  });
});

test.describe('SEO - Basic Meta Tags', () => {
  // 홈 제목은 정확히 비교한다. `toContain('Wan Sim')`은 "Wan Sim | Wan Sim"도 통과시켜서
  // 템플릿 중복 버그가 그대로 배포됐다.
  test('should have proper title and description', async ({ page }) => {
    await page.goto('/ko');

    expect(await page.title()).toBe('Wan Sim — 생각과 기록을 담는 공간');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('should have the English home title without the template suffix', async ({ page }) => {
    await page.goto('/en');

    expect(await page.title()).toBe('Wan Sim — A space for thoughts and records');
  });

  // 홈만 absolute이고, 나머지 페이지는 '%s | Wan Sim' 템플릿을 그대로 유지해야 한다.
  test('should keep the "<page> | Wan Sim" template on non-home pages', async ({ page }) => {
    await page.goto('/ko/blog');
    expect(await page.title()).toBe('블로그 | Wan Sim');

    await page.goto('/en/garden');
    expect(await page.title()).toBe('Digital Garden | Wan Sim');
  });

  // 탭 제목과 링크 프리뷰 제목이 어긋나지 않아야 한다(layout의 하드코딩 'Wan Sim' 상속 방지).
  // 홈만이 아니라 템플릿을 타는 하위 페이지에서도 성립해야 하는 불변식이다.
  test('should match the OG and Twitter titles to the document title', async ({ page }) => {
    for (const path of ['/ko', '/ko/blog', '/en/garden']) {
      await page.goto(path);

      const documentTitle = await page.title();
      expect(await page.locator('meta[property="og:title"]').getAttribute('content')).toBe(documentTitle);
      expect(await page.locator('meta[name="twitter:title"]').getAttribute('content')).toBe(documentTitle);
    }
  });

  // 페이지 로케일과 og:locale이 어긋나면 LinkedIn 등이 en 문서를 ko 콘텐츠로 취급한다.
  test('should advertise the page locale in og:locale', async ({ page }) => {
    await page.goto('/ko/blog');
    expect(await page.locator('meta[property="og:locale"]').getAttribute('content')).toBe('ko_KR');

    await page.goto('/en/garden');
    expect(await page.locator('meta[property="og:locale"]').getAttribute('content')).toBe('en_US');
  });

  test('should have robots meta tag', async ({ page }) => {
    await page.goto('/ko');

    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('index');
    expect(robots).toContain('follow');
  });
});

test.describe('SEO - Favicon', () => {
  test('should declare a PNG icon link in the document head', async ({ page }) => {
    await page.goto('/ko');

    const iconHref = await page.locator('link[rel="icon"]').first().getAttribute('href');
    const iconType = await page.locator('link[rel="icon"]').first().getAttribute('type');

    expect(iconHref).toMatch(/\/icon/);
    expect(iconType).toBe('image/png');
  });

  test('should render the generated icon as a non-trivial PNG', async ({ request }) => {
    const response = await request.get('/icon');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');

    // 폰트가 실제로 임베드되어 'WS' 글리프가 렌더되면 투명/빈 아이콘보다 훨씬 크다.
    const body = await response.body();
    expect(body.length).toBeGreaterThan(2000);
  });

  test('should respond to a direct /favicon.ico request for legacy crawlers', async ({ request }) => {
    const response = await request.get('/favicon.ico');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  });
});

test.describe('SEO - RSS autodiscovery', () => {
  test('should advertise the locale RSS feed via link rel=alternate', async ({ page }) => {
    await page.goto('/ko/blog');

    const feedHref = await page.locator('link[rel="alternate"][type="application/rss+xml"]').getAttribute('href');

    expect(feedHref).toMatch(/\/ko\/feed\.xml$/);
  });

  test('should point autodiscovery at the matching locale feed', async ({ page }) => {
    await page.goto('/en/blog');

    const feedHref = await page.locator('link[rel="alternate"][type="application/rss+xml"]').getAttribute('href');

    expect(feedHref).toMatch(/\/en\/feed\.xml$/);
  });

  test('should serve full content in the RSS feed via content:encoded', async ({ request }) => {
    const response = await request.get('/en/feed.xml');

    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"');
    expect(body).toContain('<content:encoded>');
  });
});

test.describe('GEO - Markdown source endpoint', () => {
  test('should serve clean markdown at the .md URL (rewrite)', async ({ request }) => {
    const response = await request.get('/ko/blog/essay/first.md');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/markdown');

    const body = await response.text();
    // 클린 마크다운 문서: H1 제목으로 시작하고 wikilink 원문(`[[`)이 남지 않는다.
    expect(body.trimStart().startsWith('# ')).toBe(true);
    expect(body).not.toContain('[[');
  });

  test('should keep the HTML post page working at the non-.md URL', async ({ page }) => {
    const response = await page.goto('/ko/blog/essay/first');

    // rewrite는 `.md`만 가로채고, 일반 URL은 HTML 페이지를 그대로 서빙해야 한다.
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');
  });
});

test.describe('GEO - llms.txt', () => {
  test('should serve a markdown content index at /llms.txt', async ({ request }) => {
    const response = await request.get('/llms.txt');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/plain');

    const body = await response.text();
    expect(body.startsWith('# Wan Sim')).toBe(true);
    expect(body).toContain('## Blog');
    expect(body).toContain('## Garden');
    // 블로그 항목은 AI 인용용 `.md` 원문 URL을 가리킨다.
    expect(body).toMatch(/\/ko\/blog\/.+\.md\)/);
  });
});

test.describe('Search - static search index endpoint (C-3)', () => {
  test('should serve a static JSON search index that the palette lazy-fetches', async ({ request }) => {
    const response = await request.get('/ko/search-index.json');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['cache-control']).toContain('public');

    const body = (await response.json()) as { posts: Array<{ title: string; slug: string; category: string }> };
    expect(Array.isArray(body.posts)).toBe(true);
    expect(body.posts.length).toBeGreaterThan(0);

    // 인덱스는 페이지 목록과 같은 getPosts 소스를 쓴다(draft 노출 정책 동일 적용). 검색 E2E가
    // 실제로 여는 essay/first가 인덱스에도 들어 있어야 한다.
    const first = body.posts.find(post => post.slug === 'first' && post.category === 'essay');
    expect(first).toBeDefined();
    expect(first?.title).toBeTruthy();
  });

  test('should serve the English search index as well', async ({ request }) => {
    const response = await request.get('/en/search-index.json');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = (await response.json()) as { posts: unknown[] };
    expect(body.posts.length).toBeGreaterThan(0);
  });
});

test.describe('GEO - AI crawler policy (robots.txt)', () => {
  test('should disallow training bots and explicitly allow search bots', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.ok()).toBe(true);
    const body = await response.text();

    expect(body).toContain('GPTBot');
    expect(body).toContain('PerplexityBot');
    expect(body).toContain('OAI-SearchBot');
  });
});
