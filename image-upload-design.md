# 이미지 업로드 시스템 — 아키텍처 검토 반영안

> 2026-08-08 재검토. 기존 MinIO 결정은 폐기한다. 현재 기본안은 **호스트 파일시스템 +
> Dufs + imgproxy**다. 이 문서는 구현 전 사용자 피드백을 받기 위한 기준 설계이며,
> `plan.md` Phase 4 요약도 이 결론에 맞춰 갱신한다.

## 1. 결론

이미지를 읽는 blog/photo 앱에는 S3가 필요하지 않다. 두 앱이 알아야 할 것은 저장소 API가
아니라 안정적인 공개 URL뿐이다. 운영자 1명, 단일 홈서버, 최대 100GB라는 현재 조건에서는
일반 파일시스템이 가장 작은 저장 계층이다.

```
[업로드 — LAN/WireGuard 전용]
  브라우저 → Dufs(:9101) → /srv/mumak-images (read-write)

[변환 — 내부]
  imgproxy → /srv/mumak-images (read-only)

[서빙 — 유일한 공개 진입점]
  방문자 → Cloudflare → NPM의 엄격한 공개 경로 → imgproxy

[참조]
  blog MDX → 완성된 공개 URL
  photo DB → asset id + 논리 key + 원본 크기; 공개 URL은 helper로 생성
```

이 구조가 주는 실제 효과는 다음과 같다.

- 이미지 바이트가 blog Docker 이미지와 Git 저장소에서 빠진다.
- 업로드 UI와 이미지 변환기를 직접 만들지 않는다.
- blog, 향후 photo 앱, 로컬 개발, 프리뷰가 같은 공개 URL을 사용한다.
- 저장 계층을 나중에 S3로 바꿔도 공개 URL과 콘텐츠를 유지할 수 있다.
- Dufs만 파일을 쓰고 imgproxy는 같은 디렉터리를 읽기 전용으로 본다.

단, **blog의 새 이미지 참조를 MDX에 추가하면 SSG 재빌드는 여전히 필요하다.** 없어지는 것은
이미지 바이트 때문에 발생하던 빌드 결합이다. photo 앱에서 업로드 즉시 노출하려면 추후
런타임 메타데이터 DB/API가 필요하다.

## 2. 요구사항과 비요구사항

### 2-1. 요구사항

| 항목       | 계약                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| 관리       | 한 LAN admin origin에서 `blog`·`photo` 업로드·관리·발행 snippet 생성                  |
| admin 접근 | LAN/WireGuard에서만 접근. 인터넷·Cloudflare에는 미노출                                |
| 소스       | 웹 전시용 JPEG 중심, 긴 변 4096px 이하, 파일당 10MiB 이하, 총량 100GB 이하            |
| 원본       | RAW와 원본 보관은 기존 체계를 유지                                                    |
| 공개 서빙  | `img.wannysim.com` 한 곳. 원본 저장소는 공개하지 않음                                 |
| 회선 보호  | Cloudflare 캐시 적중을 전제로 하되 캐시를 영구 저장소나 가용성 계층으로 간주하지 않음 |
| URL 안정성 | 발행된 key와 변환 버전은 불변. 변경은 새 URL 발행                                     |
| 앱 독립성  | blog/photo가 파일시스템·Dufs·S3·imgproxy 내부 URL을 저장하지 않음                     |
| 자원       | 홈서버 4GB RAM에서 동시 변환 수와 대기열을 명시적으로 제한                            |
| 복구       | 정확한 공개 key 트리와 설정을 별도 매체에 백업하고 복구를 실제 시험                   |

### 2-2. 지금 만들지 않는 것

- Dufs를 대체하는 커스텀 upload/storage API·admin
- 앨범·태그·순서·다국어 caption 같은 photo 메타데이터
- 다중 사용자·다중 노드·스토리지 복제
- 업로드 큐, 썸네일 사전 생성 worker
- 임의 크기 변환 API

이 기능은 실제 요구가 생길 때 추가한다. 지금의 경계는 이후 확장을 막지 않는다.

## 3. 기존안에서 수정한 결정

### 3-1. MinIO는 기본안에서 제외

MinIO Community 공식 저장소는 2026-04-25 archive 되었고, Community 배포는 source-only로
전환되었다. 기존 바이너리와 이미지는 더 이상 유지보수되지 않는다. 따라서 기존 문서가
전제한 “유지되는 공식 이미지 + 완성된 Console + 수동 업데이트” 조합은 성립하지 않는다.

- 공식 근거: [MinIO Community 저장소](https://github.com/minio/minio#readme)
- 유지되는 AIStor는 [라이선스 의존성](https://docs.min.io/aistor/operations/licenses/)이 있어 이
  개인 이미지 원천의 기본안으로 쓰지 않는다.

S3가 실제 요구가 되면 그 시점의 유지보수·보안·관리 UI 상태를 다시 비교한다. 지금 미래의
스토리지 제품을 미리 고정하지 않는다.

### 3-2. 저장소는 호스트 bind directory

```
/srv/mumak-images/
├── _incoming/       # 업로드·확인 중, 공개 경로에서 제외
├── blog/
│   └── YYYY/MM/
└── photo/
    └── YYYY/MM/
```

- Docker named volume 대신 명시적인 host path를 사용해 백업·복구·용량 확인을 단순화한다.
- Dufs는 `/data:rw`, imgproxy는 같은 경로를 `/images:ro`로 mount한다.
- `_incoming`에서 파일 형식·크기·이름을 확인한 뒤 `blog`/`photo`로 이동한다.
- 폴더는 지금 한 운영자의 관리 구분이다. 권한 경계가 필요해질 때가 S3 재검토 시점이다.

`_incoming`은 격리된 staging일 뿐 Dufs가 이미지 validator가 되는 것은 아니다. Dufs는 큰 파일이나
비이미지도 받을 수 있다. public scope로 이동하기 전 파일명·크기·해상도를 확인하고 canonical
imgproxy URL이 성공해야 발행 완료로 간주한다. 초과 입력은 imgproxy의 아래 제한에서 자동으로
거절하고 `_incoming`에서 정리한다.

### 3-3. 웹 업로더는 Dufs

Dufs는 한 컨테이너에서 drag-and-drop 파일/폴더 업로드, 이동·삭제·검색, 재개 업로드,
경로별 접근 제어, health endpoint를 제공한다. imgproxy가 파일시스템을 직접 읽으므로 Dufs는
public read path에 관여하지 않는다.

- 공식 기능/설정: [Dufs README](https://github.com/sigoden/dufs#readme)
- 보안 정책: [latest release만 지원](https://github.com/sigoden/dufs/security)
- 배포 시 검증된 버전과 image digest를 고정하고 수동으로 업데이트한다.
- 인증 hash와 TLS key 같은 machine-local secret은 저장소 밖에 둔다.

`admin`은 제품 관리 콘솔이 아니라 **파일을 관리하는 내부 웹 UI**라는 뜻이다. photo 앱의
큐레이션 admin은 별도 요구이며 photo 앱 착수 시 결정한다.

Dufs의 `?hash` SHA-256 기능은 발행 key 검증에 사용한다. 반면 Dufs에는 파일당 10MiB나 전체
100GB quota가 없다. 10MiB는 trusted operator의 upload precondition이고 public transform에서는
imgproxy가 강제한다. 100GB는 host filesystem이 project/dataset quota를 지원하면 약간의 여유를
둔 hard quota로 설정한다. 지원하지 않으면 hard limit인 것처럼 쓰지 않고 80GB 경고·100GB 경고와
host free-space 20% 하한을 운영 계약으로 둔다. quota 때문에 별도 upload API를 만들지는 않는다.

### 3-4. S3로 옮기는 명시적 조건

아래 중 하나가 실제로 필요해질 때만 S3 호환 저장소를 다시 고른다.

- 두 번째 서비스가 프로그래밍 방식으로 파일을 쓴다.
- 외부 브라우저에서 presigned direct upload가 필요하다.
- 앱별 write credential/IAM 격리가 필요하다.
- object versioning, lifecycle, event notification이 필요하다.
- 다른 호스트로 복제하거나 다중 노드로 운영한다.

photo 앱이 이미지를 **읽는 것만으로는** 전환 조건이 아니다.

## 4. 공개 URL은 영구 계약

### 4-1. 앱이 사용하는 URL

외부에는 imgproxy 원본 문법과 실제 저장소 scheme을 숨긴다.

```
https://img.wannysim.com/<variant>/<key>@<format>

예:
https://img.wannysim.com/content-v1/blog/2026/08/summer-night-a1b2c3d4e5f6.jpg@jpg
```

초기 공개 계약은 다음으로 제한한다.

- `variant`: `content-v1` 하나. 긴 변 최대 1600px, 비율 유지, 확대 금지
- `key`: `<scope>/<yyyy>/<mm>/<safe-name>` 전체. DB와 helper도 이 값 하나를 사용
- `scope`: key의 첫 segment이며 `blog` 또는 `photo`
- `format`: `jpg`와 `webp`; AVIF는 CPU·화질 실측 후 add-only로 허용
- `safe-name`: `<slug>-<SHA-256 앞 12자리>.jpg`. slug는 소문자 ASCII kebab-case
- 공백, Unicode, `%`, `?`, `#`, `@`, dot segment는 key에서 금지
- 같은 bytes는 같은 hash suffix를 사용하고, bytes가 바뀐 수정본은 새 hash/key를 사용

`content-v1`의 크기·crop·quality 의미는 동결한다. 의미를 바꾸려면 `content-v2`를 추가한다.
photo 앱이 시작되면 `w640-v1`, `w1600-v1`, `w2560-v1`처럼 width 기반 variant를 추가해
`srcset`을 구성한다. 단, orientation 반영 source width보다 큰 variant는 생략하고 실제 출력
width를 descriptor로 쓴다. 확대 금지 결과에 `2560w` 같은 거짓 descriptor를 붙이지 않는다.
기존 variant를 삭제하거나 의미를 바꾸지 않는다.

### 4-2. 내부 변환

NPM은 위 공개 문법만 허용하고 내부에서 다음처럼 변환한다.

```
/content-v1/blog/.../image-a1b2c3d4e5f6.jpg@jpg
→ /unsafe/content-v1/plain/mumak://blog/.../image-a1b2c3d4e5f6.jpg@jpg
```

`unsafe`는 서명을 끈 imgproxy에서도 필요한 signature placeholder다. 공개 URL에는 노출하지
않고 NPM이 붙인다. imgproxy의 저장소 alias는 다음처럼 둔다.

```
IMGPROXY_URL_REPLACEMENTS=mumak://=local:///
```

imgproxy가 제공하는 prefix replacement 기능이므로, 나중에 key를 보존한 채 S3로 옮겨도 공개
URL과 MDX/photo record는 유지할 수 있다. 다만 이전 작업은 replacement만 바꾸는 것이 아니다.
파일 tree를 같은 key로 복사한 뒤 imgproxy의 S3 enable, endpoint/credential, bucket mapping,
`IMGPROXY_ALLOWED_SOURCES`, replacement를 함께 바꾸고 acceptance test를 다시 통과해야 한다.

로컬 저장소를 쓰는 동안에는 `IMGPROXY_LOCAL_FILESYSTEM_ROOT=/images`와
`IMGPROXY_ALLOWED_SOURCES=local://`를 함께 설정한다. source allowlist는 prefix replacement가
적용된 뒤 검사되므로 `mumak://` 외의 공개 입력이 rewrite에 섞여도 네트워크 fetch로 이어지지
않는다.

- 공식 URL 문법: [imgproxy processing URL](https://docs.imgproxy.net/usage/processing)
- alias 기능: [IMGPROXY_URL_REPLACEMENTS](https://docs.imgproxy.net/latest/configuration/options)
- 로컬 소스: [Serving local files](https://docs.imgproxy.net/latest/image_sources/local_files)

NPM은 raw `/unsafe`, `/info`, 임의 preset/source를 전달하지 않는다. `GET`/`HEAD`와 위 문법만
허용하는 anchored route 하나만 두고 query string과 나머지 경로는 default 404로 거절한다.
encoded slash, dot segment, 이중 encoding도 허용 route와 source key를 빠져나가지 못해야 한다.

imgproxy는 host port를 publish하지 않고 NPM과 같은 internal Docker network에만 연결한다.
`IMGPROXY_SECRET`을 설정하고 NPM이 고정 Bearer header를 주입해 NPM을 우회한 LAN/container
요청도 거절한다. secret은 저장소 밖에 둔다. 이 경로 제한, source allowlist, presets-only가
사람이 붙여넣을 수 있는 unsigned URL의 보안 경계다. 자유로운 크기 변환이 필요해지면 그때
URL signer를 추가한다.

## 5. imgproxy 안전·자원 계약

초기값은 다음과 같이 제한한다. 숫자는 추측이 아니라 실제 허용 최대 JPEG로 부하 시험한 뒤
확정한다.

| 항목                                         | 시작값            | 목적                                  |
| -------------------------------------------- | ----------------- | ------------------------------------- |
| `IMGPROXY_ONLY_PRESETS`                      | `true`            | 임의 resize 차단                      |
| `IMGPROXY_PRESETS`                           | 아래 `content-v1` | 공개 variant의 변환 의미 고정         |
| `IMGPROXY_FORMAT_QUALITY`                    | 아래 format별 값  | URL별 encoder quality 고정            |
| `IMGPROXY_LOCAL_FILESYSTEM_ROOT`             | `/images`         | mount 밖 로컬 파일 접근 차단          |
| `IMGPROXY_ALLOWED_SOURCES`                   | `local://`        | HTTP source와 SSRF 차단               |
| `IMGPROXY_ALLOW_PRIVATE_SOURCE_ADDRESSES`    | `false`           | 내부망 fetch 방어                     |
| `IMGPROXY_ALLOW_LOOPBACK_SOURCE_ADDRESSES`   | `false`           | loopback fetch 방어                   |
| `IMGPROXY_ALLOW_LINK_LOCAL_SOURCE_ADDRESSES` | `false`           | link-local fetch 방어                 |
| `IMGPROXY_MAX_REDIRECTS`                     | `0`               | 네트워크 source redirect 차단         |
| `IMGPROXY_SECRET`                            | machine-local 값  | NPM 우회 요청 차단                    |
| `IMGPROXY_MAX_SRC_FILE_SIZE`                 | `10485760`        | 10MiB 초과 입력 거절                  |
| `IMGPROXY_MAX_SRC_RESOLUTION`                | `20` MP           | image bomb 제한                       |
| `IMGPROXY_MAX_RESULT_DIMENSION`              | `4096`            | 출력 상한                             |
| `IMGPROXY_MAX_ANIMATION_FRAMES`              | `1`               | animated 입력의 메모리 폭주 방지      |
| `IMGPROXY_WORKERS`                           | `1`               | 동시에 한 장만 변환                   |
| `IMGPROXY_REQUESTS_QUEUE_SIZE`               | `8`               | 무한 대기열 대신 초과 요청 429        |
| `IMGPROXY_TTL`                               | `86400`           | origin/browser max-age를 1일로 제한   |
| `IMGPROXY_STRIP_METADATA`                    | `true`            | GPS 등 공개 EXIF 제거                 |
| `IMGPROXY_AUTO_ROTATE`                       | `true`            | EXIF orientation 반영                 |
| imgproxy memory limit                        | `384m`에서 실측   | 4096px 최악 입력으로 OOM 여부 확인    |
| Dufs memory limit                            | `128m`에서 실측   | 10MiB 파일·폴더 업로드 중 사용량 확인 |

초기 변환 계약 후보는 다음이다.

```text
IMGPROXY_PRESETS=content-v1=resize:fit:1600:1600:false
IMGPROXY_FORMAT_QUALITY=jpeg=82,webp=79
```

4096px landscape/portrait 표본으로 파일 크기·시각 품질·peak RAM을 확인한 뒤 **Cloudflare cache를
열기 전에** 이 값을 확정한다. 이후 preset, format quality, encoder upgrade가 결과를 바꾸면
`content-v1`을 수정하지 않고 `content-v2`를 추가한다.

`IMGPROXY_AUTO_WEBP/AVIF`는 사용하지 않는다. 같은 URL이 `Accept`에 따라 다른 bytes를
반환하면 Cloudflare cache key가 format을 올바르게 구분해야 한다. Cloudflare의 image vary는
Free plan에서 제공되지 않으므로 출력 format을 URL에 명시하는 쪽이 작고 안전하다.

- imgproxy도 CDN 사용 시 `Accept`를 cache key에 반영하라고 경고한다:
  [configuration options](https://docs.imgproxy.net/latest/configuration/options)
- Cloudflare image vary 가용성:
  [Vary for Images](https://developers.cloudflare.com/cache/advanced-configuration/vary-for-images/)

AVIF는 photo 앱에서 실제 JPEG의 변환 시간·peak RAM·시각 품질을 측정해 WebP보다 가치가
있을 때만 추가한다.

## 6. Cloudflare는 방패이지 저장소가 아니다

Cloudflare cache object는 TTL 전에라도 인기도와 용량에 따라 eviction될 수 있다. 따라서
Cloudflare가 “사실상 원천 서버”라는 표현은 부정확하다. 홈서버는 항상 복구 가능한 origin이어야
하고, cold POP/cache miss에는 홈서버가 응답한다.

- 근거: [Cloudflare retention vs freshness](https://developers.cloudflare.com/cache/concepts/retention-vs-freshness/)

초기 cache 계약:

- `img.wannysim.com` 전용 Cache Rule로 응답을 cache eligible 처리한다.
- imgproxy의 origin `max-age`는 1일, Cloudflare edge TTL override는 1년으로 분리한다.
- 200만 장기 cache하고 404/429/5xx는 cache하지 않는다.
- query string은 공개 경로에서 거절해 cache-busting 입력을 없앤다.
- 반복 요청에서 `CF-Cache-Status: HIT`와 `Age`를 확인하고 origin bytes/cache ratio를 관찰한다.

`IMGPROXY_TTL=86400`을 명시하는 이유는 Cloudflare Browser Cache TTL이 더 긴 origin
`max-age`를 줄이지 못하기 때문이다. edge purge 후에도 이미 받은 browser cache는 강제로
회수할 수 없고, RSS reader·다운로드·제3자 archive의 복사본은 무기한 남을 수 있다. 삭제
절차는 관리 중인 cache를 줄이는 것이지 인터넷에서 완전 회수하는 보장이 아니다. 민감한 파일은
처음부터 public scope에 발행하지 않는다.

- [imgproxy TTL](https://docs.imgproxy.net/latest/configuration/options)
- [Cloudflare Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/)

Cloudflare를 우회해 홈 IP로 직접 요청하면 회선·CPU 보호가 무효가 된다. 공개 origin은
Cloudflare IP만 firewall에서 허용하거나 Authenticated Origin Pull을 적용한다. imgproxy와
Dufs host port는 WAN에 열지 않는다.

- [Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
- [Cloudflare IP allowlist](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/)

## 7. blog에서 쓰는 계약

### 7-1. 실제 발행 흐름

1. JPEG를 sRGB, 긴 변 4096px 이하, 10MiB 이하로 export한다.
2. Dufs의 `_incoming`에 업로드한다.
3. same-origin local publish helper에서 slug를 입력한다.
4. helper가 MIME·크기·방향·SHA-256을 확인하고
   `blog/YYYY/MM/<slug>-<hash12>.jpg` destination이 없는 경우에만 이동한다.
5. helper가 만든 `content-v1` 공개 URL과 소문자 HTML snippet을 확인한다.
6. 새 참조를 포함한 MDX 변경은 기존처럼 commit/deploy한다.

```html
<img
  src="https://img.wannysim.com/content-v1/blog/2026/08/summer-night-a1b2c3d4e5f6.jpg@jpg"
  alt="해 질 무렵 한강 위로 번지는 주황빛"
  width="4096"
  height="2731"
/>
```

`width`/`height`는 EXIF orientation을 반영한 원본 비율이다. 원격 이미지는 Next.js가 크기를
알 수 없으므로 이 값이 없으면 정확한 공간을 예약할 수 없다. 현재 `mdx-components.tsx`의
고정 `800×400`은 다양한 사진에 맞지 않으며 구현 PR에서 제거해야 한다.

- Next.js 공식 규칙: [remote image dimensions](https://nextjs.org/docs/app/api-reference/components/image#remote-images)

`mdxComponents.img`는 `img.wannysim.com`에 한해 이미 최적화된 CDN 이미지로 처리한다.
초기에는 전달받은 intrinsic ratio를 보존하는 native `<img>` 또는 `<picture>`를 쓰고,
Next Image optimizer를 다시 통과시키지 않는다. 웹 페이지에서는 같은 key의 WebP URL을
선택적으로 파생할 수 있고, `src`의 JPEG는 호환 fallback으로 남긴다.

본문 이미지는 lazy-load한다. 첫 화면 hero/LCP 이미지는 일반 본문 이미지와 다른 요구이므로,
실제 cover가 필요해질 때 optional frontmatter와 eager/priority 경로를 별도로 만든다. 업로드한
첫 이미지를 자동 OG 이미지로 간주하지 않는다. 현재 제목 기반 OG 생성은 그대로 유지한다.

### 7-2. RSS와 접근성

blog RSS는 React MDX component를 쓰지 않고 `marked`로 원문을 다시 HTML로 바꾼다. 따라서
`<Image>` 같은 앱 전용 JSX가 아니라 소문자 `<img>`를 authoring contract로 삼는다. 절대 공개
URL, `alt`, `width`, `height`가 RSS에도 그대로 남는다.

- 의미 있는 사진은 내용을 대체할 수 있는 `alt`를 반드시 쓴다.
- 순수 장식은 의도적으로 `alt=""`를 쓴다.
- private storage URL이나 `/_next/image` URL을 MDX에 저장하지 않는다.
- 구현 PR은 web render와 RSS output을 둘 다 테스트한다.

이 계약은 현재 공유 `mdxComponents`를 사용하는 blog, garden, now에 동일하게 적용된다.

### 7-3. 사용성 판정

Dufs는 imgproxy preset과 blog markup을 모르므로 “업로드 → 최종 URL 한 번에 복사”는 제공하지
않는다. 따라서 backend 없는 same-origin local publish helper는 선택 기능이 아니라 최소 발행
경계다. helper는 Dufs API의 `_incoming` 파일에 대해 MIME·크기·orientation 반영 dimensions와
SHA-256을 확인하고, 기존 destination이면 중단하며, no-overwrite 이동 뒤 URL과 HTML snippet을
복사한다. Dufs의 upload/storage를 다시 구현하는 custom admin은 만들지 않는다.

합격 기준은 URL encoding이나 hash 명령 지식 없이 **Dufs upload부터 snippet 복사까지 30초 안에**
완료되는 것이다. Dufs MOVE가 no-overwrite 조건을 보장하는지는 배포 버전에서 시험한다. 보장하지
않으면 helper가 작은 server-side publish guard를 호출하도록 바꾸며, 검증 없는 이동으로
우회하지 않는다.

## 8. photo 앱에서 쓰는 계약

photo 앱은 디렉터리를 런타임 catalog처럼 조회하지 않는다. 큐레이션 데이터는 추후 DB에 두고,
저장소에는 파일 bytes만 둔다.

최소 asset record:

```
id
key                 # photo/2026/08/summer-night-a1b2c3d4e5f6.jpg
width, height       # orientation 반영
alt, caption        # 필요하면 locale별
takenAt
sortOrder
publishedAt
```

- DB에는 완성된 imgproxy URL, Dufs path, `local://`, `s3://`를 저장하지 않는다.
- `key`와 variant를 받아 공개 URL을 만드는 helper는 photo 앱에 한 곳만 둔다.
- 같은 helper가 두 앱의 런타임 코드에서 실제로 필요해질 때만 `@mumak/shared`로 올린다.
- album/tag/order는 파일 key에 넣지 않는다.
- EXIF/GPS를 공개 rendition에서 읽지 않는다. 필요한 촬영 메타데이터는 변환 전에 추출하고
  공개 allowlist를 정한다.
- gallery는 source width 이하의 width variant만 골라 실제 출력 width로 `srcset` descriptor를
  만들고 `sizes`와 WebP fallback을 둔다.

photo admin을 만들 때 업로드와 DB record 생성의 원자성, orphan 정리, soft delete가 새 요구가
된다. 그 시점에 Dufs를 유지할지 앱 내 admin/S3 direct upload로 갈지 다시 결정한다.

## 9. 불변성·삭제·백업

### 9-1. 불변 key

- 발행된 key의 hash suffix와 실제 SHA-256이 일치해야 한다.
- 발행 destination이 이미 있으면 publish helper가 중단한다. 배포한 Dufs가 no-overwrite 이동을
  보장하지 못하면 작은 server-side publish guard가 필수다.
- 수정은 bytes에서 나온 새 hash/key를 올리고 blog 참조/photo record를 바꾼다.
- preset 설정이나 imgproxy/libvips upgrade가 출력 의미·encoder 결과를 바꿀 수 있으면 새
  variant 이름으로 발행한다. 기존 variant 아래에서 조용히 결과를 바꾸지 않는다.
- `_incoming`만 자유롭게 정리할 수 있다.

Dufs의 RW 권한만으로는 불변성이 기술적으로 보장되지 않는다. 따라서 collision/overwrite
거절을 acceptance test에서 확인하기 전에는 1년 edge cache를 활성화하지 않는다. 실수로
overwrite가 발생하면 이전 backup을 보존하고 해당 key의 모든 variant를 즉시 purge한다.

### 9-2. 공개 이미지 삭제

1. blog 참조 또는 photo published record를 먼저 제거한다.
2. source file을 삭제한다.
3. 허용된 모든 variant/format URL을 Cloudflare에서 purge한다.
4. 관리 밖 browser/RSS/download/archive 복사본은 회수할 수 없음을 수용한다.

즉 “source 삭제 = 즉시 인터넷에서 소멸”은 아니다.

### 9-3. 백업은 필수

JPEG가 원본에서 재생성 가능해도 정확한 공개 key, export 결과, 큐레이션 선택은 자동 복구되지
않는다. `/srv/mumak-images`와 Dufs/imgproxy/NPM 설정을 하루 1회 versioned backup하고,
독립 디스크 또는 암호화된 off-site target에 보관한다.

- 초기 RPO: 24시간 이하
- RTO: 첫 전체 restore 실측 후 확정
- 분기마다 빈 임시 디렉터리로 표본 restore 후 checksum과 공개 URL을 확인
- 삭제가 즉시 backup에도 전파되지 않도록 version/history window 유지
- photo DB가 생기면 asset record도 같은 RPO와 restore drill에 포함하고, file key와 DB record의
  참조 무결성을 함께 확인

R2를 쓰면 2026-08 기준 Standard storage는 10GB-month free 이후 $0.015/GB-month이고 egress는
무료다. 100GB 전체의 순수 storage 비용은 대략 월 $1.35에 operations가 더해진다. 비용은 배포
시점에 다시 확인한다.

- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

## 10. 운영과 관측

새 관측 스택은 만들지 않는다. 기존 Portainer/Cloudflare/호스트 지표에서 아래만 확인한다.

- Dufs/imgproxy health, restart count, OOM 여부
- imgproxy 2xx/4xx/429/5xx와 cold transform latency
- Cloudflare cache ratio, origin requests/bytes
- `/srv/mumak-images` 80GB/100GB 경고와 host free-space 20% 하한
- backup 마지막 성공 시각과 restore drill 결과

alert가 필요해질 때 기존 Grafana/로그 체계에 붙인다. imgproxy는 필요 시 별도 Prometheus bind를
공식 지원하지만, 이 설계만을 위해 수집기를 추가하지 않는다.

## 11. 구축 순서

1. `/srv/mumak-images/{_incoming,blog,photo}`와 별도 backup target 준비
2. host filesystem의 quota 지원을 확인하고 hard quota 또는 disk alert 계약을 고른다.
3. Dufs를 pinned version/digest로 배포: RW mount, hashed auth, hash 기능, TLS/VPN, LAN bind/firewall
4. same-origin local publish helper를 배포하고 hash/collision/no-overwrite와 30초 사용성을 시험
5. 최악 입력 upload와 재시작 후 persistence 확인
6. imgproxy를 pinned version/digest로 배포: RO mount, no host port, internal network,
   secret/preset/source/resource 제한
7. NPM에 anchored 공개 URL allowlist/rewrite, Bearer header 주입, raw/info/query/method default 404 적용
8. 최악 JPEG로 preset quality·peak RAM·queue를 실측하고 `content-v1` 값을 동결
9. Cloudflare DNS/cache rule과 origin lock 적용
10. 아래 acceptance test를 통과한 뒤 blog 구현 PR 진행
11. photo 앱 착수 시 metadata/variant/admin 결정을 별도 ADR로 작성

## 12. 완료 판정용 acceptance test

### 접근·보안

- [ ] Dufs는 LAN/WireGuard에서만 열리고 외부망에서는 접속할 수 없다.
- [ ] imgproxy raw `/unsafe`, `/info`, 임의 preset, HTTP source, query URL은 공개 host에서 거절된다.
- [ ] encoded slash/dot/double-encoding과 직접 imgproxy port/network 요청도 거절된다.
- [ ] 홈 IP + Host header 직접 요청은 Cloudflare origin lock에 의해 거절된다.
- [ ] imgproxy는 media mount를 수정할 수 없고 Dufs 외 컨테이너에는 RW mount가 없다.

### 업로드·변환

- [ ] 4096px/10MiB 경계 JPEG가 upload·이동되고 컨테이너 재시작 뒤에도 남는다.
- [ ] 초과 file size/resolution과 비이미지는 명확히 실패한다.
- [ ] hash와 다른 파일명, 기존 destination, 같은 key의 다른 bytes는 publish 단계에서 거절된다.
- [ ] Dufs upload부터 helper의 HTML snippet 복사까지 URL/hash 명령 지식 없이 30초 안에 끝난다.
- [ ] 선택한 hard quota 또는 disk/free-space alert를 경계값에서 시험한다.
- [ ] canonical URL은 예상 크기·비율·`Content-Type`으로 200을 반환한다.
- [ ] `content-v1`은 landscape/portrait 모두 1600×1600 안에 fit하고 작은 source를 확대하지 않는다.
- [ ] jpg/webp URL은 `Accept` 순서와 무관하게 각각 고정된 format을 반환한다.
- [ ] worst-case cold transform 동시 요청에서 한 worker/유한 queue/429가 동작하고 OOM이 없다.

### 캐시·장애·삭제

- [ ] 같은 URL 재요청은 `CF-Cache-Status: HIT`와 증가하는 `Age`를 보인다.
- [ ] origin/browser `Cache-Control`은 `max-age=86400`, Cloudflare edge TTL은 1년으로 분리된다.
- [ ] 404/429/5xx와 query 변형은 장기 cache entry를 만들지 않는다.
- [ ] warm cache는 origin 중단 중에도 응답하고, cold miss 실패는 알려진 한계로 기록된다.
- [ ] 새 revision 발행과 source 삭제 + 전체 variant purge 절차를 한 번 실행한다.

### blog

- [ ] 실제 landscape/portrait 이미지가 올바른 intrinsic ratio로 렌더되고 CLS가 발생하지 않는다.
- [ ] CDN 이미지는 `/_next/image`를 거치지 않고 fallback/alt/width/height를 유지한다.
- [ ] RSS `content:encoded`에 절대 공개 URL과 유효한 소문자 `<img>`가 남는다.
- [ ] 의미 있는 이미지의 alt 누락과 unsafe URL/key를 content validation이 잡는다.

### 복구

- [ ] 빈 임시 경로에 backup을 restore하고 표본 checksum이 일치한다.
- [ ] restore된 동일 key가 기존 canonical URL로 다시 제공된다.

이 테스트를 통과하기 전에는 “Cloudflare가 회선을 보호한다”, “업로드가 쉽다”, “blog/photo가
공용으로 쓸 수 있다”를 완료로 판정하지 않는다.
