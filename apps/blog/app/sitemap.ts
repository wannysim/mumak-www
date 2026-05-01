import type { MetadataRoute } from 'next';

import { getAllNoteTags, getNotes, getNotesByStatus, getNotesByTag, type NoteStatus } from '@/src/entities/note';
import { getCategories, getPosts, type PostMeta } from '@/src/entities/post';
import { locales, type Locale } from '@/src/shared/config/i18n/config';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

const NOTE_STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen'];

function postLastModified(post: PostMeta): Date {
  return new Date(post.updated ?? post.date);
}

function noteLastModified(meta: { created: string; updated?: string }): Date {
  return new Date(meta.updated ?? meta.created);
}

function maxDate(dates: Date[], fallback: Date): Date {
  return dates.length === 0 ? fallback : new Date(Math.max(...dates.map(d => d.getTime())));
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

    routes.push({
      url: `${BASE_URL}/${locale}`,
      lastModified: siteLastMod,
      changeFrequency: 'weekly',
      priority: 1,
    });

    routes.push({
      url: `${BASE_URL}/${locale}/blog`,
      lastModified: blogLastMod,
      changeFrequency: 'weekly',
      priority: 0.9,
    });

    for (const category of getCategories()) {
      const categoryLastMod = maxDate(posts.filter(p => p.category === category).map(postLastModified), buildTime);
      routes.push({
        url: `${BASE_URL}/${locale}/blog/${category}`,
        lastModified: categoryLastMod,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    for (const post of posts) {
      routes.push({
        url: `${BASE_URL}/${locale}/blog/${post.category}/${post.slug}`,
        lastModified: postLastModified(post),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }

    routes.push({
      url: `${BASE_URL}/${locale}/garden`,
      lastModified: gardenLastMod,
      changeFrequency: 'weekly',
      priority: 0.8,
    });

    routes.push({
      url: `${BASE_URL}/${locale}/garden/tags`,
      lastModified: gardenLastMod,
      changeFrequency: 'weekly',
      priority: 0.6,
    });

    for (const tag of getAllNoteTags(typedLocale)) {
      const tagLastMod = maxDate(getNotesByTag(typedLocale, tag.name).map(noteLastModified), buildTime);
      routes.push({
        url: `${BASE_URL}/${locale}/garden/tags/${tag.name}`,
        lastModified: tagLastMod,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }

    for (const status of NOTE_STATUSES) {
      const statusLastMod = maxDate(getNotesByStatus(typedLocale, status).map(noteLastModified), buildTime);
      routes.push({
        url: `${BASE_URL}/${locale}/garden/status/${status}`,
        lastModified: statusLastMod,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }

    for (const note of notes) {
      routes.push({
        url: `${BASE_URL}/${locale}/garden/${note.slug}`,
        lastModified: noteLastModified(note),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }

  return routes;
}
