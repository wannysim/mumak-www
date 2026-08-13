'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@mumak/ui/components/button';
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
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <Sheet>
      {/* aria-controls를 undefined로 설정하여 SSR 시 존재하지 않는 ID 참조 문제 방지 */}
      <SheetTrigger asChild aria-controls={undefined}>
        <Button variant="ghost" size="icon-sm" aria-label={t('openNavigation')}>
          <span className="sr-only">{t('openNavigation')}</span>
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        closeLabel={t('close')}
        className="w-56 border-r p-6 data-[state=open]:duration-150 data-[state=closed]:duration-150"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t('navigation')}</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-4">
          {items.map(item => (
            <SheetClose asChild key={item.href}>
              <Link
                href={item.href}
                className={`text-2xl font-semibold transition-colors ${
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
