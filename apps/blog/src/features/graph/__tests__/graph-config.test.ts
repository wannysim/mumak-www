import {
  buildLegendEntries,
  CATEGORY_NODE_SIZE,
  getBackgroundColor,
  getCategoryColor,
  getLinkColor,
  getNodeSize,
  getNoteColor,
  getPostColor,
  getTagColor,
  NODE_BASE_SIZE,
  NODE_SIZE_SCALE,
  resolveNodeColor,
  TAG_NODE_SIZE,
} from '../lib/graph-config';
import type { GraphNode } from '../model/types';

const node = (partial: Partial<GraphNode> & Pick<GraphNode, 'type'>): GraphNode => ({
  id: 'x',
  name: 'x',
  linkCount: 0,
  url: '',
  ...partial,
});

describe('getNodeSize', () => {
  it('tag 노드는 고정 크기를 반환한다', () => {
    expect(getNodeSize('tag', 10)).toBe(TAG_NODE_SIZE);
  });

  it('category 노드는 고정 크기를 반환한다', () => {
    expect(getNodeSize('category', 10)).toBe(CATEGORY_NODE_SIZE);
  });

  it('note 노드는 linkCount에 비례한 크기를 반환한다', () => {
    expect(getNodeSize('note', 0)).toBe(NODE_BASE_SIZE);
    expect(getNodeSize('note', 3)).toBe(NODE_BASE_SIZE + 3 * NODE_SIZE_SCALE);
  });

  it('post 노드는 linkCount에 비례한 크기를 반환한다', () => {
    expect(getNodeSize('post', 2)).toBe(NODE_BASE_SIZE + 2 * NODE_SIZE_SCALE);
  });
});

describe('getNoteColor', () => {
  it('status별로 다른 색상을 반환한다', () => {
    const seedlingLight = getNoteColor('seedling', false);
    const buddingLight = getNoteColor('budding', false);
    const evergreenLight = getNoteColor('evergreen', false);

    expect(seedlingLight).not.toBe(buddingLight);
    expect(buddingLight).not.toBe(evergreenLight);
  });

  it('다크 모드에서 다른 색상을 반환한다', () => {
    const light = getNoteColor('seedling', false);
    const dark = getNoteColor('seedling', true);

    expect(light).not.toBe(dark);
  });
});

describe('getPostColor', () => {
  it('카테고리별로 다른 색상을 반환한다', () => {
    const essay = getPostColor('essay', false);
    const articles = getPostColor('articles', false);

    expect(essay).not.toBe(articles);
  });

  it('알 수 없는 카테고리에 대해 fallback 색상을 반환한다', () => {
    const result = getPostColor('unknown-category', false);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('getTagColor', () => {
  it('라이트/다크 모드에서 다른 색상을 반환한다', () => {
    expect(getTagColor(false)).not.toBe(getTagColor(true));
  });
});

describe('getCategoryColor', () => {
  it('라이트/다크 모드에서 다른 색상을 반환한다', () => {
    expect(getCategoryColor(false)).not.toBe(getCategoryColor(true));
  });
});

describe('getLinkColor', () => {
  it('라이트/다크 모드에서 다른 색상을 반환한다', () => {
    expect(getLinkColor(false)).not.toBe(getLinkColor(true));
  });
});

describe('resolveNodeColor', () => {
  it('타입별로 대응하는 색상 함수에 위임한다', () => {
    expect(resolveNodeColor(node({ type: 'note', status: 'seedling' }), false)).toBe(getNoteColor('seedling', false));
    expect(resolveNodeColor(node({ type: 'post', category: 'essay' }), false)).toBe(getPostColor('essay', false));
    expect(resolveNodeColor(node({ type: 'tag' }), false)).toBe(getTagColor(false));
    expect(resolveNodeColor(node({ type: 'category' }), false)).toBe(getCategoryColor(false));
  });

  it('status/category가 없으면 기본값으로 색상을 결정한다', () => {
    expect(resolveNodeColor(node({ type: 'note' }), true)).toBe(getNoteColor('seedling', true));
    expect(resolveNodeColor(node({ type: 'post' }), true)).toBe(getPostColor('notes', true));
  });

  it('알 수 없는 타입은 tag 색상으로 폴백한다', () => {
    const unknown = { id: 'x', name: 'x', type: 'unknown', linkCount: 0, url: '' } as unknown as GraphNode;
    expect(resolveNodeColor(unknown, false)).toBe(getTagColor(false));
  });
});

// 두 스와치가 "같은 색"으로 읽히지 않는지 보는 최소한의 기준. 정확한 지각 거리(CIEDE2000)
// 대신 sRGB 유클리드 거리를 쓴다 — 예전 회색 충돌(68)과 오렌지/앰버 충돌(35)은 거르고
// 현재 팔레트의 최소값(91)은 통과하는 구간이라 이 회귀를 잡기에 충분하다.
const MIN_LEGEND_COLOR_DISTANCE = 80;

const rgbDistance = (a: string, b: string): number => {
  const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [ar, ag, ab] = channels(a) as [number, number, number];
  const [br, bg, bb] = channels(b) as [number, number, number];
  return Math.round(Math.hypot(ar - br, ag - bg, ab - bb));
};

describe('buildLegendEntries', () => {
  it('같은 status/category 노드가 여러 개여도 행은 하나로 합쳐진다', () => {
    const entries = buildLegendEntries(
      [
        node({ type: 'note', status: 'seedling' }),
        node({ type: 'note', status: 'seedling' }),
        node({ type: 'note', status: 'budding' }),
      ],
      false
    );

    expect(entries.map(e => e.key)).toEqual(['status:seedling', 'status:budding']);
  });

  it('데이터에 없는 status는 행을 만들지 않는다 (evergreen 0건)', () => {
    const entries = buildLegendEntries([node({ type: 'note', status: 'seedling' }), node({ type: 'tag' })], false);

    expect(entries.map(e => e.key)).not.toContain('status:evergreen');
  });

  it('각 행의 색은 캔버스와 같은 resolveNodeColor 결과와 일치한다', () => {
    const nodes = [
      node({ type: 'note', status: 'budding' }),
      node({ type: 'post', category: 'essay' }),
      node({ type: 'tag' }),
      node({ type: 'category' }),
    ];

    for (const isDark of [false, true]) {
      const byKey = new Map(buildLegendEntries(nodes, isDark).map(e => [e.key, e.color]));

      expect(byKey.get('status:budding')).toBe(resolveNodeColor(nodes[0]!, isDark));
      expect(byKey.get('category:essay')).toBe(resolveNodeColor(nodes[1]!, isDark));
      expect(byKey.get('type:tag')).toBe(resolveNodeColor(nodes[2]!, isDark));
      expect(byKey.get('type:category')).toBe(resolveNodeColor(nodes[3]!, isDark));
    }
  });

  it('입력 순서와 무관하게 status → category → 구조 노드 순으로 정렬한다', () => {
    const entries = buildLegendEntries(
      [
        node({ type: 'tag' }),
        node({ type: 'post', category: 'articles' }),
        node({ type: 'note', status: 'evergreen' }),
        node({ type: 'note', status: 'seedling' }),
      ],
      false
    );

    expect(entries.map(e => e.key)).toEqual(['status:seedling', 'status:evergreen', 'category:articles', 'type:tag']);
  });

  it('알려지지 않은 카테고리도 누락되지 않고 뒤에 붙는다', () => {
    const entries = buildLegendEntries(
      [node({ type: 'post', category: 'zines' }), node({ type: 'post', category: 'essay' })],
      false
    );

    expect(entries.map(e => e.key)).toEqual(['category:essay', 'category:zines']);
  });

  it('status/category가 없는 노드의 폴백 키가 resolveNodeColor 폴백과 일치한다', () => {
    const noteWithoutStatus = node({ type: 'note' });
    const postWithoutCategory = node({ type: 'post' });
    const entries = buildLegendEntries([noteWithoutStatus, postWithoutCategory], true);

    expect(entries.map(e => e.key)).toEqual(['status:seedling', 'category:notes']);
    expect(entries[0]!.color).toBe(getNoteColor('seedling', true));
    expect(entries[1]!.color).toBe(getPostColor('notes', true));
  });

  it('한 탭에 함께 뜨는 행들의 색이 눈으로 구분된다 (범례가 구분 불가능해지는 회귀 차단)', () => {
    const gardenNodes = [
      node({ type: 'note', status: 'seedling' }),
      node({ type: 'note', status: 'budding' }),
      node({ type: 'note', status: 'evergreen' }),
      node({ type: 'tag' }),
    ];
    const blogNodes = [
      node({ type: 'post', category: 'essay' }),
      node({ type: 'post', category: 'articles' }),
      node({ type: 'post', category: 'notes' }),
      node({ type: 'category' }),
      node({ type: 'tag' }),
    ];

    const tooClose: string[] = [];

    for (const nodes of [gardenNodes, blogNodes]) {
      for (const isDark of [false, true]) {
        const entries = buildLegendEntries(nodes, isDark);

        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i]!;
            const b = entries[j]!;
            const distance = rgbDistance(a.color, b.color);
            if (distance <= MIN_LEGEND_COLOR_DISTANCE) {
              tooClose.push(`${isDark ? 'dark' : 'light'} ${a.key}(${a.color})/${b.key}(${b.color})=${distance}`);
            }
          }
        }
      }
    }

    expect(tooClose).toEqual([]);
  });

  it('모든 스와치가 캔버스 배경 대비 3:1을 넘는다 (WCAG 1.4.11 비텍스트 대비)', () => {
    const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminance = (hex: string) => {
      const [r, g, b] = ([1, 3, 5] as const).map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255)) as [
        number,
        number,
        number,
      ];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };

    const allNodes = [
      node({ type: 'note', status: 'seedling' }),
      node({ type: 'note', status: 'budding' }),
      node({ type: 'note', status: 'evergreen' }),
      node({ type: 'post', category: 'essay' }),
      node({ type: 'post', category: 'articles' }),
      node({ type: 'post', category: 'notes' }),
      node({ type: 'category' }),
      node({ type: 'tag' }),
    ];

    const failures: string[] = [];

    for (const isDark of [false, true]) {
      const background = getBackgroundColor(isDark);
      for (const entry of buildLegendEntries(allNodes, isDark)) {
        const ratio = contrast(entry.color, background);
        if (ratio < 3) failures.push(`${isDark ? 'dark' : 'light'} ${entry.key}(${entry.color})=${ratio.toFixed(2)}`);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe('getBackgroundColor', () => {
  it('라이트 모드에서 밝은 색상을 반환한다', () => {
    expect(getBackgroundColor(false)).toBe('#ffffff');
  });

  it('다크 모드에서 어두운 색상을 반환한다', () => {
    expect(getBackgroundColor(true)).toBe('#0a0a0a');
  });
});
