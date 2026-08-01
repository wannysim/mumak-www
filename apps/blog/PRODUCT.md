# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

세 층위의 독자를 동시에 상대한다 (확인됨):

1. **미래의 나** — garden/notes는 사실상 저자 본인의 지식 베이스. 다시 찾아보고, wikilink로 연결을 따라가는 용도.
2. **동료 개발자** — articles/notes의 기술 콘텐츠를 읽으러 오는 프론트엔드/웹 개발자.
3. **일반 독자** — essay 등 비개발 글을 읽는 지인·일반 방문자.

## Product Purpose

Wan Sim의 개인 블로그 + 디지털 가든 (wannysim.com). 성공의 기준 (확인됨, 복수):

- **꾸준히 쓰게 만드는 것** — 글쓰기·가든 가꾸기가 지속되는 상태가 최우선.
- **검색·AI 유입** — SEO/GEO로 글이 검색되고 인용되는 것 (robots AI 크롤러 정책, llms.txt, 마크다운 엔드포인트 등 투자 중).
- **개인 브랜드** — Wan Sim이라는 개발자의 정체성·크래프트가 전달되는 것.
- **실험장** — 새 웹 기술(WebGPU 그래프, Spotify 위젯 등)을 실험하는 놀이터.

## Positioning

앞으로도 지켜야 할 핵심 (확인됨):

- **블로그 + 가든 이중 구조** — 완성글(essay/articles/notes)과 자라나는 노트(garden, PARA 구조: projects/areas/resources/archives)의 공존. wikilink와 그래프 뷰가 가든을 연결한다.
- **한/영 완전 이중언어** — 모든 콘텐츠의 ko/en 페어리티. `validate:content`가 에러 수준으로 강제한다.

## Operating Context

- 콘텐츠는 `content/{ko,en}/{articles,essay,notes,garden}` MDX 파일. garden은 PARA 폴더 구조 + wikilink (`validate:garden`으로 링크 무결성 검증).
- 라우트는 `(main)` 그룹(콘텐츠·목록)과 `(immersive)` 그룹(`/graph` 3D 그래프 뷰)으로 나뉜다.
- Spotify 현재 재생 위젯(spotify-vinyl), 검색(정적 인덱스), 테마·로케일 전환 등 클라이언트 위젯이 있다.
- 배포: 홈서버(프로덕션) + Vercel(프리뷰). `now.mdx`로 현재 근황 페이지 운영.

## Capabilities and Constraints

- Next.js App Router + next-intl + MDX(next-mdx-remote-client), `output: standalone`.
- FSD 레이어 규율 (앱 라우트 → widgets → features → entities → shared) + barrel export.
- 스타일: Tailwind CSS v4 + `@mumak/ui`(shadcn/ui 기반 공유 패키지).
- 접근성 기반 selector로 테스트(Jest + Playwright). E2E는 standalone 빌드 기준.
- 새 콘텐츠 타입·페이지 추가 시 ko/en 페어리티와 wikilink 무결성 검증을 통과해야 한다.
- 블로그 카테고리 `notes`의 표시 라벨은 "단상 / Thoughts"다. 라우트 slug(`/blog/notes`)와 콘텐츠 폴더(`content/{ko,en}/notes`)는 그대로이며, "노트"라는 단어는 가든 노트만 가리킨다.

## Brand Commitments

- 이름: **Wan Sim** (wannysim.com). 별도 로고·비주얼 아이덴티티 가이드는 아직 없음.
- 손수 만든 크래프트 요소(그래프 뷰, 바이닐 위젯)가 브랜드의 일부다.

## Evidence on Hand

- 실제 콘텐츠: `content/{ko,en}` 하위 essay·articles·notes·garden MDX (실존, 이중언어).
- 고객 후기·지표·프레스 등은 없음 — 미래 작업에서 지어내지 말 것.

## Product Principles

1. **쓰는 사람이 멈추지 않게** — 저작·퍼블리싱 마찰을 늘리는 변경은 실패다.
2. **가든과 블로그는 다른 생물** — 완성글의 읽기 경험과 자라나는 노트의 탐색 경험을 하나로 뭉개지 않는다.
3. **이중언어는 기본값** — 한쪽 언어만 되는 기능·콘텐츠는 미완성이다.
4. **실험은 격리해서** — 실험적 위젯은 실패 단위를 작게 (ClientErrorBoundary 등), 핵심 읽기 경험을 볼모로 잡지 않는다.
5. **검색과 AI가 읽을 수 있게** — 사람용 화면과 기계용 표면(sitemap, llms.txt, 마크다운 엔드포인트)을 함께 유지한다.
