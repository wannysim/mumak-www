import type { NoteMeta } from '@/src/entities/note';
import type { PostMeta } from '@/src/entities/post';

import { buildBlogGraphData, buildGardenGraphData } from '../lib/build-graph-data';

const createNote = (overrides: Partial<NoteMeta> = {}): NoteMeta => ({
  ...overrides,
  category: overrides.category ?? 'garden',
  slug: overrides.slug ?? 'test-note',
  title: overrides.title ?? 'Test Note',
  created: overrides.created ?? '2025-01-01',
  status: overrides.status ?? 'seedling',
  tags: overrides.tags ?? [],
  outgoingLinks: overrides.outgoingLinks ?? [],
});

const createPost = (overrides: Partial<PostMeta> = {}): PostMeta => ({
  slug: 'test-post',
  title: 'Test Post',
  date: '2025-01-01',
  description: 'A test post',
  category: 'articles',
  tags: [],
  readingTime: 5,
  ...overrides,
});

describe('buildGardenGraphData', () => {
  it('빈 노트 배열에서 빈 그래프를 반환한다', () => {
    const result = buildGardenGraphData([]);

    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
  });

  it('노트를 note 타입 노드로 변환한다', () => {
    const notes = [createNote({ slug: 'my-note', title: 'My Note', status: 'budding' })];
    const result = buildGardenGraphData(notes);

    const noteNode = result.nodes.find(n => n.id === 'note:my-note');
    expect(noteNode).toBeDefined();
    expect(noteNode?.name).toBe('My Note');
    expect(noteNode?.type).toBe('note');
    expect(noteNode?.status).toBe('budding');
    expect(noteNode?.url).toBe('/garden/my-note');
  });

  it('태그를 tag 타입 노드로 생성하고 링크를 연결한다', () => {
    const notes = [createNote({ slug: 'note-1', tags: ['javascript', 'react'] })];
    const result = buildGardenGraphData(notes);

    const tagNodes = result.nodes.filter(n => n.type === 'tag');
    expect(tagNodes).toHaveLength(2);
    expect(tagNodes.map(t => t.name)).toEqual(expect.arrayContaining(['javascript', 'react']));

    const tagLinks = result.links.filter(l => l.type === 'tag');
    expect(tagLinks).toHaveLength(2);
  });

  it('wikilink를 wikilink 타입 링크로 변환한다', () => {
    const notes = [
      createNote({ slug: 'note-a', outgoingLinks: ['note-b'] }),
      createNote({ slug: 'note-b', title: 'Note B' }),
    ];
    const result = buildGardenGraphData(notes);

    const wikilinkLinks = result.links.filter(l => l.type === 'wikilink');
    expect(wikilinkLinks).toHaveLength(1);
    expect(wikilinkLinks[0]).toEqual({
      source: 'note:note-a',
      target: 'note:note-b',
      type: 'wikilink',
    });
  });

  it('존재하지 않는 노트로의 wikilink는 무시한다', () => {
    const notes = [createNote({ slug: 'note-a', outgoingLinks: ['nonexistent'] })];
    const result = buildGardenGraphData(notes);

    const wikilinkLinks = result.links.filter(l => l.type === 'wikilink');
    expect(wikilinkLinks).toHaveLength(0);
  });

  it('linkCount를 정확히 계산한다', () => {
    const notes = [
      createNote({ slug: 'hub', title: 'Hub', tags: ['a', 'b'], outgoingLinks: ['leaf'] }),
      createNote({ slug: 'leaf', title: 'Leaf' }),
    ];
    const result = buildGardenGraphData(notes);

    const hubNode = result.nodes.find(n => n.id === 'note:hub');
    expect(hubNode?.linkCount).toBe(3);

    const leafNode = result.nodes.find(n => n.id === 'note:leaf');
    expect(leafNode?.linkCount).toBe(1);
  });

  it('중복 태그를 하나의 노드로 합친다', () => {
    const notes = [createNote({ slug: 'note-1', tags: ['shared'] }), createNote({ slug: 'note-2', tags: ['shared'] })];
    const result = buildGardenGraphData(notes);

    const tagNodes = result.nodes.filter(n => n.type === 'tag');
    expect(tagNodes).toHaveLength(1);
    expect(tagNodes[0]?.linkCount).toBe(2);
  });
});

describe('buildBlogGraphData', () => {
  it('빈 포스트 배열에서 빈 그래프를 반환한다', () => {
    const result = buildBlogGraphData([]);

    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
  });

  it('포스트를 post 타입 노드로 변환한다', () => {
    const posts = [createPost({ slug: 'my-post', title: 'My Post', category: 'essay' })];
    const result = buildBlogGraphData(posts);

    const postNode = result.nodes.find(n => n.id === 'post:my-post');
    expect(postNode).toBeDefined();
    expect(postNode?.name).toBe('My Post');
    expect(postNode?.type).toBe('post');
    expect(postNode?.category).toBe('essay');
    expect(postNode?.url).toBe('/blog/essay/my-post');
  });

  it('카테고리를 category 타입 노드로 생성하고 링크를 연결한다', () => {
    const posts = [createPost({ slug: 'p1', category: 'essay' }), createPost({ slug: 'p2', category: 'articles' })];
    const result = buildBlogGraphData(posts);

    const categoryNodes = result.nodes.filter(n => n.type === 'category');
    expect(categoryNodes).toHaveLength(2);

    const categoryLinks = result.links.filter(l => l.type === 'category');
    expect(categoryLinks).toHaveLength(2);
  });

  it('태그와 카테고리를 모두 올바르게 연결한다', () => {
    const posts = [createPost({ slug: 'p1', category: 'essay', tags: ['react', 'typescript'] })];
    const result = buildBlogGraphData(posts);

    expect(result.links).toHaveLength(3);
    expect(result.links.filter(l => l.type === 'category')).toHaveLength(1);
    expect(result.links.filter(l => l.type === 'tag')).toHaveLength(2);
  });

  it('같은 카테고리의 여러 포스트는 하나의 카테고리 노드를 공유한다', () => {
    const posts = [createPost({ slug: 'p1', category: 'essay' }), createPost({ slug: 'p2', category: 'essay' })];
    const result = buildBlogGraphData(posts);

    const categoryNodes = result.nodes.filter(n => n.type === 'category');
    expect(categoryNodes).toHaveLength(1);
    expect(categoryNodes[0]?.linkCount).toBe(2);
  });
});
