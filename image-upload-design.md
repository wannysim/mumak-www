# 이미지 업로드 시스템 — 아키텍처 검토 반영안

> 2026-08-08 재검토, 2026-08-09 photo admin·가변 media policy 보강. 기존 MinIO 결정은
> 폐기한다. 현재 기본안은 **호스트 파일시스템 + Dufs + imgproxy**다. 이 문서는 구현 전 사용자
> 피드백을 받기 위한 기준 설계이며, `plan.md` Phase 4 요약도 이 결론에 맞춰 갱신한다.

## 1. 결론

이미지를 읽는 blog/photo 앱에는 S3가 필요하지 않다. 두 앱이 알아야 할 것은 저장소 API가
아니라 안정적인 공개 URL뿐이다. 운영자 1명, 단일 홈서버, 현재 약 100GB의 여유 공간이라는
조건에서는 일반 파일시스템이 가장 작은 저장 계층이다.

```
[업로드 — LAN/WireGuard 전용]
  브라우저 → Dufs(:9101) → blog/_incoming (read-write)
  local publish helper → server-side publish guard → blog/published (single writer)

[향후 photo admin]
  브라우저 → photo backend → photo/_incoming → photo/published + metadata DB

[변환 — 내부]
  imgproxy → blog/published + photo/published (read-only)

[서빙 — 유일한 공개 진입점]
  방문자 → Cloudflare → NPM의 엄격한 공개 경로 → imgproxy

[참조]
  blog MDX → 완성된 공개 URL
  photo DB → asset id + 논리 key + intrinsic metadata; 공개 URL은 helper로 생성
```

이 구조가 주는 실제 효과는 다음과 같다.

- 이미지 바이트가 blog Docker 이미지와 Git 저장소에서 빠진다.
- 업로드 UI와 이미지 변환기를 직접 만들지 않는다.
- blog, 향후 photo 앱, 로컬 개발, 프리뷰가 같은 공개 URL을 사용한다.
- 저장 계층을 나중에 S3로 바꿔도 공개 URL과 콘텐츠를 유지할 수 있다.
- 발행된 각 namespace에는 한 시점에 writer가 하나뿐이고 imgproxy는 읽기 전용으로 본다.
- 향후 photo backend가 같은 홈서버에서 `photo/` writer를 넘겨받아도 저장·서빙 계층은 바뀌지
  않는다.

단, **blog의 새 이미지 참조를 MDX에 추가하면 SSG 재빌드는 여전히 필요하다.** 없어지는 것은
이미지 바이트 때문에 발생하던 빌드 결합이다. photo 앱에서 업로드 즉시 노출하려면 추후
런타임 메타데이터 DB/API가 필요하다.

## 2. 요구사항과 비요구사항

### 2-1. 요구사항

| 항목       | 계약                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| 관리       | LAN admin에서 업로드, server guard가 검증·발행하고 blog helper가 snippet 생성         |
| admin 접근 | LAN/WireGuard에서만 접근. 인터넷·Cloudflare에는 미노출                                |
| 소스       | sRGB JPEG 중심. 6000px/20MiB는 초기 권장값, hard gate는 50MP/32MiB의 변경 가능한 정책 |
| 용량       | 현재 약 100GB 여유. 파일 크기·decode 안전 상한과 별도로 configurable free-space 감시  |
| 원본       | RAW와 원본 보관은 기존 체계를 유지                                                    |
| 공개 서빙  | `img.wannysim.com` 한 곳. 원본 저장소는 공개하지 않음                                 |
| 회선 보호  | Cloudflare 캐시 적중을 전제로 하되 캐시를 영구 저장소나 가용성 계층으로 간주하지 않음 |
| URL 안정성 | 발행된 key와 변환 버전은 불변. 변경은 새 URL 발행                                     |
| 앱 독립성  | blog/photo가 파일시스템·Dufs·S3·imgproxy 내부 URL을 저장하지 않음                     |
| 자원       | 홈서버 4GB RAM에서 동시 변환 수와 대기열을 명시적으로 제한                            |
| 복구       | 정확한 공개 key 트리와 설정을 별도 매체에 백업하고 복구를 실제 시험                   |

### 2-2. 지금 만들지 않는 것

- 범용 media API·스토리지 adapter·photo admin의 선행 구현
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
├── blog/                # blog guard가 하나의 RW mount로 보는 scope root
│   ├── _incoming/       # Dufs가 보는 staging
│   ├── _work/           # guard 전용 claim/temp
│   └── published/       # imgproxy에는 /images/blog:ro로 mount
│       └── YYYY/MM/
└── photo/
    ├── _incoming/       # 향후 photo backend의 staging
    ├── _work/           # 향후 photo backend 전용
    └── published/       # imgproxy에는 /images/photo:ro로 mount
        └── YYYY/MM/
```

- Docker named volume 대신 명시적인 host path를 사용해 백업·복구·용량 확인을 단순화한다.
- atomic claim/promote는 host filesystem만 같다고 보장되지 않는다. blog guard는 `blog/` scope
  root 전체를 **하나의 bind mount**로 RW mount한다. `_incoming`·`_work`·`published`를 각각
  별도 bind mount하면 container 안에서는 `rename`/hard link가 `EXDEV`로 실패할 수 있으므로 금지한다.
- Dufs는 `blog/_incoming`만 별도 RW mount하고 `published`와 `_work`는 보지 못한다.
- imgproxy는 `blog/published`와 `photo/published`만 각각 `/images/blog:ro`,
  `/images/photo:ro`로 본다. 이 물리 경로는 공개 논리 key `blog/...`, `photo/...`에서 숨긴다.
- 향후 photo backend도 `photo/` scope root 하나만 RW mount한다. backup target만 별도 매체다.
- `_incoming`에서 파일 형식·크기·이름을 확인한 뒤 같은 scope의 `published`로 발행한다.
- 폴더는 저장 제품의 bucket 대용이 아니라 **writer 소유권 경계**다. 현재 `blog/`는 publish
  guard가 쓰고, photo admin이 생기면 photo backend만 `photo/`를 쓴다.

`_incoming`은 격리된 staging일 뿐 Dufs가 이미지 validator가 되는 것은 아니다. Dufs는 큰 파일이나
비이미지도 받을 수 있다. publish guard는 먼저 staging file을 Dufs가 볼 수 없는 `_work`의
server-generated claim ID로 atomic no-replace 이동한다. 이후 guard-private temp copy를 닫은 뒤
그 고정된 bytes에서 MIME magic bytes·크기·해상도·SHA-256을 계산한다. slug/key 문법은 별도로
강제한다. 검증이나 transform이 실패하면 새 destination은 남기지 않고 claim을 staging으로
no-clobber 복구한다.
원래 staging 이름이 이미 생겼다면 두 파일 중 하나를 덮지 않고 claim을 보존하거나
`recovered-<claim-id>`처럼 별도 recovery 이름으로 노출한다. imgproxy의 아래 제한은 발행된
기존 source에 대한 2차 안전망이다. staging과 `_work`는 imgproxy와 공개 URL에서 접근할 수 없다.

### 3-3. 웹 업로더는 Dufs

Dufs는 한 컨테이너에서 drag-and-drop 파일/폴더 업로드, 이동·삭제·검색, 재개 업로드,
경로별 접근 제어, health endpoint를 제공한다. imgproxy가 파일시스템을 직접 읽으므로 Dufs는
public read path에 관여하지 않는다.

- 공식 기능/설정: [Dufs README](https://github.com/sigoden/dufs#readme)
- 보안 정책: [latest release만 지원](https://github.com/sigoden/dufs/security)
- 배포 시 검증된 버전과 image digest를 고정하고 수동으로 업데이트한다.
- 인증 hash와 TLS key 같은 machine-local secret은 저장소 밖에 둔다.

`admin`은 제품 관리 콘솔이 아니라 **staging 파일을 관리하는 내부 웹 UI**라는 뜻이다. photo
앱의 큐레이션 admin은 별도 요구이며 photo 앱 착수 시 결정한다.

Dufs의 `?hash` SHA-256은 운영 확인에는 쓸 수 있지만 발행 권한은 아니다. Dufs v0.46.0의 MOVE는
목적지 존재 여부를 확인하지 않고 `fs::rename`을 호출하므로 no-overwrite를 Dufs에 위임할 수 없다.
publish guard가 bytes를 직접 hash하고, 현재 media policy를 검증하며, 목적지가 없을 때만
no-clobber 방식으로 commit한다.

- 근거: [Dufs v0.46.0 MOVE 구현](https://github.com/sigoden/dufs/blob/v0.46.0/src/server.rs#L1182-L1200)

Dufs에는 media 제약이나 전체 quota가 없다. 전자는 publish guard가 강제한다. 용량은 dedicated
quota가 실제로 있으면 warning/critical 값을 여유 있게 두고, shared filesystem이면 가짜 100GB
hard limit 대신 host free-space를 감시하며 critical 아래에서는 새 publish를 거절한다. Dufs staging
upload 자체는 이 gate를 지나기 전에도 disk를 쓰므로 trusted operator와 age cleanup에 의존한다.
staging까지 hard-isolate해야 할 실제 문제가 생기면 filesystem quota/별도 volume을 쓴다. quota
때문에 별도 storage API를 만들지는 않는다.

### 3-4. S3로 옮기는 명시적 조건

아래 중 하나가 실제로 필요해질 때만 S3 호환 저장소를 다시 고른다.

- 다른 호스트의 서비스나 여러 독립 writer가 같은 namespace에 파일을 쓴다.
- 외부 브라우저에서 presigned direct upload가 필요하다.
- 앱별 write credential/IAM 격리가 필요하다.
- object versioning, lifecycle, event notification이 필요하다.
- 다른 호스트로 복제하거나 다중 노드로 운영한다.

photo 앱이 이미지를 **읽는 것만으로는** 전환 조건이 아니다. 같은 홈서버의 photo backend가
`photo/`의 유일한 writer가 되는 것도 전환 조건이 아니다. Dufs에는 처음부터 `photo/` RW를 주지
않고 기존 bind directory를 그대로 사용한다. 반대로 photo admin을 Vercel/serverless 또는 다른
호스트에서 실행해 local mount를 쓸 수 없게 되면, 홈서버 upload API나 S3를 그때 비교한다.

### 3-5. 제약값은 URL 계약이 아니라 변경 가능한 media policy

100GB 여유 공간은 더 큰 파일을 보관할 수 있다는 뜻이지, 4GB RAM에서 더 큰 JPEG를 안전하게
decode할 수 있다는 뜻은 아니다. 용량·입력·변환·전달을 한 숫자로 묶지 않는다.

| 계층                | 초기 후보                            | 의미                                                       |
| ------------------- | ------------------------------------ | ---------------------------------------------------------- |
| authoring 권장      | 긴 변 6000px, 20MiB 이하             | 일반 blog/photo export 기본값. 초과해도 즉시 거절하지 않음 |
| ingest hard ceiling | 50MP, 32MiB 이하                     | 새 발행을 거절하는 안전 경계. 실제 최악 입력 실측 후 확정  |
| delivery            | `content-v1` 긴 변 1600px, 확대 금지 | 공개 rendition 계약. source 상한과 독립                    |
| storage capacity    | 배포별 warning/critical free bytes   | 초기 critical 20GiB 후보. publish stop, decode와 별개      |

6000px/20MiB와 50MP/32MiB는 imgproxy의 공식 권장값이 아니라 **초기 검증 후보**다. 긴 변은
사용성 안내이고 hard cap으로 두지 않는다. decode 자원은 긴 변 하나보다 총 pixel 수와 bytes로
제한하며, 실제 landscape/portrait/panorama JPEG로 cold transform peak RAM, latency, OOM을
확인해 낮추거나 높인다. 현재 free space가 약 100GB라면 초기 critical 20GiB 후보를 뺀 범위
안에서만 이미지 예산을 잡는다. 이 값도 volume 크기·다른 container 사용량을 확인한 뒤 확정하고,
shared filesystem의 다른 사용량이 바뀔 때 다시 계산한다.

구현할 때 위 값은 한 server-side media policy config를 원천으로 둔다. UI는 그 값을 받아 권장값과
현재 허용 상한을 표시하되 client 검사는 사용성 보조일 뿐이고, publish guard/photo backend가
MIME magic bytes·decode 결과·bytes를 다시 검증한다. imgproxy env는 같은 배포 설정에서 만들거나
acceptance test로 다음 관계를 강제한다.

```text
processor source ceiling >= 이미 발행된 source의 실제 최대값
processor source ceiling >= 현재 ingest hard ceiling
delivery output ceiling   >= 공개 variant의 최대 출력값
free space after commit    >= configured critical threshold
```

정책 변경 규칙:

- 권장값만 바꾸면 새 UI 문구와 export 안내만 바뀐다.
- ingest 상한을 높이면 새 경계 표본 부하 시험 뒤 imgproxy source ceiling·container memory·실제
  ingress body limit을 먼저 올리고, 마지막에 publish policy와 UI를 올린다.
- ingest 상한을 낮춰도 기존 key와 URL은 유지한다. 기존 큰 source를 계속 읽을 수 있도록
  발행 scope inventory를 먼저 만들고 processor 상한은 실제 최대값 아래로 내리지 않는다.
- `content-v1`의 출력 크기·crop·quality를 바꾸려면 policy 수정이 아니라 `content-v2`를 추가한다.
- `IMGPROXY_MAX_RESULT_DIMENSION`은 초과 output을 실패시키지 않고 축소한다. 기존 공개 URL을
  유지하는 동안 모든 live variant의 최대 출력 아래로 절대 낮추지 않는다. 꼭 낮춰야 한다면
  기존 URL은 이전 ceiling의 processor로 별도 route하고 새 variant만 새 processor로 보낸다.
- JPEG 외 형식을 추가할 때는 값만 바꾸지 않고 decoder 지원·metadata·보안 시험을 다시 한다.

이 경계를 위한 범용 config service나 storage interface는 지금 만들지 않는다. 첫 publish guard
구현 시 작은 version-controlled config 하나로 시작하고, 두 런타임에서 실제 공유가 필요해질
때만 공용 package로 올린다.

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
- `safe-name`: `<slug>-<SHA-256 앞 12자리>.jpg`. slug는 소문자 ASCII kebab-case다. 업로드
  filename extension은 identity로 쓰지 않고 JPEG magic bytes·decode 성공 뒤 key를 `.jpg`로 정규화
- 공백, Unicode, `%`, `?`, `#`, `@`, dot segment는 key에서 금지
- 같은 bytes는 같은 hash suffix를 사용하고, bytes가 바뀐 수정본은 새 hash/key를 사용
- `yyyy/mm`는 수정 가능한 `takenAt`이 아니라 최초 발행 시 정한 placement date이며 key와 함께 불변

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
URL과 MDX/photo record는 유지할 수 있다. 예를 들어 물리 파일
`blog/published/2026/08/a.jpg`는 S3 object key `blog/2026/08/a.jpg`로 복사한다. 이전 작업은
replacement만 바꾸는 것이 아니다. 모든 logical key를 복사한 뒤 imgproxy의 S3 enable,
endpoint/credential, bucket mapping, `IMGPROXY_ALLOWED_SOURCES`, replacement를 함께 바꾸고
acceptance test를 다시 통과해야 한다.

로컬 저장소를 쓰는 동안에는 `IMGPROXY_LOCAL_FILESYSTEM_ROOT=/images`와
`IMGPROXY_ALLOWED_SOURCES=local://`를 함께 설정한다. 다만 공식 문서는 prefix replacement와
source allowlist의 적용 순서를 계약하지 않는다. pinned image에서 `mumak://` alias는 성공하고
HTTP/private/loopback source는 실패하는지 acceptance test로 고정한다.

- 공식 URL 문법: [imgproxy processing URL](https://docs.imgproxy.net/usage/processing)
- alias 기능: [IMGPROXY_URL_REPLACEMENTS](https://docs.imgproxy.net/configuration/options)
- 로컬 소스: [Serving local files](https://docs.imgproxy.net/image_sources/local_files)

NPM은 raw `/unsafe`, `/info`, 임의 preset/source를 전달하지 않는다. `GET`/`HEAD`와 위 문법만
허용하는 anchored route 하나만 두고 query string과 나머지 경로는 default 404로 거절한다.
encoded slash, dot segment, 이중 encoding도 허용 route와 source key를 빠져나가지 못해야 한다.

imgproxy는 host port를 publish하지 않고 NPM과 같은 internal Docker network에만 연결한다.
`IMGPROXY_SECRET`을 설정하고 NPM이 고정 Bearer header를 주입해 NPM을 우회한 LAN/container
요청도 거절한다. secret은 저장소 밖에 둔다. 이 경로 제한, source allowlist, presets-only가
사람이 붙여넣을 수 있는 unsigned URL의 보안 경계다. 자유로운 크기 변환이 필요해지면 그때
URL signer를 추가한다.

publish guard와 향후 photo backend는 canonical preflight 때만 같은 internal network에서 Bearer
secret으로 imgproxy를 직접 호출할 수 있다. 이 secret과 raw internal URL은 browser에 반환하지 않는다.

## 5. imgproxy 안전·자원 계약

초기값은 다음과 같이 제한한다. 숫자는 추측이 아니라 실제 허용 최대 JPEG로 부하 시험한 뒤
확정한다.

| 항목                                         | 시작값            | 목적                                  |
| -------------------------------------------- | ----------------- | ------------------------------------- |
| `IMGPROXY_ONLY_PRESETS`                      | `true`            | 임의 resize 차단                      |
| `IMGPROXY_PRESETS`                           | 아래 `content-v1` | 공개 variant의 변환 의미 고정         |
| `IMGPROXY_LOCAL_FILESYSTEM_ROOT`             | `/images`         | mount 밖 로컬 파일 접근 차단          |
| `IMGPROXY_ALLOWED_SOURCES`                   | `local://`        | HTTP source와 SSRF 차단               |
| `IMGPROXY_ALLOW_PRIVATE_SOURCE_ADDRESSES`    | `false`           | 내부망 fetch 방어                     |
| `IMGPROXY_ALLOW_LOOPBACK_SOURCE_ADDRESSES`   | `false`           | loopback fetch 방어                   |
| `IMGPROXY_ALLOW_LINK_LOCAL_SOURCE_ADDRESSES` | `false`           | link-local fetch 방어                 |
| `IMGPROXY_MAX_REDIRECTS`                     | `0`               | 네트워크 source redirect 차단         |
| `IMGPROXY_SECRET`                            | machine-local 값  | NPM 우회 요청 차단                    |
| `IMGPROXY_MAX_SRC_FILE_SIZE`                 | `33554432`        | 32MiB 초과 source decode 거절         |
| `IMGPROXY_MAX_SRC_RESOLUTION`                | `50` MP           | 압축률과 무관한 image bomb 제한       |
| `IMGPROXY_MAX_RESULT_DIMENSION`              | `4096`            | 입력 크기와 독립된 출력 상한          |
| `IMGPROXY_MAX_ANIMATION_FRAMES`              | `1`               | animated 입력의 메모리 폭주 방지      |
| `IMGPROXY_WORKERS`                           | `1`               | 동시에 한 장만 변환                   |
| `IMGPROXY_REQUESTS_QUEUE_SIZE`               | `8`               | 무한 대기열 대신 초과 요청 429        |
| `IMGPROXY_TTL`                               | `86400`           | origin/browser max-age를 1일로 제한   |
| `IMGPROXY_STRIP_METADATA`                    | `true`            | GPS 등 공개 EXIF 제거                 |
| `IMGPROXY_STRIP_COLOR_PROFILE`               | `true`            | embedded ICC를 sRGB 변환 후 제거      |
| `IMGPROXY_AUTO_ROTATE`                       | `true`            | EXIF orientation 반영                 |
| imgproxy memory limit                        | `768m`에서 실측   | 50MP 최악 입력으로 OOM 여부 확인      |
| Dufs memory limit                            | `128m`에서 실측   | 32MiB 파일·폴더 업로드 중 사용량 확인 |

초기 변환 계약 후보는 다음이다.

```text
IMGPROXY_PRESETS=content-v1=resize:fit:1600:1600:false/format_quality:jpeg:82:webp:79/auto_rotate:true/strip_metadata:true/strip_color_profile:true
```

50MP·32MiB 각각의 경계에 가까운 landscape/portrait/panorama 표본으로 파일 크기·시각 품질·peak
RAM을 확인한 뒤 **Cloudflare cache를 열기 전에** 이 값을 확정한다. 두 조건은 서로 대체하지
않으므로 각각과 조합 경계를 시험한다. 768MiB는 보장값이 아니라 최초 cgroup limit 후보다.
OOM이면 host RAM을 낙관해 올리기 전에 ingest 상한이나 worker를 낮춘다.

quality·auto-rotate·metadata·color-profile 의미도 global default가 아니라 versioned preset 안에
고정한다. resize/crop/quality/orientation/metadata/colorspace 의미가 달라지면 `content-v1`을
수정하지 않고 `content-v2`를 추가한다. imgproxy/libvips 보안 업데이트 후 dimension·시각 품질·
metadata 의미가 같고 encoded bytes만 달라지는 경우는 기존 semantic URL을 유지할 수 있다.
정확한 encoder bytes까지 영구 계약으로 삼지는 않는다.

`IMGPROXY_MAX_RESULT_DIMENSION=4096`은 source 긴 변 제한이 아니라 output clamp다. 현재
`content-v1=1600`과 향후 `w2560-v1`에는 영향을 주지 않는다. ceiling은 모든 live variant의 최대
출력 이상에서만 바꿀 수 있고, 4096보다 큰 variant는 ceiling을 먼저 올린 뒤 노출한다. 공식 옵션 의미는
[imgproxy 4.0.x configuration](https://docs.imgproxy.net/configuration/options)에 따른다.

`IMGPROXY_AUTO_WEBP/AVIF`는 사용하지 않는다. 같은 URL이 `Accept`에 따라 다른 bytes를
반환하면 Cloudflare cache key가 format을 올바르게 구분해야 한다. Cloudflare의 image vary는
Free plan에서 제공되지 않으므로 출력 format을 URL에 명시하는 쪽이 작고 안전하다.

- imgproxy도 CDN 사용 시 `Accept`를 cache key에 반영하라고 경고한다:
  [configuration options](https://docs.imgproxy.net/configuration/options)
- Cloudflare image vary 가용성:
  [Vary for Images](https://developers.cloudflare.com/cache/advanced-configuration/vary-for-images/)

AVIF는 photo 앱에서 실제 JPEG의 변환 시간·peak RAM·시각 품질을 측정해 WebP보다 가치가
있을 때만 추가한다. 허용할 때는 AVIF quality도 preset에 명시해 기존 jpg/webp를 건드리지 않는
add-only 변경으로 배포한다.

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

- [imgproxy TTL](https://docs.imgproxy.net/configuration/options)
- [Cloudflare Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/)

Cloudflare를 우회해 홈 IP로 직접 요청하면 회선·CPU 보호가 무효가 된다. 공개 origin은
Cloudflare IP만 firewall에서 허용하거나 Authenticated Origin Pull을 적용한다. imgproxy와
Dufs host port는 WAN에 열지 않는다.

- [Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
- [Cloudflare IP allowlist](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/)

## 7. blog에서 쓰는 계약

### 7-1. 실제 발행 흐름

1. 보통은 JPEG를 sRGB, 긴 변 6000px 이하, 20MiB 이하로 export한다. 더 큰 source가 필요하면
   현재 media policy의 hard ceiling 안에서 그대로 올릴 수 있다.
2. Dufs의 `blog/_incoming`에 업로드한다.
3. same-origin local publish helper에서 slug를 입력한다.
4. server-side publish guard가 staging file을 `blog/_work/<server-generated-claim-id>`로 atomic
   no-replace claim한다.
5. guard가 claim을 같은 scope의 private temp로 복사하면서 byte/free-space 경계를 적용하고 닫는다.
   **고정된 temp bytes**에서 MIME magic bytes·파일 크기·방향 반영 해상도·SHA-256을 계산해 policy와
   key의 authoritative 값으로 쓴다. destination이 있으면 같은 full hash의 idempotent retry만
   재사용한다. destination이 없으면 temp를 `blog/published/YYYY/MM/<slug>-<hash12>.jpg`로
   same-mount hard link 같은 atomic no-clobber 방식으로 promote한다. Dufs가 open file handle을
   가질 수 있는 claimed inode 자체를 검증 근거나 final scope로 쓰지 않는다. 다른 bytes면 거절한다.
6. guard가 Cloudflare를 거치지 않는 internal imgproxy에 같은 preset/source를 요청해
   200·format·실제 output dimensions를 검증한다.
7. 성공하면 private temp와 claim을 지우고 descriptor를 반환한다. 실패하면 이 시도가 만든
   destination/temp만 지운다. claim은 staging으로 no-clobber 복구하고, 이름이 충돌하면 두 파일을
   모두 보존한 채 별도 recovery 이름이나 helper의 복구 목록으로 노출한다.
8. helper가 만든 공개 URL과 소문자 HTML snippet을 열어 확인한다.
9. 새 참조를 포함한 MDX 변경은 기존처럼 commit/deploy한다.

```html
<img
  src="https://img.wannysim.com/content-v1/blog/2026/08/summer-night-a1b2c3d4e5f6.jpg@jpg"
  alt="해 질 무렵 한강 위로 번지는 주황빛"
  width="1600"
  height="1067"
/>
```

`width`/`height`는 source metadata가 아니라 canonical `content-v1` 응답의 실제 dimensions다.
EXIF orientation을 반영한 source 비율은 유지한다. 원격 이미지는 Next.js가 크기를 알 수 없으므로
이 값이 없으면 정확한 공간을 예약할 수 없다. 현재 `mdx-components.tsx`의 고정 `800×400`은
다양한 사진에 맞지 않으며 구현 PR에서 제거해야 한다.

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
않는다. same-origin local publish helper UI와 작은 server-side publish guard가 최소 발행 경계다.
guard는 `blog/_incoming` 파일을 Dufs가 볼 수 없는 `blog/_work/<server-generated-claim-id>`로
atomic no-replace claim한다. 닫힌 private temp copy의 bytes를 policy·metadata·SHA-256의 유일한
근거로 삼는다. 기존 destination이면 full hash가 같은 경우에만 재사용하며, 아니면 중단한다.
atomic no-clobber promote·internal no-cache transform 뒤 아래 asset descriptor를 반환하고, blog
helper는 그 결과에 HTML snippet 생성만 덧붙인다.

```text
publish(stagedFile, scope, slug)
→ key, sha256, byteSize, mimeType, sourceWidth, sourceHeight,
  delivery { url, width, height }
```

Dufs MOVE는 no-overwrite를 보장하지 않으므로 발행에 사용하지 않는다. Dufs의 upload/storage를
다시 구현하는 범용 admin이나 media service는 만들지 않는다. guard는 allowlist된 scope와
staging-relative 식별자만 받고, canonical path가 `blog/_incoming` 아래인지 확인하며 symlink·absolute
path·`..`를 거절한다. 현재 scope allowlist는 `blog` 하나이며, original filename은 destination
key에 직접 사용하지 않는다. process crash 뒤 남은 stale claim은 helper에 복구 대상으로 표시하고
staging으로 no-clobber 되돌릴 수 있게 하며 조용히 삭제하지 않는다. 원래 이름이 점유됐으면
claim과 새 staging 파일을 모두 보존한다.

합격 기준은 URL encoding이나 hash 명령 지식 없이 **Dufs upload부터 snippet 복사까지 30초 안에**
완료되는 것이다. 권장값을 넘지만 hard ceiling 안인 파일에는 경고만 표시하고, hard ceiling을
넘으면 어느 조건이 실패했는지 알려준다.

## 8. photo 앱에서 쓰는 계약

photo 앱은 디렉터리를 런타임 catalog처럼 조회하지 않는다. 큐레이션 데이터는 추후 DB에 두고,
저장소에는 파일 bytes만 둔다.

최소 asset record:

```
id
key                 # photo/2026/08/summer-night-a1b2c3d4e5f6.jpg
sha256, mimeType, byteSize
width, height       # orientation 반영
alt, caption        # 필요하면 locale별
takenAt
sortOrder
publishedAt
deletedAt           # soft delete가 필요해질 때
```

- DB에는 완성된 imgproxy URL, Dufs path, `local://`, `s3://`를 저장하지 않는다.
- `key`는 UNIQUE로 두고 `id`는 사진 identity, `key`는 immutable byte revision으로 구분한다.
- file commit 뒤 만든 record는 `publishedAt = null`인 draft이며 alt/caption 검토 후 마지막에 공개한다.
- `key`와 variant를 받아 공개 URL을 만드는 helper는 photo 앱에 한 곳만 둔다.
- 같은 helper가 두 앱의 런타임 코드에서 실제로 필요해질 때만 `@mumak/shared`로 올린다.
- album/tag/order는 파일 key에 넣지 않는다.
- EXIF/GPS를 공개 rendition에서 읽지 않는다. 필요한 촬영 메타데이터는 변환 전에 추출하고
  공개 allowlist를 정한다.
- gallery는 source width 이하의 width variant만 골라 실제 출력 width로 `srcset` descriptor를
  만들고 `sizes`와 WebP fallback을 둔다.

### 8-1. photo 전용 admin으로 진화하는 최소 경로

photo admin이 같은 홈서버에서 실행된다면 현재 구조로 충분하다. Dufs를 photo 업로드 경로로
억지로 재사용하거나 S3로 먼저 옮기지 않고, photo backend가 `photo/`의 유일한 writer가 된다.
§7의 publish transaction 계약(policy·critical free-space·key·no-clobber·canonical rollback)은
같은 process에서 구현하거나 그때 실제 공용 코드를 재사용하면 되고, 별도 network media service
호출을 전제하지 않는다.

```text
authenticated browser
  → photo backend가 multipart를 photo/_incoming/<upload-id>.part로 stream
  → 현재 media policy로 magic bytes·bytes·decode dimensions 검증
  → SHA-256과 immutable key 계산
  → critical free-space 위에서 기존 key를 덮어쓰지 않고 photo/published에 commit
  → internal imgproxy로 canonical variant 검증; 실패 시 새 destination rollback
  → DB transaction으로 draft asset record 생성
  → key + metadata + 공개 URL을 admin UI에 반환; public 확인 뒤 publishedAt 설정
```

- upload ID는 server가 무작위로 만들고 브라우저에는 filesystem path나 Dufs credential을 주지 않는다.
- 파일 전체를 RAM에 올리지 않고 staging file로 stream한다.
- stream 중 실제 bytes와 free-space를 세어 hard byte/critical threshold를 넘으면 즉시 중단하고
  partial file을 지운다. client의 `Content-Length`만 신뢰하지 않는다.
- 같은 hash와 intended key가 이미 있으면 기존 asset을 idempotent하게 반환한다. 다른 slug까지
  전역 deduplicate하거나 reference count를 두지는 않는다.
- file commit 뒤 DB insert가 실패하면 새 file을 즉시 지운다. process crash로 남은 드문 orphan은
  `photo/_incoming` age cleanup과 `photo/published`-DB 대조 작업 하나로 정리한다. 단일 사용자·단일
  host에서 distributed transaction, outbox, queue는 만들지 않는다.
- pre-DB transform은 Cloudflare/NPM cache를 거치지 않는다. DB draft 뒤 public URL 확인이 실패하면
  source와 draft를 보존해 재시도하고 `publishedAt`은 설정하지 않는다.
- admin UI는 drag-and-drop 또는 `<input type="file" multiple>`과 upload progress, 파일별 검증
  오류를 제공한다. 현재 후보 상한에서는 일반 streamed multipart로 시작하고, 측정된 대용량·불안정
  회선 문제가 생길 때만 resumable/presigned upload를 추가한다.
- Dufs에는 `photo/` scope를 mount하지 않는다. 별도 RO 긴급 브라우징이 나중에 필요해도
  `photo/published`의 발행 writer가 될 수는 없다.

이 흐름에서 저장소 제품, 공개 URL, imgproxy, blog 경로는 바뀌지 않는다. photo backend가
off-host/serverless여서 bind mount를 쓸 수 없거나 여러 writer가 필요해지는 순간에만 upload
service/S3 ADR을 연다. 지금 storage interface나 photo app scaffold를 미리 만들 필요는 없다.

### 8-2. 배포·preview 경계

public photo app과 PR preview는 기존 `img.wannysim.com` URL을 그대로 읽을 수 있다. upload와 DB
mutation은 기본적으로 홈서버의 LAN/WireGuard admin backend에서만 허용하고, Vercel/PR preview에
production publisher credential·RW mount·production DB access를 주지 않는다. preview admin은
read-only 또는 fixture key로 둔다. public app과 admin을 반드시 같은 runtime에 배포해야 한다는
요구가 생기면 그때 인증된 home upload API와 S3 중 작은 쪽을 고른다.

## 9. 불변성·삭제·백업

### 9-1. 불변 key

- 발행된 key의 hash suffix와 실제 SHA-256이 일치해야 한다.
- 발행 destination이 이미 있으면 같은 full hash의 idempotent retry만 허용하고 다른 bytes는
  server-side publish guard가 거절한다. Dufs MOVE는 발행에 사용하지 않는다.
- 수정은 bytes에서 나온 새 hash/key를 올리고 blog 참조/photo record를 바꾼다.
- preset의 크기·crop·quality·orientation·metadata·color 의미가 바뀌면 새 variant로 발행한다.
  processor source/output ceiling은 versioning 수단이 아니며 모든 기존 source와 live variant를
  계속 수용해야 한다.
- `_incoming`만 자유롭게 정리할 수 있다.

Dufs에는 발행 scope RW 권한을 주지 않는다. publish guard의 collision/overwrite 거절을
acceptance test에서 확인하기 전에는 1년 edge cache를 활성화하지 않는다. 실수로 overwrite가
발생하면 이전 backup을 보존하고 해당 key의 모든 variant를 즉시 purge한다.

### 9-2. 공개 이미지 삭제

발행 scope 삭제도 해당 namespace writer만 수행한다. `blog/`는 authenticated publish guard,
`photo/`는 photo backend가 담당하며 Dufs에는 이 권한을 주지 않는다.

1. blog 참조 또는 photo published record를 먼저 제거한다.
2. source file을 삭제한다.
3. 허용된 모든 variant/format URL을 Cloudflare에서 purge한다.
4. 관리 밖 browser/RSS/download/archive 복사본은 회수할 수 없음을 수용한다.

즉 “source 삭제 = 즉시 인터넷에서 소멸”은 아니다.

### 9-3. 백업은 필수

JPEG가 원본에서 재생성 가능해도 정확한 공개 key, export 결과, 큐레이션 선택은 자동 복구되지
않는다. `/srv/mumak-images`와 Dufs/publish guard/media policy/imgproxy/NPM 설정을 하루 1회
versioned backup하고, 독립 디스크 또는 암호화된 off-site target에 보관한다.

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
- `/srv/mumak-images` 사용량과 configured free-space warning/critical
- backup 마지막 성공 시각과 restore drill 결과

alert가 필요해질 때 기존 Grafana/로그 체계에 붙인다. imgproxy는 필요 시 별도 Prometheus bind를
공식 지원하지만, 이 설계만을 위해 수집기를 추가하지 않는다.

## 11. 구축 순서

1. `/srv/mumak-images/{blog,photo}/{_incoming,_work,published}`와 별도 backup target 준비
2. media policy 초기 후보와 free-space warning/critical을 설정하고 host quota/alert 방식을 고른다.
3. Dufs를 pinned version/digest로 배포: staging만 RW, 발행 scope RO/미mount, hashed auth,
   TLS/VPN, LAN bind/firewall
4. imgproxy를 pinned version/digest로 배포: 발행 scope만 RO mount, no host port, internal network,
   secret/preset/source/resource 제한
5. same-origin local publish helper와 server-side guard를 배포: `blog/` scope root 하나만 RW mount,
   policy/free-space/claim/temp 검증/no-clobber/internal transform을 시험
6. guard로 50MP/32MiB 최악 fixture를 발행해 preset quality·peak RAM·queue를 실측하고
   `content-v1` 값을 동결
7. NPM에 anchored 공개 URL allowlist/rewrite, Bearer header 주입, raw/info/query/method default 404 적용
8. soft guide 초과·hard ceiling 경계·rollback·재시작 persistence와 30초 전체 사용성을 시험
9. Cloudflare DNS/cache rule과 origin lock 적용
10. 아래 acceptance test를 통과한 뒤 blog 구현 PR 진행
11. photo 앱 착수 시 metadata/variant/admin ADR을 쓰고 photo backend에 `photo/` writer 소유권을 이전

## 12. 완료 판정용 acceptance test

### 접근·보안

- [ ] Dufs는 LAN/WireGuard에서만 열리고 외부망에서는 접속할 수 없다.
- [ ] imgproxy raw `/unsafe`, `/info`, 임의 preset, HTTP source, query URL은 공개 host에서 거절된다.
- [ ] encoded slash/dot/double-encoding과 직접 imgproxy port/network 요청도 거절된다.
- [ ] 홈 IP + Host header 직접 요청은 Cloudflare origin lock에 의해 거절된다.
- [ ] Dufs는 `blog/_incoming`만 쓸 수 있고 publish guard는 `blog/` scope root 하나만 RW로 보며
      imgproxy는 `*/published`만 RO로 본다. Dufs/imgproxy 모두 `_work`를 볼 수 없고 imgproxy는
      `_incoming`도 볼 수 없다.

### 업로드·변환

- [ ] 6000px/20MiB 권장값을 넘지만 50MP/32MiB hard ceiling 안인 JPEG는 경고 후 발행된다.
- [ ] 50MP/32MiB 각각의 경계 표본은 성공하고 경계를 넘는 file size/resolution과 비이미지는
      어느 정책을 위반했는지와 함께 실패한다.
- [ ] 같은 full hash/key 재시도는 기존 asset을 반환하고, hash와 다른 파일명·같은 key의 다른
      bytes·충돌 destination은 publish 단계에서 거절된다.
- [ ] publish guard는 absolute/`..`/symlink staging path와 허용되지 않은 scope를 거절한다.
- [ ] 실제 container mount에서 `_incoming → _work → published` rename/hard link가 `EXDEV` 없이
      동작하고 existing target을 덮어쓰지 않는다.
- [ ] atomic claim 뒤 staging path를 교체·수정해도 temp에서 계산한 hash·metadata·key와 committed
      destination이 일치한다.
- [ ] 실패 복구 전에 같은 staging 이름을 다시 올려도 새 파일과 claim 중 어느 쪽도 덮어쓰지 않고
      둘 다 복구 UI에서 확인할 수 있다.
- [ ] Dufs upload부터 helper의 HTML snippet 복사까지 URL/hash 명령 지식 없이 30초 안에 끝난다.
- [ ] configured free-space warning/critical alert를 경계값에서 시험한다.
- [ ] critical free-space 아래에서는 새 publish가 거절되고 staging과 기존 발행 파일은 유지된다.
- [ ] canonical URL은 예상 크기·비율·`Content-Type`으로 200을 반환한다.
- [ ] internal canonical transform 실패는 새 destination만 rollback하고 claim을 staging으로 복구한다.
- [ ] publish 중 process crash 뒤 partial destination은 없고 stale claim은 staging으로 복구할 수 있다.
- [ ] `content-v1`은 landscape/portrait 모두 1600×1600 안에 fit하고 작은 source를 확대하지 않는다.
- [ ] EXIF orientation 표본은 올바르게 회전되고 공개 jpg/webp에서 GPS·EXIF·ICC metadata가 제거된다.
- [ ] jpg/webp URL은 `Accept` 순서와 무관하게 각각 고정된 format을 반환한다.
- [ ] worst-case cold transform 동시 요청에서 한 worker/유한 queue/429가 동작하고 OOM이 없다.
- [ ] ingest 상한을 낮춰도 기존 경계 source의 canonical URL은 계속 응답하고, 새 upload만 거절된다.

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
