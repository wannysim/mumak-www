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

// 블로그와 가든을 홈에서 대등하게 다루므로 개수도 같게 맞춘다.
const HOME_ITEM_LIMIT = 3;

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

  const allPosts = getPosts(locale as Locale);
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

      {/* 블로그와 가든은 홈에서 대등한 두 블록이다. 같은 h2 위계, 같은 카드 shell, 같은 개수,
          같은 "전체 보기" 마무리로 맞춘다. 앞서 "최신 글"과 "이전 글"로 나뉘어 있던 두 섹션은
          같은 PostCard를 쓰고 있어서 시각적 차이 없이 헤딩만 갈라진 상태였다. */}
      {allPosts.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-6">{t('latestPosts')}</h2>
          <div className="space-y-6">
            {allPosts.slice(0, HOME_ITEM_LIMIT).map(post => (
              <PostCard
                key={`${post.category}-${post.slug}`}
                post={post}
                locale={locale}
                categoryLabel={translateCategory(post.category)}
              />
            ))}
          </div>
          <div className="mt-6">
            <ArrowLink href="/blog">{t('blogCta', { count: allPosts.length })}</ArrowLink>
          </div>
        </section>
      )}

      <GardenHighlights notes={allNotes.slice(0, HOME_ITEM_LIMIT)} locale={locale} totalCount={allNotes.length} />

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
