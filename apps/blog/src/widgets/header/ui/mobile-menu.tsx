'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { IconButton } from '@mumak/ui/components/icon-button';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@mumak/ui/components/sheet';

import { Link, usePathname } from '@/src/shared/config/i18n';

interface NavItem {
  href: string;
  label: string;
}

interface MobileMenuProps {
  items: NavItem[];
}

export function MobileMenu({ items }: MobileMenuProps) {
  const pathname = usePathname();
  const t = useTranslations('common');
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <Sheet>
      {/* aria-controls를 undefined로 설정하여 SSR 시 존재하지 않는 ID 참조 문제 방지 */}
      <SheetTrigger asChild aria-controls={undefined}>
        <IconButton aria-label={t('openNavigation')}>
          <span className="sr-only">{t('openNavigation')}</span>
          <Menu className="size-5" aria-hidden />
        </IconButton>
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-56 border-r p-6 data-[state=open]:duration-150 data-[state=closed]:duration-150"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t('navigation')}</SheetTitle>
        </SheetHeader>

        <SheetClose asChild>
          <IconButton className="absolute top-1 right-1" aria-label={t('close')}>
            <X />
          </IconButton>
        </SheetClose>
        <nav className="mt-10 flex flex-col gap-4">
          {items.map(item => (
            <SheetClose asChild key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`flex min-h-11 items-center text-2xl font-semibold transition-colors ${
                  isActive(item.href) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
