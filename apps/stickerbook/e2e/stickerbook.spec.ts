import { expect, test, type Locator, type Page } from '@playwright/test';

function folio(page: Page) {
  return page.locator('[data-folio]');
}

/** 페이지 오류를 모은다. 테스트 끝에서 비어 있어야 한다. */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('요소 위치를 찾지 못했다');
  }
  return box;
}

/**
 * 화면 밖으로 나간 요소가 없는지. 페이지는 스크롤하지 않고(html·body overflow: hidden) 책·러닝 헤드가 fixed라
 * scrollWidth로는 넘침을 잡을 수 없어, 보이는 요소의 상자가 뷰포트 안에 있는지 본다.
 */
async function expectInsideViewport(page: Page, locators: Locator[]) {
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error('뷰포트 크기가 없다');
  }
  for (const locator of locators) {
    const box = await boxOf(locator);
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
  }
}

/** 러닝 헤드가 글자 한 줄이고 책 위를 덮지 않는지. */
async function expectOneLineHeadAboveBook(page: Page) {
  const lines = await page.getByRole('banner').evaluate(header =>
    Array.from(header.querySelectorAll('p'), line => ({
      height: line.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(line).lineHeight),
    }))
  );
  for (const line of lines) {
    expect(line.height).toBeLessThanOrEqual(line.lineHeight + 0.5);
  }
  const head = await boxOf(page.getByRole('banner'));
  const book = await boxOf(page.locator('.book'));
  expect(head.y + head.height).toBeLessThanOrEqual(book.y + 0.5);
}

async function openWithEnter(page: Page, firstPages = '01–02쪽') {
  const book = page.getByRole('button', { name: '책 펼치기' });
  await expect(book).toBeVisible();
  await book.focus();
  await page.keyboard.press('Enter');
  const region = page.getByRole('region', { name: '펼친 책' });
  await expect(region).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(firstPages);
  return region;
}

/** 버튼 상자 안 한 점에서 눌러 여러 단계로 끌고 뗀다. */
async function drag(page: Page, from: { x: number; y: number }, moves: Array<{ x: number; y: number }>) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const to of moves) {
    await page.mouse.move(to.x, to.y, { steps: 8 });
  }
  await page.mouse.up();
}

test.describe('Stickerbook', () => {
  test('shows the closed book first', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page).toHaveTitle('Stickerbook');
    await expect(page.getByRole('main', { name: 'Stickerbook' })).toBeVisible();
    const book = page.getByRole('button', { name: '책 펼치기' });
    await expect(book).toBeVisible();
    await expect(book).toHaveAccessibleDescription(/앞표지: 심완/);
    await expect(folio(page)).toHaveText('앞표지');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(['rgb(255, 255, 255)', 'oklch(1 0 0)']).toContain(background);
    await expectInsideViewport(page, [book, page.getByRole('banner')]);
    expect(errors).toEqual([]);
  });

  test('opens with Enter and turns with ArrowRight and the page buttons', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const region = await openWithEnter(page);
    await expect(region).toBeFocused();
    await expect(folio(page)).toContainText('01–02/08');

    const previous = region.getByRole('button', { name: '이전 쪽' });
    const next = region.getByRole('button', { name: '다음 쪽' });
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    for (const button of [previous, next]) {
      const box = await boxOf(button);
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
    await expectInsideViewport(page, [page.locator('.book'), page.getByRole('banner'), previous, next]);
    await expectOneLineHeadAboveBook(page);

    await page.keyboard.press('ArrowRight');
    await expect(folio(page)).toContainText('03–04/08');
    await expect(page.getByRole('status')).toHaveText('03–04쪽');

    // 키보드로 누른 넘김 버튼에는 포커스가 남아 이어서 넘길 수 있다(macOS WebKit은 마우스 클릭으로 버튼에 포커스를 주지 않는다).
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(folio(page)).toContainText('05–06/08');
    await expect(next).toBeFocused();

    await next.click();
    await expect(folio(page)).toContainText('07–08/08');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(region.getByText('판권면 · 임시')).toBeVisible();

    await previous.click();
    await expect(folio(page)).toContainText('05–06/08');
    expect(errors).toEqual([]);
  });

  test('turns one page per key press even while a leaf is landing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await openWithEnter(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(folio(page)).toContainText('07–08/08');
    await expect(page.getByRole('status')).toHaveText('07–08쪽');
  });

  test('turns pages by dragging forward and back, and returns a short drag without announcing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const region = await openWithEnter(page);
    const status = page.getByRole('status');
    const zone = await boxOf(region.getByRole('button', { name: '다음 쪽' }));
    // 기둥의 왼쪽 끝이 쪽 바깥 가장자리 띠의 안쪽이다. 그 근처 아래쪽을 잡는다.
    const start = { x: zone.x + 20, y: zone.y + zone.height * 0.8 };

    // 끌었다가 누른 자리 너머로 되돌려 놓으면 넘기기 전 화면으로 돌아오고 알리지 않는다.
    // (놓기 속도는 마지막 100ms를 보므로, 되돌린 끝점을 누른 점보다 바깥에 두어 이동 속도와 무관하게 복귀가 되게 한다.)
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 200, start.y - 10, { steps: 8 });
    await expect(region).toHaveAttribute('data-phase', 'turning');
    await expect(region.locator('[data-role="flap"]')).toHaveCount(1);
    await page.mouse.move(start.x + 60, start.y, { steps: 8 });
    await page.mouse.up();
    await expect(region).toHaveAttribute('data-phase', 'open');
    await expect(folio(page)).toContainText('01–02/08');
    await expect(status).toHaveText('01–02쪽');

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 60, start.y - 10, { steps: 6 });
    await expect(region).toHaveAttribute('data-phase', 'turning');
    await expect(folio(page)).toContainText('01–02/08');
    await page.mouse.move(start.x - 800, start.y - 20, { steps: 12 });
    await page.mouse.up();
    await expect(folio(page)).toContainText('03–04/08');
    await expect(region).toHaveAttribute('data-phase', 'open');
    await expect(status).toHaveText('03–04쪽');

    const back = await boxOf(region.getByRole('button', { name: '이전 쪽' }));
    const backStart = { x: back.x + back.width - 20, y: back.y + back.height * 0.8 };
    await drag(page, backStart, [{ x: backStart.x + 800, y: backStart.y - 20 }]);
    await expect(folio(page)).toContainText('01–02/08');
    await expect(status).toHaveText('01–02쪽');
  });

  test('crossfades instead of folding when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const region = await openWithEnter(page);
    await expect(region).toHaveAttribute('data-motion', 'reduced');
    await expect(page.locator('.closed-stage')).toHaveCount(0);
    const next = region.getByRole('button', { name: '다음 쪽' });
    await next.click();
    await expect(folio(page)).toContainText('03–04/08');
    await expect(region).toHaveAttribute('data-phase', 'open');

    // 끄는 동안에는 접지 않고 펼침면 전체를 투명도로 교차한다(임시, tech-research.md 7장 U7 (c)).
    const zone = await boxOf(next);
    const start = { x: zone.x + 20, y: zone.y + zone.height * 0.5 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 300, start.y, { steps: 6 });
    await expect(region).toHaveAttribute('data-phase', 'turning');
    await expect(region.locator('[data-role="flap"]')).toHaveCount(0);
    const current = region.locator('[data-role="upper"]');
    await expect(current).toHaveCount(2);
    // 들어올 때의 짧은 투명도 애니메이션이 끝난 뒤에도 인라인 투명도가 그대로 보여야 한다.
    await expect
      .poll(() =>
        current.first().evaluate(element => {
          const inline = (element as HTMLElement).style.opacity;
          return getComputedStyle(element).opacity === inline && Number(inline) < 1;
        })
      )
      .toBe(true);
    await page.mouse.move(start.x - 800, start.y, { steps: 6 });
    await page.mouse.up();
    await expect(folio(page)).toContainText('05–06/08');
    await expect(region).toHaveAttribute('data-phase', 'open');
  });

  test('shows one page at a time on a tall phone screen and turns it by swiping across the photo', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expectInsideViewport(page, [page.getByRole('button', { name: '책 펼치기' }), page.getByRole('banner')]);
    const region = await openWithEnter(page, '02쪽');
    await expect(region).toHaveAttribute('data-layout', 'single');
    await expect(folio(page)).toContainText('02/08');
    await expect(region.getByRole('img')).toHaveCount(1);
    const next = region.getByRole('button', { name: '다음 쪽' });
    const previous = region.getByRole('button', { name: '이전 쪽' });
    await expectInsideViewport(page, [page.locator('.book'), page.getByRole('banner'), previous, next]);
    await expectOneLineHeadAboveBook(page);

    await next.click();
    await expect(folio(page)).toContainText('03/08');
    await expect(region.getByRole('img')).toHaveCount(1);

    // 쪽 가운데에서 시작한 스와이프도 넘긴다(오른쪽 절반은 다음 쪽, 왼쪽 절반은 이전 쪽).
    const book = await boxOf(page.locator('.book'));
    const y = book.y + book.height * 0.5;
    await drag(page, { x: book.x + book.width * 0.6, y }, [{ x: book.x + book.width * 0.05, y }]);
    await expect(folio(page)).toContainText('04/08');
    await drag(page, { x: book.x + book.width * 0.4, y }, [{ x: book.x + book.width * 0.95, y }]);
    await expect(folio(page)).toContainText('03/08');
    await expect(page.getByRole('status')).toHaveText('03쪽');
    expect(errors).toEqual([]);
  });

  for (const size of [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
  ]) {
    test(`keeps the running head on one line above the book at ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await expectInsideViewport(page, [page.getByRole('button', { name: '책 펼치기' }), page.getByRole('banner')]);
      const region = await openWithEnter(page);
      await expect(region).toHaveAttribute('data-layout', 'spread');
      await expectOneLineHeadAboveBook(page);
      await expectInsideViewport(page, [
        page.locator('.book'),
        page.getByRole('banner'),
        region.getByRole('button', { name: '이전 쪽' }),
        region.getByRole('button', { name: '다음 쪽' }),
      ]);
    });
  }
});
