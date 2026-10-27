import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiteSearch } from '../ui/site-search';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'ko',
}));

jest.mock('@/src/shared/hooks', () => ({
  useSearchIndex: () => ({ posts: [], notes: [] }),
  useSearchPaletteShortcut: jest.requireActual('@/src/shared/hooks/use-search-palette-shortcut')
    .useSearchPaletteShortcut,
}));

// JSDOM has no layout. Model visibility only; keep the real CommandDialog and its focus lifecycle.
function mockVisibility(element: HTMLElement) {
  jest.spyOn(element, 'getClientRects').mockImplementation(() => {
    const rects = element.hidden ? [] : [new DOMRect(0, 0, 44, 44)];
    return Object.assign(rects, { item: (index: number) => rects[index] ?? null });
  });
}

function setup(viewport: 'mobile' | 'desktop' = 'mobile') {
  const view = render(
    <>
      <button type="button">Other action</button>
      <SiteSearch categoryLabels={{}} />
    </>
  );
  const [desktop, mobile] = screen.getAllByRole('button', { name: 'aria' });
  const other = screen.getByRole('button', { name: 'Other action' });
  for (const element of [desktop!, mobile!, other]) mockVisibility(element);
  function setViewport(value: 'mobile' | 'desktop') {
    desktop!.hidden = value !== 'desktop';
    mobile!.hidden = value !== 'mobile';
  }
  setViewport(viewport);
  return { ...view, desktop: desktop!, mobile: mobile!, other, setViewport, user: userEvent.setup() };
}

async function closeSearch(user: ReturnType<typeof userEvent.setup>, target: HTMLElement) {
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(target).toHaveFocus());
}

describe('SiteSearch focus lifecycle', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['mobile', 'desktop'] as const)('returns to the %s opener after clicking and closing', async viewport => {
    const state = setup(viewport);
    await state.user.click(state[viewport]);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    await closeSearch(state.user, state[viewport]);
  });

  it('remembers the clicked trigger even when pointer activation does not focus it', async () => {
    const { user, mobile, other } = setup();
    other.focus();
    // Safari may activate a button without focusing it; click must take precedence over activeElement.
    fireEvent.click(mobile);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    await closeSearch(user, mobile);
  });

  it('clears the previous opener before a subsequent shortcut invocation', async () => {
    const { user, mobile, other } = setup();
    await user.click(mobile);
    await closeSearch(user, mobile);
    other.focus();
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    await closeSearch(user, other);
  });

  it.each(['mobile', 'desktop'] as const)('uses the %s trigger when the shortcut starts from body', async viewport => {
    const state = setup(viewport);
    expect(document.body).toHaveFocus();
    await state.user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    await closeSearch(state.user, state[viewport]);
  });

  it.each(['mobile', 'desktop'] as const)(
    'uses the visible trigger if the %s opener disappears at a breakpoint',
    async viewport => {
      const state = setup(viewport);
      await state.user.click(state[viewport]);
      await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
      const destination = viewport === 'mobile' ? 'desktop' : 'mobile';
      state.setViewport(destination);
      await closeSearch(state.user, state[destination]);
    }
  );

  it('falls back to the visible trigger if the shortcut origin is removed', async () => {
    const { user, mobile, other, rerender } = setup();
    other.focus();
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    rerender(
      <>
        {null}
        <SiteSearch categoryLabels={{}} />
      </>
    );
    expect(other.isConnected).toBe(false);
    await closeSearch(user, mobile);
  });
});
