import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getNotes } from '@/src/entities/note';
import { getPage, getPosts, isValidCategory } from '@/src/entities/post';
import { type Locale } from '@/src/shared/config/i18n';
import { ArrowLink, PageHeader } from '@/src/shared/ui';
import { GardenHighlights } from '@/src/widgets/garden-highlights';
import { PostCard } from '@/src/widgets/post-card';
import { SpotifyVinylClient } from '@/src/widgets/spotify-vinyl';

const HOME_POST_LIMIT = 4;
const HOME_NOTE_LIMIT = 4;

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates({ locale, path: '' }),
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon] = await Promise.all([getTranslations('home'), getTranslations('common')]);
  const allPosts = getPosts(locale as Locale).slice(0, HOME_POST_LIMIT);
  const [featuredPost, ...recentPosts] = allPosts;

  const allNotes = getNotes(locale as Locale);
  const nowPage = getPage(locale as Locale, 'now');

  const translateCategory = (category: string) => {
    if (isValidCategory(category)) {
      return tCommon(category);
    }
    return category;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-8 md:items-center md:justify-between py-4">
        <div className="max-w-2xl space-y-4">
          <PageHeader title={t('title')} description={t('description')} />

          <p className="text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed">{t('intro')}</p>

          <ArrowLink href="/about">{t('aboutCta')}</ArrowLink>
        </div>

        <div className="w-full md:w-auto">
          <SpotifyVinylClient
            initialData={null}
            listeningToLabel={t('listeningTo')}
            lastPlayedLabel={t('lastPlayed')}
          />
        </div>
      </div>

      {featuredPost && (
        <section>
          <h2 className="text-2xl font-semibold mb-6">{t('latestPosts')}</h2>
          <PostCard post={featuredPost} locale={locale} categoryLabel={translateCategory(featuredPost.category)} />
        </section>
      )}

      {recentPosts.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-6">{t('recentPosts')}</h2>
          <div className="space-y-6">
            {recentPosts.map(post => (
              <PostCard
                key={`${post.category}-${post.slug}`}
                post={post}
                locale={locale}
                categoryLabel={translateCategory(post.category)}
              />
            ))}
          </div>
        </section>
      )}

      <GardenHighlights notes={allNotes.slice(0, HOME_NOTE_LIMIT)} locale={locale} totalCount={allNotes.length} />

      {nowPage && (
        <section className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t('nowTitle')}</span> {nowPage.meta.description}
          </p>
          <div className="mt-2">
            <ArrowLink href="/now">{t('nowCta')}</ArrowLink>
          </div>
        </section>
      )}
    </div>
  );
}
