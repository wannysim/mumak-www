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

    // Garden note should have 3 breadcrumb items: Home > Garden > Note
    expect(jsonLd.itemListElement.length).toBe(3);

    // Check specific breadcrumb names
    expect(jsonLd.itemListElement[0].name).toBe('홈');
    expect(jsonLd.itemListElement[1].name).toBe('가든');
    expect(jsonLd.itemListElement[2].name).toBeTruthy();
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
  test('should have proper title and description', async ({ page }) => {
    await page.goto('/ko');

    const title = await page.title();
    expect(title).toContain('Wan Sim');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
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
