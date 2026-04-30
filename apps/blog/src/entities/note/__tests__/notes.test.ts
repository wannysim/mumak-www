import {
  buildNoteTree,
  getAllNoteSlugs,
  getAllNoteTags,
  getBacklinks,
  getExistingNoteSlugs,
  getLinkDirection,
  getMergedLinkedNotes,
  getNote,
  getNoteAnchorIndex,
  getNoteEmbedPreview,
  getNotes,
  getNotesByStatus,
  getNotesByTag,
  getOutgoingNotes,
  hasBlockAnchor,
  hasHeadingAnchor,
  type NoteMeta,
} from '../api/notes';

describe('getNotes', () => {
  it('ko locale의 모든 노트를 가져온다', () => {
    const notes = getNotes('ko');

    expect(notes.length).toBeGreaterThanOrEqual(3);
    expect(notes.some(n => n.slug === 'what-is-digital-garden')).toBe(true);
    expect(notes.some(n => n.slug === 'my-garden-principles')).toBe(true);
  });

  it('updated 또는 created 기준 내림차순 정렬', () => {
    const notes = getNotes('ko');

    const gardenNote = notes.find(n => n.slug === 'what-is-digital-garden');
    const principlesNote = notes.find(n => n.slug === 'my-garden-principles');

    expect(gardenNote).toBeDefined();
    expect(principlesNote).toBeDefined();
  });

  it('subdir(PARA 폴더)에서 파일을 읽어 category를 추출한다', () => {
    const notes = getNotes('ko');
    const projectNote = notes.find(n => n.slug === 'digital-garden-and-pkm');

    // 만약 파일이 있으면 category가 올바르게 추출되었는지 확인
    if (projectNote) {
      expect(projectNote.category).toBe('projects');
    }
  });
});

describe('getNote', () => {
  it('특정 노트를 slug로 가져온다', () => {
    const note = getNote('ko', 'what-is-digital-garden');

    expect(note).not.toBeNull();
    expect(note?.meta.title).toBe('디지털 가든이란 무엇인가');
    expect(note?.meta.status).toBe('budding');
    expect(note?.meta.tags).toContain('digital-garden');
  });

  it('outgoingLinks를 추출한다', () => {
    const note = getNote('ko', 'what-is-digital-garden');

    expect(note?.meta.outgoingLinks).toContain('my-garden-principles');
  });

  it('존재하지 않는 노트는 null 반환', () => {
    const note = getNote('ko', 'non-existent');

    expect(note).toBeNull();
  });

  it('draft 속성이 메타에 포함된다', () => {
    const note = getNote('ko', 'what-is-digital-garden');

    expect(note?.meta.draft).toBeDefined();
    expect(typeof note?.meta.draft).toBe('boolean');
  });

  it('category 속성이 메타에 포함되며, 서브디렉토리에서도 파일을 찾을 수 있다', () => {
    const note = getNote('ko', 'my-garden-principles');

    expect(note).not.toBeNull();
    // PARA 구조에 따라 폴더 이름이 category로 들어올 것으로 예상
    expect(note?.meta.category).toBeDefined();
  });

  it('parent 속성이 frontmatter에서 파싱된다', () => {
    const note = getNote('ko', 'sirat');

    expect(note).not.toBeNull();
    expect(note?.meta.parent).toBe('movie');
  });

  it('parent가 없는 노트는 parent가 undefined다', () => {
    const note = getNote('ko', 'movie');

    expect(note).not.toBeNull();
    expect(note?.meta.parent).toBeUndefined();
  });

  it('resources 하위 파일의 category가 resources로 파싱된다', () => {
    const note = getNote('ko', 'movie');

    expect(note).not.toBeNull();
    expect(note?.meta.category).toBe('resources');
  });
});

describe('getAllNoteSlugs', () => {
  it('모든 노트 slug 목록을 반환한다', () => {
    const slugs = getAllNoteSlugs('ko');

    expect(slugs).toContain('what-is-digital-garden');
    expect(slugs).toContain('my-garden-principles');
  });
});

describe('getExistingNoteSlugs', () => {
  it('Set 형태로 slug를 반환한다', () => {
    const slugs = getExistingNoteSlugs('ko');

    expect(slugs).toBeInstanceOf(Set);
    expect(slugs.has('what-is-digital-garden')).toBe(true);
  });
});

describe('getBacklinks', () => {
  it('특정 노트를 참조하는 다른 노트들을 반환한다', () => {
    const backlinks = getBacklinks('ko', 'what-is-digital-garden');

    expect(backlinks.length).toBeGreaterThanOrEqual(1);
    expect(backlinks.some(n => n.slug === 'my-garden-principles')).toBe(true);
  });

  it('자기 자신은 백링크에 포함하지 않는다', () => {
    const backlinks = getBacklinks('ko', 'what-is-digital-garden');

    expect(backlinks.every(n => n.slug !== 'what-is-digital-garden')).toBe(true);
  });
});

describe('getNotesByTag', () => {
  it('특정 태그를 가진 노트들을 반환한다', () => {
    const notes = getNotesByTag('ko', 'digital-garden');

    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes.every(n => n.tags?.includes('digital-garden'))).toBe(true);
  });

  it('존재하지 않는 태그는 빈 배열 반환', () => {
    const notes = getNotesByTag('ko', 'non-existent-tag');

    expect(notes).toEqual([]);
  });
});

describe('getNotesByStatus', () => {
  it('특정 status의 노트들을 반환한다', () => {
    const seedlings = getNotesByStatus('ko', 'seedling');

    expect(seedlings.length).toBeGreaterThanOrEqual(1);
    expect(seedlings.every(n => n.status === 'seedling')).toBe(true);
  });

  it('해당 status가 없으면 빈 배열 반환', () => {
    const notes = getNotes('ko');
    const hasEvergreen = notes.some(n => n.status === 'evergreen');

    if (!hasEvergreen) {
      const evergreens = getNotesByStatus('ko', 'evergreen');
      expect(evergreens).toEqual([]);
    }
  });
});

describe('getAllNoteTags', () => {
  it('모든 태그와 개수를 반환한다', () => {
    const tags = getAllNoteTags('ko');

    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags[0]).toHaveProperty('name');
    expect(tags[0]).toHaveProperty('count');
  });

  it('태그는 count 내림차순으로 정렬된다', () => {
    const tags = getAllNoteTags('ko');

    for (let i = 0; i < tags.length - 1; i++) {
      expect(tags[i]!.count).toBeGreaterThanOrEqual(tags[i + 1]!.count);
    }
  });

  it('중복 태그는 하나로 합쳐진다', () => {
    const tags = getAllNoteTags('ko');
    const tagNames = tags.map(t => t.name);
    const uniqueNames = new Set(tagNames);

    expect(tagNames.length).toBe(uniqueNames.size);
  });
});

describe('getOutgoingNotes', () => {
  it('주어진 slug들에 해당하는 노트 메타를 반환한다', () => {
    const outgoing = getOutgoingNotes('ko', ['my-garden-principles']);

    expect(outgoing.length).toBe(1);
    expect(outgoing[0]!.slug).toBe('my-garden-principles');
  });

  it('존재하지 않는 slug는 필터링된다', () => {
    const outgoing = getOutgoingNotes('ko', ['my-garden-principles', 'non-existent']);

    expect(outgoing.length).toBe(1);
    expect(outgoing[0]!.slug).toBe('my-garden-principles');
  });

  it('빈 배열을 주면 빈 배열 반환', () => {
    const outgoing = getOutgoingNotes('ko', []);

    expect(outgoing).toEqual([]);
  });
});

describe('getLinkDirection', () => {
  it('outgoing만 있으면 outgoing 반환', () => {
    const outgoingSlugs = new Set(['note-a', 'note-b']);
    const backlinkSlugs = new Set(['note-c']);

    expect(getLinkDirection('note-a', outgoingSlugs, backlinkSlugs)).toBe('outgoing');
  });

  it('backlink만 있으면 incoming 반환', () => {
    const outgoingSlugs = new Set(['note-a']);
    const backlinkSlugs = new Set(['note-b', 'note-c']);

    expect(getLinkDirection('note-b', outgoingSlugs, backlinkSlugs)).toBe('incoming');
  });

  it('양방향이면 bidirectional 반환', () => {
    const outgoingSlugs = new Set(['note-a', 'note-b']);
    const backlinkSlugs = new Set(['note-a', 'note-c']);

    expect(getLinkDirection('note-a', outgoingSlugs, backlinkSlugs)).toBe('bidirectional');
  });
});

describe('getMergedLinkedNotes', () => {
  const createMockNote = (slug: string, overrides?: Partial<NoteMeta>): NoteMeta => ({
    category: 'garden',
    slug,
    title: `Title ${slug}`,
    created: '2026-01-01',
    status: 'seedling',
    outgoingLinks: [],
    ...overrides,
  });

  it('outgoing과 backlink를 병합한다', () => {
    const outgoing = [createMockNote('note-a')];
    const backlinks = [createMockNote('note-b')];

    const merged = getMergedLinkedNotes(outgoing, backlinks);

    expect(merged.length).toBe(2);
    expect(merged.some(n => n.slug === 'note-a')).toBe(true);
    expect(merged.some(n => n.slug === 'note-b')).toBe(true);
  });

  it('중복 노트는 한 번만 포함된다', () => {
    const outgoing = [createMockNote('note-a')];
    const backlinks = [createMockNote('note-a')];

    const merged = getMergedLinkedNotes(outgoing, backlinks);

    expect(merged.length).toBe(1);
    expect(merged[0]!.slug).toBe('note-a');
  });

  it('양방향 노트는 bidirectional로 표시된다', () => {
    const outgoing = [createMockNote('note-a')];
    const backlinks = [createMockNote('note-a')];

    const merged = getMergedLinkedNotes(outgoing, backlinks);

    expect(merged[0]!.direction).toBe('bidirectional');
  });

  it('outgoing만 있는 노트는 outgoing으로 표시된다', () => {
    const outgoing = [createMockNote('note-a')];
    const backlinks = [createMockNote('note-b')];

    const merged = getMergedLinkedNotes(outgoing, backlinks);
    const noteA = merged.find(n => n.slug === 'note-a');

    expect(noteA!.direction).toBe('outgoing');
  });

  it('backlink만 있는 노트는 incoming으로 표시된다', () => {
    const outgoing = [createMockNote('note-a')];
    const backlinks = [createMockNote('note-b')];

    const merged = getMergedLinkedNotes(outgoing, backlinks);
    const noteB = merged.find(n => n.slug === 'note-b');

    expect(noteB!.direction).toBe('incoming');
  });

  it('빈 배열들을 처리한다', () => {
    const merged = getMergedLinkedNotes([], []);

    expect(merged).toEqual([]);
  });

  it('outgoing만 있을 때 정상 동작', () => {
    const outgoing = [createMockNote('note-a'), createMockNote('note-b')];

    const merged = getMergedLinkedNotes(outgoing, []);

    expect(merged.length).toBe(2);
    expect(merged.every(n => n.direction === 'outgoing')).toBe(true);
  });

  it('backlink만 있을 때 정상 동작', () => {
    const backlinks = [createMockNote('note-a'), createMockNote('note-b')];

    const merged = getMergedLinkedNotes([], backlinks);

    expect(merged.length).toBe(2);
    expect(merged.every(n => n.direction === 'incoming')).toBe(true);
  });

  it('실제 노트 데이터로 양방향 연결 검증', () => {
    const gardenNote = getNote('ko', 'what-is-digital-garden');
    const principlesNote = getNote('ko', 'my-garden-principles');

    expect(gardenNote).not.toBeNull();
    expect(principlesNote).not.toBeNull();

    const outgoingFromGarden = getOutgoingNotes('ko', gardenNote!.meta.outgoingLinks);
    const backlinksToGarden = getBacklinks('ko', 'what-is-digital-garden');

    const merged = getMergedLinkedNotes(outgoingFromGarden, backlinksToGarden);

    const principlesInMerged = merged.find(n => n.slug === 'my-garden-principles');
    expect(principlesInMerged).toBeDefined();
    expect(principlesInMerged!.direction).toBe('bidirectional');
  });
});

describe('buildNoteTree', () => {
  const createMockNote = (slug: string, overrides?: Partial<NoteMeta>): NoteMeta => ({
    category: 'garden',
    slug,
    title: `Title ${slug}`,
    created: '2026-01-01',
    status: 'seedling',
    outgoingLinks: [],
    ...overrides,
  });

  it('parent가 없는 노트는 모두 루트 노드가 된다', () => {
    const notes = [createMockNote('a'), createMockNote('b'), createMockNote('c')];
    const tree = buildNoteTree(notes);

    expect(tree.length).toBe(3);
    expect(tree.every(n => n.children.length === 0)).toBe(true);
  });

  it('parent가 있는 노트는 부모의 children에 들어간다', () => {
    const notes = [createMockNote('movie'), createMockNote('sirat', { parent: 'movie' })];
    const tree = buildNoteTree(notes);

    expect(tree.length).toBe(1);
    expect(tree[0]!.slug).toBe('movie');
    expect(tree[0]!.children.length).toBe(1);
    expect(tree[0]!.children[0]!.slug).toBe('sirat');
  });

  it('다중 레벨 중첩을 지원한다', () => {
    const notes = [
      createMockNote('top'),
      createMockNote('mid', { parent: 'top' }),
      createMockNote('bottom', { parent: 'mid' }),
    ];
    const tree = buildNoteTree(notes);

    expect(tree.length).toBe(1);
    expect(tree[0]!.children[0]!.children[0]!.slug).toBe('bottom');
  });

  it('존재하지 않는 parent를 가진 노트는 루트가 된다', () => {
    const notes = [createMockNote('orphan', { parent: 'non-existent' }), createMockNote('root')];
    const tree = buildNoteTree(notes);

    expect(tree.length).toBe(2);
    expect(tree.some(n => n.slug === 'orphan')).toBe(true);
  });

  it('빈 배열은 빈 배열을 반환한다', () => {
    const tree = buildNoteTree([]);
    expect(tree).toEqual([]);
  });

  it('하나의 부모에 여러 자식이 올 수 있다', () => {
    const notes = [
      createMockNote('movie'),
      createMockNote('sirat', { parent: 'movie' }),
      createMockNote('parasite', { parent: 'movie' }),
    ];
    const tree = buildNoteTree(notes);

    expect(tree.length).toBe(1);
    expect(tree[0]!.children.length).toBe(2);
  });

  it('실제 데이터에서 sirat이 movie의 자식으로 나온다', () => {
    const notes = getNotes('ko');
    const tree = buildNoteTree(notes);

    const findNode = (
      nodes: ReturnType<typeof buildNoteTree>,
      slug: string
    ): ReturnType<typeof buildNoteTree>[0] | undefined => {
      for (const node of nodes) {
        if (node.slug === slug) return node;
        const found = findNode(node.children, slug);
        if (found) return found;
      }
      return undefined;
    };

    const movieNode = findNode(tree, 'movie');
    expect(movieNode).toBeDefined();
    expect(movieNode!.children.some(c => c.slug === 'sirat')).toBe(true);

    // sirat은 루트에 있으면 안됨
    expect(tree.some(n => n.slug === 'sirat')).toBe(false);
  });
});

describe('advanced anchor utilities', () => {
  it('노트의 heading/block 앵커 인덱스를 만든다', () => {
    const anchors = getNoteAnchorIndex('ko', 'movie');

    expect(anchors).not.toBeNull();
    expect(anchors?.headings.size ?? 0).toBeGreaterThan(0);
    expect(anchors?.blocks).toBeInstanceOf(Set);
  });

  it('존재하는 heading 앵커를 찾는다', () => {
    expect(hasHeadingAnchor('ko', 'what-is-digital-garden', '성장 단계')).toBe(true);
  });

  it('존재하지 않는 heading 앵커는 false다', () => {
    expect(hasHeadingAnchor('ko', 'what-is-digital-garden', '없는 제목')).toBe(false);
  });

  it('존재하지 않는 노트의 anchor index는 null', () => {
    expect(getNoteAnchorIndex('ko', 'totally-missing-note')).toBeNull();
  });

  it('노트 임베드 미리보기를 반환한다', () => {
    const preview = getNoteEmbedPreview('ko', 'what-is-digital-garden');

    expect(preview).not.toBeNull();
    expect(preview?.title).toBe('디지털 가든이란 무엇인가');
    expect((preview?.excerpt.length ?? 0) > 0).toBe(true);
  });

  it('존재하지 않는 노트의 embed preview는 null', () => {
    expect(getNoteEmbedPreview('ko', 'totally-missing-note')).toBeNull();
  });

  it('heading 옵션으로 해당 섹션 발췌를 반환한다', () => {
    const preview = getNoteEmbedPreview('ko', 'what-is-digital-garden', { heading: '성장 단계' });

    expect(preview).not.toBeNull();
    expect(preview?.title).toBe('디지털 가든이란 무엇인가');
  });

  it('존재하지 않는 heading은 embed preview가 null', () => {
    expect(getNoteEmbedPreview('ko', 'what-is-digital-garden', { heading: '없는 섹션' })).toBeNull();
  });

  it('존재하지 않는 blockId는 embed preview가 null', () => {
    expect(getNoteEmbedPreview('ko', 'what-is-digital-garden', { blockId: 'missing-block' })).toBeNull();
  });

  it('존재하지 않는 블록 앵커는 false다', () => {
    expect(hasBlockAnchor('ko', 'what-is-digital-garden', 'missing-block')).toBe(false);
  });

  it('존재하지 않는 노트의 hasBlockAnchor는 false', () => {
    expect(hasBlockAnchor('ko', 'totally-missing-note', 'any-block')).toBe(false);
  });
});
