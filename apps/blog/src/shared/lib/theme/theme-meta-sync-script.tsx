'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { useRef } from 'react';

import { themeMetaSyncInlineScript } from './theme-meta-sync';

// 초기 SSR 스트림에만 인라인 스크립트를 삽입한다 (paint 전 실행 보장).
// locale 전환 같은 클라이언트 내비게이션에서는 아무것도 렌더하지 않으므로
// React 19의 "script tag while rendering" 경고가 발생하지 않고,
// 최초 로드에 등록된 MutationObserver가 계속 동작한다.
//
// dangerouslySetInnerHTML 사용 근거: 주입되는 스크립트는 빌드 타임에
// themeMetaSync.toString()과 정적 theme-config 값으로만 합성되며,
// 사용자·외부 입력이 섞일 경로가 없다. React는 script 자식 텍스트를
// HTML 이스케이프하므로 인라인 JS 주입에는 이 방법만 동작한다.
export function ThemeMetaSyncScript() {
  const isInsertedRef = useRef(false);

  useServerInsertedHTML(() => {
    if (isInsertedRef.current) return null;
    isInsertedRef.current = true;
    return <script dangerouslySetInnerHTML={{ __html: themeMetaSyncInlineScript }} />;
  });

  return null;
}
