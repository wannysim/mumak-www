import { render } from '@testing-library/react';

import { Command, CommandItem, CommandList } from '@mumak/ui/components/command';

import '@testing-library/jest-dom';

// cmdk 1.1.1은 모든 아이템에 data-selected를 항상 붙인다("true"/"false").
// 그래서 하이라이트 스타일은 반드시 값 지정 변형(data-[selected=true]:)이어야 한다.
// presence 변형(data-selected:)을 쓰면 [data-selected]가 "false" 아이템까지 매칭해
// 기본 상태에서 모든 항목이 hover된 것처럼 칠해진다. 이 회귀를 고정한다.
// @mumak/ui에 테스트 러너가 없어 소비자(blog)에서 실제 컴포넌트로 검증한다.
describe('CommandItem selected-state styling', () => {
  it('highlights only the active item via the value-specific data variant', () => {
    const { container } = render(
      <Command>
        <CommandList>
          <CommandItem>First</CommandItem>
          <CommandItem>Second</CommandItem>
        </CommandList>
      </Command>
    );

    const items = container.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      const cls = item.className;
      expect(cls).toContain('data-[selected=true]:bg-muted');
      // presence 변형으로의 회귀 방지: 이게 있으면 모든 항목이 칠해진다.
      // 문자열을 런타임 조립해 Tailwind @source 스캐너가 죽은 클래스를 생성하지 않게 한다.
      const presenceForm = ['data-selected', 'bg-muted'].join(':');
      expect(cls).not.toContain(presenceForm);
    }
  });
});
