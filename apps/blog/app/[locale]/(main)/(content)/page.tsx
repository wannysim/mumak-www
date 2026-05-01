import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getPosts, isValidCategory } from '@/src/entities/post';
import { type Locale } from '@/src/shared/config/i18n';
import { PostCard } from '@/src/widgets/post-card';
import { SpotifyVinylClient } from '@/src/widgets/spotify-vinyl';

const HOME_POST_LIMIT = 4;

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

  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');
  const allPosts = getPosts(locale as Locale).slice(0, HOME_POST_LIMIT);
  const [featuredPost, ...recentPosts] = allPosts;

  const translateCategory = (category: string) => {
    if (isValidCategory(category)) {
      return tCommon(category);
    }
    return category;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-8 md:items-center md:justify-between py-4">
        <p className="text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-2xl">{t('intro')}</p>

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
    </div>
  );
}
