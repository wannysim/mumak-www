import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test.describe('Smart Header - Scroll Behavior', () => {
    // SmartHeader만 선택하는 locator (data-visible 속성으로 구분)
    const getSmartHeader = (page: import('@playwright/test').Page) => page.locator('header[data-visible]');

    // 스크롤 및 상태 변경 대기를 위한 헬퍼 함수.
    // WebKit은 window.scrollTo 후 scroll 이벤트가 즉시 디스패치되지 않을 수 있어
    // (1) documentElement.scrollTop도 함께 세팅하고 (2) scroll 이벤트를 명시 dispatch한 뒤
    // (3) rAF를 두 번 기다려 스크롤 핸들러의 ticking 가드(rAF로 등록된 상태 업데이트)가
    // 실제로 적용될 때까지 대기시킨다. 이 패턴은 chromium/firefox에서도 안전하다.
    const scrollTo = async (page: import('@playwright/test').Page, y: number) => {
      await page.evaluate(async scrollY => {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
        document.documentElement.scrollTop = scrollY;
        if (document.body) {
          document.body.scrollTop = scrollY;
        }
        window.dispatchEvent(new Event('scroll'));
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }, y);
    };

    const waitForHeaderState = async (
      page: import('@playwright/test').Page,
      expectedVisible: string,
      timeout = 2000
    ) => {
      await page.waitForFunction(
        expected => {
          const header = document.querySelector('header[data-visible]') as HTMLElement | null;
          return header?.dataset.visible === expected;
        },
        expectedVisible,
        { timeout }
      );
    };

    test('should hide header when scrolling down', async ({ page }) => {
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);
      await expect(header).toBeVisible();

      // 스크롤 다운 (점진적으로)
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 300);

      await waitForHeaderState(page, 'false');
      await expect(header).toHaveAttribute('data-visible', 'false');
    });

    test('should show header when scrolling up', async ({ page }) => {
      // WebKit에서 과거에 rAF 타이밍 차이로 flake가 있었으나, scrollTo 헬퍼가 double-rAF로
      // 대기하도록 보강된 뒤로는 이 테스트는 webkit에서도 통과해야 한다. 만약 다시 flake가
      // 보고되면 이 위에 `test.skip(browserName === 'webkit', ...)` 한 줄로 되돌리고 사유를
      // 함께 적자.
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);

      // 아래로 스크롤
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 400);
      await waitForHeaderState(page, 'false');

      // 위로 스크롤
      await scrollTo(page, 200);
      await waitForHeaderState(page, 'true');

      await expect(header).toHaveAttribute('data-visible', 'true');
    });

    test('should always show header at top of page', async ({ page }) => {
      // 위 테스트와 같은 이유로 webkit skip을 제거. flake 발생 시 동일하게 한 줄 재추가.
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);

      // 아래로 스크롤 후 최상단으로
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 400);
      await waitForHeaderState(page, 'false');

      await scrollTo(page, 0);
      await waitForHeaderState(page, 'true');

      await expect(header).toHaveAttribute('data-visible', 'true');
      await expect(header).toHaveAttribute('data-at-top', 'true');
    });

    test('should have shadow when scrolled (not at top)', async ({ page }) => {
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);

      // threshold 초과 후 위로 스크롤
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 200);
      await page.waitForTimeout(100);
      await scrollTo(page, 100);

      await waitForHeaderState(page, 'true');

      await expect(header).toHaveAttribute('data-at-top', 'false');
      // 클래스 확인 (공백/개행 포함 가능)
      const hasClass = await header.evaluate(el => el.classList.contains('shadow-sm'));
      expect(hasClass).toBe(true);
    });

    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);
      await expect(header).toBeVisible();

      // 스크롤 다운
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 400);
      await waitForHeaderState(page, 'false');

      // 스크롤 업
      await scrollTo(page, 200);
      await waitForHeaderState(page, 'true');

      await expect(header).toHaveAttribute('data-visible', 'true');
    });

    test('should work on tablet viewport', async ({ page }) => {
      // 위 테스트와 같은 이유로 webkit skip을 제거. flake 발생 시 동일하게 한 줄 재추가.
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);

      // 스크롤 다운
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 500);
      await waitForHeaderState(page, 'false');

      // 스크롤 업
      await scrollTo(page, 300);
      await waitForHeaderState(page, 'true');

      await expect(header).toHaveAttribute('data-visible', 'true');
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);

      // 스크롤 다운
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 600);
      await waitForHeaderState(page, 'false');

      // 스크롤 업
      await scrollTo(page, 400);
      await waitForHeaderState(page, 'true');

      await expect(header).toHaveAttribute('data-visible', 'true');
    });

    test('navigation links should still work after scroll', async ({ page }) => {
      await page.goto('/ko/blog/essay/retrospect-2025');

      const header = getSmartHeader(page);

      // 스크롤 후 헤더 표시
      await scrollTo(page, 100);
      await page.waitForTimeout(100);
      await scrollTo(page, 200);
      await page.waitForTimeout(100);
      await scrollTo(page, 100);
      await waitForHeaderState(page, 'true');

      // 네비게이션 링크 클릭
      await header.getByRole('link', { name: '블로그' }).click();
      await page.waitForURL(/\/ko\/blog$/);

      await expect(page).toHaveURL(/\/ko\/blog$/);
    });
  });

  test.describe('Accessibility', () => {
    // WebKit(Safari)은 macOS의 "Full Keyboard Access" 시스템 설정이 켜져 있어야만
    // Tab 키로 링크 등 비-텍스트 요소에 포커스를 옮긴다. 헤드리스 환경에서는 이 시스템
    // 설정을 토글할 수 없어 Tab 동작 자체가 호스트마다 달라진다(Linux CI vs macOS CI).
    // 환경 의존이라 webkit 프로젝트에서는 의도적으로 skip하며, 키보드 접근성 자체는
    // chromium/firefox 두 브라우저 커버리지로 충분.
    test('should show skip to content link on tab', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'WebKit Tab nav requires macOS Full Keyboard Access (env-dependent)');

      await page.goto('/ko');

      await page.keyboard.press('Tab');

      const skipLink = page.getByRole('link', { name: 'Skip to content' });
      await expect(skipLink).toBeVisible();
      await expect(skipLink).toBeFocused();
    });

    test('should skip to main content when skip link is clicked', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'WebKit Tab nav requires macOS Full Keyboard Access (env-dependent)');

      await page.goto('/ko');

      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // eslint-disable-next-line no-useless-escape
      await expect(page).toHaveURL(/\#main-content$/);
    });
  });

  test.describe('Header Navigation', () => {
    test('should display logo and navigate to home', async ({ page }) => {
      await page.goto('/ko/blog');

      const logo = page.getByRole('link', { name: 'Wan Sim' });
      await expect(logo).toBeVisible();

      await logo.click();
      await page.waitForURL(/\/ko$/);
    });

    test('should display blog navigation link', async ({ page }) => {
      await page.goto('/ko');

      const nav = page.locator('nav');
      await expect(nav.getByRole('link', { name: '블로그' })).toBeVisible();
    });

    test('should navigate to blog page from nav', async ({ page }) => {
      await page.goto('/ko');
      const nav = page.locator('nav');

      await nav.getByRole('link', { name: '블로그' }).click();
      await page.waitForURL(/\/ko\/blog$/);
      await expect(page.getByRole('heading', { level: 1, name: '블로그' })).toBeVisible();
    });

    test('should work in English', async ({ page }) => {
      await page.goto('/en');
      const nav = page.locator('nav');

      await expect(nav.getByRole('link', { name: 'Blog' })).toBeVisible();
    });

    test('should open mobile sheet menu with blog link', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 900 });
      await page.goto('/ko');

      const trigger = page.getByRole('button', { name: 'Open navigation' });
      await trigger.click();

      // Sheet opens as dialog
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();

      await expect(sheet.getByRole('link', { name: '블로그' })).toBeVisible();

      await sheet.getByRole('link', { name: '블로그' }).click();
      await page.waitForURL(/\/ko\/blog$/);
      await expect(page).toHaveURL(/\/ko\/blog$/);
    });

    test('mobile header keeps switchers visible and sheet can close with escape', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 900 });
      await page.goto('/ko');

      await expect(page.getByRole('button', { name: 'Change theme' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Change language' })).toBeVisible();

      const trigger = page.getByRole('button', { name: 'Open navigation' });
      await trigger.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('mobile sheet opens from the left side', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 900 });
      await page.goto('/ko');

      const trigger = page.getByRole('button', { name: 'Open navigation' });
      await trigger.click();

      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();

      // Sheet should have left-0 positioning (opens from left)
      await expect(sheet).toHaveCSS('left', '0px');
    });
  });

  test.describe('Post Navigation', () => {
    test('should navigate from post list to post detail', async ({ page }) => {
      await page.goto('/ko/blog/essay');

      // PostCard wraps article with Link, so we click on the article's parent link
      const firstPostCard = page.locator('article').first();
      await firstPostCard.click();

      // Should be on post detail page
      await page.waitForURL(/\/ko\/blog\/essay\/.+/);
      await expect(page.url()).toMatch(/\/ko\/blog\/essay\/.+/);
    });

    test('should navigate back to list from post detail', async ({ page }) => {
      await page.goto('/ko/blog/essay/first');

      await page.getByRole('link', { name: '목록으로 돌아가기' }).click();
      await page.waitForURL(/\/ko\/blog\/essay$/);
    });
  });

  test.describe('Footer', () => {
    test('should display copyright', async ({ page }) => {
      await page.goto('/ko');

      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
      await expect(footer).toContainText('Wan Sim');
    });

    test('should display RSS, About, and Now links', async ({ page }) => {
      await page.goto('/ko');

      const footer = page.locator('footer');
      await expect(footer.getByRole('link', { name: '소개' })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'RSS' })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Now' })).toBeVisible();
    });

    test('should navigate to About page from footer', async ({ page }) => {
      await page.goto('/ko');

      const footer = page.locator('footer');
      await footer.getByRole('link', { name: '소개' }).click();
      await page.waitForURL(/\/ko\/about$/);

      await expect(page.getByRole('heading', { level: 1, name: '소개' })).toBeVisible();
    });

    test('should navigate to Now page from footer', async ({ page }) => {
      await page.goto('/ko');

      const footer = page.locator('footer');
      await footer.getByRole('link', { name: 'Now' }).click();
      await page.waitForURL(/\/ko\/now$/);

      await expect(page.getByRole('heading', { level: 1, name: 'Now' })).toBeVisible();
    });

    test('should have RSS link pointing to feed.xml', async ({ page }) => {
      await page.goto('/ko');

      const footer = page.locator('footer');
      const rssLink = footer.getByRole('link', { name: 'RSS' });
      await expect(rssLink).toHaveAttribute('href', '/ko/feed.xml');
    });

    test('should display social links', async ({ page }) => {
      await page.goto('/ko');

      const footer = page.locator('footer');
      const githubLink = footer.getByRole('link', { name: /github/i });
      const linkedinLink = footer.getByRole('link', { name: /linkedin/i });

      await expect(githubLink).toBeVisible();
      await expect(linkedinLink).toBeVisible();
    });

    test('social links should open in new tab', async ({ page }) => {
      await page.goto('/ko');

      const footer = page.locator('footer');
      const githubLink = footer.getByRole('link', { name: /github/i });
      const linkedinLink = footer.getByRole('link', { name: /linkedin/i });

      await expect(githubLink).toHaveAttribute('target', '_blank');
      await expect(linkedinLink).toHaveAttribute('target', '_blank');
      await expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(linkedinLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  test.describe('About Page', () => {
    test('should display About page content', async ({ page }) => {
      await page.goto('/ko/about');

      await expect(page.getByRole('heading', { level: 1, name: '소개' })).toBeVisible();
    });

    test('should work in English', async ({ page }) => {
      await page.goto('/en/about');

      await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    });
  });

  test.describe('Now Page', () => {
    test('should display Now page content', async ({ page }) => {
      await page.goto('/ko/now');

      await expect(page.getByRole('heading', { level: 1, name: 'Now' })).toBeVisible();
    });

    test('should work in English', async ({ page }) => {
      await page.goto('/en/now');

      await expect(page.getByRole('heading', { level: 1, name: 'Now' })).toBeVisible();
    });
  });
});
