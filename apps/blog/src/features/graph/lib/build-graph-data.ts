import type { NoteMeta } from '@/src/entities/note';
import type { PostMeta } from '@/src/entities/post';

import type { GraphData, GraphLink, GraphNode } from '../model/types';

const toNoteNode = (note: NoteMeta): GraphNode => ({
  id: `note:${note.slug}`,
  name: note.title,
  type: 'note',
  status: note.status,
  linkCount: 0,
  url: `/garden/${note.slug}`,
});

const toPostNode = (post: PostMeta): GraphNode => ({
  id: `post:${post.slug}`,
  name: post.title,
  type: 'post',
  category: post.category,
  linkCount: 0,
  url: `/blog/${post.category}/${post.slug}`,
  description: post.description,
});

const toTagNode = (tag: string): GraphNode => ({
  id: `tag:${tag}`,
  name: tag,
  type: 'tag',
  linkCount: 0,
  url: '',
});

const toCategoryNode = (category: string): GraphNode => ({
  id: `category:${category}`,
  name: category,
  type: 'category',
  linkCount: 0,
  url: '',
});

const toTagLinks = (sourceId: string, tags: string[]): GraphLink[] =>
  tags.map(tag => ({ source: sourceId, target: `tag:${tag}`, type: 'tag' as const }));

const toWikilinkTargets = (sourceId: string, targets: string[], validSlugs: Set<string>): GraphLink[] =>
  targets.flatMap(slug =>
    validSlugs.has(slug) ? [{ source: sourceId, target: `note:${slug}`, type: 'wikilink' as const }] : []
  );

function withLinkCounts(data: GraphData): GraphData {
  const counts = data.links.reduce((acc, link) => {
    acc.set(link.source, (acc.get(link.source) ?? 0) + 1);
    acc.set(link.target, (acc.get(link.target) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  return {
    nodes: data.nodes.map(node => ({ ...node, linkCount: counts.get(node.id) ?? 0 })),
    links: data.links,
  };
}

function collectUniqueTags(items: Array<{ tags?: string[] }>): string[] {
  return [...new Set(items.flatMap(item => item.tags ?? []))];
}

export function buildGardenGraphData(notes: NoteMeta[]): GraphData {
  const validSlugs = new Set(notes.map(n => n.slug));

  const noteNodes = notes.map(toNoteNode);
  const tagNodes = collectUniqueTags(notes).map(toTagNode);

  const tagLinks = notes.flatMap(note => toTagLinks(`note:${note.slug}`, note.tags ?? []));
  const wikilinkLinks = notes.flatMap(note => toWikilinkTargets(`note:${note.slug}`, note.outgoingLinks, validSlugs));

  return withLinkCounts({
    nodes: [...noteNodes, ...tagNodes],
    links: [...tagLinks, ...wikilinkLinks],
  });
}

export function buildBlogGraphData(posts: PostMeta[]): GraphData {
  const postNodes = posts.map(toPostNode);
  const tagNodes = collectUniqueTags(posts).map(toTagNode);
  const categoryNodes = [...new Set(posts.map(p => p.category))].map(toCategoryNode);

  const categoryLinks: GraphLink[] = posts.map(post => ({
    source: `post:${post.slug}`,
    target: `category:${post.category}`,
    type: 'category',
  }));
  const tagLinks = posts.flatMap(post => toTagLinks(`post:${post.slug}`, post.tags ?? []));

  return withLinkCounts({
    nodes: [...postNodes, ...tagNodes, ...categoryNodes],
    links: [...categoryLinks, ...tagLinks],
  });
}
