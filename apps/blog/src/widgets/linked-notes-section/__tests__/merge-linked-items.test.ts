import { mergeLinkedItems } from '../lib/merge-linked-items';

// 두 상세 페이지가 같은 함수를 쓰지 않으면 같은 상호 참조 쌍이 한쪽에서는 "서로 참조",
// 다른 쪽에서는 "이 노트를 참조"로 갈린다.
describe('mergeLinkedItems', () => {
  const note = { href: '/garden/x', title: 'X 노트' };
  const post = { href: '/blog/articles/y', title: 'Y 글' };

  it('나가기만 하는 항목은 outgoing이다', () => {
    expect(mergeLinkedItems([note], [])).toEqual([{ ...note, direction: 'outgoing' }]);
  });

  it('들어오기만 하는 항목은 incoming이다', () => {
    expect(mergeLinkedItems([], [note])).toEqual([{ ...note, direction: 'incoming' }]);
  });

  it('양쪽에 있으면 bidirectional이고 한 번만 나온다', () => {
    expect(mergeLinkedItems([note], [note])).toEqual([{ ...note, direction: 'bidirectional' }]);
  });

  it('노트와 글을 섞어도 각자의 방향을 유지한다', () => {
    expect(mergeLinkedItems([note], [post])).toEqual([
      { ...note, direction: 'outgoing' },
      { ...post, direction: 'incoming' },
    ]);
  });

  it('둘 다 비면 빈 배열이다', () => {
    expect(mergeLinkedItems([], [])).toEqual([]);
  });
});
