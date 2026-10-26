import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@mumak/ui/components/dropdown-menu';
import { IconButton } from '@mumak/ui/components/icon-button';

import '@testing-library/jest-dom';

it('forwards the native ref and preserves Enter/Space without submitting a form by default', async () => {
  const ref = createRef<HTMLButtonElement>();
  const click = jest.fn();
  const submit = jest.fn(event => event.preventDefault());
  const user = userEvent.setup();
  render(
    <form onSubmit={submit}>
      <IconButton ref={ref} aria-label="Search" onClick={click}>
        <svg />
      </IconButton>
    </form>
  );
  const button = screen.getByRole('button', { name: 'Search' });
  expect(ref.current).toBe(button);
  await user.tab();
  await user.keyboard('{Enter} ');
  expect(click).toHaveBeenCalledTimes(2);
  expect(submit).not.toHaveBeenCalled();
});

it('preserves disabled behavior', async () => {
  const click = jest.fn();
  const user = userEvent.setup();
  render(
    <IconButton disabled aria-label="Search" onClick={click}>
      <svg />
    </IconButton>
  );
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(click).not.toHaveBeenCalled();
});

it('composes with a Radix trigger without losing popup state, ref or focus return', async () => {
  const user = userEvent.setup();
  render(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label="Theme">
          <svg />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Dark</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const button = screen.getByRole('button', { name: 'Theme' });
  expect(button).toHaveAttribute('aria-haspopup', 'menu');
  await user.tab();
  await user.keyboard('{Enter}');
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('menuitem', { name: 'Dark' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute('aria-expanded', 'false');
});
