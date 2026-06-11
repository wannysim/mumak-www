import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { ArrowLink } from '@/src/shared/ui';
import { SocialLinks } from '@/src/widgets/footer';

const TECH_STACK = ['TypeScript', 'React', 'Next.js', 'React Native'] as const;

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
        <p className="mt-1 text-sm text-muted-foreground">{t('role')}</p>
      </header>

      <div className="mb-8">
        <SocialLinks variant="default" />
      </div>

      <div className="prose prose-neutral dark:prose-invert">
        <p className="whitespace-pre-wrap leading-relaxed">{t('intro')}</p>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('stackTitle')}</h2>
        <ul className="flex list-none flex-wrap gap-2 p-0">
          {TECH_STACK.map(tech => (
            <li key={tech} className="rounded-md border border-border px-2.5 py-1 text-sm">
              {tech}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 border-t border-border pt-6">
        <ArrowLink href="/now">{t('nowCta')}</ArrowLink>
      </div>
    </article>
  );
}
