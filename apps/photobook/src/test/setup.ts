import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { resetViewport } from './browser';

import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetViewport();
});
