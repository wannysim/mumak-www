# 이미지 자산·업로드 아키텍처 — Single Source of Truth

> 상태: **Accepted · 구현 완료, production go-live 대기**
>
> 결정일: 2026-08-14
>
> 적용 대상: `apps/blog`의 본문 이미지와 `apps/admin`의 내부 업로드 경로
>
> 소유자: 저장소 소유자
>
> 이 문서가 이미지 저장·업로드·서빙에 관한 유일한 규범 문서다. 과거 리뷰·계획 문서를
> 대체하며 운영 절차는 같은 디렉터리의 `home-server-runbook.md`가 연결한다.

## 1. 최종 결정

런타임 이미지 업로드 코드는 `apps/admin`에 구축하되, 홈 서버 acceptance가 끝나기 전에는
production에 연결하지 않는다.

2026-08-14 구현 시점의 blog 콘텐츠에는 실제 본문 이미지가 0개였다. 저장소 소유자가 브라우저에서
이미지를 먼저 발행하는 운영 흐름을 명시적으로 승인했다. Dufs,
imgproxy, DB, queue 없이 direct writer와 고정 rendition만 구현한다.

대신 다음 두 단계로 간다.

1. **production 연결 전 — authoring 계약 준비**
   - 잘못된 `800x400` 렌더링은 제거했고 MDX/RSS authoring 계약을 CI가 검증한다.
   - 실제 asset 발행은 홈 서버 acceptance 뒤 `apps/admin`으로만 한다.
2. **구현된 목표 — 단일 writer 업로드**
   - `apps/admin`의 직접 업로드와 read-only static media origin을 사용한다.
   - 업로드 시 고정 JPEG/WebP를 한 번 생성한다. 요청 시 변환기는 두지 않는다.
   - 공개 URL과 바이트는 불변이며, 정확한 바이트를 off-host에 백업한다.

production go-live 이후 구조는 다음과 같다.

```text
[업로드 — LAN/WireGuard + 별도 인증]
운영자 브라우저 → apps/admin → <host-media-root>
                               ├─ private     canonical source + manifest
                               └─ published   fixed renditions

[공개 읽기 — read-only]
방문자/RSS/preview → Cloudflare → NPM → media-origin(RO) → published

[참조]
blog MDX → https://img.wannysim.com/blog/<sha256>/content-v1/image.jpg|webp
```

## 2. 이 결정을 만든 확인 사실

| 확인 사실                                                                                    | 설계에 미치는 영향                                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 구현 시작 당시 blog MDX에 실제 본문 이미지가 0개였다.                                        | 기존 asset migration 없이 새 영구 계약을 적용할 수 있다.                                |
| upload route, file input, multipart parser, durable upload mount가 없다.                     | 기존 시스템과의 호환보다 새 신뢰 경계를 정확히 만드는 것이 중요하다.                    |
| MDX 웹 렌더러는 임의로 `800x400`을 넣고, RSS는 React MDX component가 아니라 `marked`를 쓴다. | 웹 전용 component로 문제를 숨기지 말고 MDX 원문이 절대 URL·실제 크기·alt를 가져야 한다. |
| production은 Cloudflare → NPM → 홈서버 Docker이고 Vercel은 dev/PR preview다.                 | 공개 asset hostname은 앱 배포 위치와 분리해야 한다.                                     |
| 홈서버는 제한된 RAM을 여러 컨테이너와 공유한다.                                              | 동시 decode는 1개로 제한하고 실제 최악 입력으로 상한을 보정한다.                        |
| RAW/촬영 원본은 별도 보관 체계가 있다.                                                       | 업로드 시스템은 공개용 canonical source와 rendition만 책임진다.                         |

## 3. 영구 계약

아래 항목은 구현 편의 때문에 바꾸지 않는다.

### 3.1 공개 URL

```text
https://img.wannysim.com/blog/<full-sha256>/content-v1/image.jpg
https://img.wannysim.com/blog/<full-sha256>/content-v1/image.webp
```

- asset id는 privacy-safe canonical source 바이트의 **소문자 full SHA-256**이다. 잘린 hash, slug,
  날짜, 업로드 파일명은 identity에 넣지 않는다.
- 허용 경로는 `blog/[0-9a-f]{64}/content-v[1-9][0-9]*/image.(jpg|webp)`뿐이다.
- query string, encoded slash, dot segment, directory listing은 허용하지 않는다.
- `content-v1`의 의미나 기존 바이트를 바꾸지 않는다. 크기·crop·quality·format 정책이 달라지면
  `content-v2`를 **추가**하고 `content-v1`은 계속 제공한다.
- `img.wannysim.com`은 영구 public contract다. 저장소를 R2/S3나 다른 host로 옮겨도 URL을 바꾸지
  않는다.

### 3.2 canonical source와 `content-v1`

asset id를 결정하는 canonical source 정책은 하나만 허용한다.

| 정책        | canonical bytes                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `source-v1` | resize하지 않은 orientation 반영 픽셀을 sRGB로 바꾸고 metadata를 제거한 JPEG. quality 95, 4:4:4, progressive off다. |

이 정책은 mozjpeg를 끄고 optimized Huffman coding은 켠다. `sharp`와 libvips 버전을 manifest에
기록하고 같은 pinned fixture의 canonical checksum을 테스트로 고정한다. dependency를 올려 새 bytes가
생기면 기존 asset을 다시 인코딩하지 않는다. 이후 같은 사진이 다른 asset id를 얻는 것은 허용하며,
정책 의미 자체를 바꿀 때만 `source-v2`를 추가한다.

공개 `content-v1`은 다음과 같다.

| 항목        | `content-v1`                                                        |
| ----------- | ------------------------------------------------------------------- |
| geometry    | 긴 변 최대 1600px, 비율 유지, 확대 금지                             |
| JPEG        | quality 82, 4:2:0, progressive on, mozjpeg off, optimized coding on |
| WebP        | lossy quality 79, effort 4, smart subsample on                      |
| orientation | canonical source에서 이미 반영된 픽셀 기준                          |
| color       | sRGB                                                                |
| metadata    | EXIF, GPS, thumbnail, ICC 등 모든 metadata 제거                     |
| animation   | 허용하지 않음                                                       |

`source-v1`에서 두 rendition을 직렬로 만든다. 첫 공개 전에 실제 사진 fixture로 품질과 peak RAM을 확인한다. 값이
부적절하면 첫 URL 발행 전에 이 표를 고칠 수 있지만, 발행 뒤에는 값을 바꾸지 않고 version을 올린다.

### 3.3 소유권과 불변성

- namespace별 writer는 항상 하나다. blog는 `apps/admin`만 RW이고 public origin은 RO다.
- 이미 발행된 파일은 overwrite하지 않는다. 같은 asset id가 다시 계산되면 incoming canonical
  bytes를 저장된 canonical source와 비교하고, 기존 파일은 **기존 manifest의 checksum**으로 검증한
  뒤 그대로 반환한다. 새 encoder가 만든 rendition과 과거 rendition을 비교하지 않는다.
- 같은 SHA인데 canonical bytes가 다르면 collision, 기존 source·manifest·rendition의 checksum이
  서로 다르면 corruption이다. 둘 다 overwrite 없이 발행을 중단한다.
- public delete UI는 만들지 않는다. 법적·보안상 삭제가 필요할 때만 명시적 수동 절차로 origin과
  관리 가능한 cache를 제거한다. browser, RSS reader, archive의 복사본까지 회수된다고 약속하지
  않는다.

### 3.4 앱과 저장소의 분리

- MDX와 향후 DB는 local path, Nginx path, S3 scheme, signed transform URL을 저장하지 않는다.
- blog는 위 public URL만 사용한다.
- photo 앱은 실제 구현이 승인될 때 별도 metadata/workflow ADR을 쓴다. 지금 DB schema, album,
  caption, queue, storage adapter를 미리 만들지 않는다.

## 4. blog authoring 계약

### 4.1 구현 완료 범위

다음 blog-side 계약을 구현했다.

1. `apps/blog/mdx-components.tsx`의 고정 `width={800}` / `height={400}`을 제거한다.
2. blog 본문용 이미지는 이미 만들어진 rendition이므로 `next/image` 재최적화를 거치지 않고 원문의
   validated native image props를 보존한다. 최소 집합은 `src`, `srcSet`, `type`, `width`, `height`,
   `alt`, `loading`, `decoding`, `fetchPriority`, `role`, `aria-hidden`이다.
3. `validate-content.mjs`에 실제 본문 이미지 검사를 추가한다.
   - code fence와 inline code 안의 예시는 제외한다.
   - Markdown image 문법은 거절하고 lowercase `<picture>` 안의 WebP source + JPEG fallback만 허용한다.
   - 두 URL의 host, full hash, version이 같고 확장자만 다른지 검사한다.
   - `img.wannysim.com` URL 문법, 양의 정수 width/height, alt를 검사한다.
   - `alt=""`는 `role="presentation"`과 `aria-hidden="true"`를 명시한 장식 이미지에만 허용한다.
4. 웹 렌더링과 RSS `content:encoded`가 같은 absolute asset URL, 실제 크기, alt를 유지하는 최소
   회귀 테스트를 둔다. `/_next/image` URL이 RSS에 들어가면 실패한다.

권장 snippet은 다음 형태다. 본문 일반 이미지는 lazy이고, LCP 이미지라면 작성자가 `loading`과
`fetchPriority`를 명시적으로 바꾼다.

```mdx
<picture>
  <source type="image/webp" srcSet="https://img.wannysim.com/blog/<sha256>/content-v1/image.webp" />
  <img
    src="https://img.wannysim.com/blog/<sha256>/content-v1/image.jpg"
    alt="이미지의 의미를 설명하는 텍스트"
    width="1600"
    height="1067"
    loading="lazy"
    decoding="async"
  />
</picture>
```

## 5. 런타임 업로드 결정

저장소 소유자가 “Git 배포 전에 브라우저에서 이미지를 공개한다”는 운영 흐름을 선택해 구현을
승인했다. 첫 asset 발행은 §15의 수동 go-live acceptance 뒤에만 수행한다.

## 6. 구현된 최소 구성

| 구성요소                         | 책임                                                                                      | 권한                             |
| -------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| `apps/admin`                     | 인증, raw upload streaming, 검증, canonicalize, rendition 생성, 원자적 발행, snippet 반환 | blog scope RW                    |
| `media-origin`                   | 고정 파일의 GET/HEAD                                                                      | `published` RO                   |
| NPM                              | 두 hostname의 TLS, source/path/method allowlist, internal container proxy                 | 파일 접근 없음                   |
| Cloudflare                       | public DNS, cache, 회선 보호                                                              | 원천 저장소 아님                 |
| restic + off-host object storage | exact-byte backup과 복구                                                                  | backup read, remote append/write |

`media-origin`은 pinned digest의 작은 Nginx container 하나로 둔다. admin 프로세스에 public GET을
합치면 인터넷에 노출된 프로세스가 RW mount까지 가지므로 분리한다. NPM container에 host 파일을
직접 mount하지 않는다.

`apps/admin`은 기존 monorepo 배포 방식을 따르는 최소 앱으로 만들되, about/now 편집이나 photo
관리 기능을 함께 넣지 않는다. `sharp`는 Next의 transitive dependency에 기대지 않고 admin의 direct
dependency로 선언하고 lockfile로 고정한다. admin과 media-origin은 host port 없이 NPM과 같은
internal Docker network에만 붙이고 admin replica는 정확히 1개다.

admin ingress는 다음 한 경로로 고정한다.

```text
LAN/WireGuard browser
  → <private-admin-hostname>
  → NPM: DNS-01 인증서로 TLS 종료 + LAN/WireGuard CIDR allowlist
  → apps/admin internal container port
```

private admin hostname에는 public A/AAAA record를 만들지 않는다. LAN/WireGuard DNS만
홈서버 LAN IP로 답한다. NPM은 실제 배포에서 확인한 LAN/WireGuard CIDR만 허용하고 나머지를
거절한다. hostname을 알아내거나 홈 IP에 Host header를 직접 보내도 allowlist를 통과하지 못해야
한다.

## 7. 저장 구조와 manifest

admin은 scope root 하나를 RW bind mount한다. 하위 경로를 별도 mount하지 않아 rename이 `EXDEV`로
깨지지 않게 한다.

```text
<host-media-root>/
├── .staging/<server-generated-uuid>/
├── private/<sha256>/
│   ├── source.jpg
│   └── manifest.json
└── published/<sha256>/
    └── content-v1/
        ├── image.jpg
        └── image.webp
```

- `.staging`과 `private`는 어떤 public container에도 mount하지 않는다.
- `source.jpg`는 §3.2 정책으로 만든 privacy-safe canonical source다. 사용자가 올린
  metadata-bearing input은 성공·실패와 무관하게 staging cleanup 대상이며 백업하지 않는다.
- `published/<sha256>`는 public variant set 전체를 directory rename으로 한 번에 보이게 한다.
- 새 version은 `content-v2` directory를 원자적으로 추가한다. 기존 version은 수정하지 않는다.

`manifest.json`에는 다음만 둔다.

```json
{
  "schemaVersion": 1,
  "assetId": "<full-sha256>",
  "canonicalPolicy": "source-v1",
  "source": { "sha256": "...", "bytes": 0, "width": 0, "height": 0 },
  "processor": { "sharp": "...", "libvips": "..." },
  "variants": {
    "content-v1": {
      "jpeg": { "sha256": "...", "bytes": 0, "width": 0, "height": 0 },
      "webp": { "sha256": "...", "bytes": 0, "width": 0, "height": 0 }
    }
  }
}
```

원래 filename, EXIF, GPS, bearer token, client path는 manifest와 log에 남기지 않는다.

## 8. 업로드·발행 트랜잭션

### 8.1 요청 계약

- multipart parser를 추가하지 않는다. browser는 한 요청에 파일 하나를 raw body
  (`application/octet-stream`)로 보낸다.
- server는 `Content-Type`과 `Content-Length`를 신뢰하지 않고 stream 중 실제 bytes를 센다.
- 시작 정책은 JPEG 1장, 32MiB 이하, 50MP 이하, animation/multi-page 없음이다. 32MiB/50MP는
  첫 go-live benchmark에서 낮출 수 있는 상한이지 URL 계약이 아니다.
- proxy와 app 모두 body, header, read timeout을 제한한다. 시작 upload timeout은 120초다.
- 활성 upload는 전역 1개다. 두 번째 요청은 queue에 쌓지 않고 `429 Retry-After`로 돌려보낸다.

### 8.2 인증과 network

- admin container는 host port를 열지 않는다. browser traffic은 §6의 NPM TLS 경로만 사용한다.
- LAN은 인증이 아니다. 256-bit random bearer token을 요구하고 server에는 hash만 둔다.
- token은 URL, cookie, localStorage, log에 넣지 않는다. UI는 탭 memory에만 보관한다.
- NPM의 CIDR allowlist와 함께 production에서 설정한 exact HTTPS Origin 검사, CORS deny를
  적용한다. cookie 인증을 쓰지 않으므로 ambient credential 기반 CSRF를 만들지 않는다.
- token과 machine-local config는 저장소 밖, Vaultwarden/배포 secret에 둔다.

### 8.3 처리 순서

1. server-generated UUID 아래 파일을 `O_CREAT|O_EXCL`, no-follow, mode `0600`으로 연다.
2. body를 backpressure를 지키며 stream하고 byte ceiling, timeout, disk error를 즉시 처리한다.
3. JPEG magic byte와 `sharp` decode를 모두 통과시킨다. `limitInputPixels`, fail-on-warning,
   single-page를 강제한다.
4. auto-orient → sRGB → metadata strip → §3.2 `source-v1` full-size JPEG 순으로 만든다.
5. canonical bytes의 full SHA-256을 asset id로 계산한다.
6. 같은 id의 path가 있으면 먼저 아래 상태표로 분류한다. complete duplicate이면 incoming canonical
   bytes를 기존 `source.jpg`와 비교하고 기존 manifest/files checksum을 검증한다. 새 rendition은
   만들지 않되, 아직 success를 반환하지 않고 10번의 public 검증으로 간다.
7. 새 asset이면 canonical source에서 `content-v1` JPEG/WebP를 **직렬** 생성하고 실제
   dimensions/checksum을 manifest에 쓴다.
8. staged 파일과 directory를 `fsync`한다.
9. process mutex 아래 `private/<sha256>`와 `published/<sha256>`를 exclusive `mkdir`로 claim한다.
   private 파일을 commit한 뒤, 두 rendition이 든 staged `content-v1` directory를
   `published/<sha256>/content-v1`로 한 번에 rename한다. public reader는 완성된 두 파일 또는 404만
   보고 한 파일만 보지 않는다.
10. parent directory를 `fsync`하고 Cloudflare 경유 JPEG/WebP `GET`과 checksum을 확인한 뒤에만
    success를 반환한다.

`published/<sha256>/content-v1` directory의 등장이 commit point다. 그 전에는 URL이나 success를
반환하지 않는다. 기존 path의 처리 순서는 다음과 같다.

| 상태                                                                            | 판정과 동작                                                                                                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| public commit point + 유효한 private manifest/files                             | complete duplicate. incoming canonical을 비교하고 10번의 public GET/checksum으로 간다.                                                                              |
| commit point 전의 빈 claim 또는 incomplete private                              | interrupted transaction. staged checksum이 유효하면 commit을 재개하고, 없으면 claim/temp를 폐기한 뒤 저장된 canonical source 또는 incoming input에서 다시 생성한다. |
| public commit point는 있지만 manifest/source/rendition이 없거나 checksum 불일치 | corruption. overwrite/자동 삭제 없이 중단하고 알린다.                                                                                                               |
| 같은 SHA지만 incoming canonical bytes가 다름                                    | collision. overwrite 없이 중단한다.                                                                                                                                 |

완성된 public set이나 그 private source는 age만으로 지우지 않는다. 24시간이 지난 무소유 UUID
input/temp만 안전한 경로 규칙 안에서 정리하며 symlink는 따라가지 않는다.

모든 실패 경로는 input/temp를 지운다. `ENOSPC`는 예상 가능한 실패로 처리해 public partial을 남기지
않는다. free-space precheck만 믿지 않고 write/rename/fsync 각각의 오류를 처리한다.

### 8.4 성공 응답

응답은 asset id, JPEG/WebP public URL, 실제 공통 width/height, canonical source/JPEG/WebP 각각의
SHA-256을 반환한다. admin UI는 alt 입력 또는 “장식 이미지” 선택 없이는 MDX snippet 복사를 활성화하지
않는다. 의미 있는 이미지는 빈 alt를 허용하지 않는다. 이 metadata는 이미지 identity에 섞지 않는다.

## 9. 자원·프로세스 경계

- container는 non-root, read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`로 실행한다.
- admin만 blog scope RW mount를 받고 media-origin은 published RO mount만 받는다.
- admin replica와 upload/transform concurrency는 모두 1이다. 두 번째 upload는 429로 거절한다.
  sharp/libvips thread 수, CPU, memory, pids limit을 compose에 명시한다.
- cgroup memory 값은 문서의 과거 384/768MiB 추측을 복사하지 않는다. 최신 production host에서
  `free -m`을 측정하고 32MiB·50MP landscape/portrait/panorama fixture의 peak RSS를 관찰해 정한다.
- 새 commit 뒤에도 `minFreeBytes`가 남아야 한다. 초기 20GiB는 후보일 뿐 `df`와 다른 container의
  사용량으로 확정한다. ceiling 근처에서는 거절하고 `ENOSPC` rollback도 시험한다.
- decode crash/OOM은 admin container에만 영향을 주어야 한다. blog와 media-origin health는 유지한다.
- request id, result, asset id, bytes, dimensions, latency만 구조화해 기록한다. 원본 filename, body,
  EXIF, auth header는 기록하지 않는다.

## 10. 공개 서빙과 cache

media-origin/NPM은 다음을 강제한다.

- `GET`/`HEAD`와 §3.1 path만 허용하고 나머지는 404/405다.
- 확장자별 고정 `Content-Type`, `X-Content-Type-Options: nosniff`, directory listing off,
  symlink/dotfile 접근 거절.
- 성공 응답은 `Cache-Control: public, max-age=31536000, immutable`이다.
- 404, 429, 5xx는 장기 cache하지 않는다.
- media-origin은 host port를 열지 않고 NPM과 internal Docker network에서만 통신한다.

Cloudflare는 `img.wannysim.com`만 orange proxy로 두고 immutable path를 1년 edge cache한다. Tiered
Cache는 현재 plan에서 잘못 적었던 Generic Global이 아니라 해당 plan에서 제공되는 Smart Topology를
쓴다. Cloudflare cache는 eviction 가능한 복사본이지 원천 저장소나 backup이 아니다.

origin은 `img.wannysim.com` location에서 Cloudflare IP만 허용한다. Authenticated Origin Pull을 쓸
경우 zone-specific certificate까지 구성했을 때만 origin lock으로 간주한다. public blog의 기존 DR
hostname 규칙과 media allowlist를 섞지 않는다.

## 11. MDX·RSS authoring 계약

- source of truth는 MDX에 들어간 lowercase `<picture>`, `<source>`, `<img>`와 absolute public URL이다.
- Markdown image 문법은 허용하지 않는다. `<picture>`의 WebP와 JPEG는 같은 full hash·variant여야 한다.
- width/height는 `content-v1`의 실제 JPEG/WebP 공통 dimensions다. 가짜 기본값을 만들지 않는다.
- meaningful image는 구체적인 alt가 필수다. 장식 이미지는 `alt=""`, `role="presentation"`,
  `aria-hidden="true"`를 함께 쓴다.
- RSS는 React component 결과가 아니라 source를 `marked`로 변환하므로 source 자체가 유효해야 한다.
- blog renderer는 이미 최적화된 asset을 `/_next/image`로 다시 감싸지 않는다.
- upload success는 public URL 검증 뒤에만 반환하므로 CI build가 홈서버 availability에 의존하는
  network HEAD check는 두지 않는다. validator는 문법·metadata를 검사하고, availability는 upload
  transaction과 외부 uptime check가 담당한다.

## 12. 백업·복구·관측

런타임 go-live 전에 다음을 모두 완료한다.

- `private`, `published`, manifest, media policy, compose, media-origin/NPM 설정을 매일 encrypted
  restic backup으로 off-host object storage에 보낸다. 기본 대상은 Cloudflare R2다.
- exact published derivative bytes를 반드시 백업한다. encoder를 pin해도 미래 버전으로 같은 bytes를
  재생성할 수 있다고 가정하지 않는다.
- backup credential과 restic password는 Vaultwarden에 보관하고, 같은 값을 적은 봉인 recovery card를
  홈서버와 다른 물리 장소에 둔다. secret을 rotate하면 두 곳을 함께 바꾼다. Vaultwarden만으로는
  홈서버 재해를 복구할 수 있다고 보지 않는다.
- 기본 RPO는 24시간, 목표 RTO는 4시간, 보존은 daily 7 / weekly 5 / monthly 12다.
- backup job은 성공 heartbeat를 보내고 26시간 미수신 시 알린다.
- 분기마다 **홈서버와 Vaultwarden을 사용할 수 없다고 가정하고** off-site recovery card에서 시작해
  빈 임시 경로로 restore한다. manifest checksum을 전수 확인한 뒤 isolated media-origin으로 같은 URL
  path가 200과 동일 bytes를 내는지 시험한다.

관측 항목은 upload success/failure reason, 처리 latency, peak RSS, free bytes, staging age,
media-origin 4xx/5xx, Cloudflare hit ratio, backup age다. 개인 블로그에 Prometheus/Loki를 새로 추가하지
말고 현재 log/uptime 수단으로 시작한다.

## 13. 저장소 이전 조건과 절차

R2/S3-compatible primary storage는 다음 중 하나가 실제 요구가 될 때만 검토한다.

- writer가 local bind mount를 쓸 수 없는 host/serverless에서 실행된다.
- 외부 client의 presigned direct upload가 필요하다.
- 여러 독립 writer, IAM 분리, object versioning/lifecycle/event, off-host HA가 필요하다.

이전할 때 object key는 public path와 같은 `blog/<sha256>/content-vN/image.ext`로 둔다. exact bytes와
checksum을 먼저 복사하고 shadow read로 검증한 뒤 `img.wannysim.com` origin만 바꾼다. MDX/DB URL은
수정하지 않는다. primary 이전 전에도 R2 backup은 유지할 수 있다.

production page origin을 다시 Vercel 등으로 옮겨도 asset hostname은 별도이므로 DNS의 path split에
의존하지 않는다.

## 14. 구현·배포 상태

| 상태 | 작업                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| 완료 | MDX native rendition, validator, RSS 회귀 테스트                                         |
| 완료 | `apps/admin` auth, raw streaming, canonicalize, atomic publication, recovery tests       |
| 완료 | standalone Dockerfile, read-only media origin, GHCR promotion workflow                   |
| 대기 | host 실측, storage/backup restore rehearsal, NPM/Cloudflare 설정, 실제 upload acceptance |

runtime origin 전환은 §15의 수동 acceptance 뒤 한다. 구체적인 사용자 작업 순서는
`home-server-runbook.md`를 따른다.

## 15. 완료 조건

### 자동화할 최소 회귀 테스트

- code block의 가짜 `<img>`는 무시하고 실제 body image만 검증한다.
- URL host/path, width/height, alt/decorative 규칙 위반이 build를 실패시킨다.
- Markdown image 문법과 hash/version이 다른 불완전 `<picture>` 쌍이 build를 실패시킨다.
- RSS에 absolute JPEG/WebP URL과 width/height/alt가 남고 `/_next/image`가 없다.
- pinned fixture의 `source-v1` checksum이 바뀌면 명시적 policy 결정을 요구한다.
- byte/pixel/format 경계, 중복 upload, SHA destination mismatch가 각각 안전하게 실패한다.
- processor upgrade 뒤 중복 upload는 새 rendition과 비교하지 않고 기존 manifest/files를 검증해
  기존 URL과 bytes를 반환한다.
- crash injection을 private commit 전/후와 public rename 전/후에 걸어도 partial public set이 없다.
- EXIF/GPS/thumbnail이 canonical source와 rendition 모두에서 사라지고 orientation·sRGB가 맞다.
- ENOSPC와 timeout 뒤 staging이 정리되고 기존 asset은 바뀌지 않는다.

### go-live 수동 acceptance

- WAN에서 admin이 닫히고 LAN/WireGuard + 잘못된/없는 token은 거절된다.
- 32MiB/50MP 경계 fixture에서 host의 다른 container가 건강하고 peak RSS가 정한 limit 안이다.
- public allowlist 밖의 method/path/query/source/manifest는 도달하지 않는다.
- JPEG/WebP의 MIME, checksum, dimensions, immutable cache header가 맞다.
- 두 번째 요청에서 `CF-Cache-Status: HIT`와 `Age`가 확인된다.
- upload 직후 반환된 snippet이 web, RSS, Vercel preview에서 렌더되고 CLS를 만들지 않는다.
- 빈 위치 restore로 같은 key와 bytes를 제공하고 RPO/RTO 안에 끝난다.

## 16. 명시적으로 채택하지 않은 것

| 제외                      | 이유                                                                                               | 재검토 조건                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Dufs                      | staging writer와 publish guard 사이 claim/recovery protocol이 생긴다. raw direct upload가 더 작다. | 폴더 업로드·재개·파일 관리 UI가 실제 필수일 때     |
| imgproxy                  | variant가 하나이고 불변이므로 request-time decode와 cache-miss OOM을 만들 이유가 없다.             | 사용자 지정 crop/size가 실제 제품 요구일 때        |
| MinIO                     | 현재 Community 저장소가 archive/source-only 상태이고 단일 writer에 S3 API가 필요 없다.             | §13 조건이 생긴 시점의 유지되는 제품을 새로 비교   |
| DB                        | blog asset identity와 발행에는 filesystem manifest면 충분하다.                                     | photo metadata/workflow가 실제 생길 때             |
| queue/worker              | 운영자 1명이고 concurrency 1 reject가 데이터 손실 없이 동작한다.                                   | 측정된 대기 수요가 생길 때                         |
| generic storage interface | 구현체가 하나다.                                                                                   | 두 storage를 동시에 운영해야 할 때                 |
| AVIF                      | 제한된 host에서 CPU/메모리 비용의 가치가 검증되지 않았다.                                          | 실제 사진 benchmark에서 WebP 대비 이득이 확인될 때 |

## 17. 공식 근거

- Next.js는 static import에서 dimensions를 추론하지만 remote image는 width/height가 필요하다:
  [Images](https://nextjs.org/docs/app/getting-started/images),
  [`next/image`](https://nextjs.org/docs/app/api-reference/components/image)
- Next.js `public` 자산의 기본 cache header는 장기 immutable이 아니므로 asset origin에서 명시한다:
  [`public` folder](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder)
- sharp의 pixel limit, fail-on, auto-orient, color/metadata 동작:
  [Constructor](https://sharp.pixelplumbing.com/api-constructor/),
  [Operations](https://sharp.pixelplumbing.com/api-operation/),
  [Output](https://sharp.pixelplumbing.com/api-output/)
- Cloudflare Tiered Cache의 plan 가용성과 topology:
  [Cache plans](https://developers.cloudflare.com/cache/plans/),
  [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/)
- Cloudflare cache는 원천 저장소가 아니다:
  [Retention vs freshness](https://developers.cloudflare.com/cache/concepts/retention-vs-freshness/)
- DNS record가 없는 private hostname의 인증서는 DNS-01로 검증한다:
  [Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/)
- zone-specific origin 인증을 포함한 AOP:
  [Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
- R2의 S3-compatible API와 restic의 S3 backend:
  [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/),
  [restic repository backends](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)
- MinIO Community 상태:
  [official repository](https://github.com/minio/minio)

## 18. 결정 이력

- 2026-08-09: host filesystem + Dufs + imgproxy 안과 별도 리뷰 작성.
- 2026-08-14: 코드·콘텐츠·운영 환경 재검증. 현재 수요 0건을 반영해 런타임 구축을 조건부로
  미루고, 발동 후 목표를 direct raw upload + pre-generated rendition + RO static origin으로 축소.
  외부 Codex 적대적 검토에서 atomic directory publication, exact derivative backup, MDX/RSS snippet,
  private temp cleanup, ENOSPC rollback을 필수 계약으로 승격.
- 2026-08-14: 저장소 소유자가 브라우저 선발행 운영 흐름을 명시적으로 선택해 구현 승인. `apps/admin`
  direct writer와 read-only origin, blog authoring contract, GHCR 공급망을 구현. Vercel은 영구 RW mount와
  private ingress를 제공하는 이 구조에 맞지 않아 admin 배포 대상에서 제외. production 연결은 host
  benchmark·backup restore·NPM/Cloudflare acceptance 뒤로 유지.
