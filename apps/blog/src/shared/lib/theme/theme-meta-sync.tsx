import { themeColors } from './theme-config';

// theme-color 메타 태그를 html 클래스 변경에 맞춰 동기화
// Safari iOS에서는 메타 태그를 삭제/생성하면 인식하지 못하고,
// 기존 메타 태그의 content 속성만 변경해야 동적으로 업데이트됨
//
// export는 단위 테스트에서 직접 호출 가능하도록 하기 위함이며,
// 함수는 여전히 .toString()으로 직렬화돼 script 태그 안에서 실행된다.
export function themeMetaSync(colors: { light: string; dark: string }) {
  const updateThemeColor = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const expectedColor = isDark ? colors.dark : colors.light;

    const metaTags = document.querySelectorAll('meta[name="theme-color"]');
    if (!metaTags.length) return;

    metaTags.forEach(metaTag => {
      // content가 다를 때만 업데이트 (불필요한 변경 방지)
      if (metaTag.getAttribute('content') !== expectedColor) {
        metaTag.setAttribute('content', expectedColor);
      }
    });
  };

  // html 요소의 클래스 변경 감지 (next-themes가 dark/light 클래스 토글)
  const themeObserver = new MutationObserver(updateThemeColor);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // head 요소의 변경 감지 (메타 태그가 동적으로 추가될 경우)
  const headObserver = new MutationObserver(updateThemeColor);
  headObserver.observe(document.head, {
    childList: true,
    subtree: true,
  });

  // 초기 실행
  updateThemeColor();
}

export function ThemeMetaSyncScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(${themeMetaSync.toString()})(${JSON.stringify(themeColors)})`,
      }}
    />
  );
}
