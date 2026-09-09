# R2 이미지 운영 기록

2026-09-09 기준. 사용자 승인으로 이미지 업로더를 Vercel + R2로 전환하고 운영 업로드를 검증했다.
영구 이미지 계약은 [architecture.md](architecture.md)의 R2 전환 계약을 따른다.

## 구조와 접근 범위

```text
mumak-www-public                    Standard / APAC
└── blog/<full-sha256>/content-v1/
    ├── image.jpg
    └── image.webp

mumak-www-private                   Standard / APAC
└── blog/
    ├── <full-sha256>/
    │   ├── source.jpg
    │   └── manifest.json
    ├── staging/<uuid>              브라우저가 전송한 입력, 1일 만료
    └── control/
        ├── upload-budget.json     ETag CAS 예약 장부
        └── tickets/<uuid>.json     admission/processing/done 상태
```

- 공개 도메인: `https://img.wannysim.com`, 최소 TLS 1.2.
- admin 프로젝트: `mumak-www-admin`, root `apps/admin`, Node.js 24.x.
- admin origin: `https://admin.wannysim.com`.
- 도메인 등록은 Vercel, 권한 DNS는 Cloudflare다. `admin` CNAME은 Vercel 프로젝트의
  지정 대상에 DNS only로 연결한다. 기존 `mumak-www-admin.vercel.app` 주소는 경로와 쿼리를
  유지한 채 새 도메인으로 308 이동한다. 기존 도메인의 로그인 쿠키는 이전되지 않는다.
- 양쪽 `r2.dev` URL은 disabled. private 버킷에 공개 도메인은 없다.
- `mumak-admin-r2` Account API Token은 두 버킷의 Object Read & Write만 허용한다.
  버킷 설정을 바꾸는 Admin 권한은 없다.
- Vercel production에만 R2 credential, 업로드 token digest와 session signing secret을 넣는다. Preview에는 운영 쓰기
  권한을 자동 전달하지 않는다. 키·token 원문·호스트 경로는 Git에 저장하지 않는다.
- private CORS는 admin origin의 PUT, `Content-Type`/`If-None-Match`만 허용한다.
  public CORS는 미설정이다. CSP는 R2 S3 endpoint로의 전송을 허용한다.
- 다른 앱은 `blog/` 옆에 `<app>/`을 추가한다. 현재 구현된 writer는 blog뿐이다.
  prefix는 권한 격리 수단이 아니므로 신뢰 범위가 다른 writer는 별도 버킷을 검토한다.

## 배포와 사용

- 운영 URL: [Mumak Media Admin](https://admin.wannysim.com).
- private 버킷 CORS는 `https://admin.wannysim.com` 한 origin만 허용한다. 로컬 dev에서
  브라우저 직접 PUT까지 시험하려면 `wrangler r2 bucket cors set`으로 로컬 origin을 추가해야 한다.
- `apps/admin/app/api/images/route.ts`의 `maxDuration = 300`이 현재 Vercel 플랜에서 실제로
  적용되는지는 아직 확인하지 않았다. Fluid Compute 설정과 함께 점검 대상이다.
- Vercel Hobby 프로젝트의 production 배포 상태는 READY다.
  배포 ID: `dpl_BY6AvCZUeQru1u7G5W55N8yVsvfS`.
- 현재 운영 배포는 Vercel CLI 소스 snapshot이다. GitHub `wannysim/mumak-www` 연결을 완료했고,
  이후 main push는 Production, 나머지 브랜치 push와 PR은 Preview로 자동 배포한다.
  이 PR의 base인 develop 병합은 Preview이며, main 릴리즈 시 운영 도메인에 반영된다.
- 재배포 시 로컬 build/cache 산출물을 제외한 소스만 업로드한다. Vercel에서는 adapter를
  사용하고, 로컬 E2E에서만 Next.js `output: standalone`을 사용한다.
- 업로드 토큰으로 로그인한 뒤 JPEG와 대체 텍스트를 입력하고 이미지 발행을 누른다. 로그인은 7일간 유지된다. 성공하면 MDX snippet을
  블로그 본문에 붙인다. 운영자 토큰 원문은 저장소 밖의 사용자 로컬 보안 파일에 보관한다.

## 업로드 흐름

1. 운영자가 토큰으로 로그인해 HttpOnly 세션 쿠키를 받는다. 이후 JPEG와 대체 텍스트만 입력한다.
2. `POST /api/images/uploads`가 세션 서명·만료와 정확한 Origin을 검사하고 크기를 검증한다.
3. 장부에 용량을 먼저 예약한 뒤 5분 presigned PUT과 15분 publication ticket을 반환한다.
   파일 크기와 Content-Type, `If-None-Match: *`가 서명에 포함된다.
4. 브라우저가 private staging에 파일을 직접 PUT한다. 운영자 bearer token은 R2에 보내지 않는다.
   업로드가 성공한 객체는 즉시 삭제하지 않아 유효한 URL의 재사용을 막는다.
5. `POST /api/images`가 ticket을 CAS로 한 번 claim하고, 임시 디렉터리에서
   source-v1/content-v1 변환을 실행한다. 최대 입력 32 MiB, 50 MP를 유지한다.
6. manifest·source·rendition을 조건부 생성하고 공개 URL의 MIME/크기/SHA-256을 검사한 뒤
   MDX snippet을 반환한다. 임시 디렉터리는 정리한다.
7. 완료 ticket 재전송은 기존 manifest의 결과를 반환한다. 공개 파일 재검증을 반복하지 않는다.

## 비용 방어와 한계

| 항목             | 적용값                                                         |
| ---------------- | -------------------------------------------------------------- |
| R2 저장 등급     | Standard, Infrequent Access 전환 없음                          |
| 미완료 multipart | 양쪽 버킷에 1일 정리 규칙; 기존 7일 기본 규칙도 유지           |
| 입력 임시 객체   | private `blog/staging/` 1일 만료; 영구 이미지 만료 없음        |
| rendition 캐시   | `public, max-age=31536000, immutable`                          |
| 계정 예산 알림   | `mumak-www early spend warning`, USD 0.01, 계정 소유자 이메일  |
| 기존 계정 알림   | 자동 생성된 USD 10 알림 유지                                   |
| admission        | UTC 하루 20회, 최소 간격 5초                                   |
| 저장량 예약      | blog writer의 보수적 예산 8,000,000,000 bytes                  |
| 한 요청 예약     | 160 MiB; 완료 시 입력 크기 + 영구 객체 크기 + 8 KiB로 정산     |
| 예약 회수        | 발행 미진입 예약은 72시간 유예 뒤 다음 admission에서 자동 회수 |

Lifecycle 삭제와 사용량 집계에는 지연이 있다. 무료량은 계정 전체에 합산되며 버킷별로
늘어나지 않는다. Standard 무료량은 저장 공간 10 GB-month, Class A 월 100만 회,
Class B 월 1,000만 회다. [공식 가격](https://developers.cloudflare.com/r2/pricing/)

**USD 0.01 예산 알림은 결제 상한이나 자동 정지 기능이 아니다.** R2 밖의 계정 PAYG 비용도
포함할 수 있다. [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)

8 GB는 이 writer가 관리하는 예약 장부의 한도다. 다른 앱·CLI·콘솔에서 기록하는 객체나
다른 R2 버킷의 사용량까지 제한하지 않는다. 새 앱을 추가할 때는 계정 전체 예산을 다시
나누어야 한다. 인증되지 않은 API 요청은 R2 접근 전에 거절한다.

## 이미지 요청 방어

`mumak image request guard` WAF custom rule은 `img.wannysim.com`에서 다음을 Block한다.

- GET/HEAD 이외 method, query string, raw path의 `%`, path의 `/.` 또는 `//`.
- `/blog/`로 시작하지 않는 경로.
- `/content-v1/image.jpg` 또는 `/content-v1/image.webp`로 끝나지 않는 경로.

full SHA-256 문법 전체를 검사하는 validator는 아니다. 공개 객체 key와 불변성은 writer가
검증한다. 다른 앱이나 `content-v2`를 추가할 때 WAF 허용 범위도 함께 갱신한다.
정상 형태의 대량 요청과 cache miss 비용까지 차단하는 설정은 아니다.

## 실패와 복구

- 발행 단계에 들어가지 못한 ticket의 예약은 72시간 유예 뒤 다음 admission에서 회수한다.
  staging lifecycle이 1일이므로 그 시점에는 해당 ticket이 차지한 바이트가 남아 있지 않다.
  claim을 시도한 예약은 부분 발행 가능성 때문에 회수하지 않는다. 새 업로드가 기존 부분 발행을
  복구해도 이전 예약은 남는다.
- version 1 장부의 항목은 예약과 정산을 구분할 수 없어 회수하지 않는다. version 1 장부가 남은
  환경에서는 기존 잠금이 자동으로 풀리지 않고 수동 대조가 필요하다. 2026-09-09 기준 운영 버킷에는
  장부 객체 자체가 없으므로 해당 사례는 없다.
- processing 상태에서 실패하면 같은 ticket은 재처리하지 않는다. 새 ticket으로 같은
  사진을 올리면 저장된 manifest/checksum을 기준으로 누락 객체만 복구한다.
- 저장된 바이트가 manifest와 다르거나 기존 encoder의 누락 바이트를 재현할 수 없으면
  overwrite 없이 멈춘다. 손상된 객체를 임의 삭제하거나 재인코딩해 덮어쓰지 않는다.
- 실패·취소 admission만 누적하면 약 47회에서 8 GB 예산에 도달할 수 있다. 하루 20회 제한이므로
  3일 안에 연속 실패하면 여전히 `storage_limit`에 닿는다. 다만 72시간 유예가 지난 예약은
  자동 회수되므로 잠금이 영구적이지는 않다. 이는 실제 사용량을 조회하는 quota가 아니라
  실패 시 추가 쓰기를 멈추는 정책이다.
- `storage_limit` 발생 시 먼저 업로드를 중단하고 모든 ticket과 실행 중인 함수가 종료됐는지
  확인한다. private 장부를 백업한 뒤 두 버킷 객체 inventory, 진행 중인 업로드, 다른 앱의
  사용량과 실제 결제 사용량을 대조한다. 그 근거 없이 장부를 삭제하거나 예약을 0으로 초기화하지 않는다.
  자동 회계 재조정 명령은 아직 제공하지 않는다. 영구 이미지를 자동 삭제해 용량을 맞추지 않는다.
- 발행 실패 응답은 원인 코드를 유지한다. `collision`·`corruption`은 재시도를 권하지 않는
  문구로 안내하고 500으로, 공개 URL 검증 실패는 503으로 응답한다. 서버 로그에도 같은 코드가 남는다.

## 검증 기록

- 최초 합성 fixture: `86f9d3521206f75ebc3f371bb1ac9975ca7c5a201232582269fa199285e9c5b8`.
  64 × 36 JPEG(529 bytes), WebP(80 bytes). 사용자 사진은 사용하지 않았다.
- HTTPS JPEG/WebP `200`, 로컬 SHA-256 일치, 반복 JPEG 조회 cache `HIT` 3회.
- 디렉터리·source·query·POST 공개 요청 각각 `403`.
- custom domain ownership/SSL active, 양쪽 `r2.dev` disabled.
- 실제 S3 presigned PUT: 크기 변조 `403`, 최초 저장 `200`, 재사용 `412`, 원격 바이트 일치.
- 실제 S3 ETag 조건 불일치 쓰기 거절. admin CORS preflight `204`와 정확한 origin/header 확인.
  아래 기록은 최초 운영 배포 시점의 검증이다. 저장소 정리 후의 검증은 별도로 기록한다.

- type check, lint, format check, 로컬 build와 Vercel production build 통과.
- 단위 테스트 6개 suite, 116개 통과. 중복/경합/부분 실패 복구/손상/예약 한도/인증 경계를
  검증한다. coverage threshold 통과, React Doctor 96점.
- 브라우저 E2E 2개 통과. 외부 PUT과 publication 흐름은 mock으로 검증한다.
- 별도 운영 acceptance: Codex 전용 Computer Use로 실제 production 관리자 페이지에서
  기존 64 × 36 fixture의 중복 업로드와 신규 192 × 108 갈색 합성 JPEG 발행을 모두 완료했다.
  공개 URL 검증 완료 메시지와 각 이미지의 MDX snippet을 확인했다.
- 신규 asset: `b70816b4de73f11cfcbbac852c6c5dbfc1fb2d02f981abbd8fc918748288bc6c`.
  private source 521 bytes, 공개 JPEG 632 bytes, WebP 116 bytes. 원격 manifest와 공개
  HTTPS 응답의 크기·SHA-256이 일치한다. 두 응답 모두 `200`과 정확한 이미지 MIME을 반환했다.
- 로컬 시스템 DNS에는 `img.wannysim.com`의 미해결 상태가 남아 있었다. 공용 DNS의 정상
  응답을 확인하고 HTTPS 검증은 해당 주소를 지정하되 인증서 검증을 유지했다. Vercel 함수의
  공개 URL 검증은 정상 DNS 경로로 성공했다. 로컬 DNS 설정은 변경하지 않았다.
- 운영 검증은 작은 합성 이미지 기준이다. 최대 32 MiB·50 MP의 운영 부하 시험과 별도 백업
  복구 훈련은 수행하지 않았다.

## 저장소 정리 후 검증

2026-09-09, R2 전용 구현 정리 직후의 로컬 검증이다. 이후 쿠키 로그인 개선과 함께 운영에 배포했다.

- 영구 디스크 writer와 배포 산출물을 제거하고 R2 발행만 유지했다.
- type check, lint, format check, production build 통과.
- 단위 테스트 6개 suite, 81개 통과. statements 94.01%, branches 89.95%, lines 97.93%로
  coverage threshold를 통과했다. E2E 2개도 통과했다.
- 고정 EXIF fixture의 canonical hash와 최초 운영 192 × 108 이미지의 source/JPEG/WebP
  checksum이 동일하다. 임시 파일은 발행 성공·실패 후 정리된다.
- workflow YAML을 파싱하고 기존 blog promote gate·build·성공 상태 단계를 비교했다.
  blog의 SHA/latest 이미지 발행 경로는 유지한다.
- Knip에서 미사용 코드 문제 없음. React Doctor는 85점으로 순차 rendition 인코딩에 경고 1개를
  표시했다. 50 MP 원본을 처리할 때 peak native memory를 제한하는 기존 순차 실행을 유지했다.

## 쿠키 로그인 운영 검증

2026-09-09, `dpl_2HqBxPRvad5xbTGjkjJqR4Ky1Qd5` production READY 기준이다.

- 독립 `MEDIA_ADMIN_SESSION_SECRET`을 Vercel production에 sensitive 환경 변수로 설정했다.
  사용하지 않는 저장 모드 환경 변수도 프로젝트 설정에서 제거했다.
- type check, lint, format check, 로컬·Vercel build 통과. 단위 테스트 99개, 브라우저 E2E 4개 통과.
- 운영 HTTPS 관리자 페이지에서 실제 토큰으로 로그인하고 `__Host-`·Secure·HttpOnly·Strict
  쿠키를 확인했다. 페이지 스크립트에서는 쿠키를 읽을 수 없고 새로고침 후에도 인증 상태가 유지됐다.
- 토큰 재입력 없이 기존 192 × 108 합성 이미지를 재업로드해 같은 asset ID와 MDX snippet을 받았다.
- 로그아웃 후 쿠키 삭제와 새로고침 시 로그인 화면을 확인했다. 이후 업로드 admission은 `401`이었다.
- 운영자 토큰은 처음 로그인할 때만 사용한다. 세션은 7일 뒤 만료되며 자동 연장하지 않는다.
  signing secret 또는 운영자 token digest 교체는 기존 세션 전체를 무효화한다.
- 로그아웃은 현재 브라우저 쿠키 삭제다. 복사된 쿠키의 개별 서버 철회는 제공하지 않는다.
  세션 내용과 키, token 원문은 운영 기록이나 Git에 저장하지 않는다.

## 관리자 도메인과 rebase 후 검증

2026-09-09, `origin/develop`의 `9e7c9e7` 기준으로 rebase했다.
Next.js 16.3.3 / pnpm 12.3.4 기반 production 배포 `dpl_BY6AvCZUeQru1u7G5W55N8yVsvfS`는 READY다.

- Cloudflare `admin` CNAME을 Vercel 지정 대상으로 DNS only 연결했다. Vercel domain verification과
  일반 DNS 경로의 HTTPS 응답이 정상이다.
- Vercel `MEDIA_ADMIN_ORIGIN`과 private R2 CORS를 `https://admin.wannysim.com`으로 일치시켰다.
- 기존 Vercel alias의 경로·쿼리를 유지하는 `308`과 이전 Origin의 admission `403`을 확인했다.
- headless Chromium에서 실제 로그인·HttpOnly 쿠키·새로고침·R2 직접 PUT·중복 이미지 발행·MDX
  결과·로그아웃을 검증했다. 동일한 192 × 108 asset ID를 반환하며 로그아웃 이후 admission은 `401`이다.
- rebase 후 frozen lockfile 설치, type check, lint, format check, production build, 단위 테스트
  99개와 E2E 4개가 모두 통과했다.

## 구조 리팩토링 검증

- MDX 생성과 공개 이미지 타입을 image entity로 분리하고 브라우저의 admission → PUT → publication
  통신을 feature API로 옮겼다. UI는 폼 상태와 세션 만료 처리를 담당한다.
- 인증 설정을 `admin-auth-config`로 분리하고 도메인 HTTP handler를 feature/server로 이동했다.
  shared 역방향 import와 signing → request 의존은 Oxlint로 금지한다.
- Madge 순환 참조 0개, 단위 테스트 103개(11 suites), E2E 4개 통과.
  coverage는 추출한 API까지 포함하며 statements 95.02%, branches 91.14%, lines 98.20%다.
- React Doctor의 로컬 실행은 maintainability 분석 실패로 점수를 산출하지 못했다.
  표시된 순차 인코딩·R2 조건부 기록 경고는 기존 서버 구현에 해당한다.
