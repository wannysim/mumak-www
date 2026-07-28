import { expect, test } from '@playwright/test';

/**
 * 누를 수 있는 요소는 전부 같은 press 피드백을 가져야 한다.
 *
 * 기본값에 맡기면 갈린다. shadcn Button은 `active:not-aria-[haspopup]:translate-y-px`라
 * 드로어 트리거(곡 제목·싱크 편집)가 빠지고, ToggleGroupItem에는 :active 규칙이 없다.
 * src/index.css가 이를 scale(0.97)로 통일하는데, 그게 유지되는지 여기서 잡는다.
 *
 * :active는 합성 이벤트로 안정적으로 재현되지 않아 CDP로 강제한다(chromium 전용).
 */
const CONTROLS: Array<[string, string]> = [
  ['이전 곡', '[aria-label="이전 곡"]'],
  ['다음 곡', '[aria-label="다음 곡"]'],
  ['곡 목록 트리거', '[aria-label*="곡 목록 열기"]'],
  ['재생', '[aria-label="재생"]'],
  ['반복 모드', '[aria-label^="재생 모드"]'],
  ['테마', '[aria-label*="테마로 전환"]'],
  ['싱크 편집 트리거', '[aria-label="싱크 편집 모드"]'],
  ['표시 토글', '[data-slot="toggle-group-item"]'],
];

const PRESSED = 'matrix(0.97, 0, 0, 0.97, 0, 0)';

test.describe('Press feedback', () => {
  test('every control presses the same way', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'CSS.forcePseudoState는 CDP(chromium) 전용');

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');

    for (const [name, selector] of CONTROLS) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      expect(nodeId, `${name}을(를) 찾지 못했다`).toBeTruthy();

      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      // transition이 끝난 뒤를 봐야 한다. 누른 직후에는 아직 중간값이다.
      await expect
        .poll(async () => {
          const { computedStyle } = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
          return computedStyle.find(entry => entry.name === 'transform')?.value;
        })
        .toBe(PRESSED);

      const { computedStyle } = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
      // Button 기본 translate-y-px가 살아 있으면 일부만 1px 더 내려가 어긋난다.
      expect(computedStyle.find(entry => entry.name === 'translate')?.value, `${name} translate`).toBe('none');

      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
  });
});
