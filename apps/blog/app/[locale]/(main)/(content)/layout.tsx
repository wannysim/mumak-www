// children을 Suspense로 감싸지 않는다. 예전 Cache Components 실험 때 넣었던
// 경계인데(db5091e), 그 모드는 철회됐고(next.config.mjs 참조) 경계가 남아 있으면
// 동적 렌더(SSG miss 등)에서 셸이 먼저 flush돼 notFound()가 404 status를 못 잡고
// 200 + noindex(soft-404)로 굳는다.
// xl에서만 폭을 한 단계 넓힌다. 긴 글의 우측 목차 레일(widgets/post-toc)이
// 본문 48rem을 줄이지 않고 들어가려면 여기서 여유가 나와야 한다
// (1152 − 좌우 패딩 64 = 1088 = 본문 768 + gap 32 + 레일 288).
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl xl:max-w-6xl">{children}</div>;
}
