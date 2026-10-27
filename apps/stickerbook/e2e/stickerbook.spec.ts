import { expect, test, type Page } from '@playwright/test';

const book = (page: Page) => page.getByRole('region', { name: '사진 스티커북' });
const counter = (page: Page) => page.locator('.page-counter');

test('browse, enlarge, restore focus, peel and reset without changing page', async ({ page }) => {
  await page.goto('/');
  await expect(book(page)).toHaveAttribute('data-layout', 'spread');
  const photo = page.getByRole('button', { name: 'The quiet outside 사진 크게 보기' });
  await photo.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(photo).toBeFocused();
  const sticker = page.getByRole('button', { name: '여우 스티커 떼기' }).first();
  await sticker.click();
  await expect(page.getByRole('status')).toContainText('깨끗하게');
  await expect(counter(page)).toContainText('01 — 02');
  await page.getByRole('button', { name: '여우 스티커 다시 붙이기' }).click();
  await sticker.click({ modifiers: ['Shift'] });
  await expect(page.getByRole('status')).toContainText('자국');
  await page.getByRole('button', { name: '스티커 되돌리기' }).click();
  await expect(page.locator('[data-sticker-state="residue"]')).toHaveCount(0);
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(counter(page)).toContainText('03 — 04');
  await expect(book(page)).toHaveAttribute('data-turning', 'false');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(counter(page)).toContainText('05 — 06');
  await expect(page.getByRole('button', { name: '다음 페이지' })).toBeDisabled();
  await page.getByRole('button', { name: '이전 페이지' }).click();
  await expect(counter(page)).toContainText('03 — 04');
});

test('drag can be cancelled then committed, and ignores a second pointer', async ({ page }) => {
  await page.goto('/');
  const bounds = (await book(page).boundingBox())!;
  const x = bounds.x + bounds.width - 12;
  const y = bounds.y + bounds.height - 45;
  await book(page).evaluate(element => {
    element.addEventListener(
      'pointerdown',
      event => {
        element.setAttribute('data-test-pointer-id', String((event as PointerEvent).pointerId));
      },
      { once: true }
    );
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - bounds.width * 0.12, y - 15, { steps: 12 });
  await expect(book(page)).toHaveAttribute('data-turning', 'true');
  await book(page).dispatchEvent('pointerdown', { pointerId: 90, isPrimary: false, clientX: 0 });
  const pointerId = Number(await book(page).getAttribute('data-test-pointer-id'));
  await book(page).dispatchEvent('pointercancel', { pointerId, isPrimary: true });
  await page.mouse.up();
  await expect(book(page)).toHaveAttribute('data-turning', 'false');
  await expect(counter(page)).toContainText('01 — 02');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - bounds.width * 0.35, y - 15, { steps: 20 });
  await page.mouse.up();
  await expect(counter(page)).toContainText('03 — 04');
});

test('keyboard and reduced motion never mount the turning renderer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(counter(page)).toContainText('03 — 04');
  await expect(page.locator('.turn-layer')).toHaveCount(0);
  await book(page).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(counter(page)).toContainText('01 — 02');
  await page.getByRole('button', { name: '책 덮기' }).click();
  await page.getByRole('button', { name: /눌러서 펼치기/ }).click();
  await expect(counter(page)).toContainText('01 — 02');
});

test('rotation keeps the current photo and UI fits small, wide and tablet viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(book(page)).toHaveAttribute('data-layout', 'spread');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(counter(page)).toHaveText('03 — 04 / 06');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(book(page)).toHaveAttribute('data-layout', 'spread');
  await expect(page.getByRole('button', { name: 'Into the green 사진 크게 보기' })).toBeVisible();
  for (const size of [
    { width: 320, height: 568 },
    { width: 382, height: 580 },
    { width: 594, height: 368 },
    { width: 669, height: 867 },
    { width: 951, height: 585 },
    { width: 385, height: 571 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () => {
        const b = (await book(page).boundingBox())!;
        return b.x >= 0 && b.y >= 0 && b.x + b.width <= size.width + 1 && b.y + b.height <= size.height;
      })
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: '다음 페이지' })).toBeInViewport();
  }
});

test('page turns never need a canvas context', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error('Canvas must not be used for book content');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(counter(page)).toContainText('03 — 04');
  await page.getByRole('button', { name: '이전 페이지' }).click();
  await expect(counter(page)).toContainText('01 — 02');
});

test('real segmented viewport avoids hinges in book, tabletop and compact tabletop', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP segment emulation is Chromium-specific');
  const cdp = await page.context().newCDPSession(page);
  for (const scenario of [
    { width: 1134, height: 800, orientation: 'vertical', offset: 550, maskLength: 34, posture: 'book' },
    { width: 1134, height: 800, orientation: 'horizontal', offset: 380, maskLength: 40, posture: 'tabletop' },
    { width: 844, height: 390, orientation: 'horizontal', offset: 175, maskLength: 40, posture: 'tabletop' },
  ]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: scenario.width,
      height: scenario.height,
      deviceScaleFactor: 1,
      mobile: true,
      displayFeature: { orientation: scenario.orientation, offset: scenario.offset, maskLength: scenario.maskLength },
    });
    await page.goto('/');
    await expect(page.getByRole('main')).toHaveAttribute('data-posture', scenario.posture);
    if (scenario.height < 400) {
      const before = await counter(page).innerText();
      const bounds = (await book(page).boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height - 3);
      await page.mouse.down();
      await page.mouse.up();
      await expect(counter(page)).toHaveText(before);
      await page.getByRole('button', { name: '다음 페이지' }).click();
      await expect(counter(page)).toContainText('03 — 04');
      await expect(page.locator('.turn-layer')).toHaveCount(0);
    }
    const photos = page.getByRole('button', { name: /사진 크게 보기/ });
    for (const photo of await photos.all()) {
      const bounds = (await photo.boundingBox())!;
      const start = scenario.orientation === 'vertical' ? bounds.x : bounds.y;
      const end = start + (scenario.orientation === 'vertical' ? bounds.width : bounds.height);
      expect(end <= scenario.offset || start >= scenario.offset + scenario.maskLength).toBe(true);
    }
    await photos.first().click();
    const dialog = (await page.getByRole('dialog').boundingBox())!;
    expect(
      scenario.orientation === 'vertical' ? dialog.x + dialog.width : dialog.y + dialog.height
    ).toBeLessThanOrEqual(scenario.offset);
    await page.keyboard.press('Escape');
    await expect(photos.first()).toBeFocused();
    await page.getByRole('button', { name: '책 덮기' }).click();
    const cover = (await page.getByRole('button', { name: /눌러서 펼치기/ }).boundingBox())!;
    expect(scenario.orientation === 'vertical' ? cover.x + cover.width : cover.y + cover.height).toBeLessThanOrEqual(
      scenario.offset
    );
  }
});

test('touch swipe, slow/fast peel and first tap reattachment work together', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Raw touch timings use CDP');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await page.goto('/');
  const bounds = (await book(page).boundingBox())!;
  const x = bounds.x + bounds.width - 10,
    y = bounds.y + bounds.height - 40;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - bounds.width * 0.7, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(counter(page)).toHaveText('03 — 04 / 06');
  for (const [duration, expected] of [
    [600, 'clean'],
    [30, 'residue'],
  ] as const) {
    const sticker = page.getByRole('button', { name: '여우 스티커 떼기' }).first();
    const box = (await sticker.boundingBox())!;
    const sx = box.x + box.width / 2,
      sy = box.y + box.height / 2;
    const time = Date.now() / 1000;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      timestamp: time,
      touchPoints: [{ x: sx, y: sy }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      timestamp: time + duration / 1000,
      touchPoints: [{ x: sx - 100, y: sy - 10 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      timestamp: time + duration / 1000 + 0.01,
      touchPoints: [],
    });
    await expect(page.locator(`[data-sticker-state="${expected}"]`)).toHaveCount(1);
    const reattach = page.getByRole('button', { name: '여우 스티커 다시 붙이기' });
    const newBox = (await reattach.boundingBox())!;
    const point = { x: newBox.x + newBox.width / 2, y: newBox.y + newBox.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(sticker).toBeVisible();
  }
});

test('small stickers retain separate 44px targets on mobile and every page has two or three', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('header')).toHaveCount(0);
  for (let spread = 0; spread < 3; spread++) {
    const pages = page.getByRole('article');
    await expect(pages).toHaveCount(2);
    for (const leaf of await pages.all()) {
      const stickers = leaf.getByRole('button', { name: '여우 스티커 떼기' });
      const count = await stickers.count();
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(3);
      const photo = (await leaf.getByRole('button', { name: /사진 크게 보기/ }).boundingBox())!;
      for (const sticker of await stickers.all()) {
        const box = (await sticker.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y + box.height / 2 < photo.y || box.y + box.height / 2 > photo.y + photo.height).toBe(true);
        expect(
          await sticker.evaluate(element => {
            const b = element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
          })
        ).toBe(true);
      }
      await stickers.first().click();
      await expect(leaf.getByRole('button', { name: '여우 스티커 다시 붙이기' })).toHaveCount(1);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    if (spread < 2) await page.getByRole('button', { name: '다음 페이지' }).click();
  }
});

test('holding a page keeps its original layout until the pointer moves', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const restingPages = page.locator('.book > .book-pages');
  const before = await restingPages.innerHTML();
  const bounds = (await book(page).boundingBox())!;
  for (const grabY of [0.08, 0.5, 0.92]) {
    const x = bounds.x + bounds.width - 12;
    const y = bounds.y + bounds.height * grabY;
    await page.mouse.move(x, y);
    await page.mouse.down();
    const layer = page.locator('.turn-layer');
    await expect(layer).toHaveAttribute('data-renderer', 'dom');
    await expect(layer).toHaveCSS('visibility', 'hidden');
    expect(await restingPages.innerHTML()).toBe(before);
    expect(await book(page).boundingBox()).toEqual(bounds);
    await page.mouse.move(x, y + (grabY > 0.5 ? -60 : 60), { steps: 10 });
    await expect.poll(async () => Number(await layer.getAttribute('data-progress'))).toBeGreaterThan(0);
    await page.mouse.up();
    await expect(book(page)).toHaveAttribute('data-turning', 'false');
    await expect(counter(page)).toContainText('01 — 02');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 160, y + (grabY > 0.5 ? -70 : 70), { steps: 12 });
    await expect(layer).toHaveCSS('visibility', 'visible');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(book(page)).toHaveAttribute('data-turning', 'false');
    await expect(counter(page)).toContainText('01 — 02');
  }
});

for (const viewport of [
  { width: 1440, height: 960, dpr: 1 },
  { width: 390, height: 844, dpr: 3 },
]) {
  test(`keeps native text metrics and correct reverse faces throughout a turn at ${viewport.width}px DPR${viewport.dpr}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.dpr });
    const page = await context.newPage();
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(book(page)).toHaveAttribute('data-compact', 'false');
    const bounds = (await book(page).boundingBox())!;
    const original = await page
      .locator('.book > .book-pages .photo-exif')
      .first()
      .evaluate(element => ({
        font: getComputedStyle(element).fontSize,
        width: element.getBoundingClientRect().width,
      }));
    for (const direction of [1, -1]) {
      const x = bounds.x + (direction === 1 ? bounds.width - 6 : 6);
      const y = bounds.y + bounds.height * 0.9;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (const progress of [0.015, 0.3, 0.65, 0.96, 1]) {
        await page.mouse.move(x - direction * bounds.width * progress, y, { steps: 4 });
        const layer = page.locator('.turn-layer');
        await expect(layer).toHaveAttribute('data-renderer', 'dom');
        await expect(page.locator('canvas')).toHaveCount(0);
        const text = await layer.locator('.photo-exif').evaluateAll(elements =>
          elements.map(element => ({
            font: getComputedStyle(element).fontSize,
            width: (element as HTMLElement).offsetWidth,
          }))
        );
        for (const item of text) {
          expect(item.font).toBe(original.font);
          expect(Math.abs(item.width - original.width)).toBeLessThan(1);
        }
        if (progress >= 0.3) {
          const back = layer.locator('[data-face="back"]').last();
          await expect(back).toContainText(direction === 1 ? 'Into the green' : 'A place to pause');
          const matrix = await back.evaluate(element => {
            const m = new DOMMatrix(getComputedStyle(element).transform);
            return { determinant: m.a * m.d - m.b * m.c, scale: Math.hypot(m.a, m.b) };
          });
          expect(matrix.determinant).toBeCloseTo(1, 5);
          expect(matrix.scale).toBeCloseTo(1, 5);
        }
      }
      await page.mouse.up();
      await expect(counter(page)).toContainText(direction === 1 ? '03 — 04' : '01 — 02');
      await expect(book(page)).toHaveAttribute('data-turning', 'false');
      await expect(page.getByRole('article')).toHaveCount(2);
      expect(await book(page).boundingBox()).toEqual(bounds);
    }
    await context.close();
  });
}
