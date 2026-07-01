import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/src/features/switch-locale';
import { ThemeSwitcher } from '@/src/features/switch-theme';
import { Link } from '@/src/shared/config/i18n';
import { ClientErrorBoundary } from '@/src/shared/ui/client-error-boundary';

import { MobileMenu } from './mobile-menu';
import { NavLinks } from './nav-links';

// 그래프는 블로그/가든의 형제 콘텐츠 섹션이 아니라 두 섹션을 가로지르는 몰입형 "보기"다.
// (immersive 라우트 그룹, 풀스크린) 그래서 전역 nav 형제에서 빼고, 각 섹션(blog/garden)
// 인덱스의 PageHeader 아래 ArrowLink로 해당 탭에 딥링크한다.
const navItems = [
  { href: '/blog', labelKey: 'blog' },
  { href: '/garden', labelKey: 'garden' },
] as const;

export async function Navigation() {
  const t = await getTranslations('common');

  const items = navItems.map(item => ({
    href: item.href,
    label: t(item.labelKey),
  }));

  return (
    <nav className="border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="md:hidden">
              <MobileMenu items={items} />
            </div>

            <Link href="/" className="text-xl font-bold">
              Wan Sim
            </Link>

            <NavLinks items={items} />
          </div>

          <div className="flex items-center gap-2">
            <ClientErrorBoundary name="ThemeSwitcher">
              <ThemeSwitcher />
            </ClientErrorBoundary>
            <ClientErrorBoundary name="LocaleSwitcher">
              <LocaleSwitcher />
            </ClientErrorBoundary>
          </div>
        </div>
      </div>
    </nav>
  );
}
