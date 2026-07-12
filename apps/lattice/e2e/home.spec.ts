import { expect, test } from '@playwright/test';

test.describe('Lattice Page', () => {
  test('should display the lattice stage', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();
    await expect(page.locator('[data-filter-chip]')).toHaveCount(7);
    // 비디오 레이어 4개 + 웹캠 PIP(cam)
    await expect(page.locator('[data-video-id]')).toHaveCount(5);
    await expect(page.locator('[data-pane-id]')).toHaveCount(2);
  });

  test('should spawn a backdrop-filter pane when a chip is clicked', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'filter mono' }).click();

    await expect(page.locator('[data-pane-id]')).toHaveCount(3);
    await expect(page.locator('[data-pane-id]').last()).toHaveCSS('backdrop-filter', /grayscale/);
  });

  test('should render an ascii canvas inside the ascii pane', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('[data-pane-id="2"] canvas')).toBeVisible();
  });

  test('should move a pane by dragging its body', async ({ page }) => {
    await page.goto('/');

    const pane = page.locator('[data-pane-id="1"]');
    const before = await pane.boundingBox();
    if (!before) throw new Error('pane not found');

    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 150, before.y + before.height / 2 + 90, {
      steps: 5,
    });
    await page.mouse.up();

    const after = await pane.boundingBox();
    expect(after!.x).toBeGreaterThan(before.x + 100);
    expect(after!.y).toBeGreaterThan(before.y + 50);
  });

  test('should resize a pane from its bottom-right corner', async ({ page }) => {
    await page.goto('/');

    const pane = page.locator('[data-pane-id="1"]');
    const before = await pane.boundingBox();
    if (!before) throw new Error('pane not found');

    await page.mouse.move(before.x + before.width - 4, before.y + before.height - 4);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width + 140, before.y + before.height + 100, {
      steps: 5,
    });
    await page.mouse.up();

    const after = await pane.boundingBox();
    expect(after!.width).toBeGreaterThan(before.width + 80);
    expect(after!.height).toBeGreaterThan(before.height + 50);
  });

  test('should resize a pane from its left edge keeping the right side fixed', async ({ page }) => {
    await page.goto('/');

    const pane = page.locator('[data-pane-id="1"]');
    const before = await pane.boundingBox();
    if (!before) throw new Error('pane not found');

    await page.mouse.move(before.x + 3, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x - 90, before.y + before.height / 2, { steps: 5 });
    await page.mouse.up();

    const after = await pane.boundingBox();
    expect(after!.x).toBeLessThan(before.x);
    expect(after!.width).toBeGreaterThan(before.width + 50);
    expect(after!.x + after!.width).toBeCloseTo(before.x + before.width, 0);
  });

  test('should move a video layer by dragging its body', async ({ page }) => {
    await page.goto('/');

    const bunny = page.locator('[data-video-id="bunny"]');
    const before = await bunny.boundingBox();
    if (!before) throw new Error('video not found');

    // 중앙부는 mono 존이, 우측은 z가 더 높은 sintel이 덮고 있으므로
    // 어느 쪽에도 가리지 않는 bunny 상단 영역을 잡는다
    const grabX = before.x + before.width * 0.4;
    const grabY = before.y + 30;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + 120, grabY + 80, { steps: 5 });
    await page.mouse.up();

    const after = await bunny.boundingBox();
    expect(after!.x).toBeGreaterThan(before.x + 80);
  });

  test('should move the webcam PIP by dragging its body', async ({ page }) => {
    await page.goto('/');

    const cam = page.locator('[data-video-id="cam"]');
    const before = await cam.boundingBox();
    if (!before) throw new Error('cam not found');

    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 200, before.y + before.height / 2 - 150, {
      steps: 5,
    });
    await page.mouse.up();

    const after = await cam.boundingBox();
    expect(after!.x).toBeGreaterThan(before.x + 150);
    expect(after!.y).toBeLessThan(before.y - 100);
  });

  test('should spawn a pane where a chip is dropped after a drag', async ({ page }) => {
    await page.goto('/');

    const chip = await page.getByRole('button', { name: 'filter vhs' }).boundingBox();
    if (!chip) throw new Error('chip not found');

    await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2);
    await page.mouse.down();
    await page.mouse.move(500, 200, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator('[data-pane-id]')).toHaveCount(3);
    const spawned = await page.locator('[data-pane-id]').last().boundingBox();
    // 놓은 지점(500,200)이 새 존의 중심이 된다
    expect(spawned!.x + spawned!.width / 2).toBeCloseTo(500, 0);
    expect(spawned!.y + spawned!.height / 2).toBeCloseTo(200, 0);
  });

  test('should have responsive design', async ({ page }) => {
    await page.goto('/');

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();
  });
});
