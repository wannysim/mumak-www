import { expect, test } from '@playwright/test';

test.describe('Lattice Page', () => {
  test('should display the lattice stage', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();
    await expect(page.locator('[data-filter-chip]')).toHaveCount(7);
    await expect(page.locator('[data-video-id]')).toHaveCount(4);
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

  test('should move a pane by dragging its grip', async ({ page }) => {
    await page.goto('/');

    const pane = page.locator('[data-pane-id="1"]');
    const before = await pane.boundingBox();
    const grip = await page.getByRole('button', { name: 'move mono pane' }).boundingBox();
    if (!before || !grip) throw new Error('pane or grip not found');

    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 150, grip.y + 90, { steps: 5 });
    await page.mouse.up();

    const after = await pane.boundingBox();
    expect(after!.x).toBeGreaterThan(before.x + 100);
    expect(after!.y).toBeGreaterThan(before.y + 50);
  });

  test('should resize a pane by dragging its corner handle', async ({ page }) => {
    await page.goto('/');

    const pane = page.locator('[data-pane-id="1"]');
    const before = await pane.boundingBox();
    const handle = await page.getByRole('button', { name: 'resize mono pane' }).boundingBox();
    if (!before || !handle) throw new Error('pane or handle not found');

    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 140, handle.y + 100, { steps: 5 });
    await page.mouse.up();

    const after = await pane.boundingBox();
    expect(after!.width).toBeGreaterThan(before.width + 80);
    expect(after!.height).toBeGreaterThan(before.height + 50);
  });

  test('should have responsive design', async ({ page }) => {
    await page.goto('/');

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();
  });
});
