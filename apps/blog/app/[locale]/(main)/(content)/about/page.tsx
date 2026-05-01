import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { SocialLinks } from '@/src/widgets/footer';

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates({ locale, path: '/about' }),
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('about');

  return (
    <article className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('description')}</p>
      </header>

      <div className="mb-8">
        <SocialLinks variant="default" />
      </div>

      <div className="prose prose-neutral dark:prose-invert">
        <p className="whitespace-pre-wrap leading-relaxed">{t('intro')}</p>
      </div>
    </article>
  );
}
