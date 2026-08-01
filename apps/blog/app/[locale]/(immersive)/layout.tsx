export default function ImmersiveLayout({ children }: { children: React.ReactNode }) {
  // 몰입형 라우트에는 헤더/푸터가 없어 main landmark가 아예 없었다.
  // overflow-hidden은 유지한다 — 캔버스 크기가 ResizeObserver로 이 컨테이너에서 나오므로
  // 스크롤바가 생기면 폭 변화 → resize 피드백 루프가 된다.
  return <main className="h-dvh w-full overflow-hidden">{children}</main>;
}
