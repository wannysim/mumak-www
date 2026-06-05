'use client';

// 연도는 render에서 바로 계산한다. effect로 마운트 후에 채우면 footer가
// 비었다가 채워지는 깜빡임이 생긴다. 서버 산출물과 클라이언트의 연도가
// 다를 수 있는 건 연초 재빌드 전의 짧은 기간뿐이므로 경고만 억제한다.
export function Copyright() {
  return <span suppressHydrationWarning>&copy; {new Date().getFullYear()} Wan Sim</span>;
}
