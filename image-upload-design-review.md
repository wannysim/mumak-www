# 이미지 업로드 설계 리뷰 — 장단점 정리

> 2026-08-09. 대상: [image-upload-design.md](image-upload-design.md)(2026-08-09판)와 [plan.md](plan.md) Phase 4.
>
> **이 설계로 진행하기로 이미 결정된 상태에서 쓴 문서다.** 결정을 뒤집자는 글이 아니라, 무엇을
> 알고 시작하는지를 남기는 기록이다. 아래 약점 항목의 조치는 대부분 설정 한 줄, 문장 한 줄,
> 조건 분기 하나로 끝나는 것만 골랐다. 설계의 골격(호스트 디렉터리 + imgproxy + 불변 key +
> 공개 URL 계약)을 바꾸자는 제안은 리뷰 §4-1과 리뷰 §4-2 두 건뿐이고, 그 둘도 "언제 다시 볼지"를
> 적어두는 쪽으로 정리했다.
>
> **절 번호 표기**: `§N`은 설계문서(image-upload-design.md)의 절, `리뷰 §N`은 이 문서의 절이다.

## 0. 검증 방법과 요약

5개 렌즈(보안, 운영/장애, 복잡도, 외부 사실, 사용성/제품)로 독립 감사한 뒤, 각 지적을 다른
검증자가 **반박을 시도**하는 방식으로 걸렀다. 반박 기준은 (a) 문서가 이미 명시적으로 다룸,
(b) 사실관계 오류, (c) 1인 운영·개인 블로그·홈서버라는 실제 조건에서 발생하지 않음.

| 구분                    | 건수 | 비고                                                                     |
| ----------------------- | ---- | ------------------------------------------------------------------------ |
| 제기된 우려             | 42   |                                                                          |
| 반박되어 기각           | 19   | 대부분 "문서가 이미 §N에서 다룸"                                         |
| 살아남은 지적           | 23   | 중복을 합쳐 이 문서에는 **22건** 수록 (높음 2 / 중간 8 / 낮음 12)        |
| 외부 사실 주장 검증     | 11   | **11건 전부 확인됨. 부정확한 주장 0건**                                  |
| 저장소 사실 직접 재확인 | 5    | 리뷰 §4-1, 리뷰 §5-1에서 인용. 포트·라벨 등은 커밋 전 별도 대조에서 확인 |

한 줄 요약: **기술적으로는 매우 견고하고 외부 근거도 전부 정확하다. 남는 문제는 설계의 옳고
그름이 아니라 규모의 문제 — 지금 이 저장소에 이미지가 0장이라는 사실과, 그 0장을 위해 만드는
구성요소의 수가 맞지 않는다.**

## 1. 강점

### 1-1. 뺄셈으로 문제 클래스를 통째로 삭제한 것

이 설계에서 가장 잘한 것은 무엇을 추가했는지가 아니라 무엇을 없앴는지다.

- **MinIO 제외** — stateful 서비스 1개, Console, credential 관리, 업데이트 트레드밀이 통째로
  사라졌다. 대체물이 "평범한 디렉터리"라서 백업이 `tar`, 용량 확인이 `df`, 복구가 `cp`가 된다.
  1인 운영에서 가장 비싼 자원은 디스크가 아니라 "6개월 뒤에도 기억하는가"인데, 디렉터리는
  기억할 게 없다.
- **네트워크 source 클래스 제거** — `ALLOWED_SOURCES=local://` + `LOCAL_FILESYSTEM_ROOT` +
  private/loopback/link-local 차단 + `MAX_REDIRECTS=0` + `ONLY_PRESETS=true`의 조합은 방어가
  아니라 기능 제거다. 셀프호스트 imgproxy의 사실상 유일한 심각 취약 클래스(임의 URL fetch를
  통한 내부망 스캔)와 임의 geometry를 통한 메모리 폭탄이 동시에 사라진다. secret이 유출돼도
  imgproxy를 내부망 프록시로 전용할 수 없다.
- **`Accept` 기반 자동 WebP/AVIF 거부** — Cloudflare Free에 image vary가 없다는 실제 제약을
  확인하고 더 똑똑한 쪽 대신 더 단순한 쪽을 골랐다. Accept 협상은 캐시 키가 어긋나는 순간
  "가끔 어떤 사람에게만 이상한 포맷이 간다"는 최악 등급의 디버깅이 되고, 그 오염이 1년 edge
  TTL과 곱해진다. 비용은 URL에 문자 4개(`@jpg`)다. 교환비가 압도적이다.

### 1-2. 되돌릴 수 없는 것을 되돌릴 수 있게 만든 것

- **`mumak://` alias** — 이 설계에서 가장 되돌리기 비싼 것은 저장소가 아니라 MDX·RSS·제3자
  아카이브에 박히는 URL이다. `IMGPROXY_URL_REPLACEMENTS=mumak://=local:///` 한 줄로 그 결합을
  오늘 끊어두면, 나중에 S3/R2로 가든 경로를 바꾸든 콘텐츠를 다시 쓸 일이 없다. 비용이 env 한
  줄인데 되돌릴 수 없는 결정을 되돌릴 수 있게 만든다. "치환만 바꾸면 되는 게 아니라 key 전량
  복사 + allowlist + acceptance 재통과"라고 낙관을 미리 깎아둔 것도 정직하다.
- **content-addressed 불변 key + 순서 배치** — key에 바이트 해시가 들어가므로 "같은 URL의
  의미가 조용히 바뀌는" 캐시 포이즈닝이 구조적으로 불가능하다. 더 중요한 건 순서다.
  overwrite 거절이 acceptance test로 확인되기 전에는 1년 edge cache를 켜지 않는다고 못박았다.
  위험한 캐시 설정을 그것이 의존하는 불변식 뒤에 세운 것으로, 보통은 반대 순서로 배포했다가
  되돌릴 수 없는 상태가 된다.
- **Dufs MOVE를 소스 코드까지 읽고 발행 경로에서 배제** — v0.46.0의 MOVE가 목적지 존재 확인
  없이 `fs::rename`을 부른다는 것을 라인 번호로 근거화하고 편해 보이는 기능을 거부했다. 이
  판단 하나가 "1년 캐시된 발행 key의 조용한 덮어쓰기(purge로도 회수 불가)"를 원천 차단한다.

### 1-3. 경계를 권한이 아니라 토폴로지로 강제한 것

인터넷에 노출된 유일한 프로세스인 imgproxy가 `*/published`만 RO로 보고 `_incoming`·`_work`는
아예 보지 못한다. 흔한 "공유 uploads 볼륨 하나를 전부 RW로" 패턴과 달리, imgproxy 완전 장악의
결과가 "이미 공개된 픽셀 읽기"로 한정된다. 게다가 이 경계를 문서가 아니라 acceptance test
항목으로 고정해 배포 시 실제로 검증된다.

identity 처리도 교과서적이다. 업로드 filename extension을 identity로 쓰지 않고 magic bytes와
decode 성공 뒤 key를 정규화하며, photo 경로에서도 client의 `Content-Length`를 믿지 않고 stream
중 실제 바이트를 센다. 신뢰 경계에서 사용자 제어 메타데이터를 전부 버리고 서버가 직접 측정한
값만 authoritative로 삼았다.

### 1-4. 새벽 3시에 배울 것을 미리 적어둔 것

- **EXDEV** — `_incoming`/`_work`/`published`를 각각 bind mount하면 로컬에서는 멀쩡하고
  컨테이너에서만 rename이 깨진다. 배포 후에야 터지는 부류인데 설계 단계에서 잡아 acceptance
  항목까지 내렸다.
- **RSS는 `marked`를 거친다** — MDX 컴포넌트 경로와 RSS 경로가 다르다는 걸 설계 단계에서
  발견했다. 놓치면 구현 후 "RSS에서만 이미지가 안 나온다"로 하루를 태우고, 그때는 이미 MDX에
  `<Image>`가 여러 개 박혀 있어 되돌리는 비용이 훨씬 크다. 문서 한 문단으로 나중의 하루를 샀다.
- **상한 4계층 분리와 불변식** — "processor source ceiling >= 이미 발행된 source의 실제 최대값"
  이라는 불변식은 나중에 한도를 조인 탓에 기존 공개 URL이 죽는 self-DoS를 막는다.

### 1-5. 미래의 나와 재논쟁하지 않기로 한 것

"지금 만들지 않는 것"(§2-2)과 "S3로 가는 트리거"(§3-4)를 먼저 문장으로 적어둔 것이 지금 안
만들기 위한 가장 싼 방법이다. 특히 "범용 config service·storage interface는 만들지 않는다",
"helper는 photo 앱에 한 곳만 두고 실제로 두 런타임에서 필요할 때만 `@mumak/shared`로 올린다"는
rule-of-three를 정확히 지킨 문장이다. "photo가 읽는 것만으로는 S3 전환 조건이 아니다"도 선제
추상화를 막는다.

## 2. 외부 사실 검증 — 11건 전부 확인됨

문서가 인용한 외부 주장을 원문·소스코드까지 확인했다. **부정확한 것이 하나도 없다.** 이것 자체가
이 설계의 가장 큰 강점이다. 아래 항목 중 하나라도 틀렸다면 결론이 통째로 흔들렸을 것들이다.

| 주장                                                    | 판정 | 확인 내용                                                                                           |
| ------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| MinIO Community 2026-04-25 archive, source-only 전환    | 정확 | 저장소 archive 배너 날짜 일치, README가 사전 컴파일 바이너리 미유지 명시                            |
| imgproxy 보안·자원 옵션 10종 실재 + 전부 OSS(무료)      | 정확 | v4.0.12 소스에서 정의 위치 확인, Pro 게이트 없음. §5 표 전체가 아니라 보안·자원 축 10종이 검증 범위 |
| `MAX_RESULT_DIMENSION`은 실패가 아니라 축소             | 정확 | 공식 문서 원문 "scale the image down to fit"                                                        |
| URL_REPLACEMENTS ↔ ALLOWED_SOURCES 순서를 문서가 미계약 | 정확 | 실제 구현은 치환 후 검증이지만 문서 계약은 없음 → acceptance로 고정한 판단이 옳음                   |
| Dufs v0.46.0 MOVE가 목적지 확인 없이 rename             | 정확 | L1197 `fs::rename(path, &dest)`, extract_dest에 존재 확인 없음                                      |
| Dufs 기능 목록(D&D·재개·경로별 ACL·health·hash)         | 정확 | README + `HEALTH_CHECK_PATH` 상수 확인                                                              |
| Cloudflare Vary for Images가 Free 미제공                | 정확 | 공식 availability 표 Free: No                                                                       |
| R2 $0.015/GB-month, egress 무료, 10GB free              | 정확 | 90GB × $0.015 = $1.35 계산까지 일치                                                                 |
| Next.js 원격 이미지 width/height 필수                   | 정확 | 인용 앵커까지 현재 문서에 실재                                                                      |
| Browser Cache TTL이 더 긴 origin max-age를 못 줄임      | 정확 | 공식 원문 "you can override to make browsers cache longer ... but not less"                         |
| Cloudflare 캐시는 인기도 기반 LRU eviction              | 정확 | retention-vs-freshness 문서와 방향 일치                                                             |

## 3. 반박되어 기각된 우려 (걱정하지 않아도 되는 것)

19건이 검증 과정에서 기각됐다. 대표적인 것만 남긴다. 나중에 같은 걱정이 떠오르면 여기를 보면
된다.

- **"이중 인코딩이 imgproxy `plain/` 언이스케이프에서 되살아난다"** → §4-1의 key 금지 문자
  목록(`%`, `?`, `#`, `@`, dot segment)과 §4-2·§12의 anchored route 조항이 이미 다룬다.
  (다만 그 조항을 NPM 설정에 실제로 옮기는 것은 별개다 — plan.md 실행 가이드 3단계 참조.)
- **"CPU만 상한이 없다"** → 사실이 아니다. imgproxy는 Lambda 밖에서 `vips_concurrency_set(1)`을
  호출해 요청당 1스레드로 고정하므로 병렬성은 `IMGPROXY_WORKERS`로만 결정된다.
- **"`LOCAL_FILESYSTEM_ROOT`가 symlink 탈출을 막지 않는다"** → 컨테이너가 `published`만 RO bind
  mount하므로 symlink 해석이 mount 밖으로 나갈 수 없다.
- **"`@jpg`는 확장자가 두 번 들어가는 이상한 문법"** → imgproxy plain URL의 네이티브 출력
  확장자 문법이고, `@`가 key 금지 문자인 것은 모순이 아니라 파싱 모호성을 없애는 설계 의도다.
- **"content-v1을 동결했는데 같은 절에서 `w1600-v1`을 예고한다"** → `content-v1`은 fit box,
  `w1600-v1`은 width 기반이라 portrait에서 결과가 다르다. 충돌이 아니다.
- **"guard가 무엇을 발행하는지 아무도 확인하지 않는다"** → §7-1 8단계(사람이 URL·snippet
  확인)가 9단계(MDX commit)보다 앞에 있다.
- **"blog에 published↔참조 대조 작업이 없어 orphan이 쌓인다"** → 참조 집합은 git의 mdx 트리이고
  key는 URL에 통째로 박혀 있으므로 필요할 때 `grep` vs `find` diff 한 줄로 재구성된다.

## 4. 약점 — 구조적 지적 2건 (높음)

이 둘만 설계의 형태에 관한 것이다. 나머지는 전부 문장·설정 수준의 보완이다.

### 4-1. 해결 대상 문제의 현재 인스턴스가 0건이다

**확인된 사실** (직접 재검증):

- `apps/blog/content`의 252개 MDX에서 마크다운 이미지 문법 `![alt](url)` 실제 사용 **0건**.
  `![[...]]` 6건은 garden wikilink transclusion, `<img` 20여 건은 XSS/CWV를 설명하는 본문·코드
  펜스 안 문자열이다.
- `apps/blog/public`은 3.2MB 전부 Pretendard 폰트. 저장소 내 사진 **0장**. `.git`은 38MB.
- 즉 `mdx-components.tsx`의 img override는 프로덕션에서 **한 번도 렌더된 적이 없다.**

즉 696줄 설계, 신규 컨테이너 2개, 신규 서버 1개, NPM rule, Cloudflare rule, 백업 job, 34개
acceptance test가 지금까지 한 번도 발생하지 않은 요구를 위해 준비되고 있다.

**어떻게 나빠지는가**: 3~6일을 들여 전부 세우고 acceptance를 절반쯤 통과시킨 뒤, 실제 발행량이
분기당 3~5장이라는 걸 알게 된다. 사진 1장당 인프라 비용이 반나절이 되고, 6개월 뒤 imgproxy CVE
패치 알림을 받았을 때 이 스택으로 서빙 중인 이미지가 12장이라는 걸 확인한다. 그리고 12장짜리
스택을 유지하기 싫어서 패치를 미룬다.

**대안이 실제로 존재한다**: `next.config.mjs`에 이미 `formats: ['image/avif','image/webp']`,
`deviceSizes`, `minimumCacheTTL: 31536000`이 있고, Dockerfile runner 스테이지가 `public/`을
standalone에 복사하며 sharp는 traced 바이너리를 빌드 시 assert까지 한다. **`public/images/`에
커밋 + static import + next/image면 신규 코드 0줄**이고, static import는 intrinsic width/height를
빌드타임에 주므로 §7-1이 손으로 관리하려는 width/height와 CLS 문제도 함께 사라진다.

**그럼에도 진행하기로 한 이상**: 이 설계는 폐기 대상이 아니라 착수 시점의 문제다. 진행한다면
아래 둘은 그대로 유효하다.

- `apps/blog/mdx-components.tsx`의 `img` override에 박힌 고정 `width={800} height={400}`은 이
  설계와 무관하게 **지금 고칠 수 있는 별개 버그**다. 어떤 경로로 가든 먼저 고치는 게 이득이다.
- 이 설계를 언제 여는지에 대한 트리거를 문서에 남겨두면, 나중에 "왜 12장을 위해 이걸 만들었지"가
  아니라 "이 조건이 충족돼서 만들었지"가 된다. 후보: 사진 20~30장 초과, Docker 이미지/clone이
  사진 때문에 눈에 띄게 무거워짐, 휴대폰에서 바로 올려야 하는 요구 발생.

### 4-2. guard 복잡도의 대부분은 Dufs를 쓰기로 한 결과다

atomic no-replace claim, guard-private temp copy, "claimed inode 자체를 검증 근거로 쓰지 않는다",
실패 시 staging으로 no-clobber 복구, 이름 충돌 시 `recovered-<claim-id>`, stale claim 복구 UI —
이 전부는 **"같은 디렉터리에 신뢰할 수 없는 동시 writer(Dufs)가 있고 그가 open fd를 들고 있을 수
있다"** 를 방어하는 코드다.

그런데 같은 문서 §8-1의 photo backend는 정확히 반대 설계다: 브라우저 → backend가 multipart를
`.part`로 직접 stream → 검증 → commit. claim도, temp 프로토콜도, 복구 UI도 없다. **더 단순한
설계가 같은 문서 안에 이미 있는데 blog에는 적용 검토가 없다.**

Dufs를 정당화하는 근거는 둘이다. **첫째, §3-3의 기능 목록** — 폴더 드래그앤드롭, 재개 업로드,
경로별 접근 제어, 검색·이동·삭제, health endpoint를 한 컨테이너가 제공한다. 이건 사실이고
리뷰 §2에서 실제로 확인했다. 다만 현재 발행량(분기 3~5장, 파일당 수 MB)에서 **재개 업로드와
폴더 업로드가 실제로 필요해지는 지점이 없다.** 둘째, **§7-3의 "Dufs의 upload/storage를 다시
구현하는 범용 admin이나 media service는 만들지 않는다"** — 그런데 문서는 같은 절에서 **이미
same-origin publish helper UI를 직접 만든다고 못박고 있다.** 즉 UI를 안 만드는 게 아니라 이미
만들면서, 그 UI에 `<input type="file">` 하나를 더 두지 않기 위해 claim 프로토콜 전체를 떠안는다.
§3-3이 Dufs MOVE를 기각한 것 자체가 "동시 writer로서의 Dufs"가 문제의 원천임을 보여준다.

즉 교환은 "재개 업로드·폴더 업로드를 포기하고 claim 프로토콜 일체를 없앤다"이다. 대용량·불안정
회선에서 재개 업로드가 실제로 필요해지면 그때 다시 넣으면 되고, 그 판단 기준은 설계문서 §8-1이
photo 경로에 대해 이미 적어둔 것과 같다("측정된 대용량·불안정 회선 문제가 생길 때만 resumable
upload를 추가한다").

**Dufs를 빼면 사라지는 것**: Dufs 컨테이너, 버전 핀·hashed auth·TLS 관리, `_incoming`, claim
프로토콜, staging no-clobber 복구, `recovered-<claim-id>` 규칙, stale claim 복구 UI, §12의 관련
acceptance 4~6개. 그리고 코드가 §8-1과 동일해져 **photo 착수 시 재작업이 0이 된다.**

**주의**: 이 항목은 리뷰 §4-1(착수를 미룸)을 기각한 경우에만 유효하다. 그리고 리뷰 §5-4 첫
항목(guard·helper를 어디에 둘 것인가)과 얽혀 있으므로 둘을 한 번에 정해야 한다.

## 5. 약점 — 보완 항목 20건

각 항목은 "무엇이 비어 있는가 → 최소 조치" 형태다. 설계 변경이 필요한 것은 없다.

### 5-1. 운영·자원 (중간 4건)

| #   | 지적                                                                                            | 최소 조치                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | §5 표가 컨테이너별 상한만 정하고 **박스 전체 합계를 검산하지 않는다**. guard는 예산 자체가 없다 | 배포 전 `free -m` 실측 → 그 숫자 안에서 세 컨테이너 상한 합계를 정한다. imgproxy는 768m 대신 **384m에서 시작**해 자기 cgroup 안에서 먼저 실패하게 둔다. 100GB 디스크에 2GB swapfile 한 줄이 가장 싼 보험                              |
| 2   | **origin에 결과 캐시가 0**이다. edge eviction마다 풀 디코드가 반복된다                          | NPM(nginx)에 `proxy_cache`를 붙인다(컨테이너 0개 추가). `proxy_cache_path`는 http 컨텍스트 지시어이므로 Advanced 탭이 아니라 `/data/nginx/custom/http.conf`에 넣을 것. `proxy_cache_lock on`이 동시 중복 miss를 upstream 1회로 접는다 |
| 3   | POP 단위 cold miss가 worker 1 + queue 8을 직렬로 통과 → 다지역 동시 유입에서 429                | Cloudflare **Tiered Cache**(Generic Global Topology, Free 포함) 토글 1개. `IMGPROXY_WORKERS`를 2~3으로(요청당 vips 스레드는 1이라 8 vCPU에서 1은 CPU를 과하게 아끼는 값)                                                              |
| 4   | 이미지 스택에 **알림이 하나도 없다**. 기존 uptime 모니터는 blog HTML만 본다                     | 가장 싼 순서로: imgproxy·Dufs에 healthcheck + `labels: autoheal=true`(PR #534의 사이드카 재사용, 신규 컨테이너 0) → 그 다음에야 `/healthz` rewrite + UptimeRobot 체크 1개                                                             |

이 저장소 사실 하나를 덧붙인다: **현재 작업 브랜치의 `apps/blog/docker-compose.yml`은
`origin/develop`보다 38줄 낡았다**(PR #534의 autoheal·mem_limit·로그 로테이션이 빠져 있음). 이
브랜치에서 compose를 손대면 그 자체가 회귀다. 새 스택 작업 전에 반드시 rebase/merge할 것.

### 5-2. 운영·프로세스 (중간 2건 + 낮음 4건)

- **[중간] 백업은 최초 restore만 게이트되고 이후 실패는 무신호다.** §10은 "마지막 성공 시각
  확인"을 사람의 수동 항목으로만 둔다. 조치: §11 1단계에서 도구·스케줄을 확정(`restic` + R2면
  한 줄), 성공 시에만 외부 heartbeat(healthchecks.io 무료)를 ping하고 26시간 무소식이면 기존
  텔레그램 채널로 알림. **dead-man's switch가 이 항목의 유일한 실질 추가분이다.**
- **[중간] acceptance 34개를 "통과 전 배포 금지"로 두었지만 강제 장치가 없다.** 작성자·구현자·
  검수자가 동일인이고 CI 훅이 없다. 조치: 두 목록으로 쪼갠다. (1) CI 자동화 — 경계 파일 거부,
  같은 hash 재시도 idempotent, 충돌 destination 거부, path traversal/scope 거부, EXIF/ICC strip,
  jpg/webp 고정 포맷, RSS `<img>` 출력, alt 누락 검증. (2) 1회성 수동 드릴 — 50MP OOM 실측,
  crash 후 상태, EXDEV 부재, `CF-Cache-Status`/`Age`, 전체 variant purge, restore+checksum, CLS,
  30초 사용성. 게이트는 (1)에만 걸고 (2)는 실행 날짜·결과를 기록한다. **검증 안 된 체크리스트가
  검증된 것처럼 보이는 게 체크리스트가 없는 것보다 나쁘다.** 최악 fixture(32MiB)는 저장소에 넣을
  수 없으니 홈서버 고정 경로를 §11-6에 적을 것.
- **[낮음] guard의 런타임 봉투가 비어 있다.** 동작 계약은 이 설계에서 가장 상세하지만 이미지
  빌드·레지스트리·mem_limit·restart/healthcheck·인증·갱신 경로가 §5 표에도 §11-5에도 없다.
  조치: §5 표에 guard 한 행 추가(`mem_limit 128m` + healthcheck + autoheal 라벨).
- **[낮음] pinned digest를 푸는 시점이 없다.** watchtower는 `mumak-blog`만 감시하고 새 스택은
  git 밖·dependabot 대상 밖이다. blog만 자동으로 따라가고 Dufs/imgproxy만 정지하는 비대칭을
  아무도 눈치채지 못한다. 조치: 스택 compose를 git에 넣고 `.github/dependabot.yml`에
  `package-ecosystem: docker` 추가(적용은 지금처럼 Portainer 수동, git은 알림 채널로만). 또는
  §9-3의 분기 drill 체크리스트에 "릴리스 노트 확인 후 digest 갱신" 한 줄.
- **[낮음] §11-5의 배포 한 줄이 실제로는 Dockerfile + GHCR + compose + watchtower 항목을
  뜻한다.** 다만 `apps.yml`/CI 매트릭스/E2E 포트는 필수가 아니다(`apps/karaoke`,
  `apps/spotify-stage`가 등록 없이 존재하는 선례). 검증 로직은 I/O 경계가 얇은 함수로 써서
  blog의 기존 jest 스위트에서 직접 테스트하고 HTTP 껍데기만 컨테이너로 두면 세금이 준다.
- **[낮음] R2/Cloudflare Images를 1차 후보로 비교한 적이 없다.** 다만 이 사용자는 이미 홈서버
  컷오버를 끝냈고 프로젝트 엔드게임이 탈Vercel이므로 결론 자체는 바뀌지 않는다. 조치: §3-4 옆에
  한 문장 — "R2/CF Images는 성능·비용이 아니라 **주권** 때문에 채택하지 않는다. 홈서버가 이미
  상시 가동 중이라 디렉터리 추가의 한계비용은 0이며, off-host/serverless photo backend가
  필요해지는 순간 §3-4 조건에 따라 R2를 1순위로 재비교한다." 이유를 "단순성"이 아니라 "주권"으로
  적어야 이후 결정들이 흔들리지 않는다.

### 5-3. 보안 (중간 1건 + 낮음 5건)

- **[중간] Authenticated Origin Pull 기본 인증서는 "내 zone"이 아니라 "Cloudflare 어딘가"만
  증명한다.** 기본 AOP는 전 고객 공용 origin-pull CA를 쓴다. 공격자가 자기 Cloudflare zone의 A
  레코드를 홈 IP로 지정하고 프록시를 켜면 `ssl_verify_client`를 통과하고, Host 헤더로 img
  vhost에 도달한다. 이 경로에서는 내 zone의 Cache Rule·edge TTL·WAF가 전부 적용되지 않아 요청
  하나하나가 cold miss로 origin에 꽂힌다. §6이 "IP allowlist **또는** AOP"로 둘을 동등하게 제시한
  것이 틀렸다. 조치: **IP allowlist를 1차 통제로 두고** AOP는 per-zone custom certificate일 때만
  origin lock으로 인정한다. nginx `default_server`에 `return 444` 한 줄로 SNI 불일치를 먼저 끊는다.
  §12의 origin lock 테스트를 "유효한 CF 클라이언트 인증서를 든 다른 zone 경유 요청도 거절"로 강화.
- **[낮음] 잘린 업로드가 발행되는 것을 막는 검사가 없다.** Dufs에는 업로드 완료 신호가 없고,
  rename은 진행 중인 쓰기를 멈추지 않는다. libvips는 잘린 JPEG를 부분 디코드하므로 §7-1 6단계
  internal 검증도 통과한다. 실제 피해는 버려진 key 하나(§7-1 8단계의 눈 확인이 MDX commit보다
  앞에 있음)지만 조치가 두 줄이다: claim 직후 `fstat`의 size/mtime을 기록하고 temp 복사 완료 후
  재비교, 선택적으로 마지막 2바이트 `FFD9` 확인. **Dufs를 빼면(§4-2) 이 항목 자체가 사라진다.**
- **[낮음] symlink 검사 시점이 규정돼 있지 않다.** `rename(2)`는 마지막 컴포넌트의 symlink를
  따라가지 않아 claim은 안전하지만, 다음 단계인 "claim을 temp로 복사"는 `open`이라 링크를
  따라간다. 조치: 경로 검사 결과가 아니라 **열린 fd를 이후 모든 단계의 유일한 근거로** 삼고
  `O_NOFOLLOW`(가능하면 `openat2` `RESOLVE_NO_SYMLINKS|RESOLVE_BENEATH`)를 쓴다. 플래그 하나다.
- **[낮음] `ufw`는 Docker publish 포트를 막지 못한다.** DOCKER 체인이 nat/PREROUTING과 FORWARD에
  삽입되므로 INPUT 규칙을 우회한다. §11-3의 "LAN bind"는 compose 포트 표기를 규정하지 않아
  naive한 `9101:5000`을 유도한다. 조치: `<LAN-IP>:9101:5000`으로 명시 바인드하거나 publish를 아예
  없애고 internal network + WireGuard 피어로만 접근. §12의 "외부망에서 접속 불가"는 **ufw를 정지한
  상태에서도** 확인한다(방화벽이 없어도 닫혀 있어야 정상).
- **[낮음] 원본 트리에 GPS가 그대로 남는다.** `strip_metadata`는 imgproxy 출력에만 적용되고,
  `published/`의 원본 JPEG는 좌표·촬영 시각·임베디드 썸네일을 갖는다. 현재 노출 경로는 0이지만
  (presets-only + anchored route + `ENABLE_INFO_ENDPOINT` 기본 false) 전부 "나중에 설정을 바꾸면"
  열린다. §2-1대로 진짜 원본은 RAW 체계에 남으므로 조치에 손실이 없다: guard가 temp 단계에서
  `exiftool -gps:all= -thumbnailimage=` 적용 후 **그 바이트로 해시를 계산**(순서 중요), §5 표에
  `IMGPROXY_ENABLE_INFO_ENDPOINT=false` 명시 고정.
- **[낮음] `IMGPROXY_SECRET`이 백업으로 평문 복제되고 회전 절차가 없다.** 외부에서 이 secret으로
  imgproxy를 직접 때리는 경로는 없다(host port 미공개). 내부자 대상 defense-in-depth일 뿐이지만
  조치가 싸다: 백업 대상 중 secret이 든 설정만 age/gpg 암호화, NPM admin(81)을 LAN/WireGuard로
  제한, 회전은 "새 secret으로 두 번째 imgproxy 기동 → NPM upstream 전환 → 구 컨테이너 종료"
  3단계로 §11에 기록, §10에 "imgproxy 401 급증 시 확인" 한 줄.

### 5-4. 사용성·발행 흐름 (중간 1건 + 낮음 3건)

- **[중간] publish helper의 코드·배포 위치가 정의돼 있지 않다.** §11-5는 배포 대상과 mount·검증
  항목만 나열할 뿐, 코드가 어느 저장소에 살며 어떻게 빌드·갱신되는지가 없다. 손으로 만든 Portainer
  컨테이너로 띄우면 monorepo CI·promote·watchtower 밖의 **네 번째 배포 절차**가 생긴다. 조치:
  plan.md가 이미 지정해 둔 자리(`apps/admin`, LAN/WireGuard 전용, "실제 필요가 생기면")가 바로 이
  helper다. `apps/admin`의 첫 라우트로 만들면 기존 Dockerfile/GHCR/promote/watchtower 패턴을
  재사용한다. 단 "새 운영 절차 0개"는 아니다 — plan.md가 이미 기록해 둔 함정 3개가 그대로 적용된다:
  (i) `promote.yml` 변경은 main에 닿기 전까지 무효, (ii) watchtower command에 컨테이너 이름을
  추가해야 따라옴, (iii) 새 GHCR 패키지에 Actions access(Write) 수동 부여 필요. E2E 포트를 쓴다면
  **3006**이다(3000~3005는 next/react/blog/native/lattice/karaoke가 이미 점유).
- **[낮음] guard의 canonical preflight가 429와 4xx를 구분하지 않는다.** 큐가 찼을 뿐인데 방금
  promote한 destination을 rollback한다. 조치: 429/502/504는 재시도 가능으로 분류해 지수 백오프 3회
  뒤에만 실패 처리하고, rollback은 실제 디코드 거절(4xx)에서만. 조건 분기 하나다.
- **[낮음] 429가 독자에게 무엇으로 보이는지 정의돼 있지 않다.** 브라우저는 `<img>` 실패를 자동
  재시도하지 않으므로 그 세션 동안 깨진 아이콘이다. 조치: guard 발행 성공 직후 공개
  URL(jpg/webp)을 Cloudflare 경유로 1회씩 `curl`해 edge와 origin 캐시를 미리 데우는 한 줄.
- **[낮음] helper가 평문 http 사설 IP origin이면 `navigator.clipboard`가 없다**(secure context
  전용, localhost만 예외). 30초 기준의 마지막 단계가 조용히 성립하지 않는다. 조치: helper도 NPM
  proxy host + 인증서 뒤에 두거나, `document.execCommand('copy')` fallback 또는 readonly
  `<textarea>` + focus 시 전체 select 한 줄. §12의 30초 체크박스가 잡아주므로 문구 보강으로 충분.

## 6. 결정 유지 시 반드시 반영할 것

우선순위 순. 상세는 위 각 항목 참조.

1. **작업 브랜치를 `origin/develop`에 맞춘다.** 현재 48커밋 뒤이고 compose가 38줄 낡았다.
2. **착수 전 실측 3개**: `free -m`, `df -h`, 호스트 포트 목록. 이 숫자 없이 mem_limit과 critical
   임계값을 확정하지 않는다. imgproxy는 384m에서 시작한다.
3. **Dufs를 쓸지 먼저 정한다**(리뷰 §4-2). 빼면 코드·문서·acceptance가 함께 줄고 photo 재작업이 0이 된다.
4. **helper/guard의 자리를 정한다**(리뷰 §5-4 첫 항목). `apps/admin`이 이미 예약된 자리다.
5. **origin lock은 IP allowlist를 1차로**(리뷰 §5-3 첫 항목). AOP 기본 인증서는 origin lock이 아니다.
   단 allowlist는 **img proxy host의 location 단위**로 건다 — 호스트 방화벽에 걸면
   `blog.wannysim.com` grey 레코드로 남겨둔 Cloudflare 장애 시 비상문이 함께 닫힌다.
6. **NPM `proxy_cache` + Tiered Cache**(리뷰 §5-1 2·3번). 컨테이너 0개 추가로 429 클래스가 크게 준다.
7. **autoheal 라벨을 새 스택에도**(리뷰 §5-1 4번). 기존 사이드카가 `AUTOHEAL_CONTAINER_LABEL: autoheal`로
   데몬 전역을 감시하므로 라벨만 달면 되고 신규 컨테이너는 0개다.
8. **백업 dead-man's switch**(리뷰 §5-2 첫 항목). 백업은 조용히 죽는 게 기본값이다.
9. **acceptance를 CI 자동화 / 1회성 드릴로 쪼갠다**(리뷰 §5-2 두 번째). 게이트는 자동화에만 건다.
   단 imgproxy가 LAN 전용이면 응답을 봐야 하는 항목(EXIF strip, 포맷 고정)은 CI에 넣을 수 없다.
10. **`mdx-components.tsx`의 `img` override 고정 800×400은 지금 고친다.** 어떤 경로로 가든 이득이다.
