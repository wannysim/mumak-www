import { expect, test, type Page } from '@playwright/test';

import { TEST_ONLY_PAPER_ROW } from '../src/__tests__/fixtures/test-snapshot';

const REASON = '정기 리밸런싱';

async function mockSnapshots(page: Page, withReason = true, expanded = false) {
  const row = {
    ...structuredClone(TEST_ONLY_PAPER_ROW),
    payload: {
      ...structuredClone(TEST_ONLY_PAPER_ROW.payload),
      holdings: TEST_ONLY_PAPER_ROW.payload.holdings.map(holding => ({ ...holding, symbol: 'AMD' })),
      fills: TEST_ONLY_PAPER_ROW.payload.fills.map(fill => ({
        ...fill,
        symbol: 'AMD',
        ...(withReason ? { reason: REASON } : {}),
      })),
    },
  };
  if (expanded) {
    Object.assign(row.payload, {
      label: '미국 주식 저빈도 추세 모의 운용 에피소드',
      history: ['2026-09-18T19:45:00Z', '2026-09-18T20:00:00Z', '2026-09-21T13:30:00Z', '2026-09-21T13:45:00Z'].map(
        (at, index) => ({
          at,
          nav: String(100000 + index * 100),
          profit: String(index * 100),
          returnPct: String(index / 10),
        })
      ),
      fills: Array.from({ length: 41 }, (_, index) => ({
        ...row.payload.fills[0],
        id: `fill-${index}`,
        symbol: index % 2 ? 'A' : 'GOOGL',
        side: index % 2 ? 'sell' : 'buy',
        at: new Date(Date.UTC(2026, 8, 15, 0, index)).toISOString(),
      })),
    });
  }
  // All data is test-only and fulfilled locally. No real project or account is contacted.
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    if (new URL(route.request().url()).pathname === '/rest/v1/paper_snapshots') {
      await route.fulfill({ json: [row] });
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: expanded ? '미국 주식 저빈도 추세 모의 운용 에피소드' : '테스트 운용 1기' })
  ).toBeVisible();
}

async function chartBounds(page: Page) {
  const grid = page.locator('.recharts-cartesian-grid');
  await expect(grid).toBeVisible();
  // Scroll the HTML container: Firefox does not reliably scroll SVG groups.
  await page.getByRole('slider', { name: /^성과 시계열 탐색/ }).scrollIntoViewIfNeeded();
  const bounds = await grid.boundingBox();
  if (!bounds) throw new Error('Chart plot bounds unavailable');
  return bounds;
}

test('desktop combined chart values, decision reason, and safe ticker navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockSnapshots(page);
  const bounds = await chartBounds(page);
  await page.mouse.move(bounds.x + 4, bounds.y + bounds.height / 2);
  const readout = page.getByRole('status', { name: '선택 시점 성과' });
  await expect(readout).toContainText('$100,000.00');
  await expect(readout).toContainText('0.00%');
  await page.mouse.move(bounds.x + bounds.width - 4, bounds.y + bounds.height / 2);
  await expect(readout).toContainText('$101,250.50');
  await expect(readout).toContainText('+1.25%');
  await expect(page.getByRole('radio', { name: '수익률', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  const reason = page.getByRole('button', { name: 'AMD 매수 체결 상세' });
  await reason.hover();
  await expect(page.getByRole('tooltip')).toContainText(REASON);
  await reason.click();
  await expect(page.getByRole('dialog', { name: 'AMD 매수 체결 상세' })).toContainText(REASON);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(reason).toBeFocused();
  await reason.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  const link = page.getByRole('link', { name: 'AMD 토스증권에서 보기 (새 탭)' }).first();
  await expect(link).toHaveAttribute('href', 'https://www.tossinvest.com/stocks/AMD');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('target', '_blank');
});

test('the selected point stays visible on the chart and the axes stay compact', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockSnapshots(page);
  await chartBounds(page);

  // 선택 지점이 판독값뿐 아니라 그래프 위에도 표시되어야 한다.
  const marker = page.locator('circle[data-selected="true"]');
  const guide = page.locator('.recharts-reference-line-line');
  await expect(marker).toBeVisible();
  // 세로 가이드는 폭이 0인 <line>이라 Playwright의 visible 판정 대상이 아니다. 존재와 위치로 확인한다.
  await expect(guide).toHaveCount(1);

  const explorer = page.getByRole('slider', { name: /^성과 시계열 탐색/ });
  await explorer.focus();
  await page.keyboard.press('End');
  const atEnd = await marker.getAttribute('cx');
  const guideAtEnd = await guide.getAttribute('x1');
  await page.keyboard.press('Home');
  const atStart = await marker.getAttribute('cx');
  const guideAtStart = await guide.getAttribute('x1');
  expect(Number(atStart)).toBeLessThan(Number(atEnd));
  expect(Number(guideAtStart)).toBeLessThan(Number(guideAtEnd));

  // Y축은 축약 통화 표기만 쓴다. $101,250.50 같은 전체 표기는 축 폭을 밀어낸다.
  const yTicks = await page
    .locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')
    .allTextContents();
  expect(yTicks.length).toBeGreaterThan(0);
  for (const tick of yTicks) expect(tick.trim()).toMatch(/^\$[\d.]+[KMB]?$/);

  // X축 눈금에는 시각·타임존을 넣지 않는다. 정확한 시각은 판독값과 툴팁이 담당한다.
  const xTicks = await page
    .locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')
    .allTextContents();
  expect(xTicks.length).toBeGreaterThan(0);
  for (const tick of xTicks) expect(tick).not.toMatch(/GMT|:/);

  // 통화 단위는 고정 판독값의 NAV 라벨에 한 번만 표시한다.
  await expect(page.getByText('NAV (USD)', { exact: true })).toHaveCount(1);
});

test('historical fills without reasons remain blank and the live tab requires login', async ({ page }) => {
  await mockSnapshots(page, false);
  await page.getByRole('button', { name: /체결 상세/ }).click();
  await expect(page.getByRole('dialog')).toContainText('기록된 결정 근거가 없습니다.');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '실운용' }).click();
  await expect(page.getByRole('heading', { name: '실운용 내역 로그인' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '최근 체결' })).toHaveCount(0);
});

test.describe('touch dashboard', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('touch exposes values and decision details without overflow', async ({ page }) => {
    await mockSnapshots(page);
    const bounds = await chartBounds(page);
    await page.touchscreen.tap(bounds.x + 4, bounds.y + bounds.height / 2);
    await expect(page.getByRole('status', { name: '선택 시점 성과' })).toContainText('$100,000.00');
    await expect(page.getByRole('status', { name: '선택 시점 성과' })).toContainText('0.00%');
    const reason = page.getByRole('button', { name: 'AMD 매수 체결 상세' });
    await reason.tap();
    const dialog = page.getByRole('dialog', { name: 'AMD 매수 체결 상세' });
    await expect(dialog).toContainText(REASON);
    const popup = await dialog.boundingBox();
    expect(popup!.x).toBeGreaterThanOrEqual(0);
    expect(popup!.x + popup!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const outsideX = popup!.x > 8 ? popup!.x / 2 : (popup!.x + popup!.width + 390) / 2;
    expect(outsideX < popup!.x || outsideX > popup!.x + popup!.width).toBe(true);
    await page.touchscreen.tap(outsideX, popup!.y + popup!.height / 2);
    await expect(dialog).toHaveCount(0);
  });
});

for (const width of [320, 390, 768, 1440]) {
  test(`dashboard layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockSnapshots(page, true, true);
    const episode = page.getByRole('combobox', { name: '에피소드' });
    await expect(episode).toContainText('미국 주식 저빈도 추세 모의 운용 에피소드');
    const monthBox = await page.getByRole('combobox', { name: '조회 월' }).boundingBox();
    const refreshBox = await page.getByRole('button', { name: '새로고침' }).boundingBox();
    const episodeBox = await episode.boundingBox();
    expect(Math.abs(monthBox!.y - refreshBox!.y)).toBeLessThan(2);
    if (width < 640) expect(monthBox!.y).toBeGreaterThan(episodeBox!.y + episodeBox!.height);
    expect(await episode.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const value = episode.locator('[data-slot="select-value"]');
    expect(await value.evaluate(el => getComputedStyle(el).webkitLineClamp)).toBe('none');
    expect(await value.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    await episode.click();
    await expect(page.getByRole('option', { name: '미국 주식 저빈도 추세 모의 운용 에피소드' })).toBeVisible();
    await page.keyboard.press('Escape');

    const chartPanel = page.locator('section').filter({ has: page.getByRole('heading', { name: '성과 추이' }) });
    const bounds = await chartBounds(page);
    await expect(chartPanel.getByRole('status')).toContainText('$100,300.00');
    await expect(chartPanel.getByRole('status')).toContainText('+0.30%');
    await expect(chartPanel.getByRole('radio')).toHaveCount(0);
    expect(bounds.height).toBeLessThan(350);

    const fills = page.locator('section').filter({ has: page.getByRole('heading', { name: '최근 체결' }) });
    await expect(fills.getByRole('button', { name: /체결 상세/ })).toHaveCount(20);
    if (width < 768) {
      const buy = await fills.getByText('매수', { exact: true }).first().boundingBox();
      const sell = await fills.getByText('매도', { exact: true }).first().boundingBox();
      expect(buy!.x).toBe(sell!.x);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('expanded history keeps equal chart spacing and all fill pages reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mockSnapshots(page, true, true);

  const explorer = page.getByRole('slider');
  await explorer.focus();
  const positions = [];
  await page.keyboard.press('Home');
  for (let index = 0; index < 4; index++) {
    positions.push(Number(await page.locator('circle[data-selected="true"]').getAttribute('cx')));
    await page.keyboard.press('ArrowRight');
  }
  expect(positions[1]! - positions[0]!).toBeCloseTo(positions[2]! - positions[1]!, 0);
  expect(positions[2]! - positions[1]!).toBeCloseTo(positions[3]! - positions[2]!, 0);

  const fills = page.locator('section').filter({ has: page.getByRole('heading', { name: '최근 체결' }) });
  await fills.getByRole('button', { name: '다음' }).click();
  await expect(fills.getByRole('status')).toContainText('21–40건 표시');
  await expect(fills.getByRole('status')).toBeFocused();
  await fills.getByRole('button', { name: '다음' }).click();
  await expect(fills.getByRole('status')).toContainText('41–41건 표시');
  await expect(fills.getByRole('button', { name: '다음' })).toBeDisabled();
  await expect(fills.getByRole('button', { name: /체결 상세/ })).toHaveCount(1);
  await fills.getByRole('button', { name: /체결 상세/ }).click();
  await expect(page.getByRole('dialog')).toContainText('총 매수 지출');
  await page.keyboard.press('Escape');
  await fills.getByRole('button', { name: '이전' }).click();
});

test.describe('time zone selection', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('starts in the browser zone and converts every date display together', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSnapshots(page);
    const selector = page.getByRole('combobox', { name: '표시 시간대' });
    await expect(selector).toHaveAttribute('title', /뉴욕/);
    await expect(page.getByRole('status', { name: '선택 시점 성과' })).toContainText('9월 21일 01:30');
    const main = page.getByRole('main');
    await expect(main).not.toContainText('GMT');
    await expect(main.getByText('데이터 기준 시각 9월 21일 01:30')).toBeVisible();
    await page.getByRole('button', { name: 'AMD 매수 체결 상세' }).click();
    await expect(page.getByRole('dialog')).toContainText('9월 14일 21:00');
    await page.keyboard.press('Escape');

    await selector.click();
    await page.getByRole('option', { name: 'GMT+9 · 서울', exact: true }).click();
    await expect(selector).toContainText('GMT+9');
    await expect(page.getByRole('status', { name: '선택 시점 성과' })).toContainText('9월 21일 14:30');
    await expect(main.getByText('데이터 기준 시각 9월 21일 14:30')).toBeVisible();
    await expect(main.getByRole('definition').filter({ hasText: /^9월 21일 14:29$/ })).toBeVisible();
    const xTicks = page.locator('.recharts-xAxis-tick-labels');
    await expect(xTicks).toContainText('9월 15일');
    await page.getByRole('button', { name: 'AMD 매수 체결 상세' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('9월 15일 10:00');
    await expect(dialog).not.toContainText('GMT');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('unlisted browser time zone', () => {
  test.use({ timezoneId: 'Pacific/Chatham' });

  test('keeps the detected zone selectable after changing to another region', async ({ page }) => {
    await mockSnapshots(page);
    const selector = page.getByRole('combobox', { name: '표시 시간대' });
    await expect(selector).toContainText(/GMT\+1[23]:45/);
    await selector.click();
    await page.getByRole('option', { name: 'GMT+9 · 서울', exact: true }).click();
    await selector.click();
    await page.getByRole('option', { name: /현지/ }).click();
    await expect(selector).toContainText(/GMT\+1[23]:45/);
  });
});

test('month picker uses the shared menu and loads the selected month', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const previous = structuredClone(TEST_ONLY_PAPER_ROW);
  const august = {
    ...previous,
    month: '2026-08',
    as_of: '2026-08-31T05:30:00.000Z',
    payload: { ...previous.payload, month: '2026-08', label: '8월 운용 내역', asOf: '2026-08-31T05:30:00.000Z' },
  };
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    if (new URL(route.request().url()).pathname === '/rest/v1/paper_snapshots') {
      await route.fulfill({ json: [TEST_ONLY_PAPER_ROW, august] });
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
  const month = page.getByRole('combobox', { name: '조회 월' });
  await expect(month).toContainText('2026-09');
  await month.click();
  await page.getByRole('option', { name: '2026-08' }).click();
  await expect(month).toContainText('2026-08');
  await expect(page.getByRole('heading', { name: '8월 운용 내역' })).toBeVisible();
  await expect(month).toBeFocused();
  await month.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(month).toBeFocused();
});

test('serves the favicon declared in the document head', async ({ page, request }) => {
  await mockSnapshots(page);
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href).toBe('/favicon.svg');
  const response = await request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
});

test('paints the chart line under the production CSP', async ({ page }) => {
  const blocked: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  await mockSnapshots(page);
  await page.goto('/');
  const line = page.locator('.recharts-line-curve');
  await expect(line).toBeVisible();
  const stroke = await line.evaluate(node => getComputedStyle(node).stroke);
  expect(stroke).not.toBe('none');
  expect(blocked).toEqual([]);
});
