'use client';

import { Link, usePathname } from '@/src/shared/config/i18n';

interface NavItem {
  href: string;
  label: string;
}

interface NavLinksProps {
  items: NavItem[];
}

export function NavLinks({ items }: NavLinksProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <div className="hidden md:flex items-center gap-4">
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? 'page' : undefined}
          className={`flex min-h-11 items-center px-3 py-2 text-sm rounded-md transition-colors ${
            isActive(item.href) ? 'bg-muted font-medium' : 'hover:bg-muted/50'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
