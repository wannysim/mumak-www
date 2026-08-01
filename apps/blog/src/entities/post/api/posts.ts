import path from 'path';
import { cache } from 'react';

import type { Locale } from '@/src/shared/config/i18n';
import {
  isPublishable,
  listMdxFiles,
  PageFrontmatterSchema,
  parseMdxFile,
  PostFrontmatterSchema,
} from '@/src/shared/lib/content';
import { calculateReadingTime } from '@/src/shared/lib/reading-time';

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  updated?: string;
  description: string;
  category: Category;
  tags?: string[];
  draft?: boolean;
  readingTime: number;
}

export interface Post {
  meta: PostMeta;
  content: string;
}

export interface PageMeta {
  title: string;
  description: string;
  lastUpdated?: string;
}

const CATEGORIES = ['essay', 'articles', 'notes'] as const;
export type Category = (typeof CATEGORIES)[number];

const CONTENT_DIR = path.join(process.cwd(), 'content');

export function getCategories(): Category[] {
  return [...CATEGORIES];
}

export function isValidCategory(category: string): category is Category {
  return CATEGORIES.includes(category as Category);
}

function getContentPath(locale: Locale, category?: string): string {
  if (category) {
    return path.join(CONTENT_DIR, locale, category);
  }
  return path.join(CONTENT_DIR, locale);
}

export function calculateWordCount(content: string): number {
  const text = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const words = text
    .replace(/[가-힣]/g, '')
    .split(/\s+/)
    .filter(Boolean).length;
  return koreanChars + words;
}

function toPostMeta(filePath: string, slug: string, category: Category): PostMeta {
  const { frontmatter, content } = parseMdxFile(filePath, PostFrontmatterSchema);

  return {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    updated: frontmatter.updated,
    description: frontmatter.description,
    category,
    tags: frontmatter.tags,
    draft: frontmatter.draft,
    readingTime: calculateReadingTime(content),
  };
}

function getPostsUncached(locale: Locale, category?: string): PostMeta[] {
  const posts: PostMeta[] = [];
  const categoriesToSearch = category && isValidCategory(category) ? [category] : CATEGORIES;

  for (const cat of categoriesToSearch) {
    const categoryPath = getContentPath(locale, cat);
    const files = listMdxFiles(categoryPath);

    for (const filePath of files) {
      const slug = path.basename(filePath, '.mdx');
      const post = toPostMeta(filePath, slug, cat);

      if (isPublishable(post)) {
        posts.push(post);
      }
    }
  }

  return posts.toSorted((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

function getPostUncached(locale: Locale, category: string, slug: string): Post | null {
  if (!isValidCategory(category)) {
    return null;
  }

  const categoryPath = getContentPath(locale, category);
  const filePath = path.join(categoryPath, `${slug}.mdx`);
  const files = new Set(listMdxFiles(categoryPath));

  if (!files.has(filePath)) {
    return null;
  }

  const { frontmatter, content } = parseMdxFile(filePath, PostFrontmatterSchema);
  const meta: PostMeta = {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    updated: frontmatter.updated,
    description: frontmatter.description,
    category,
    tags: frontmatter.tags,
    draft: frontmatter.draft,
    readingTime: calculateReadingTime(content),
  };

  return isPublishable(meta) ? { meta, content } : null;
}

function getAllPostSlugsUncached(locale: Locale): Array<{
  category: Category;
  slug: string;
}> {
  return getPosts(locale).map(({ category, slug }) => ({ category, slug }));
}

function getPageUncached(locale: Locale, pageName: string): { meta: PageMeta; content: string } | null {
  const contentPath = getContentPath(locale);
  const filePath = path.join(contentPath, `${pageName}.mdx`);
  const files = new Set(listMdxFiles(contentPath));

  if (!files.has(filePath)) {
    return null;
  }

  const { frontmatter, content } = parseMdxFile(filePath, PageFrontmatterSchema);

  return {
    meta: {
      title: frontmatter.title,
      description: frontmatter.description,
      lastUpdated: frontmatter.lastUpdated,
    },
    content,
  };
}

export const getPosts = cache(getPostsUncached);
export const getPost = cache(getPostUncached);
export const getAllPostSlugs = cache(getAllPostSlugsUncached);
export const getPage = cache(getPageUncached);
