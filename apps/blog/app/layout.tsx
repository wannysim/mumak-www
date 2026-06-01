import '@mumak/ui/globals.css';
import './prism.css';

// <html>/<body>/폰트/테마/viewport는 app/[locale]/layout.tsx로 이동했다.
// 루트 레이아웃에서는 locale을 알 수 없어 getLocale()(headers)로 읽으면 앱 전체가
// 동적 렌더링으로 강제되기 때문이다. 여기서는 전역 CSS만 로드하고 그대로 통과시킨다.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
