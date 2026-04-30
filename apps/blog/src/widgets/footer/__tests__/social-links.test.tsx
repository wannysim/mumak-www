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

    it('should render links with external link attributes', () => {
      render(<SocialLinks />);

      const links = screen.getAllByRole('link');

      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should render SVG icons', () => {
      render(<SocialLinks />);

      const svgIcons = screen.getAllByRole('img');
      expect(svgIcons.length).toBeGreaterThan(0);
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

    it('should render links with external link attributes in compact mode', () => {
      render(<SocialLinks variant="compact" />);

      const links = screen.getAllByRole('link');

      links.forEach(link => {
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
