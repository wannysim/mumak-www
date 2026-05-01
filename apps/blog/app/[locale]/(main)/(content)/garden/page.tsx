import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getNotes } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';

interface GardenPageProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: GardenPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'garden' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates({ locale, path: '/garden' }),
  };
}

export default async function GardenPage({ params }: GardenPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const notes = getNotes(locale as Locale);
  const t = await getTranslations('garden');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('noteCount', { count: notes.length })}</p>
      </header>

      <section className="prose dark:prose-invert max-w-none">
        <p>
          {t('intro.line1')} <br />
          {t('intro.line2')} <br />
          {t('intro.line3')}
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">{t('categories.title')}</h3>
        <ul className="space-y-4">
          <li>
            <strong>{t('categories.projects.label')}</strong>: {t('categories.projects.description')}
          </li>
          <li>
            <strong>{t('categories.areas.label')}</strong>: {t('categories.areas.description')}
          </li>
          <li>
            <strong>{t('categories.resources.label')}</strong>: {t('categories.resources.description')}
          </li>
          <li>
            <strong>{t('categories.archives.label')}</strong>: {t('categories.archives.description')}
          </li>
        </ul>
      </section>
    </div>
  );
}
