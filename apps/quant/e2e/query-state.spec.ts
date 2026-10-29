import { expect, test } from '@playwright/test';

import { TEST_ONLY_PAPER_ROW } from '../src/__tests__/fixtures/test-snapshot';

// All intercepted responses below are synthetic fixtures, never production observations.
const endpoint = 'https://quant-e2e.supabase.co/rest/v1/paper_snapshots**';
const title = '2026-09 · 테스트 운용 1기';

test('hidden initial view is unqueried, then visibility resumes the real client request', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  });
  let requests = 0;
  await page.route(endpoint, async route => {
    requests++;
    await route.fulfill({ json: [TEST_ONLY_PAPER_ROW] });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '아직 조회하지 않았습니다.' })).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByText('표시할 데이터가 없습니다.')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  expect(requests).toBeGreaterThan(0);
});

test('confirmed empty can be retried and mode tabs implement keyboard semantics', async ({ page }) => {
  let empty = true;
  let liveRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/live_snapshots')) liveRequests++;
  });
  await page.route(endpoint, route => route.fulfill({ json: empty ? [] : [TEST_ONLY_PAPER_ROW] }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '모의 운용 내역이 아직 없습니다.' })).toBeVisible();
  empty = false;
  await page.getByRole('button', { name: '다시 조회' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const paper = page.getByRole('tab', { name: '모의 운용' });
  const live = page.getByRole('tab', { name: '실운용' });
  await paper.focus();
  await paper.press('ArrowRight');
  await expect(live).toBeFocused();
  await expect(live).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'mode-live');
  await expect(page.getByRole('heading', { name: '실운용 내역 로그인' })).toBeVisible();
  expect(liveRequests).toBe(0);
  await live.press('Home');
  await expect(paper).toBeFocused();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await paper.press('End');
  await expect(live).toBeFocused();
  await live.press('ArrowLeft');
  await expect(paper).toBeFocused();
});

for (const failure of ['transport', 'schema', 'access'] as const) {
  test(`${failure} is not empty, hides old data and recovers with retry (synthetic)`, async ({ page }) => {
    let fail = false;
    await page.route(endpoint, async route => {
      if (!fail) return route.fulfill({ json: [TEST_ONLY_PAPER_ROW] });
      if (failure === 'transport') return route.abort('failed');
      if (failure === 'access')
        return route.fulfill({ status: 403, json: { code: '42501', message: 'PRIVATE_ERROR_DETAIL' } });
      return route.fulfill({
        json: [
          { ...TEST_ONLY_PAPER_ROW, payload: { ...TEST_ONLY_PAPER_ROW.payload, private: 'PRIVATE_ERROR_DETAIL' } },
        ],
      });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    fail = true;
    await page.getByRole('button', { name: '운용 내역 전체 새로고침' }).click();
    // postgrest-js 2.117.2 retries rejected GETs three times (1s + 2s + 4s).
    // Wait for that documented client policy, not an arbitrary sleep or a weaker assertion.
    await expect(page.getByRole('heading', { name: '운용 내역을 불러오지 못했습니다.' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(
        failure === 'schema'
          ? '응답 형식 또는 데이터 계약을 확인하지 못했습니다.'
          : failure === 'access'
            ? '인증 또는 조회 권한을 확인해 주세요.'
            : '네트워크 또는 조회 서비스 연결을 확인해 주세요.'
      )
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
    await expect(page.getByText(/PRIVATE_ERROR_DETAIL/)).toHaveCount(0);
    await expect(page.getByText(/기존 실운용/)).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: '다시 조회' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });
}

for (const width of [320, 390, 1280]) {
  test(`source, separate clocks and unknown state fit ${width}px (synthetic)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(endpoint, route => route.fulfill({ json: [TEST_ONLY_PAPER_ROW] }));
    await page.goto('/');
    const context = page.getByRole('region', { name: '자료 출처와 조회 상태' });
    await expect(context).toContainText('공개 모의 운용 · 가상 자금 · 실계좌 아님');
    await expect(context).not.toContainText('DB 적재 확인');
    await expect(context).not.toContainText('최근 판단·현재 위험상태');
    await expect(page.getByRole('region', { name: 'PAPER 전략과 일별 운영' })).toContainText('전략과 일별 운영');
    await expect(context).toContainText('내보냄·웹 조회 성공은');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 768) {
      const fill = page.getByRole('button', { name: 'TEST 매수 체결 상세' });
      const box = await fill.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await fill.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(fill).toBeFocused();
    }
    await page.screenshot({ path: testInfo.outputPath(`data-context-${width}.png`), fullPage: true });
  });
}
