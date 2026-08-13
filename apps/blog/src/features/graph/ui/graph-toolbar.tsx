'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { Button } from '@mumak/ui/components/button';

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
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 pointer-events-auto bg-background/60 backdrop-blur-sm hover:bg-background/80"
        onClick={handleBack}
        aria-label={backLabel}
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1 pointer-events-auto">
        <ThemeSwitcher />
        <LocaleSwitcher />
      </div>
    </div>
  );
}

export { GraphToolbar };
