import { Button } from '@mumak/ui/components/button';
import { cn } from '@mumak/ui/lib/utils';

import { getIcon, socialLinks, type SocialLink } from '@/src/entities/social';

interface SocialLinksProps {
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
  noWrapper?: boolean;
}

function Icon({ slug, className }: { slug: string; className?: string }) {
  const icon = getIcon(slug);
  if (!icon) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.path} />
    </svg>
  );
}

export function SocialLinks({ variant = 'default', className, noWrapper = false }: SocialLinksProps) {
  const isCompact = variant === 'compact';
  const isMinimal = variant === 'minimal';

  const links = socialLinks.map(({ name, url, iconSlug, ariaLabel, external = true }: SocialLink) => {
    const label = ariaLabel || `Visit ${name}`;
    const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

    if (isMinimal) {
      return (
        <a
          key={name}
          href={url}
          {...externalProps}
          aria-label={label}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon slug={iconSlug} className="size-4" />
          <span className="sr-only">{label}</span>
        </a>
      );
    }

    if (isCompact) {
      return (
        <Button
          key={name}
          variant="ghost"
          size="icon-sm"
          asChild
          aria-label={label}
          className="text-muted-foreground hover:text-foreground"
        >
          <a href={url} {...externalProps}>
            <Icon slug={iconSlug} className="size-4" />
            <span className="sr-only">{label}</span>
          </a>
        </Button>
      );
    }

    return (
      <Button key={name} variant="outline" size="sm" asChild aria-label={label} className="gap-2">
        <a href={url} {...externalProps}>
          <Icon slug={iconSlug} className="size-4" />
          <span>{name}</span>
        </a>
      </Button>
    );
  });

  if (noWrapper) {
    return <>{links}</>;
  }

  return <div className={cn('flex items-center gap-2', className)}>{links}</div>;
}
