import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ClientErrorBoundary } from '../client-error-boundary';

import '@testing-library/jest-dom';

function BrokenWidget(): ReactNode {
  throw new Error('widget failed');
}

describe('ClientErrorBoundary', () => {
  it('renders fallback for the failed subtree only', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <div>
        <ClientErrorBoundary name="BrokenWidget" fallback={<div>Widget unavailable</div>}>
          <BrokenWidget />
        </ClientErrorBoundary>
        <button type="button">Still interactive</button>
      </div>
    );

    expect(screen.getByText('Widget unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Still interactive' })).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ClientErrorBoundary:BrokenWidget]',
      expect.any(Error),
      expect.any(Object)
    );

    consoleErrorSpy.mockRestore();
  });
});
