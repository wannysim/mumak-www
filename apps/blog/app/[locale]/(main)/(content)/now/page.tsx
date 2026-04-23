import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MDXRemote } from 'next-mdx-remote-client/rsc';
import { notFound } from 'next/navigation';

import { mdxComponents } from '@/mdx-components';
import { getPage } from '@/src/entities/post';
import { type Locale } from '@/src/shared/config/i18n';
import { mdxOptions } from '@/src/shared/config/mdx';
import { formatDateForLocale } from '@/src/shared/lib/date';

interface NowPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NowPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'now' });
  const page = getPage(locale as Locale, 'now');

  return {
    title: page?.meta.title ?? t('title'),
    description: page?.meta.description ?? t('description'),
  };
}

export default async function NowPage({ params }: NowPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('now');
  const page = getPage(locale as Locale, 'now');

  if (!page) {
    notFound();
  }

  return (
    <article className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{page.meta.title || t('title')}</h1>
        <p className="text-lg text-muted-foreground">{page.meta.description || t('description')}</p>
      </header>

      <div className="prose prose-neutral dark:prose-invert">
        <MDXRemote source={page.content} components={mdxComponents} options={mdxOptions} />
      </div>

      <footer className="mt-8 pt-4 border-t border-border text-sm text-muted-foreground">
        {t('lastUpdated')}:{' '}
        <time dateTime={formatDateForLocale(page.meta.lastUpdated, locale).dateTime}>
          {formatDateForLocale(page.meta.lastUpdated, locale).text}
        </time>
      </footer>
    </article>
  );
}
