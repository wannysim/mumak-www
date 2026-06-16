'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Link } from '@/src/shared/config/i18n';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('error');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('description')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
        >
          {t('retry')}
        </button>
        <Link href="/" className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
