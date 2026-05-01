import { render } from '@testing-library/react';

jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    children ? <script {...props}>{children}</script> : <script {...props} />,
}));

jest.mock('@vercel/analytics/next', () => ({
  Analytics: () => null,
}));

jest.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => null,
}));

import { GoogleAnalytics } from '../analytics';

describe('GoogleAnalytics', () => {
  const originalEnv = process.env.NEXT_PUBLIC_GA_ID;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_GA_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_ID = originalEnv;
    }
  });

  it('should render nothing when NEXT_PUBLIC_GA_ID is undefined', () => {
    delete process.env.NEXT_PUBLIC_GA_ID;

    const { container } = render(<GoogleAnalytics />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should render nothing when NEXT_PUBLIC_GA_ID is empty string', () => {
    process.env.NEXT_PUBLIC_GA_ID = '';

    const { container } = render(<GoogleAnalytics />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should render gtag script and init when NEXT_PUBLIC_GA_ID is set', () => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TESTID123';

    const { container } = render(<GoogleAnalytics />);

    const html = container.innerHTML;
    expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-TESTID123');
    expect(html).toContain("gtag('config', 'G-TESTID123')");
  });
});
