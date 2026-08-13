// request.ts가 로드하는 것과 동일한 정적 import 경로를 그대로 쓴다.
// 로케일 간 키 누락은 런타임에 MISSING_MESSAGE로만 드러나므로 여기서 구조 불변식으로 고정한다.
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';

type Leaf = { path: string; value: unknown };

function flattenLeaves(node: Record<string, unknown>, prefix = ''): Leaf[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? flattenLeaves(value as Record<string, unknown>, path)
      : [{ path, value }];
  });
}

// ICU 인자 이름만 뽑는다: {name}, {count, plural, ...} 양쪽 모두 첫 토큰이 인자 이름이다.
function placeholderNames(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const matches = value.match(/\{\s*\w+/g) ?? [];
  return Array.from(new Set(matches.map(match => match.replace(/[{\s]/g, '')))).toSorted();
}

const koLeaves = flattenLeaves(ko);
const enLeaves = flattenLeaves(en);
const koPaths = koLeaves.map(leaf => leaf.path);
const enPaths = enLeaves.map(leaf => leaf.path);

describe('messages/{ko,en}.json parity', () => {
  it('should expose the identical set of leaf key paths', () => {
    const enPathSet = new Set(enPaths);
    const koPathSet = new Set(koPaths);

    expect({
      koOnly: koPaths.filter(path => !enPathSet.has(path)),
      enOnly: enPaths.filter(path => !koPathSet.has(path)),
    }).toEqual({ koOnly: [], enOnly: [] });
  });

  it('should declare the keys in the identical order', () => {
    const index = koPaths.findIndex((path, i) => path !== enPaths[i]);
    const firstMismatch = index === -1 ? null : { index, ko: koPaths[index] ?? null, en: enPaths[index] ?? null };

    expect(firstMismatch).toBeNull();
  });

  it('should have a non-empty string at every leaf', () => {
    const invalid = [
      ...koLeaves.map(leaf => ({ locale: 'ko', ...leaf })),
      ...enLeaves.map(leaf => ({ locale: 'en', ...leaf })),
    ].filter(leaf => typeof leaf.value !== 'string' || leaf.value.trim() === '');

    expect(invalid).toEqual([]);
  });

  it('should use the identical ICU placeholders for every shared key', () => {
    const enByPath = new Map(enLeaves.map(leaf => [leaf.path, leaf.value]));

    const mismatched = koLeaves
      .filter(leaf => enByPath.has(leaf.path))
      .map(leaf => ({
        path: leaf.path,
        ko: placeholderNames(leaf.value),
        en: placeholderNames(enByPath.get(leaf.path)),
      }))
      .filter(entry => entry.ko.join(',') !== entry.en.join(','));

    expect(mismatched).toEqual([]);
  });
});
