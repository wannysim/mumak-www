import path from 'path';
import { cache } from 'react';

import type { Locale } from '@/src/shared/config/i18n';
import { isPublishable, listMdxFiles, NoteFrontmatterSchema, parseMdxFile } from '@/src/shared/lib/content';
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
  outgoingLinks: string[];
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

function cleanupInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

const BLOCK_MARKER_REGEX = /(?:^|\s)\^([A-Za-z0-9][\w-]*)\s*$/;

function extractHeadingLines(content: string): Array<{ index: number; level: number; text: string; anchor: string }> {
  return content
    .split('\n')
    .map((line, index) => ({ line, index }))
    .map(({ line, index }) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) {
        return null;
      }

      const level = match[1]?.length ?? 1;
      const text = cleanupInlineMarkdown(match[2] ?? '');
      return {
        index,
        level,
        text,
        anchor: normalizeHeadingToAnchor(text),
      };
    })
    .filter((value): value is { index: number; level: number; text: string; anchor: string } => value !== null);
}

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
  const headings = extractHeadingLines(content);
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

  const headingLines = extractHeadingLines(note.content);
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
