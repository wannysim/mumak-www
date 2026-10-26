'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { IconButton } from '@mumak/ui/components/icon-button';

import { LocaleSwitcher } from '@/src/features/switch-locale';
import { ThemeSwitcher } from '@/src/features/switch-theme';

interface GraphToolbarProps {
  locale: string;
  backLabel: string;
}

function GraphToolbar({ locale, backLabel }: GraphToolbarProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    const hasHistory = window.history.length > 1 && document.referrer !== '';
    if (hasHistory) {
      router.back();
    } else {
      router.push(`/${locale}`);
    }
  }, [router, locale]);

  return (
    <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
      <IconButton
        surfaceSize="lg"
        className="pointer-events-auto"
        surfaceClassName="bg-background/60 backdrop-blur-sm [@media(hover:hover)]:group-hover/button:bg-background/80"
        onClick={handleBack}
        aria-label={backLabel}
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </IconButton>

      <div className="flex items-center gap-1 pointer-events-auto">
        <ThemeSwitcher />
        <LocaleSwitcher />
      </div>
    </div>
  );
}

export { GraphToolbar };
