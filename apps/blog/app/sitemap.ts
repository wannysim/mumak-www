import type { MetadataRoute } from 'next';

import { buildAlternates } from '@/src/app/seo';
import { getAllNoteTags, getNotes, getNotesByStatus, getNotesByTag, type NoteStatus } from '@/src/entities/note';
import { getCategories, getPosts, type PostMeta } from '@/src/entities/post';
import { locales, type Locale } from '@/src/shared/config/i18n/config';

const NOTE_STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen'];

type SitemapEntry = MetadataRoute.Sitemap[number];
type EntryFields = Pick<SitemapEntry, 'lastModified' | 'changeFrequency' | 'priority'>;

function postLastModified(post: PostMeta): Date {
  return new Date(post.updated ?? post.date);
}

function noteLastModified(meta: { created: string; updated?: string }): Date {
  return new Date(meta.updated ?? meta.created);
}

function maxDate(dates: Date[], fallback: Date): Date {
  return dates.length === 0 ? fallback : new Date(Math.max(...dates.map(d => d.getTime())));
}

// URL과 hreflang alternates를 buildAlternates 한 곳에서 만든다.
// path는 locale prefix를 뺀 경로(예: '/blog', '' = locale 루트)다.
function localizedEntry(locale: string, path: string, fields: EntryFields): SitemapEntry {
  const { canonical, languages } = buildAlternates({ locale, path });
  return {
    url: canonical,
    alternates: { languages },
    ...fields,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [];
  const buildTime = new Date();

  for (const locale of locales) {
    const typedLocale = locale as Locale;
    const posts = getPosts(typedLocale);
    const notes = getNotes(typedLocale);

    const postLastMods = posts.map(postLastModified);
    const noteLastMods = notes.map(noteLastModified);
    const siteLastMod = maxDate([...postLastMods, ...noteLastMods], buildTime);
    const blogLastMod = maxDate(postLastMods, buildTime);
    const gardenLastMod = maxDate(noteLastMods, buildTime);

    // 카테고리별 최신 수정일은 posts 한 번의 순회로 모은다
    // (카테고리 루프 안에서 매번 filter+map으로 재순회하지 않도록).
    const postModsByCategory = new Map<string, Date[]>();
    for (const post of posts) {
      const mods = postModsByCategory.get(post.category) ?? [];
      mods.push(postLastModified(post));
      postModsByCategory.set(post.category, mods);
    }

    routes.push(localizedEntry(locale, '', { lastModified: siteLastMod, changeFrequency: 'weekly', priority: 1 }));

    routes.push(
      localizedEntry(locale, '/blog', { lastModified: blogLastMod, changeFrequency: 'weekly', priority: 0.9 })
    );

    for (const category of getCategories()) {
      const categoryLastMod = maxDate(postModsByCategory.get(category) ?? [], buildTime);
      routes.push(
        localizedEntry(locale, `/blog/${category}`, {
          lastModified: categoryLastMod,
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      );
    }

    for (const post of posts) {
      routes.push(
        localizedEntry(locale, `/blog/${post.category}/${post.slug}`, {
          lastModified: postLastModified(post),
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      );
    }

    routes.push(
      localizedEntry(locale, '/garden', { lastModified: gardenLastMod, changeFrequency: 'weekly', priority: 0.8 })
    );

    routes.push(
      localizedEntry(locale, '/garden/tags', { lastModified: gardenLastMod, changeFrequency: 'weekly', priority: 0.6 })
    );

    for (const tag of getAllNoteTags(typedLocale)) {
      const tagLastMod = maxDate(getNotesByTag(typedLocale, tag.name).map(noteLastModified), buildTime);
      routes.push(
        localizedEntry(locale, `/garden/tags/${tag.name}`, {
          lastModified: tagLastMod,
          changeFrequency: 'weekly',
          priority: 0.5,
        })
      );
    }

    for (const status of NOTE_STATUSES) {
      const statusLastMod = maxDate(getNotesByStatus(typedLocale, status).map(noteLastModified), buildTime);
      routes.push(
        localizedEntry(locale, `/garden/status/${status}`, {
          lastModified: statusLastMod,
          changeFrequency: 'weekly',
          priority: 0.5,
        })
      );
    }

    for (const note of notes) {
      routes.push(
        localizedEntry(locale, `/garden/${note.slug}`, {
          lastModified: noteLastModified(note),
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      );
    }
  }

  return routes;
}
