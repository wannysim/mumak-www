import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { Skeleton } from '@mumak/ui/components/skeleton';

import { getNotes } from '@/src/entities/note';
import { getPosts } from '@/src/entities/post';
import { buildBlogGraphData, buildGardenGraphData } from '@/src/features/graph';
import { GraphView } from '@/src/features/graph/ui/graph-view';
import { locales, type Locale } from '@/src/shared/config/i18n';

interface GraphPageProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: GraphPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'graph' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

function GraphSkeleton() {
  return (
    <div className="relative w-full h-full">
      <Skeleton className="w-full h-full rounded-none" />
    </div>
  );
}

async function GraphContent({ locale }: { locale: string }) {
  const notes = getNotes(locale as Locale);
  const posts = getPosts(locale as Locale);

  const t = await getTranslations('graph');
  const tCommon = await getTranslations('common');
  const tGarden = await getTranslations('garden');

  // 캔버스 노드 라벨·범례 행·필터 옵션이 한 화면에서 같은 어휘를 쓰도록 분류 문구는 여기 한 곳에서 만든다.
  const categoryLabels = {
    essay: tCommon('essay'),
    articles: tCommon('articles'),
    notes: tCommon('notes'),
  };

  const gardenData = buildGardenGraphData(notes);
  const blogData = buildBlogGraphData(posts, categoryLabels);

  const labels = {
    tabs: {
      garden: t('tabs.garden'),
      blog: t('tabs.blog'),
    },
    controls: {
      back: t('controls.back'),
      search: t('controls.search'),
      filter: t('controls.filter'),
      clearFilters: t('controls.clearFilters'),
      noResults: t('controls.noResults'),
      status: t('controls.status'),
      tags: t('controls.tags'),
      categories: t('controls.categories'),
    },
    panel: {
      description: t('panel.description'),
      close: t('panel.close'),
      viewDetail: t('panel.viewDetail'),
      connections: t('panel.connections'),
      type: {
        note: t('panel.type.note'),
        post: t('panel.type.post'),
        tag: t('panel.type.tag'),
        category: t('panel.type.category'),
      },
      status: {
        seedling: t('panel.status.seedling'),
        budding: t('panel.status.budding'),
        evergreen: t('panel.status.evergreen'),
      },
      category: categoryLabels,
    },
    legend: {
      title: t('legend.title'),
      hint: t('legend.hint'),
      dismissHint: t('legend.dismissHint'),
      sizeNote: t('legend.sizeNote'),
      // 범례 행 라벨은 새 문구를 만들지 않고 가든 status·전역 카테고리 어휘를 재사용한다.
      items: {
        'status:seedling': tGarden('status.seedling'),
        'status:budding': tGarden('status.budding'),
        'status:evergreen': tGarden('status.evergreen'),
        'category:essay': categoryLabels.essay,
        'category:articles': categoryLabels.articles,
        'category:notes': categoryLabels.notes,
        'type:category': t('panel.type.category'),
        'type:tag': t('panel.type.tag'),
      },
    },
    unsupported: {
      title: t('unsupported.title'),
      description: t('unsupported.description'),
    },
    error: {
      title: t('error.title'),
      description: t('error.description'),
    },
  };

  return <GraphView gardenData={gardenData} blogData={blogData} locale={locale} labels={labels} />;
}

// 비시각 대체 경로. GraphView가 useSearchParams를 쓰기 때문에 그것을 감싼 Suspense는
// 통째로 CSR bailout된다 — 이 블록이 그 안에 있으면 프리렌더 HTML에서 사라진다.
// JS가 죽은 환경과 크롤러의 1차 HTML 패스가 바로 이 대체 경로가 필요한 상황이므로
// Suspense 바깥, 즉 서버 렌더 결과에 정적으로 남는 자리에 둔다.
async function GraphAccessibleAlternative({ locale }: { locale: string }) {
  const t = await getTranslations('graph');

  return (
    <>
      {/* 캔버스는 스크린리더에 불투명하다. 페이지의 정체와 동등한 목록 경로를 텍스트로 남긴다. */}
      <div className="sr-only">
        <h1>{t('title')}</h1>
        <p>{t('a11y.summary')}</p>
      </div>
      {/* 포커스되면 드러나는 링크. sr-only div 안에 두면 focus:not-sr-only가 상위 sr-only를 되돌릴 수 없다.
          위치는 좌상단 Back(top-3)과 좌측 검색 입력(top-14)을 피해 잡는다.
          그래프는 가든 탭과 블로그 탭 두 데이터셋을 보여주므로 대체 경로도 둘 다 준다.
          탭은 클라이언트 state라 서버에서 고를 수 없고, 하나만 두면 blog 탭에는 대체 경로가 없다.
          ponytail: (main)/layout.tsx의 skip link와 같은 recipe. 세 번째 사용처가 생기면 shared/ui로 뺀다. */}
      {[
        { href: `/${locale}/garden`, label: t('a11y.listAlternative') },
        { href: `/${locale}/blog`, label: t('a11y.listAlternativeBlog') },
      ].map(link => (
        <a
          key={link.href}
          href={link.href}
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-16 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
        >
          {link.label}
        </a>
      ))}
    </>
  );
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <GraphAccessibleAlternative locale={locale} />
      <Suspense fallback={<GraphSkeleton />}>
        <GraphContent locale={locale} />
      </Suspense>
    </>
  );
}
