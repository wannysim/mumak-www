import { expect, test } from '@playwright/test';

test.describe('Graph Page', () => {
  test('should load the graph page', async ({ page }) => {
    await page.goto('/en/graph');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/en\/graph/);
  });

  test('should display Garden and Blog tabs', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('tab', { name: 'Garden' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Blog' })).toBeVisible();
  });

  test('should default to Garden tab', async ({ page }) => {
    await page.goto('/en/graph');

    const gardenTab = page.getByRole('tab', { name: 'Garden' });
    await expect(gardenTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch to Blog tab and update URL', async ({ page }) => {
    await page.goto('/en/graph');

    const blogTab = page.getByRole('tab', { name: 'Blog' });
    await blogTab.click();

    await expect(page).toHaveURL(/tab=blog/);
    await expect(blogTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should display back button', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  test('should not display header and footer', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('link', { name: 'Wan Sim' })).not.toBeVisible();
    await expect(page.locator('footer')).not.toBeVisible();
  });

  test('should display theme and locale switchers', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('button', { name: /theme/i })).toBeVisible();
  });

  test('should render graph canvas or unsupported fallback', async ({ page }) => {
    await page.goto('/en/graph');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas');
    const unsupported = page.getByText('3D graph is not available on this device');

    await expect(canvas.or(unsupported)).toBeVisible({ timeout: 10000 });
  });

  test('should work in Korean locale', async ({ page }) => {
    await page.goto('/ko/graph');

    await expect(page.getByRole('tab', { name: '가든' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '블로그' })).toBeVisible();
    // 툴바 버튼 이름도 로케일을 따른다(하드코딩된 'Back'이 아니다).
    await expect(page.getByRole('button', { name: '뒤로 가기' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  });

  // 필터 팝오버는 캔버스와 무관하게 렌더되므로 WebGL 없이도 결정적으로 통과한다.
  test('names blog categories with the locale vocabulary, not the raw slug', async ({ page }) => {
    await page.goto('/ko/graph?tab=blog');

    await page.getByRole('button', { name: '필터' }).click();

    await expect(page.getByRole('option', { name: '에세이' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'essay' })).toHaveCount(0);
  });

  test('back button leaves the immersive graph for the locale home when there is no in-site history', async ({
    page,
  }) => {
    // 그래프 Back은 in-site referrer가 있으면 router.back(), 없으면 locale 홈으로 폴백한다.
    // 직접 진입(referrer 없음)에서는 폴백 경로가 결정적으로 동작한다.
    await page.goto('/en/graph');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  // 범례는 캔버스가 실제로 그려졌을 때만 뜬다. 존재하지 않는 노드의 색 규칙과
  // "클릭하세요" 안내를 미지원 폴백 위에 띄우지 않기 위한 계약이다.
  // 이 저장소의 CI 브라우저는 WebGL 유무가 환경마다 갈리므로 캔버스 유무로 분기해
  // "캔버스가 있으면 범례가 있고, 없으면 범례도 없다"는 양방향 불변식을 검증한다.
  const waitForCanvasOrFallback = async (page: import('@playwright/test').Page) => {
    const canvas = page.locator('canvas');
    const unsupported = page.getByText(/3D graph is not available|3D 그래프를 볼 수 없습니다/);
    await expect(canvas.or(unsupported).first()).toBeVisible({ timeout: 10000 });
    return (await canvas.count()) > 0;
  };

  test('shows a legend derived from the rendered nodes, and only when they render', async ({ page }) => {
    await page.goto('/en/graph');
    const hasCanvas = await waitForCanvasOrFallback(page);

    const legend = page.locator('[data-slot="graph-legend"]');

    if (!hasCanvas) {
      await expect(legend).toHaveCount(0);
      return;
    }

    await expect(legend).toBeVisible();
    await expect(legend.getByText('Seedling')).toBeVisible();
    await expect(legend.getByText('Tag')).toBeVisible();
  });

  test('localizes the legend rows', async ({ page }) => {
    await page.goto('/ko/graph');
    test.skip(!(await waitForCanvasOrFallback(page)), 'WebGL unavailable: no canvas, so no legend by design');

    await expect(page.locator('[data-slot="graph-legend"]').getByText('씨앗')).toBeVisible();
  });

  test('shows the click hint once and never again after it is dismissed', async ({ page }) => {
    await page.goto('/en/graph');
    test.skip(!(await waitForCanvasOrFallback(page)), 'WebGL unavailable: no canvas, so no hint by design');

    const hint = page.getByText('Click a node to see its details');
    await expect(hint).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss hint' }).click();
    await expect(hint).toBeHidden();

    await page.reload();
    await waitForCanvasOrFallback(page);
    await expect(page.locator('[data-slot="graph-legend"]')).toBeVisible();
    await expect(hint).toBeHidden();
  });

  // 비시각 대체 경로는 서버 렌더 결과라 캔버스와 무관하게 항상 존재해야 한다.
  test('exposes a heading and a list alternative for both tabs to assistive tech', async ({ page }) => {
    await page.goto('/en/graph');

    // sr-only 요소라 toBeVisible() 대신 존재/속성으로 검증한다.
    await expect(page.getByRole('heading', { level: 1, name: 'Graph' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Browse the note list' })).toHaveAttribute('href', '/en/garden');
    // 그래프에는 blog 탭도 있으므로 글 목록 대체 경로가 함께 있어야 한다.
    await expect(page.getByRole('link', { name: 'Browse the post list' })).toHaveAttribute('href', '/en/blog');
  });

  // 위 테스트는 Playwright가 하이드레이션 이후를 보므로 "서버 HTML에 있다"를 검증하지 못한다.
  // GraphView가 useSearchParams를 쓰는 한 그것을 감싼 Suspense는 CSR bailout되므로,
  // 대체 경로가 그 경계 밖에 남아 있는지는 JS 없는 원본 응답으로만 확인할 수 있다.
  test('serves the non-visual alternative in the prerendered HTML (no JS)', async ({ request }) => {
    const response = await request.get('/en/graph');
    expect(response.ok()).toBe(true);

    const html = await response.text();
    expect(html).toContain('<h1>Graph</h1>');
    expect(html).toContain('href="/en/garden"');
    expect(html).toContain('href="/en/blog"');
  });

  test('is reachable from the blog and garden section headers, deep-linked to the matching tab', async ({ page }) => {
    // 전역 nav의 형제 항목이 아니라 각 섹션 인덱스의 PageHeader 아래 진입점에서 연다.
    await page.goto('/en/garden');
    const gardenGraphLink = page.getByRole('link', { name: /Explore the graph/i });
    await expect(gardenGraphLink).toBeVisible();
    await gardenGraphLink.click();
    await expect(page).toHaveURL(/\/en\/graph\?tab=garden/);
    await expect(page.getByRole('tab', { name: 'Garden' })).toHaveAttribute('aria-selected', 'true');

    await page.goto('/en/blog');
    const blogGraphLink = page.getByRole('link', { name: /Explore the graph/i });
    await expect(blogGraphLink).toBeVisible();
    await blogGraphLink.click();
    await expect(page).toHaveURL(/\/en\/graph\?tab=blog/);
    await expect(page.getByRole('tab', { name: 'Blog' })).toHaveAttribute('aria-selected', 'true');
  });
});
