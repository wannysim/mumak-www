import { render, screen } from '@testing-library/react';

import { SocialLinks } from '../ui/social-links';

import '@testing-library/jest-dom';

// Mock @mumak/ui components
jest.mock('@mumak/ui/components/button', () => ({
  Button: ({
    children,
    className,
    asChild,
    ...props
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
    [key: string]: unknown;
  }) => {
    void asChild; // Radix UI prop - prevent passing to DOM
    return (
      <div data-testid="button" className={className} {...props}>
        {children}
      </div>
    );
  },
}));

jest.mock('@mumak/ui/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('SocialLinks', () => {
  describe('default variant', () => {
    it('should render social links', () => {
      render(<SocialLinks />);

      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    });

    it('should render links with correct href', () => {
      render(<SocialLinks />);

      const githubLink = screen.getByRole('link', { name: /github/i });
      const linkedinLink = screen.getByRole('link', { name: /linkedin/i });

      expect(githubLink).toHaveAttribute('href', expect.stringContaining('github.com'));
      expect(linkedinLink).toHaveAttribute('href', expect.stringContaining('linkedin.com'));
    });

    it('should open external (http) links in a new tab', () => {
      render(<SocialLinks />);

      const externalLinks = screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('http'));

      expect(externalLinks.length).toBeGreaterThan(0);
      externalLinks.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should render a mailto link without new-tab attributes', () => {
      render(<SocialLinks />);

      const mailtoLink = screen.getAllByRole('link').find(link => link.getAttribute('href')?.startsWith('mailto:'));

      expect(mailtoLink).toBeDefined();
      expect(mailtoLink).not.toHaveAttribute('target');
      expect(mailtoLink).not.toHaveAttribute('rel');
    });

    it('should render decorative SVG icons hidden from the a11y tree', () => {
      const { container } = render(<SocialLinks />);

      // 아이콘은 장식용 — 접근성 이름은 링크의 aria-label/sr-only가 제공하므로
      // svg는 aria-hidden으로 a11y 트리에서 감춘다(role="img" 노출 안 함).
      const svgIcons = container.querySelectorAll('svg');
      expect(svgIcons.length).toBeGreaterThan(0);
      svgIcons.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
      expect(screen.queryAllByRole('img')).toHaveLength(0);
    });
  });

  describe('compact variant', () => {
    it('should render social links in compact mode', () => {
      render(<SocialLinks variant="compact" />);

      // compact 모드에서는 텍스트가 sr-only로 숨겨짐
      const githubLink = screen.getByRole('link', { name: /github/i });
      const linkedinLink = screen.getByRole('link', { name: /linkedin/i });

      expect(githubLink).toBeInTheDocument();
      expect(linkedinLink).toBeInTheDocument();
    });

    it('should open external (http) links in a new tab in compact mode', () => {
      render(<SocialLinks variant="compact" />);

      const externalLinks = screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('http'));

      expect(externalLinks.length).toBeGreaterThan(0);
      externalLinks.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<SocialLinks className="custom-class" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});
