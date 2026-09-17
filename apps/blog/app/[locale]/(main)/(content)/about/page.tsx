import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { ArrowLink } from '@/src/shared/ui';
import { ContentImage } from '@/src/shared/ui/content-image';
import { ImageZoom } from '@/src/shared/ui/image-zoom';
import { SocialLinks } from '@/src/widgets/footer';

const TECH_STACK = ['TypeScript', 'React', 'Next.js', 'React Native'] as const;
const PROFILE_IMAGE =
  'https://img.wannysim.com/blog/5dac9df09fd36092cc7c76e2181736b6f23186e16f6cae5d6c9c07babc8ac46b/content-v1';

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
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('description')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('role')}</p>
      </header>

      <SocialLinks variant="default" className="mb-8 flex-wrap" />

      <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-8">
        <ImageZoom className="w-40 justify-self-center sm:col-start-2 sm:row-start-1 sm:w-full">
          <ContentImage
            src={`${PROFILE_IMAGE}/image.jpg`}
            zoomSrc={`${PROFILE_IMAGE}/image.webp`}
            alt={t('photoAlt')}
            width={1067}
            height={1600}
            sizes="(min-width: 640px) 192px, 160px"
            className="h-auto w-full"
            loading="eager"
            decoding="async"
          />
        </ImageZoom>

        <div className="prose prose-neutral dark:prose-invert sm:col-start-1 sm:row-start-1">
          <p className="m-0 whitespace-pre-wrap break-keep leading-relaxed">{t('intro')}</p>
        </div>
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
