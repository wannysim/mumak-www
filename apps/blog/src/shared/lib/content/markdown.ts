import { Marked } from 'marked';

// MDX 본문(코드펜스 포함, top-level JSX/import 없음)을 RSS content:encoded 등
// HTML 소비 경로용으로 변환한다. 포스트의 JSX 데모는 전부 코드펜스 안에 있어
// `<pre><code>`로 이스케이프되므로 피드에 raw JSX가 새지 않는다.
//
// 본문 렌더링(MDX, next-mdx-remote-client + remark-gfm)과는 별개의 경량 경로다.
// GFM 동작은 맞추되, 피드/원문 생성에만 쓰이므로 코드 하이라이팅 등은 적용하지 않는다.
const marked = new Marked({ gfm: true, breaks: false });

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }).trim();
}
