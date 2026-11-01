import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TEST_ONLY_PAPER_PAYLOAD } from '@/__tests__/fixtures/test-snapshot';
import { FillDetails } from '@/components/fill-details';
import { parseSnapshotPayload } from '@/lib/dashboard-schema';

it('defers hidden fill detail formatting until the real popover opens', async () => {
  const fill = parseSnapshotPayload(structuredClone(TEST_ONLY_PAPER_PAYLOAD)).fills[0]!;
  // Intl exposes a function-valued accessor; model the accessor as a property
  // so Vitest's getter overload observes it without treating it as a method.
  const prototype: { readonly format: unknown } = Intl.DateTimeFormat.prototype;
  const format = vi.spyOn(prototype, 'format', 'get');
  try {
    render(<FillDetails fill={fill} currency="USD" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(format).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: `${fill.symbol} 매수 체결 상세` }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('체결 금액');
    expect(format).toHaveBeenCalled();
  } finally {
    format.mockRestore();
  }
});
