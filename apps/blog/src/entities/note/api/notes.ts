import path from 'path';
import { cache } from 'react';

import type { Locale } from '@/src/shared/config/i18n';
import {
  cleanupInlineMarkdown,
  extractHeadings,
  extractInAppLinks,
  isPublishable,
  listMdxFiles,
  NoteFrontmatterSchema,
  parseMdxFile,
} from '@/src/shared/lib/content';
import { calculateReadingTime } from '@/src/shared/lib/reading-time';
import { extractWikilinkSlugs, normalizeHeadingToAnchor } from '@/src/shared/lib/wikilink';

export type NoteStatus = 'seedling' | 'budding' | 'evergreen';

export interface NoteMeta {
  category: string;
  slug: string;
  title: string;
  created: string;
  updated?: string;
  status: NoteStatus;
  tags?: string[];
  draft?: boolean;
  parent?: string;
  /** 위키링크(`[[slug]]`)가 가리키는 노트 slug. 가든 안쪽 그래프의 정의다. */
  outgoingLinks: string[];
  /** 본문의 표준 마크다운 링크가 가리키는 사이트 내부 경로(정규화됨). 블로그 글과의 연결에 쓴다. */
  outgoingHrefs: string[];
  excerpt?: string;
  readingTime: number;
}

export interface NoteTreeNode extends NoteMeta {
  children: NoteTreeNode[];
}

export interface Note {
  meta: NoteMeta;
  content: string;
}

export interface NoteAnchorIndex {
  headings: Set<string>;
  blocks: Set<string>;
}

export interface NoteEmbedPreview {
  title: string;
  excerpt: string;
}

const GARDEN_DIR = 'garden';
const CONTENT_DIR = path.join(process.cwd(), 'content');

function getGardenPath(locale: Locale): string {
  return path.join(CONTENT_DIR, locale, GARDEN_DIR);
}

const BLOCK_MARKER_REGEX = /(?:^|\s)\^([A-Za-z0-9][\w-]*)\s*$/;

function extractBlockIds(content: string): Set<string> {
  return new Set(
    content
      .split('\n')
      .map(line => line.match(BLOCK_MARKER_REGEX)?.[1])
      .filter((value): value is string => Boolean(value))
  );
}

function extractFirstParagraph(content: string): string {
  const lines = content.split('\n');
  const paragraph: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    if (/^(- |\* |\d+\. )/.test(line)) {
      continue;
    }

    if (line.startsWith('```') || line.startsWith('>')) {
      continue;
    }

    paragraph.push(cleanupInlineMarkdown(line));
  }

  return paragraph.join(' ').trim();
}

function extractHeadingSectionExcerpt(content: string, heading: string): string | null {
  const lines = content.split('\n');
  const headings = extractHeadings(content);
  const targetAnchor = normalizeHeadingToAnchor(heading);
  const currentIndex = headings.findIndex(item => item.anchor === targetAnchor);

  if (currentIndex < 0) {
    return null;
  }

  const current = headings[currentIndex]!;
  const nextSameOrHigher = headings.slice(currentIndex + 1).find(item => item.level <= current.level);
  const endLine = nextSameOrHigher ? nextSameOrHigher.index : lines.length;
  const sectionLines = lines.slice(current.index + 1, endLine);
  const excerpt = extractFirstParagraph(sectionLines.join('\n'));

  return excerpt || cleanupInlineMarkdown(current.text);
}

function getNoteCategory(gardenPath: string, filePath: string): string {
  const relativePath = path.relative(gardenPath, filePath);
  const rawCategory = path.dirname(relativePath).split(path.sep)[0];
  return !rawCategory || rawCategory === '.' ? 'garden' : rawCategory;
}

function parseNoteMdx(filePath: string, slug: string, category: string = 'garden'): Note {
  const { frontmatter, content } = parseMdxFile(filePath, NoteFrontmatterSchema);

  return {
    meta: {
      category,
      slug,
      title: frontmatter.title,
      created: frontmatter.created,
      updated: frontmatter.updated,
      status: frontmatter.status,
      tags: frontmatter.tags,
      draft: frontmatter.draft,
      parent: frontmatter.parent,
      outgoingLinks: extractWikilinkSlugs(content),
      outgoingHrefs: extractInAppLinks(content),
      excerpt: extractFirstParagraph(content) || undefined,
      readingTime: calculateReadingTime(content),
    },
    content,
  };
}

const byMostRecentFirst = (a: NoteMeta, b: NoteMeta) => {
  const dateA = new Date(a.updated || a.created);
  const dateB = new Date(b.updated || b.created);
  return dateB.getTime() - dateA.getTime();
};

function getNotesUncached(locale: Locale): NoteMeta[] {
  const gardenPath = getGardenPath(locale);

  return listMdxFiles(gardenPath, { recursive: true })
    .map(filePath => {
      const slug = path.basename(filePath, '.mdx');
      const category = getNoteCategory(gardenPath, filePath);
      return parseNoteMdx(filePath, slug, category).meta;
    })
    .filter(isPublishable)
    .toSorted(byMostRecentFirst);
}

function getNoteUncached(locale: Locale, slug: string): Note | null {
  const gardenPath = getGardenPath(locale);
  const mdxFiles = listMdxFiles(gardenPath, { recursive: true });
  const filePath = mdxFiles.find(f => path.basename(f, '.mdx') === slug);

  if (!filePath) {
    return null;
  }

  const category = getNoteCategory(gardenPath, filePath);
  const note = parseNoteMdx(filePath, slug, category);

  return isPublishable(note.meta) ? note : null;
}

export const getNotes = cache(getNotesUncached);
export const getNote = cache(getNoteUncached);

export function getNoteAnchorIndex(locale: Locale, slug: string): NoteAnchorIndex | null {
  const note = getNote(locale, slug);
  if (!note) {
    return null;
  }

  const headingLines = extractHeadings(note.content);
  return {
    headings: new Set(headingLines.flatMap(item => (item.anchor ? [item.anchor] : []))),
    blocks: extractBlockIds(note.content),
  };
}

export function hasHeadingAnchor(locale: Locale, slug: string, heading: string): boolean {
  const normalized = normalizeHeadingToAnchor(heading);
  const anchors = getNoteAnchorIndex(locale, slug);
  return Boolean(anchors?.headings.has(normalized));
}

export function hasBlockAnchor(locale: Locale, slug: string, blockId: string): boolean {
  const anchors = getNoteAnchorIndex(locale, slug);
  return Boolean(anchors?.blocks.has(blockId));
}

export function getNoteEmbedPreview(
  locale: Locale,
  slug: string,
  options?: { heading?: string; blockId?: string }
): NoteEmbedPreview | null {
  const note = getNote(locale, slug);
  if (!note) {
    return null;
  }

  if (options?.heading) {
    const sectionExcerpt = extractHeadingSectionExcerpt(note.content, options.heading);
    if (!sectionExcerpt) {
      return null;
    }

    return {
      title: note.meta.title,
      excerpt: sectionExcerpt,
    };
  }

  if (options?.blockId) {
    const lines = note.content.split('\n');
    const blockLineIndex = lines.findIndex(
      line => BLOCK_MARKER_REGEX.test(line) && line.includes(`^${options.blockId}`)
    );
    if (blockLineIndex < 0) {
      return null;
    }

    const sourceLine = lines[blockLineIndex]?.replace(BLOCK_MARKER_REGEX, '').trim() ?? '';
    return {
      title: note.meta.title,
      excerpt: cleanupInlineMarkdown(sourceLine) || note.meta.title,
    };
  }

  return {
    title: note.meta.title,
    excerpt: extractFirstParagraph(note.content) || note.meta.title,
  };
}

export function getAllNoteSlugs(locale: Locale): string[] {
  return getNotes(locale).map(note => note.slug);
}

export function getExistingNoteSlugs(locale: Locale): Set<string> {
  return new Set(getAllNoteSlugs(locale));
}

export function getBacklinks(locale: Locale, targetSlug: string): NoteMeta[] {
  const linksToTarget = (note: NoteMeta) => note.outgoingLinks.includes(targetSlug) && note.slug !== targetSlug;

  return getNotes(locale).filter(linksToTarget);
}

/**
 * 주어진 경로를 본문에서 가리키는 노트들. getBacklinks의 href 버전이다.
 *
 * 위키링크는 가든 안에서만 통하는 주소라 블로그 글을 가리킬 수 없어서, 저자는
 * 블로그 글을 인용할 때 표준 마크다운 링크를 쓴다. 그 방향을 여기서 되짚는다.
 * entities/note가 entities/post를 import하지 않아도 되도록(같은 레이어 cross-import
 * 금지) "어떤 경로를 가리키는가"라는 구조적 질문만 받는다.
 */
export function getNotesLinkingTo(locale: Locale, href: string): NoteMeta[] {
  return getNotes(locale).filter(note => note.outgoingHrefs.includes(href));
}

/** 경로 목록을 노트로 되돌린다. 가든 노트를 가리키지 않는 경로는 조용히 버린다. */
export function getNotesByHrefs(locale: Locale, hrefs: string[]): NoteMeta[] {
  const bySlug = new Map(getNotes(locale).map(note => [`/garden/${note.slug}`, note]));

  return hrefs.map(href => bySlug.get(href)).filter((note): note is NoteMeta => note !== undefined);
}

export function getNotesByTag(locale: Locale, tag: string): NoteMeta[] {
  const notes = getNotes(locale);
  return notes.filter(note => note.tags?.includes(tag));
}

export function getNotesByStatus(locale: Locale, status: NoteStatus): NoteMeta[] {
  const notes = getNotes(locale);
  return notes.filter(note => note.status === status);
}

export function getNotesByCategory(locale: Locale, category: string): NoteMeta[] {
  const notes = getNotes(locale);
  return notes.filter(note => (note.category || 'garden') === category);
}

export function getAllNoteTags(locale: Locale): Array<{ name: string; count: number }> {
  const tagCounts = getNotes(locale)
    .flatMap(note => note.tags ?? [])
    .reduce((counts, tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1), new Map<string, number>());

  return Array.from(tagCounts, ([name, count]) => ({ name, count })).toSorted((a, b) => b.count - a.count);
}

export function getOutgoingNotes(locale: Locale, slugs: string[]): NoteMeta[] {
  const allNotes = getNotes(locale);
  const noteMap = new Map(allNotes.map(note => [note.slug, note]));

  return slugs.map(slug => noteMap.get(slug)).filter((note): note is NoteMeta => note !== undefined);
}

export type LinkDirection = 'outgoing' | 'incoming' | 'bidirectional';

export interface LinkedNote extends NoteMeta {
  direction: LinkDirection;
}

export function getLinkDirection(slug: string, outgoingSlugs: Set<string>, backlinkSlugs: Set<string>): LinkDirection {
  const isOutgoing = outgoingSlugs.has(slug);
  const isBacklink = backlinkSlugs.has(slug);

  if (isOutgoing && isBacklink) {
    return 'bidirectional';
  }
  if (isOutgoing) {
    return 'outgoing';
  }
  return 'incoming';
}

export function getMergedLinkedNotes(outgoingNotes: NoteMeta[], backlinks: NoteMeta[]): LinkedNote[] {
  const outgoingSlugs = new Set(outgoingNotes.map(n => n.slug));
  const backlinkSlugs = new Set(backlinks.map(n => n.slug));

  const toLinkedNote = (note: NoteMeta): LinkedNote => ({
    ...note,
    direction: getLinkDirection(note.slug, outgoingSlugs, backlinkSlugs),
  });

  const incomingOnly = backlinks.filter(note => !outgoingSlugs.has(note.slug));

  return [...outgoingNotes.map(toLinkedNote), ...incomingOnly.map(toLinkedNote)];
}

export function buildNoteTree(notes: NoteMeta[]): NoteTreeNode[] {
  const nodeMap = new Map<string, NoteTreeNode>();
  const roots: NoteTreeNode[] = [];

  for (const note of notes) {
    nodeMap.set(note.slug, { ...note, children: [] });
  }

  for (const node of Array.from(nodeMap.values())) {
    if (node.parent && nodeMap.has(node.parent)) {
      nodeMap.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
