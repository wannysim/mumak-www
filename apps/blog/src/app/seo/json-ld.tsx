import type { NoteMeta, NoteStatus } from '@/src/entities/note';
import type { PostMeta } from '@/src/entities/post';
import { socialLinks } from '@/src/entities/social';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

const AUTHOR_SAME_AS = socialLinks.map(link => link.url);

const AUTHOR_KNOWS_ABOUT = [
  'Frontend Engineering',
  'React',
  'Next.js',
  'TypeScript',
  'Software Architecture',
  'Web Performance',
];

const AUTHOR_PERSON = {
  '@type': 'Person' as const,
  '@id': `${BASE_URL}/#author`,
  name: 'Wan Sim',
  url: BASE_URL,
  jobTitle: 'Software Engineer',
  knowsAbout: AUTHOR_KNOWS_ABOUT,
  ...(AUTHOR_SAME_AS.length > 0 ? { sameAs: AUTHOR_SAME_AS } : {}),
};

interface WebSiteJsonLdParams {
  locale: string;
}

export function generateWebSiteJsonLd({ locale }: WebSiteJsonLdParams) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'Wan Sim',
    url: `${BASE_URL}/${locale}`,
    description: locale === 'ko' ? '생각과 기록을 위한 공간' : 'A space for thoughts and records',
    inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
    author: AUTHOR_PERSON,
    publisher: {
      '@id': `${BASE_URL}/#author`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/${locale}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

interface SiteNavigationJsonLdParams {
  locale: string;
}

export function generateSiteNavigationJsonLd({ locale }: SiteNavigationJsonLdParams) {
  const navItems =
    locale === 'ko'
      ? [
          { name: '블로그', url: `${BASE_URL}/${locale}/blog` },
          { name: '가든', url: `${BASE_URL}/${locale}/garden` },
          { name: '소개', url: `${BASE_URL}/${locale}/about` },
          { name: 'Now', url: `${BASE_URL}/${locale}/now` },
        ]
      : [
          { name: 'Blog', url: `${BASE_URL}/${locale}/blog` },
          { name: 'Garden', url: `${BASE_URL}/${locale}/garden` },
          { name: 'About', url: `${BASE_URL}/${locale}/about` },
          { name: 'Now', url: `${BASE_URL}/${locale}/now` },
        ];

  return {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    '@id': `${BASE_URL}/#navigation`,
    name: locale === 'ko' ? '사이트 네비게이션' : 'Site Navigation',
    hasPart: navItems.map((item, index) => ({
      '@type': 'WebPage',
      '@id': `${item.url}`,
      name: item.name,
      url: item.url,
      position: index + 1,
    })),
  };
}

interface BreadcrumbJsonLdParams {
  items: Array<{ name: string; url: string }>;
}

export function generateBreadcrumbJsonLd({ items }: BreadcrumbJsonLdParams) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function localeToLanguageTag(locale: string) {
  return locale === 'ko' ? 'ko-KR' : 'en-US';
}

interface BlogPostingJsonLdParams {
  post: PostMeta;
  locale: string;
  category: string;
  wordCount?: number;
}

export function generateBlogPostingJsonLd({ post, locale, category, wordCount }: BlogPostingJsonLdParams) {
  const url = `${BASE_URL}/${locale}/blog/${category}/${post.slug}`;
  const datePublished = post.date;
  const dateModified = post.updated ?? post.date;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished,
    dateModified,
    url,
    inLanguage: localeToLanguageTag(locale),
    image: [`${url}/opengraph-image`],
    ...(post.tags && post.tags.length > 0 ? { keywords: post.tags.join(', ') } : {}),
    articleSection: category,
    ...(typeof wordCount === 'number' ? { wordCount } : {}),
    author: {
      '@type': 'Person',
      '@id': `${BASE_URL}/#author`,
      name: 'Wan Sim',
      url: BASE_URL,
    },
    publisher: {
      '@id': `${BASE_URL}/#author`,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
}

interface GardenNoteJsonLdParams {
  note: NoteMeta;
  locale: string;
  description: string;
  outgoingNotes?: Array<{ slug: string; title: string }>;
  backlinks?: Array<{ slug: string; title: string }>;
  wordCount?: number;
}

const STATUS_DESCRIPTION: Record<NoteStatus, string> = {
  seedling: 'Early-stage seed: rough idea, notes still forming.',
  budding: 'Developing: ideas taking shape, partially refined.',
  evergreen: 'Mature: well-formed, refined and stable.',
};

export function generateGardenNoteJsonLd({
  note,
  locale,
  description,
  outgoingNotes = [],
  backlinks = [],
  wordCount,
}: GardenNoteJsonLdParams) {
  const url = `${BASE_URL}/${locale}/garden/${note.slug}`;
  const datePublished = note.created;
  const dateModified = note.updated ?? note.created;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: note.title,
    description,
    datePublished,
    dateModified,
    url,
    inLanguage: localeToLanguageTag(locale),
    image: [`${url}/opengraph-image`],
    about: STATUS_DESCRIPTION[note.status],
    ...(note.tags && note.tags.length > 0 ? { keywords: note.tags.join(', ') } : {}),
    articleSection: 'Digital Garden',
    ...(typeof wordCount === 'number' ? { wordCount } : {}),
    ...(outgoingNotes.length > 0
      ? {
          mentions: outgoingNotes.map(target => ({
            '@type': 'Article',
            '@id': `${BASE_URL}/${locale}/garden/${target.slug}`,
            url: `${BASE_URL}/${locale}/garden/${target.slug}`,
            name: target.title,
          })),
        }
      : {}),
    ...(backlinks.length > 0
      ? {
          citation: backlinks.map(source => ({
            '@type': 'Article',
            '@id': `${BASE_URL}/${locale}/garden/${source.slug}`,
            url: `${BASE_URL}/${locale}/garden/${source.slug}`,
            name: source.title,
          })),
        }
      : {}),
    isPartOf: {
      '@type': 'CreativeWorkSeries',
      name: 'Digital Garden',
      url: `${BASE_URL}/${locale}/garden`,
    },
    author: {
      '@type': 'Person',
      '@id': `${BASE_URL}/#author`,
      name: 'Wan Sim',
      url: BASE_URL,
    },
    publisher: {
      '@id': `${BASE_URL}/#author`,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
}

interface JsonLdScriptProps {
  data: Record<string, unknown>;
}

export function JsonLdScript({ data }: JsonLdScriptProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
