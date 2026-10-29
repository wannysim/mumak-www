import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/app';

describe('application foundation', () => {
  it('mounts an empty reading surface for the next design', () => {
    render(<App />);
    expect(screen.getByRole('main', { name: 'Stickerbook' })).toBeEmptyDOMElement();
  });
});
