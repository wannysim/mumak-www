'use client';

import { useScrollDirection } from '@/src/shared/hooks';

interface SmartHeaderProps {
  children: React.ReactNode;
}

/**
 * 스크롤 방향에 따라 자동으로 숨기고 나타나는 헤더 래퍼
 *
 * - 스크롤 다운: 헤더가 위로 슬라이드하며 사라짐
 * - 스크롤 업: 헤더가 다시 나타남
 * - 상단 근처: 항상 표시
 *
 * pr-[var(--removed-body-scroll-bar-size,0px)]: Radix 오버레이(테마·언어 드롭다운 등)가
 * body 스크롤을 잠글 때 react-remove-scroll은 body에만 스크롤바 폭을 보정하고,
 * fixed 요소인 이 헤더는 뷰포트만큼 넓어져 내용이 옆으로 밀린다. 잠금 중에만
 * body에 세팅되는 이 CSS 변수로 같은 폭을 패딩 보정해 밀림을 없앤다.
 */
export function SmartHeader({ children }: SmartHeaderProps) {
  const { isVisible, isAtTop } = useScrollDirection({ threshold: 50 });

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50
        pr-[var(--removed-body-scroll-bar-size,0px)]
        transition-transform duration-300 ease-out
        ${isVisible ? 'translate-y-0' : '-translate-y-full'}
        ${isAtTop ? 'bg-background' : 'bg-background/95 backdrop-blur-sm shadow-sm'}
      `}
      data-visible={isVisible}
      data-at-top={isAtTop}
    >
      {children}
    </header>
  );
}

/**
 * 고정 헤더의 높이만큼 공간을 확보하는 Spacer 컴포넌트
 * 헤더가 fixed position이므로, 콘텐츠가 헤더 아래에서 시작하도록 함
 */
export function HeaderSpacer() {
  return <div className="h-16" aria-hidden="true" />;
}
