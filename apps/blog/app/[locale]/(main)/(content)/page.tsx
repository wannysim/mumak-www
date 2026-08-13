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

  // 홈은 페이지 제목이 곧 사이트명이라 layout의 '%s | Wan Sim' 템플릿을 타면 "Wan Sim | Wan Sim"이
  // 된다. 홈만 absolute로 템플릿을 우회한다. 템플릿 자체는 건드리지 않는다 — 뒤집으면 모든 글의
  // 고유 제목이 사이트명 뒤로 밀려 탭·검색결과에서 잘린다.
  //
  // openGraph는 손대지 않는다. Next의 메타데이터 병합은 shallow라 여기서 openGraph를 적으면
  // layout의 openGraph가 통째로 교체되고, 그 세그먼트에 붙어 있던 opengraph-image.tsx의
  // 콘텐츠 해시 URL까지 함께 날아간다(홈만 캐시 버스터 없는 OG 이미지를 광고하게 된다).
  // 비워 두면 og:title/og:description은 아래 title/description을 그대로 상속한다.
  return {
    title: { absolute: t('metaTitle') },
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

  // 모바일 히어로의 세로 여백을 줄여 첫 카드가 첫 화면 안에 들어오게 한다(e2e/home.spec.ts).
  // 컨테이너가 이미 py-8/px-4를 주므로 히어로의 py-4와 위젯의 p-4는 모바일 세로 배치에서 중복이다.
  return (
    <div className="space-y-6 md:space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-5 md:gap-8 md:items-center md:justify-between py-0 md:py-4">
        <div className="max-w-2xl space-y-3 md:space-y-4">
          <PageHeader title={t('title')} description={t('description')} />

          {/* 클램프하지 않는다. 3문장짜리 1인칭 자기소개는 사이트의 저작성 신호이고, 펼칠 수단
              없는 line-clamp는 압축이 아니라 은닉이다(en 인트로가 더 길어 en에서만 마지막
              문장이 잘렸다). 모바일 세로 압축은 py/gap/위젯 패딩 쪽에서만 가져온다. */}
          <p
            data-slot="home-intro"
            className="text-base sm:text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed"
          >
            {t('intro')}
          </p>

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
          {/* h2 클래스는 GardenHighlights의 h2와 문자 그대로 같아야 한다(두 블록 대칭 계약). */}
          <h2 className="text-2xl font-semibold mb-4 md:mb-6">{t('latestPosts')}</h2>
          {/* 카드 간격은 섹션 간격(space-y-6 = 24px)보다 좁아야 "최신 글"과 "최신 노트"의
              경계가 공간으로 읽힌다. GardenHighlights와 문자 그대로 같아야 한다. */}
          <div className="space-y-4 md:space-y-6">
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
