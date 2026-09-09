# 이미지 자산·업로드 아키텍처

`apps/admin`의 저장·인증·발행·공개 URL 계약을 정의한다.
운영 설정과 검증 기록은 [r2-setup.md](r2-setup.md)를 따른다.

## 구성

```text
운영자 브라우저 → Vercel admin → 인증·용량 예약·발행 ticket
       │                │
       └─ signed PUT ─→ R2 private: blog/staging/<uuid>
                        │
                 임시 디렉터리에서 변환
                        │
                 R2 private: source + manifest
                 R2 public: JPEG + WebP
                        │
                 img.wannysim.com → 방문자·RSS
```

- admin은 `apps/admin`을 root directory로 하는 독립 Vercel 프로젝트다.
- 영구 저장소는 R2뿐이다. 변환마다 서버가 임시 디렉터리를 생성하고 성공·실패 뒤 삭제한다.
- 공개 도메인과 자산 URL은 블로그 앱의 배포 위치에 의존하지 않는다.
- DB, 요청 시 이미지 변환기, 별도 queue는 사용하지 않는다.

## 인증과 업로드

- 운영자는 처음 한 번 업로드 토큰으로 로그인한다. `POST /api/session`에서 정확한 Origin과
  bearer token을 검증한 뒤 7일 유효 세션을 발급한다. 토큰 원문은 로그인 성공 뒤 입력 상태에서 지운다.
- 세션은 별도 256-bit secret으로 HMAC-SHA256 서명하고, 발급·만료 시각과 난수 nonce를 포함한다.
  서명은 admin origin과 현재 token digest에도 묶인다. 토큰이나 signing secret을 바꾸면 기존 세션은 무효다.
- production 쿠키는 `__Host-` 이름, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`를 사용한다.
  Domain은 지정하지 않는다. HTTP localhost 개발 환경에서는 별도 쿠키 이름과 Secure 없는 설정을 쓴다.
- 두 업로드 API는 쿠키 서명·만료와 정확한 Origin을 매번 검증하고 인증 실패 시 R2에 접근하지 않는다.
  bearer token만으로 직접 업로드할 수 없다. JSON body는 1 KiB로 제한한다.
- `DELETE /api/session`은 정확한 Origin을 확인하고 현재 브라우저의 쿠키를 만료시킨다.
  세션 목록을 저장하지 않는 구조라 이미 복사된 쿠키 자체를 개별 철회하지는 않는다.
  전체 세션 철회는 signing secret 교체로 수행한다. R2 조회와 별도 DB는 필요하지 않다.
- 새로고침은 서버가 쿠키를 검증해 로그인 상태를 복원한다. 업로드 중 401 응답을 받으면
  로그인 화면으로 돌아간다. token/session은 localStorage나 sessionStorage에 저장하지 않는다.
- `POST /api/images/uploads`는 1 byte 이상 32 MiB 이하 크기를 받아 용량을 예약한다.
  5분 presigned PUT과 15분 publication ticket을 발급한다.
- PUT 서명은 `Content-Length`, `Content-Type`, `If-None-Match: *`를 고정한다.
  브라우저는 private staging으로 직접 전송하며 운영자 bearer token은 R2에 보내지 않는다.
- private CORS는 승인된 admin origin만 허용한다. R2 credential은 서버 환경 변수에만 둔다.
- `POST /api/images`는 ticket ID만 받아 ETag CAS로 한 번 claim한다. 임의 객체 key를 받지 않는다.
  실제 staging 크기가 ticket의 선언 크기와 같아야 변환한다.
- 같은 프로세스에서 변환·발행이 진행 중이면 새 변환을 거절한다. 인스턴스 간 경합과 영구
  객체 불변성은 R2 조건부 쓰기로 제어한다.

## Identity와 인코딩

| 계약              | 값                                                                       |
| ----------------- | ------------------------------------------------------------------------ |
| 입력              | 단일 JPEG, 최대 32 MiB, decoded 50,000,000 pixels                        |
| canonical policy  | `source-v1`: EXIF 방향 적용, sRGB 변환, metadata 제거                    |
| canonical JPEG    | quality 95, 4:4:4, progressive false, mozjpeg false, optimiseCoding true |
| asset ID          | canonical JPEG의 전체 SHA-256, 소문자 64자리                             |
| rendition 크기    | 1600 × 1600 안에 비율 유지, 확대 금지                                    |
| `content-v1` JPEG | quality 82, 4:2:0, progressive true, mozjpeg false, optimiseCoding true  |
| `content-v1` WebP | quality 79, effort 4, lossy, smartSubsample true                         |

원본 입력 바이트와 canonical source는 구분한다. EXIF/GPS/ICC/XMP를 영구 이미지에 남기지 않는다.
manifest는 schema version, asset ID, source policy, encoder 버전, 각 파일의 크기·치수·SHA-256을 담는다.
`source-v1` 바이트는 고정 fixture 테스트로 보호한다. encoder 변경 시 이 계약을 먼저 검증하며,
기존 `content-v1` URL의 바이트를 새 인코딩 결과로 덮어쓰지 않는다.

## R2 key와 불변성

```text
mumak-www-private/blog/<asset-id>/source.jpg
mumak-www-private/blog/<asset-id>/manifest.json
mumak-www-private/blog/staging/<uuid>
mumak-www-private/blog/control/upload-budget.json
mumak-www-private/blog/control/tickets/<uuid>.json

mumak-www-public/blog/<asset-id>/content-v1/image.jpg
mumak-www-public/blog/<asset-id>/content-v1/image.webp
```

- 두 버킷의 루트 `blog/`가 현재 앱 영역이다. 다른 앱은 `<app>/` 형제로 추가한다.
  prefix는 인증 격리 수단이 아니다. 현재 writer는 blog만 지원한다.
- manifest를 먼저 `If-None-Match: *`로 생성해 checksum을 확정하고 source·rendition을 조건부 생성한다.
  경쟁 요청은 저장된 manifest를 기준으로 기존 바이트를 검증한다.
- 같은 canonical source의 재업로드는 기존 주소와 바이트를 유지한다. 누락 객체는 새 변환 결과가
  저장된 manifest와 일치할 때만 복구한다. source 불일치는 collision, checksum 불일치는 corruption이다.
- 공개 객체 생성은 여러 key에 걸쳐 원자적이지 않다. JPEG만 먼저 보일 수 있지만 두 공개 URL의
  MIME·길이·SHA-256 검증이 끝나야 발행 성공과 MDX 결과를 반환한다.
- 완료 ticket 재전송은 기존 manifest의 결과를 반환한다. 공개 파일 검증을 반복하지 않는다.
- 캐시 정책은 `public, max-age=31536000, immutable`이다. 원본과 manifest는 공개하지 않는다.

## 비용·실패·복구

- admission은 UTC 하루 20회, 최소 간격 5초다. private CAS 장부로 8,000,000,000 bytes를 예약한다.
- 요청당 160 MiB를 먼저 예약하고 완료 시 입력·영구 파일 크기와 8 KiB로 정산한다.
  이 장부는 계정 전체 실제 사용량이나 결제 상한이 아니다.
- 발행 단계에 들어가지 못한 예약은 staging lifecycle보다 넉넉한 72시간 유예 뒤 다음 admission에서
  자동 회수한다. 영구 객체를 만들 수 있는 지점을 통과한 ticket은 회수 대상에서 제외하고 수동
  대조까지 예약을 남긴다. processing ticket 재처리는 거절하며, 새 ticket으로 같은 파일을 올리면
  checksum이 일치하는 누락 객체를 복구할 수 있다.
- 발행 실패는 원인 코드를 유지해 응답한다. 저장소 상태 불일치(collision·corruption)는 재시도를
  권하지 않고, 공개 URL 검증 실패만 일시적 실패로 안내한다.
- staging은 1일 lifecycle로 삭제한다. 유효한 signed URL 재사용을 막기 위해 전송 직후 객체를
  삭제하지 않는다. 영구 이미지에는 만료 규칙을 적용하지 않는다.
- 예산 알림과 WAF의 범위, 보수적 장부의 수동 정산 절차는 운영 기록을 따른다.
- R2 내구성은 별도 백업과 동일한 보장이 아니다. 별도 백업 복구 훈련은 수행하지 않았다.

## 블로그 사용 계약

성공 응답의 MDX snippet은 WebP `<source>`와 JPEG `<img>`를 갖춘 `<picture>`다.
`img.wannysim.com/blog/<asset-id>/content-v1/image.{jpg,webp}`를 그대로 사용한다.
실제 rendition의 width/height와 `loading="lazy"`, `decoding="async"`를 포함한다.
의미 있는 사진은 대체 텍스트를 작성하고, 장식 이미지는 빈 alt와 presentation/aria-hidden을 지정한다.
이미지 발행 뒤 블로그 본문에 snippet을 붙이고 콘텐츠를 배포한다.
