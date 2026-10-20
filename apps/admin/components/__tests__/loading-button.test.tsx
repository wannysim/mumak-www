import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { LoadingButton } from '@mumak/ui/components/loading-button';

// The shared package has no DOM test runner; its consuming app verifies the contract.
it('preserves the native button and blocks activation while keeping pending focus', async () => {
  const user = userEvent.setup();
  const click = jest.fn();
  const submit = jest.fn(event => event.preventDefault());
  const ref = createRef<HTMLButtonElement>();
  const view = (loading: boolean) => (
    <form onSubmit={submit}>
      <LoadingButton ref={ref} type="submit" loading={loading} loadingLabel="저장 중…" onClick={click}>
        변경 저장
      </LoadingButton>
    </form>
  );
  const { rerender } = render(view(false));
  const button = screen.getByRole('button', { name: '변경 저장' });
  button.focus();
  await user.keyboard('{Enter}');
  expect(click).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1);
  rerender(view(true));
  expect(ref.current).toBe(button);
  expect(button).toHaveFocus();
  expect(button).toHaveAccessibleName('저장 중…');
  expect(button).not.toBeDisabled();
  fireEvent.click(button);
  await user.keyboard('{Enter} ');
  expect(click).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1);
  rerender(view(false));
  expect(button).toHaveAccessibleName('변경 저장');
  await user.keyboard(' ');
  expect(submit).toHaveBeenCalledTimes(2);
});

it('keeps validation-disabled state distinct from loading', async () => {
  const click = jest.fn();
  render(
    <LoadingButton disabled loadingLabel="저장 중…" onClick={click}>
      저장
    </LoadingButton>
  );
  const button = screen.getByRole('button', { name: '저장' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(button).toHaveAttribute('aria-busy', 'false');
  fireEvent.click(button);
  expect(click).not.toHaveBeenCalled();
});
