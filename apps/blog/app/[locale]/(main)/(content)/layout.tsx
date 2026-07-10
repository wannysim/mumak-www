// children을 Suspense로 감싸지 않는다. 예전 Cache Components 실험 때 넣었던
// 경계인데(db5091e), 그 모드는 철회됐고(next.config.mjs 참조) 경계가 남아 있으면
// 동적 렌더(SSG miss 등)에서 셸이 먼저 flush돼 notFound()가 404 status를 못 잡고
// 200 + noindex(soft-404)로 굳는다.
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">{children}</div>;
}
