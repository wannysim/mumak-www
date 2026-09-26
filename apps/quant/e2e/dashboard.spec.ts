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
  const guide = page.locator('.selection-guide .recharts-reference-line-line');
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

test('two paper strategies share the episode selector and dashboard sections', async ({ page }) => {
  const lowFrequency = structuredClone(TEST_ONLY_PAPER_ROW);
  lowFrequency.episode_id = 'sep2026-low-frequency';
  lowFrequency.payload.episodeId = 'sep2026-low-frequency';
  lowFrequency.payload.label = '미국 주식 저빈도 추세 모의운용';
  const intraday = structuredClone(TEST_ONLY_PAPER_ROW);
  intraday.episode_id = 'paper-intraday-2026-09';
  intraday.as_of = '2026-09-26T03:43:19.000Z';
  Object.assign(intraday.payload, {
    episodeId: 'paper-intraday-2026-09',
    status: 'pending',
    label: '미국 주식 장중 15분 ORB 모의운용 · 시작 대기',
    startedAt: '2026-09-26T03:43:19.000Z',
    asOf: '2026-09-26T03:43:19.000Z',
    summary: {
      ...intraday.payload.summary,
      startingNav: '100000',
      currentNav: '100000',
      cash: '100000',
      profit: '0',
      returnPct: '0',
    },
    history: [{ at: '2026-09-26T03:43:19.000Z', nav: '100000', profit: '0', returnPct: '0' }],
    holdings: [],
    fills: [],
    notes: ['테스트 전용 시작 대기 스냅샷입니다.'],
  });
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    if (new URL(route.request().url()).pathname === '/rest/v1/paper_snapshots') {
      await route.fulfill({ json: [intraday, lowFrequency] });
    } else {
      await route.abort();
    }
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '미국 주식 장중 15분 ORB 모의운용 · 시작 대기' })).toBeVisible();
  await expect(page.getByText('시작 대기', { exact: true })).toBeVisible();
  await expect(page.getByText('운용 중', { exact: true })).toHaveCount(0);
  await expect(page.getByText('보유 종목이 없습니다.')).toBeVisible();
  await expect(page.getByText('최근 체결이 없습니다.')).toBeVisible();
  const episode = page.getByRole('combobox', { name: '에피소드' });
  await episode.click();
  await page.getByRole('option', { name: '미국 주식 저빈도 추세 모의운용' }).click();

  await expect(page.getByRole('heading', { name: '미국 주식 저빈도 추세 모의운용' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '성과 추이' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '보유 종목' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '최근 체결' })).toBeVisible();
  await expect(page.getByText('TEST').first()).toBeVisible();
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

test('the month-start NAV baseline spans the plot under the production CSP', async ({ page }) => {
  const blocked: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockSnapshots(page);
  await chartBounds(page);

  const baseline = page.locator('.baseline-nav .recharts-reference-line-line');
  await expect(baseline).toHaveCount(1);
  // 가로선이라 높이 0 — visible 판정 대신 좌표와 해석된 stroke로 확인한다.
  const line = await baseline.evaluate(node => ({
    y1: Number(node.getAttribute('y1')),
    y2: Number(node.getAttribute('y2')),
    stroke: getComputedStyle(node).stroke,
  }));
  expect(line.y1).toBe(line.y2);
  expect(line.stroke).not.toMatch(/^(none|)$/);
  const chartPanel = page.locator('section').filter({ has: page.getByRole('heading', { name: '성과 추이' }) });
  await expect(chartPanel).toContainText(/월 시작 NAV \$[\d,]+\.\d{2}/);
  expect(blocked).toEqual([]);
});

const ALLOCATION_SYMBOLS = [
  'AMD',
  'GOOGL',
  'MSFT',
  'NVDA',
  'TSLA',
  'AVGO',
  'META',
  'NFLX',
  'CRM',
  'ORCL',
  'ADBE',
  'QCOM',
  'INTC',
];

async function mockAllocationSnapshot(page: Page, symbolCount: number) {
  const base = structuredClone(TEST_ONLY_PAPER_ROW.payload.holdings[0]!);
  const holdings = ALLOCATION_SYMBOLS.slice(0, symbolCount).map((symbol, index) => ({
    ...base,
    symbol,
    marketValue: String(8000 - index * 400),
  }));
  const row = {
    ...structuredClone(TEST_ONLY_PAPER_ROW),
    payload: { ...structuredClone(TEST_ONLY_PAPER_ROW.payload), holdings },
  };
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    if (new URL(route.request().url()).pathname === '/rest/v1/paper_snapshots') {
      await route.fulfill({ json: [row] });
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '테스트 운용 1기' })).toBeVisible();
}

test('holding weights are readable as text and every slice keeps a resolved color', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAllocationSnapshot(page, 3);

  const legend = page.getByRole('list', { name: '보유 종목 평가액 비중' });
  await expect(legend.getByRole('listitem')).toHaveCount(3);
  await expect(legend).toContainText('AMD');
  await expect(legend).toContainText('35.1%');
  await expect(legend).toContainText('33.3%');
  await expect(legend).toContainText('31.6%');

  // CSP가 style-src 'self'라 주입된 <style>이 차단되면 stroke가 none으로 떨어져 도넛이 사라진다.
  // 색이 실제 값으로 해석되는지까지 확인한다.
  const strokes = await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '보유 종목' }) })
    .locator('circle')
    .evaluateAll(nodes => nodes.map(node => getComputedStyle(node).stroke));
  expect(strokes).toHaveLength(3);
  for (const stroke of strokes) expect(stroke).not.toMatch(/^(none|)$/);
  expect(new Set(strokes).size).toBe(3);
});

test('hovering a slice shows its symbol, weight, and value next to the arc', async ({ page }) => {
  const blocked: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAllocationSnapshot(page, 3);

  const figure = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '보유 종목' }) })
    .locator('figure');
  await figure.scrollIntoViewIfNeeded();
  const box = await figure.boundingBox();
  if (!box) throw new Error('Donut bounds unavailable');
  // 첫 조각(AMD)은 12시에서 시계방향으로 시작한다. 1시 방향 링 위를 가리킨다.
  const ring = (box.width * 15.9155) / 42;
  const angle = Math.PI / 6;
  await page.mouse.move(
    box.x + box.width / 2 + Math.sin(angle) * ring,
    box.y + box.height / 2 - Math.cos(angle) * ring
  );

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('AMD');
  await expect(tooltip).toContainText('35.1%');
  await expect(tooltip).toContainText('$8,000.00');
  // CSP가 인라인 위치를 막으면 툴팁이 figure 왼쪽 위 모서리로 떨어진다. 1시 방향 기준점에서
  // 중심 쪽(왼쪽 아래)으로 펼쳐지므로 오른쪽 끝이 도넛 중심보다 오른쪽, 위쪽 끝이 figure 안이어야 한다.
  const tip = await tooltip.boundingBox();
  if (!tip) throw new Error('Tooltip bounds unavailable');
  expect(tip.x + tip.width).toBeGreaterThan(box.x + box.width / 2);
  expect(tip.y).toBeGreaterThanOrEqual(box.y);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(tooltip).toHaveCount(0);
  expect(blocked).toEqual([]);
});

test('a long tail folds into one 기타 slice and the donut fits the narrowest phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockAllocationSnapshot(page, 13);

  const legend = page.getByRole('list', { name: '보유 종목 평가액 비중' });
  await expect(legend.getByRole('listitem')).toHaveCount(10);
  await expect(legend).toContainText('기타 4종목');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

// 첫 로드는 항상 성공시키고, 이후 실패 여부는 테스트가 직접 켠다. 앱이 초기에 몇 번
// 요청하는지에 기대면(StrictMode·auth 효과) 실패 케이스가 flaky해진다.
async function mockRefreshOutcome(page: Page) {
  const state = { failing: false };
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    if (new URL(route.request().url()).pathname === '/rest/v1/paper_snapshots') {
      if (state.failing) await route.fulfill({ status: 500, json: { message: 'unavailable' } });
      else await route.fulfill({ json: [TEST_ONLY_PAPER_ROW] });
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '테스트 운용 1기' })).toBeVisible();
  return state;
}

test('the refresh button reports success with the data timestamp and stays CSP clean', async ({ page }) => {
  const blocked: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await mockRefreshOutcome(page);

  const notice = page.getByRole('status', { name: '알림' });
  // 누르기 전에는 비어 있어야 한다. 라이브 영역 자체는 미리 떠 있다.
  await expect(notice).toBeEmpty();

  await page.getByRole('button', { name: '운용 내역 전체 새로고침' }).click();
  await expect(notice).toContainText('운용 내역을 새로 불러왔습니다.');
  await expect(notice).toContainText('데이터 기준 시각');
  // 토스트가 대시보드를 영구히 가리지 않는다.
  await expect(notice).toBeEmpty({ timeout: 10_000 });
  expect(blocked).toEqual([]);
});

test('a failed refresh says so instead of silently leaving the old screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const state = await mockRefreshOutcome(page);
  state.failing = true;

  await page.getByRole('button', { name: '운용 내역 전체 새로고침' }).click();
  const notice = page.getByRole('status', { name: '알림' });
  await expect(notice).toContainText('운용 내역을 불러오지 못했습니다.');
  await notice.getByRole('button', { name: '알림 닫기' }).click();
  await expect(notice).toBeEmpty();
});
