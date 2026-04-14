import { expect, test } from '@playwright/test';

test.describe('Garden Page (PARA Sidebar Navigation)', () => {
  test('should display PARA sidebar and navigate to a project note', async ({ page }) => {
    // Navigate to the Korean Garden index
    await page.goto('/ko/garden');

    // 1. Verify existence of the Sidebar and its Accordion categories
    const sidebar = page.locator('aside').filter({ hasText: 'PARA Garden' });
    await expect(sidebar).toBeVisible();

    // Verify PARA categories are rendered properly
    await expect(sidebar.getByRole('button', { name: /Projects\s*\d+/ })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Areas\s*\d+/ })).toBeVisible();

    // 2. Expand 'Projects' when collapsed and click a note
    const projectsAccordion = sidebar.getByRole('button', { name: /Projects\s*\d+/ });
    if ((await projectsAccordion.getAttribute('aria-expanded')) !== 'true') {
      await projectsAccordion.click();
    }

    // Verify that the link is visible and click it
    const noteLink = sidebar.getByRole('link', { name: '디지털 가든과 Second Brain' });
    await expect(noteLink).toBeVisible();
    await Promise.all([page.waitForURL(/\/ko\/garden\/digital-garden-and-pkm/), noteLink.click()]);

    // 3. Verify navigation to the note page
    await expect(page).toHaveURL(/\/ko\/garden\/digital-garden-and-pkm/);

    // The main heading of the note should be visible
    await expect(page.getByRole('heading', { level: 1, name: '디지털 가든과 Second Brain' })).toBeVisible();

    // The sidebar should still be visible on the note page
    await expect(sidebar).toBeVisible();
    await expect(projectsAccordion).toBeVisible();
  });

  test('should keep linked notes collapsed by default and expand on toggle', async ({ page }) => {
    await page.goto('/ko/garden/movie');

    const section = page.locator('[data-linked-notes-section]');
    await expect(section).toBeVisible();

    const trigger = section.getByRole('button', { name: /연결된 노트\s*\(\d+\)/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const linkedList = section.locator('ul.space-y-2');
    await expect(linkedList).not.toBeVisible();

    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(linkedList).toBeVisible();
    await expect(section.getByRole('link', { name: '시라트 (Sirât, 2025)' })).toBeVisible();
  });
});
