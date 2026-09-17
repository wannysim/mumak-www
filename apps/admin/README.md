# Media Admin

이미지를 R2에 발행하고 JPEG/WebP 주소와 용도별 이미지 스니펫을 만드는 내부 운영 도구다.
인증·인코딩·불변성 계약은 [architecture.md](docs/architecture.md), 운영 설정은
[r2-setup.md](docs/r2-setup.md)를 따른다.

## 사용

[관리자 페이지](https://admin.wannysim.com)에서 업로드 토큰으로 한 번 로그인한다.
같은 브라우저에서 7일간 유지되며 새로고침해도 다시 입력하지 않는다. 이미지와 대체 텍스트를 입력해
발행한 뒤 스니펫 형식을 선택해 복사한다. 형식을 바꾸거나 대체 텍스트를 수정할 때 다시 업로드하지 않는다.
사용을 마치면 로그아웃할 수 있다.

| 형식        | 사용처                    | 출력                                        |
| ----------- | ------------------------- | ------------------------------------------- |
| React / MDX | 이 블로그 본문, React JSX | WebP/JPEG `<picture>`, `srcSet`             |
| HTML        | 일반 HTML                 | WebP/JPEG `<picture>`, `srcset`             |
| Markdown    | 일반 Markdown 편집기      | JPEG 이미지 문법; 크기와 WebP fallback 없음 |
| Next.js     | Next.js 페이지·컴포넌트   | `next/image` import + 반응형 `<Image>`      |

Next.js 형식은 표시 크기에 맞게 `sizes`를 조정하고, 함께 제공되는 항목을 기존
`next.config`의 `images.remotePatterns` 배열에 추가한다. 이 블로그의 MDX에는 **React / MDX**를
사용한다. 렌더링 단계에서 Next Image 최적화와 확대 보기가 자동 적용되고, RSS에는 native `<picture>`가 유지된다.

## 로컬 실행

`.env.example`의 환경 변수를 Git에 포함되지 않는 `.env.local`에 설정한다.
서버에는 운영자 토큰의 SHA-256 digest와 독립적인 `MEDIA_ADMIN_SESSION_SECRET`(64자리 hex)을
설정한다. R2 키와 signing secret은 클라이언트에 노출하지 않는다.

```sh
pnpm --filter admin dev
```

로컬 origin은 `http://admin.mumak.localhost:1355`다. 직접 업로드를 테스트할 origin은 private
버킷 CORS에도 등록해야 한다. 운영 credential과 테스트 저장소를 공유할 때는 용량 장부도 공유된다.

## 배포

`apps/admin`을 root directory로 하는 별도 Vercel 프로젝트를 사용한다.
GitHub 저장소에 연결되어 main push는 운영 자동 배포, 나머지 브랜치·PR은 Preview 자동 배포다.
R2 credential, 운영자 token digest와 session secret은 production 환경에 설정하고 preview에는 자동 제공하지 않는다.
이미지는 private staging으로 직접 전송하고, 서버의 임시 디렉터리에서 변환한 뒤 R2에 저장한다.
로컬 E2E는 standalone build를 사용한다. 영구 파일은 서버 디스크에 보관하지 않는다.

## 이미지 관리

로그인 후 이미지 업로드와 이미지 보관함을 전환할 수 있다. 보관함은 기존 R2 공개 파일을
폴더별로 탐색하고 이미지 수·파일 수·용량·저장 시각·미리보기·공개 주소를 보여 준다.
목록이 여러 페이지면 더 불러오기를 누르며, 완료 전 개수는 불러온 파일 기준이다.

업로드 입력은 JPEG·PNG·WebP·AVIF·정적 GIF를 지원한다. 최대 32 MiB·50 MP이며
발행 결과는 JPEG/WebP다. 투명 배경은 흰색이 되며 움직이는 이미지는 지원하지 않는다.
