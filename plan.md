# 블로그 홈서버 이관 계획 (Vercel 탈출 · **Phase 2 완료**)

> 상태(2026-07-11): **컷오버 + 후속 정리까지 완료 — `https://wannysim.com`이 홈서버에서 서빙 중.**
> Cloudflare(orange, Full strict) → NPM(Origin CA) → `mumak-blog`. dev/프리뷰는 Vercel 유지.
> 배포 플로우: **develop 또는 main**에 그린 커밋 → promote가 GHCR push → Watchtower 자동 반영(~5분).
> (develop = 평시 발행 채널, main = hotfix 직접 머지 커버 — release 1.9.1로 활성화·실증)
> `blog.wannysim.com` = 평시 301→apex(SEO 통합) + Cloudflare 장애 시 비상문(NPM Advanced 한 줄 삭제).
>
> 완료된 것(전부 실증):
>
> - **배포 파이프라인**: develop 그린 → `promote.yml`이 Vercel promote + GHCR 빌드/push(`:latest`+`:<sha>`)
>   → 홈서버 `mumak-blog-watchtower`(`nickfedor/watchtower`, 5분 폴링)가 자동 pull. 자동/수동 경로 모두 성공,
>   idempotency guard 정상 동작 확인. release 1.9.0(PR #475, 태그 `1.9.0`, back-sync #476)으로 main 활성화.
> - **NS 이관**: `wannysim.com` → Cloudflare(무중단). 레코드 6종 grey. 와일드카드 버림(프리뷰는 vercel.app).
> - **https**: Cloudflare API 토큰 → NPM LE DNS 챌린지로 `home.wannysim.com` 인증서 + Force SSL.
> - **Analytics**: GA가 `VERCEL_ENV` 게이트에 갇힌 버그를 PR #477로 수정(셀프호스트에서 GA 렌더). GA4 속성 생성
>   - `NEXT_PUBLIC_GA_ID=G-XYYH688J4W` var 등록 → 홈서버 HTML에 gtag 반영 + 실시간 수집 확인(시크릿탭).
> - GitHub Variables: `NEXT_PUBLIC_NAVER_TOKEN`, `NEXT_PUBLIC_GA_ID`. (`NEXT_PUBLIC_BASE_URL`은 전환기에만 쓰고
>   컷오버 때 삭제 — 현재는 워크플로 폴백 `https://wannysim.com`이 적용됨.)
> - GHCR: read 토큰 `ghcr-mumak-read`(Vaultwarden 보관), 패키지 repo Actions access(Write).
>
> **컷오버 완료(2026-07-11).** 후속 정리도 완료: release 1.9.1로 promote 개편 활성화(Vercel 스텝 제거 +
> **배포 소스 develop|main 이중화** — main발 첫 promote 성공 실증, run 29130482823), Vercel Ignored Build
> Step 검증(main 빌드 CANCELED, 프리뷰 정상), back-sync #480.
>
> **`home` → `blog.wannysim.com` 전환 + DR 설계(2026-07-11)**: NPM은 disabled 호스트의 도메인도 점유해
> 같은 도메인의 Redirection+Proxy 공존이 불가 → **Proxy Host 단일 운용**으로 해결. `blog.wannysim.com`
> Proxy Host(forward `10.0.0.105:3100`, X-Forwarded 헤더 2줄, 새 LE 인증서+Force SSL)의 **Advanced 탭에
> `return 301 https://wannysim.com$request_uri;` 한 줄** — 평상시엔 전 요청이 apex로 301(SEO 통합,
> canonical과 이중 방어), **Cloudflare 장애 시 이 한 줄만 지우고 Save 하면 origin 직접 서빙**(비상문).
> 301 경로보존·인증서·http 진입 전부 검증 완료. Cloudflare API 토큰은 Roll로 재발급(Vaultwarden 보관).
> IP 은닉 참고: `blog` grey 레코드가 홈 IP를 노출하지만 `5231.kr` apex도 동일 IP 노출 + passive DNS
> 역사에 이미 기록 → 레코드 삭제 실익 없음, DR 가치 우선. 실공격 시 카드: ISP IP 변경 + grey 전량 정리.
> **로컬 DNS flip-flop (집 LAN 한정, 자연 치유 예정)**: AdGuard의 upstream들이 각자 "NS = Vercel" 위임을
> 캐시 중이고 Vercel 옛 zone이 아직 응답해서, 질의가 어느 upstream에 떨어지냐에 따라 옛/새 IP가 번갈아 나옴.
> 개별 레코드 캐시(20분)가 아니라 **NS 위임 캐시(24~48h)** 문제라 맥 flush로는 안 풀림. 외부 방문자는 무영향.
> 해소: 위임 TTL 만료 대기(늦어도 2026-07-12 저녁) 또는 AdGuard 컨테이너 재시작. 임시로 맥 DNS를 1.1.1.1로.

## 배경 / 목표

- Vercel 의존도를 **점진적으로** 제거하고 홈서버로 이관.
- 엔드게임: 홈서버 기반 **이미지 업로드 시스템**. 이번 컨테이너화가 그 초석.
- **프로덕션만 홈서버로.** `dev.wannysim.com` + PR/브랜치 프리뷰는 Vercel에 그대로 둔다 (브랜치별 프리뷰 자동생성을 홈서버에서 흉내내지 않기로 결정).

## 현재 홈서버 인프라 (실측 · Portainer API 조회)

- Portainer EE `https://docker.5231.kr`, 배포 대상 **endpoint 11 = MumAk-Docker** (Ubuntu 22.04, **x86_64/amd64**, 8 vCPU, **RAM 4.3GB**, Docker 29). 원격 endpoint 12/13(Cloud01/02)도 있음.
- 상주 컨테이너: **nginx-proxy-manager**(80/443/81, letsencrypt 볼륨 → 리버스프록시+TLS 담당), **postgres:16-alpine**(5432), teslamate 스택(**grafana 포함**), unifi(mongo), vaultwarden, adguard, wireguard 등 12개.
- 커스텀 레지스트리 0개(GHCR 미등록), git-backed 스택 없음. 도메인 `5231.kr` 보유.
- repo: `github.com/wannysim/mumak-www` (개인, aptmtr 아님).

## 확정 결정

| 항목                  | 결정                                                              | 이유                                                                                                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빌드 위치             | **CI/랩탑에서 빌드 → GHCR push**, Portainer는 pull만              | 4.3GB 박스에서 Next 빌드 = OOM 위험                                                                                                                                                                                                                                     |
| 아키텍처              | `linux/amd64` 고정                                                | 박스가 x86_64, sharp 바이너리 매칭                                                                                                                                                                                                                                      |
| 대상 앱               | `apps/blog`                                                       | 첫 이관 대상                                                                                                                                                                                                                                                            |
| 레지스트리            | GHCR **private** `ghcr.io/wannysim/mumak-blog`                    | gh 이미 인증, 무료                                                                                                                                                                                                                                                      |
| 인그레스              | 기존 **nginx-proxy-manager**                                      | 이미 80/443/TLS 담당 → Cloudflare Tunnel 불필요                                                                                                                                                                                                                         |
| 프로덕션 도메인       | `wannysim.com` → 홈서버 (나중 컷오버)                             |                                                                                                                                                                                                                                                                         |
| Phase 1 테스트 호스트 | **`home.wannysim.com`** (blog.5231.kr → blog.25g.dev → 최종 확정) | 25g.dev 사용 불가 판명. wannysim.com DNS는 Vercel 관리 → A `home` → 공인 IP `1.228.10.189`(와일드카드보다 구체 레코드 우선). **사설 IP를 넣으면 내부망에서만 접근됨** — 라우터 80 포트포워딩·하핀 NAT는 이미 동작(2026-07-10 실측). 집 공인 IP 변경 시 이 레코드도 갱신 |
| 인프라 변경           | **UI runbook으로만** (에이전트 API mutation 금지)                 | 사용자 통제권 유지                                                                                                                                                                                                                                                      |

## 앱 사실 (코드 검증 완료)

- `output: 'standalone'` + `outputFileTracingRoot`=모노레포 루트 → 엔트리 `.next/standalone/apps/blog/server.js` (cwd가 이 디렉터리여야 content/OG폰트 로드됨).
- standalone은 `.next/static`, `public/`을 자동 포함 안 함 → Dockerfile에서 수동 copy (start-e2e.mjs가 하는 그대로).
- **sharp는 `next`의 의존성**이라 이미 트레이싱됨 → 수동 설치 금지(이중 sharp로 깨짐), arch 맞춰 빌드 + `require('sharp')`로 빌드타임 검증.
- **ISR/revalidate 없음, 완전 SSG(922 routes)** → 새 글 발행 = 이미지 재빌드+재배포.
- `next/font/local`(Pretendard), 빌드타임 네트워크 폰트 fetch 없음.
- env — 빌드타임(인라인): `NEXT_PUBLIC_BASE_URL`(폴백 `https://wannysim.com`), `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_TOKEN`, `NEXT_PUBLIC_NAVER_TOKEN`. 런타임: `SPOTIFY_CLIENT_ID/SECRET/REFRESH_TOKEN`(옵션).
- `robots`는 무조건 `index:true`(env 비의존, noindex 위험 없음). `VERCEL_ENV`는 **Vercel Analytics on/off에만** 사용 → 홈서버에선 Vercel Analytics만 꺼짐. ⚠️ 단 `NEXT_PUBLIC_GA_ID`가 프로덕션 미설정이라 **GA도 실제론 안 붙어 있음**(2026-07-10 실측) → 홈서버 이관 시 방문 데이터 0. Analytics 섹션 참조.

## 생성된 파일 (이 브랜치)

- `apps/blog/Dockerfile` — turbo prune + standalone, amd64, sharp 검증, `.next/cache` 권한 처리.
- `.dockerignore` — 기존 유지 + 옵시디언 볼트 제외 1줄.
- `apps/blog/docker-compose.yml` — **블로그 전용 독립 스택** (GHCR 이미지 pull, `blog_next_cache` 볼륨, `/ko/blog` healthcheck, 로그/DB는 seam).

## Phase 1 Runbook — `home.wannysim.com`에 띄우기 (완료)

### 사전 준비 — 완료

- GHCR PAT: push용 `write:packages` 발급·docker login 완료. Portainer pull용은 `read:packages` 전용 토큰 권장.
- DNS: Vercel 대시보드(`wannysim.com` DNS Records)에 A `home` → 공인 IP `1.228.10.189`. 기존 와일드카드(→Vercel)보다 구체 레코드가 우선. (25g.dev 경로는 폐기. 처음 사설 IP `10.0.0.105`를 넣었더니 외부망 접근 불가 — 2026-07-10 공인 IP로 교정)

### ① 랩탑: 빌드 + push — 완료

```bash
cd <repo>
echo <WRITE_PAT> | docker login ghcr.io -u wannysim --password-stdin
docker build -f apps/blog/Dockerfile --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_BASE_URL=https://home.wannysim.com \
  -t ghcr.io/wannysim/mumak-blog:latest .
docker push ghcr.io/wannysim/mumak-blog:latest
```

### ② Portainer UI: GHCR 레지스트리 등록 — 완료

Registries → Add registry → Custom → Name `GHCR`, URL `ghcr.io`, Auth on, user `wannysim`, pass `<READ_PAT>`.

### ③ Portainer UI: 블로그 전용 스택 — 완료

endpoint **MumAk-Docker** → Stacks → Add stack → Name `blog` → Web editor에 `apps/blog/docker-compose.yml` 붙여넣기 → (선택) SPOTIFY\_\* env → Deploy → 컨테이너 `mumak-blog` healthy 확인.
배포됨: `mumak-blog` healthy, 호스트 `3100:3000` (호스트 3000은 adguard host-network UI 점유로 3100 사용).

### ④ NPM UI: 프록시 호스트 — 완료 (`proxy.5231.kr`에서 접속)

Proxy Hosts → Add → `home.wannysim.com` → http / **`10.0.0.105`** / **3100**, SSL None(TLS는 Phase 2).
실측으로 배운 것 두 가지:

- Forward 대상으로 `172.17.0.1`(docker0)은 **타임아웃** — NPM 컨테이너가 커스텀 네트워크에 있어 막힘. **서버 LAN IP(`10.0.0.105`)를 쓸 것.**
- Next standalone은 Host 헤더에 포트가 없으면 리다이렉트 Location에 **내부 포트(:3000)를 붙인다** (`/`→`/ko` 로케일 리다이렉트가 `home.wannysim.com:3000/ko`로 오염). 해결: **Custom locations 탭**에 location `/` 를 만들고 기어 아이콘 설정에 아래 두 줄 추가. Advanced 탭(server 레벨)은 location 블록에 자체 `proxy_set_header`가 있어 **nginx 상속 규칙상 무시되므로 안 먹힌다.**

  ```nginx
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Port $server_port;
  ```

### ⑤ 스모크 테스트 — 완료 (내부망 직접 + NPM 경유 모두)

```bash
curl -sI http://10.0.0.105:3100/ko/blog                  # 200 (내부망 직접)
curl -sI http://home.wannysim.com/ko/blog                # 200 (NPM 경유)
curl -sI http://home.wannysim.com/ko/opengraph-image     # 200 image/png (OG는 locale 하위, 폰트/cwd 정상)
curl -sI http://home.wannysim.com/                       # 307 → http://home.wannysim.com/ko (포트 오염 없음)
# 포스트별 OG는 해시 붙은 URL(/…/opengraph-image-xxxxx)이 정상 — 페이지 og:image 메타로 확인
# 이미지 최적화(sharp)는 브라우저로 글 열어 썸네일 확인 (public엔 이미지 없어 curl로 못 침)
```

> 스모크 완료(2026-07-09) — 로컬 컨테이너 + 홈서버(`10.0.0.105:3100`) 모두: /ko/blog 200 + 카드 렌더,
> /ko/opengraph-image 200 PNG, 포스트 페이지·포스트 OG 200 PNG. sharp 0.34.5 빌드타임 로드 검증 통과
> (Dockerfile 검증 스크립트를 next의 require 컨텍스트 기준으로 수정 — pnpm 레이아웃에선 top-level
> sharp 심링크가 없음).

## Phase 2 — 프로덕션 컷오버 (진행 중)

### Promote 파이프라인 (기존 promote.yml 개조) — 워크플로 수정 완료 (2026-07-10)

기존 `promote.yml`(develop CI+E2E 이중 green gate → Vercel promote)의 **게이트·concurrency·idempotency guard·workflow_dispatch 로직을 그대로 재사용**하고, 배포 스텝만 교체한다:

> **구현됨(이 브랜치)**: 같은 gate 뒤에 Vercel promote → GHCR 스텝(login / build / push `:latest`+`:<sha>`)을
> 나란히 추가. `permissions: packages: write` 추가. `NEXT_PUBLIC_*`는 GitHub **Variables**에서 build-arg로
> 주입, BASE_URL 미설정 시 `https://wannysim.com` 폴백(빈 문자열 인라인 방지). `promote/gate` success
> status는 두 배포가 모두 성공했을 때만 남으므로 idempotency 의미 유지 — 한쪽 실패 시 다음 트리거가
> 전체 재시도(같은 SHA의 Vercel 재배포는 무해). **workflow_run은 main의 파일 기준으로 실행** — main 반영 후 활성화.
>
> **활성화 전 사용자 액션 (UI runbook)**:
>
> 1. **GHCR 패키지 Actions access** — github.com 패키지 `mumak-blog` → Package settings →
>    Manage Actions access → `wannysim/mumak-www` 를 **Write** 로 추가.
>    (패키지가 PAT push로 생성돼 있어 이걸 안 하면 `GITHUB_TOKEN` push가 denied.)
> 2. **GitHub repo Variables 등록** — repo Settings → Secrets and variables → Actions → **Variables**:
>    실측(2026-07-10, 프로덕션 HTML·번들 검사) 결과 실제 필요한 건 하나뿐:
>    `NEXT_PUBLIC_NAVER_TOKEN` = `81ab0844a8584a2a4645b41d62f8db1ef81bcc7e`.
>    `NEXT_PUBLIC_GA_ID`·`NEXT_PUBLIC_GSC_TOKEN`은 **Vercel 프로덕션에도 미설정**이라 등록 안 함.
>    `NEXT_PUBLIC_BASE_URL` = `http://home.wannysim.com` — **컷오버 전까지** 등록.
>    전환기 동안 홈서버가 이 호스트로 서빙되므로 canonical/OG가 자기 자신을 가리켜야 한다
>    (TLS 미적용이라 http). **컷오버 때 이 var를 삭제**하면 워크플로 폴백 `https://wannysim.com`이 적용됨.
>    var 변경은 그 자체로 재배포를 만들지 않음 — `gh workflow run promote.yml`로 재빌드해야 인라인된다.
>    (Spotify 3종은 런타임 시크릿 — Portainer `blog` 스택 env에 이미 있음, GitHub엔 불필요.)
> 3. **Watchtower 스택 배포** — Portainer(MumAk-Docker) → Stacks → Add stack → Name `mumak-blog-watchtower`:
>
>    ```yaml
>    services:
>      watchtower:
>        # containrrr/watchtower는 2025-12 아카이브 → Docker 29(min API 1.44)와 비호환
>        # ("client version 1.25 is too old"). nickfedor/watchtower가 드롭인 유지보수 포크.
>        image: nickfedor/watchtower
>        container_name: mumak-blog-watchtower
>        restart: unless-stopped
>        volumes:
>          - /var/run/docker.sock:/var/run/docker.sock
>        environment:
>          REPO_USER: wannysim
>          REPO_PASS: ${GHCR_READ_PAT} # read:packages PAT — 스택 env로 주입
>        # 감시 스코프는 blog 스택의 컨테이너 이름 `mumak-blog`(스택/이미지 이름 아님).
>        # 다른 상주 컨테이너는 건드리지 않음. 롤백으로 :<sha> 고정 중이면 그 태그엔
>        # 새 digest가 없어 자연히 안전.
>        command: --interval 300 --cleanup mumak-blog
>    ```

1. Vercel promote 스텝 → **Docker 빌드**(`--build-arg NEXT_PUBLIC_BASE_URL=https://wannysim.com`, NEXT*PUBLIC*\* 는 GitHub vars에서) + **GHCR push `:latest` + `:<sha>`** (내장 `GITHUB_TOKEN`의 `packages: write` — 추가 시크릿 불필요).
2. 홈서버 반영은 **pull형(Watchtower)으로 시작**: 홈서버에 Watchtower 컨테이너 1개 추가, `read:packages` PAT으로 GHCR `:latest` 폴링(간격 ~5분) → 새 digest면 `mumak-blog` 자동 re-pull·재시작. **GitHub 러너가 사설 IP의 Portainer에 닿을 수 없어서** push형 webhook은 지금 불가.
3. 컷오버로 서버가 공개된 뒤 원하면 push형 전환: Portainer 스택 webhook URL을 NPM으로 노출 + CI 마지막에 `curl -X POST` (시크릿 `PORTAINER_WEBHOOK_URL` 1개 추가). 즉시 반영이 필요해지기 전까지는 Watchtower로 충분.
4. **롤백**: Portainer 스택 이미지를 `:<sha>`로 고정해 Update (Watchtower는 `:latest` 추적이므로 롤백 동안 잠시 중지하거나 스택에서 라벨로 제외).
5. Vercel promote와 홈서버 배포는 전환기 동안 **병행 가능** — 같은 게이트 뒤에 스텝 두 개를 나란히 두면 dev/프리뷰(Vercel)와 프로덕션(홈서버)이 한 워크플로에서 갈라진다.

### SSL 연결 타이밍 (조사 완료 · 2026-07-09 / **NS 이관 완료 · 2026-07-11**)

> **NS 이관 완료**: Cloudflare zone 생성(`yolanda`/`leland.ns.cloudflare.com`), 레코드 6종 — A `home`(grey),
> CNAME `@`→`392fc8b5bd5b93bd.vercel-dns-017.com`(flatten, grey), CNAME `dev`/`www`→`cname.vercel-dns-017.com`(grey),
> TXT `@`+`google-search-console`(GSC 검증). 와일드카드 `*`는 의도적으로 버림(프리뷰는 vercel.app URL).
> CAA 3종(letsencrypt/pki.goog/sectigo)은 유지 — NPM LE·Vercel·Cloudflare SSL 전부 커버. Cloudflare 자동
> 스캔은 ALIAS를 IP 하드코딩 A로 + 전부 Proxied로 가져오므로 그대로 쓰면 안 됨(수동 교정했음).
> dig로 Cloudflare NS 직접 조회 + dev(302)/prod(307)/home(200) 응답 전부 무중단 검증.
> **D5~D7 완료(2026-07-11)**: Cloudflare API 토큰(Edit zone DNS, wannysim.com 한정) 발급 → NPM에서
> LE DNS 챌린지로 `home.wannysim.com` 인증서 발급(YE2, ~10/08, NPM 자동갱신) + Force SSL.
> https 200 / http→301 / 로케일 리다이렉트 `https://…/ko` 오염 없음 검증. GitHub var
> `NEXT_PUBLIC_BASE_URL`을 `https://home.wannysim.com`으로 갱신 후 promote 수동 재빌드(run 29105152381)
> → GHCR push → **Watchtower 자동 pull → 홈서버 canonical `https://…/ko` 반영 확인**. var→빌드→배포
> 루프 E2E 실증 완료. **이제 컷오버 전 남은 것: Analytics(GA4) 선행 + 컷오버 절차 자체.**
>
> Analytics 완료(2026-07-11): GA가 `VERCEL_ENV` 게이트에 갇혀 셀프호스트에서 안 켜지는 버그를
> PR #477로 분리 수정(develop 머지 완료). GA4 속성 생성 → `NEXT_PUBLIC_GA_ID=G-XYYH688J4W` var 등록 →
> promote 재빌드 → **홈서버 HTML에 `gtag/js?id=G-XYYH688J4W` 반영 확인**. GA 실사용 검증만 남음(실시간 보고서).

https가 막힌 원인은 단 하나: wannysim.com DNS가 Vercel 관리인데 **NPM의 LE DNS 챌린지 provider에 Vercel이 없음** (사설 IP라 HTTP 챌린지는 원천 불가). Cloudflare는 NPM 기본 지원 provider이므로, **NS를 Cloudflare로 이관하는 순간 풀린다.**

1. **NS 이관은 컷오버 전에 미리** — 호스팅은 그대로 Vercel, 기존 레코드를 Cloudflare에 그대로 복사하면 `dev.wannysim.com`·프리뷰 무중단. 리스크 1번(DNS/인증서 핸드오프)을 미리 쪼개서 제거.
2. 이관 즉시 NPM에서 **LE DNS 챌린지(Cloudflare API 토큰)** 로 `home.wannysim.com` 인증서 발급 → 컷오버 전부터 https 테스트.
3. 컷오버 시 **Cloudflare proxy(주황 구름)** 켜면 방문자 TLS는 엣지가 종결. origin(NPM)엔 **Cloudflare Origin CA 인증서**(15년 유효, 갱신 사이클 없음) + Full(strict) — 장기 최종 형태.

### 컷오버 runbook (다음 세션 · 순서 중요)

전제(전부 완료): NS Cloudflare, 파이프라인 가동, home https, GA. 시간 여유 + 집 네트워크 앞에서 시작할 것
(컷오버 순간부터 홈 회선/박스가 프로덕션 SPOF). 롤백은 각 단계에서 Cloudflare 레코드/Vercel 도메인을 되돌리면 됨.

1. **NPM에 Cloudflare Origin CA 인증서 설치** (proxy.5231.kr)
   - Cloudflare → SSL/TLS → Origin Server → Create Certificate → hostnames `wannysim.com`, `*.wannysim.com` → 15년.
   - 발급된 cert+key를 NPM → SSL Certificates → Add → Custom 으로 등록.
   - 홈서버 NPM에 `wannysim.com` 프록시 호스트 추가(forward `10.0.0.105:3100`, home과 동일 Custom location
     X-Forwarded 헤더 2줄) → 이 Origin CA 인증서 선택 + Force SSL.

2. **Cloudflare: apex/www를 홈서버로 + proxy on**
   - apex `wannysim.com` CNAME(→vercel)·`www` CNAME(→vercel)을 **A `1.228.10.189`로 교체하고 orange(proxied)로**.
     (또는 `home`을 CNAME 타깃으로) — 방문자 TLS는 Cloudflare 엣지가 종결.
   - SSL/TLS → Overview → **Full (strict)** 로 설정(엣지↔origin은 위 Origin CA로 검증).
   - `dev`는 그대로 grey(→Vercel) 유지.

3. **Vercel: 프로덕션 도메인 제거**
   - 블로그 프로젝트 → Settings → Domains → `wannysim.com`(+`www`) **제거**. `dev.wannysim.com` + 프리뷰는 유지.
   - Vercel이 프로덕션을 계속 빌드하면 orphan → Ignored Build Step 또는 promote 갈라치기로 정리.

4. **BASE_URL 폴백 재빌드**
   - GitHub var `NEXT_PUBLIC_BASE_URL`(현재 `https://home.wannysim.com`) **삭제** → 워크플로 폴백 `https://wannysim.com` 적용.
   - `gh workflow run promote.yml` → GHCR 재빌드 → Watchtower 반영. canonical/OG가 `https://wannysim.com`으로.

5. **검증**
   - `curl -sI https://wannysim.com/ko/blog` 200 + Cloudflare 헤더(`server: cloudflare`).
   - canonical/robots/sitemap이 `https://wannysim.com` 기준인지. GSC 도메인 속성 정상.
   - `home.wannysim.com`은 origin 직접 점검용으로 유지 권장(Cloudflare 장애 시 우회).

> **컷오버 완료(2026-07-11).** apex/www → Cloudflare(`172.67.153.229`/`104.21.4.52`, orange) → NPM(Origin CA,
> Full strict) → 홈서버. 엣지 직결 검증: `/`307, `/ko`·`/ko/blog` 200, robots/sitemap Host=`https://wannysim.com`,
> OG PNG 200, canonical `https://wannysim.com/ko`. dev는 Vercel 무중단. **Vercel 탈출 완료.**
>
> ⚠️ **함정(겪음)**: 3단계(Vercel 도메인 제거)를 로컬 리졸버 캐시 만료 전에 해서, 옛 Vercel apex IP를 캐시하던
> 클라이언트가 `DEPLOYMENT_NOT_FOUND` 404를 받음. **공용 리졸버(1.1.1.1/8.8.8.8/9.9.9.9/OpenDNS)는 이미
> Cloudflare로 전파돼 실사용 무영향**, 홈 네트워크의 AdGuard 리졸버만 stale(TTL 잔여 ~20분). 교훈: apex 전환 후
> 전파를 넉넉히 기다린 뒤 Vercel 도메인을 지울 것. 복구: AdGuard DNS 캐시 clear 또는 기기 DNS 플러시.

### Analytics (해결 완료 · 2026-07-11 — GA4 채택)

배경: `NEXT_PUBLIC_GA_ID` 미설정 + GA 컴포넌트가 `VERCEL_ENV` 게이트에 갇혀 있어 **GA가 실제로 안 붙던** 상태였음.
컷오버로 Vercel Analytics까지 꺼지면 방문 데이터 0이 되는 리스크였고, **GA4로 해결**:

- PR #477: `GoogleAnalytics`를 `VercelAnalytics`(`VERCEL_ENV` 게이트)에서 분리 → 레이아웃 게이트 밖에서 렌더.
  `NEXT_PUBLIC_GA_ID` 미설정이면 스스로 null(dev/프리뷰 오염 없음). 회귀 방지 테스트 포함.
- GA4 속성 생성 + var `NEXT_PUBLIC_GA_ID=G-XYYH688J4W` → promote 재빌드 → 홈서버 gtag 반영 + 실시간 수집 확인.
- 주의: 광고/추적 차단기가 `/g/collect` 비콘을 막아 로컬 브라우저에선 실시간에 안 잡힐 수 있음(시크릿탭/휴대폰데이터로 검증).

**향후 옵션(미도입)**: Speed Insights는 `web-vitals`→GA4 커스텀 이벤트(0-인프라). 더 필요해지면 Umami(쿠키리스, 기존
postgres:16 재사용, ~50MB) 또는 PostHog self-host(Cloud01, ARM64/11.7GB — replay·에러추적 올인원). 개인 블로그엔
현재 GA4로 충분.

## 간헐 다운 대응 (진행 중 · 2026-08-08)

컷오버 후 blog가 간헐적으로 내려가는데 자동 복구·감지가 모두 없던 상태. 구조적 구멍:
**Docker healthcheck는 unhealthy 표시만 하고 아무 조치도 안 하며**, `restart: unless-stopped`는
프로세스 종료에만 반응한다 → 행(hang) 상태 Node는 수동 재시작 전까지 영구 다운.

- **PR #534** (`fix(blog): 프로덕션 컨테이너 자가복구·리소스 상한 추가`): autoheal 사이드카
  (unhealthy → 자동 재시작, ~90초) + `mem_limit 768m` + `NODE_OPTIONS=--max-old-space-size=512`
  (OOM 시 이웃 컨테이너 대신 blog가 지목·부활) + json-file 로그 로테이션(디스크 포화 예방).
- **PR #535** (`feat(blog): GlitchTip 에러 트래킹 통합`): 아래 Phase 3 실행 런북 참조.

### 진단 런북 (다음 다운 시 홈서버에서)

```bash
docker inspect mumak-blog --format 'restarts={{.RestartCount}} status={{.State.Status}} health={{.State.Health.Status}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}} finished={{.State.FinishedAt}}'
free -m; df -h; dmesg -T | grep -iE 'oom|killed' | tail
docker logs mumak-blog --since 1h 2>&1 | tail -50
```

판정: `oom=true` → 메모리(상한·힙 조정 검토) / `running`+`unhealthy` → 행(autoheal이 잡아야 정상) /
`restarts=0`+`healthy`인데 외부에서 안 열림 → 컨테이너 밖(NPM·Cloudflare·공인 IP 변동. 가정용 회선이라
IP 재할당 시 Cloudflare A 레코드가 stale — DDNS 갱신 없음, 재발 시 도입 검토).

### 적용 런북 (사용자 실행, [[feedback_no_infra_api_mutations]])

1. **PR #534 머지 후**: Portainer `blog` 스택 에디터에 develop의 `apps/blog/docker-compose.yml`
   변경분 반영 → Update the stack. autoheal은 `/var/run/docker.sock` 마운트 필요(watchtower와 동일 패턴).
2. **외부 uptime 모니터** (설치 0, 5분): UptimeRobot 등에서 `https://wannysim.com/ko/blog` 3~5분 간격
   - 알림 채널 연결. 감시자는 홈서버 **밖**에 있어야 홈서버가 죽었을 때 알려줄 수 있다.
     Cloudflare Analytics의 521/522/523(origin 불달) vs 5xx(앱 에러) 구분도 즉시 쓸 수 있는 무료 데이터.

## Phase 3 — 에러 트래킹 + DB (조사 완료 · 2026-07-12)

### 에러 트래킹 / 유저 플로우 툴 조사 (여유 RAM ~1GB 제약)

| 툴                 | 최소 RAM                                            | Sentry SDK                             | 리플레이           | 라이선스         | 판정                |
| ------------------ | --------------------------------------------------- | -------------------------------------- | ------------------ | ---------------- | ------------------- |
| Sentry self-hosted | 16GB + Kafka/ClickHouse                             | O                                      | O                  | FSL              | 탈락                |
| GlitchTip          | 256–512MB, 기존 PG 재사용 O                         | O                                      | X                  | MIT              | **채택**            |
| Bugsink            | <300MB 단일 컨테이너                                | O (Next.js 소스맵 이슈 #133/#157 open) | X                  | Polyform Shield  | 차선                |
| Highlight.io       | 32GB + CH, LaunchDarkly 인수로 사실상 유지보수 중단 | X                                      | O                  | Apache 2.0       | 탈락                |
| PostHog hobby      | 8–16GB + Kafka/CH, 공식 "셀프호스트 비추천"         | X                                      | O                  | MIT              | 탈락                |
| OpenReplay         | 8GB 최소(미만이면 안 뜸)                            | X                                      | O                  | ELv2             | 탈락                |
| Rybbit             | ~2GB (ClickHouse 필수)                              | X                                      | O                  | AGPL             | RAM 증설 후 재고    |
| Umami              | ~256–512MB, 기존 PG 재사용 O                        | X                                      | journeys/funnels O | MIT              | 옵션                |
| Plausible CE       | ~4GB (CH), funnel은 CE 제외                         | X                                      | X                  | AGPL             | 탈락                |
| Telebugs           | 1GB 단일 컨테이너                                   | O                                      | X                  | 상용 $299 일회성 | 무료 대안 있어 skip |

- **에러 트래킹: GlitchTip** — `@sentry/nextjs` DSN만 교체, sentry-cli 소스맵 업로드 그대로. 5.2+부터 Valkey/Redis 선택사항(`VALKEY_URL` 비우면 Postgres가 캐시/celery 겸임) → **컨테이너 1개 + 기존 postgres:16 재사용**. 2026-03에 6.1 릴리즈, 활발.
- **유저 플로우**: GA4의 경로 탐색으로 일단 충분. 더 원하면 Umami 추가(journeys/funnels/retention, 기존 PG 재사용, 합계 ~1GB 예산 내). **세션 리플레이는 현 RAM에선 현실 후보 없음**(유일 후보 Rybbit도 CH ~2GB) → RAM 증설 시 재검토.

### GlitchTip 배포 런북 (사용자 실행 · 코드 절반은 PR #535로 완료)

앱 코드는 PR #535에 들어감: `instrumentation.ts`(서버, `onRequestError`) + `instrumentation-client.ts`
(브라우저) + 에러 바운더리 `captureException`. DSN 미설정이면 전부 no-op이라 먼저 머지해도 안전.

1. postgres 컨테이너 콘솔: `CREATE ROLE glitchtip LOGIN PASSWORD '<pw>'; CREATE DATABASE glitchtip OWNER glitchtip;`
2. Portainer에 `glitchtip` 스택 — 공식 문서 확인 결과(2026-08-08) 단일 컨테이너 공식 지원:
   - `GLITCHTIP_EMBED_WORKER=true` (= `SERVER_ROLE=all_in_one`, 웹+celery worker 한 프로세스)
   - `VALKEY_URL=""` (빈 문자열 → Postgres가 task queue/cache/session 겸임, 5.2+)
   - 필수 env: `DATABASE_URL=postgres://glitchtip:<pw>@postgres:5432/glitchtip`, `SECRET_KEY`(랜덤),
     `GLITCHTIP_DOMAIN`, `EMAIL_URL`(콘솔 출력이면 `consolemail://`), `DEFAULT_FROM_EMAIL`
   - 마이그레이션은 자동 실행. 이미지 `glitchtip/glitchtip`
3. NPM 프록시 호스트(LAN 전용이면 Cloudflare 미경유) → 웹 UI에서 조직/프로젝트 생성 → DSN 복사
4. `gh variable set NEXT_PUBLIC_SENTRY_DSN --body "<dsn>"` → promote 재빌드(다음 그린 커밋 또는
   `gh workflow run promote.yml`) — [[project_next_public_env_requires_promote_rebuild]]
5. 검증: 사이트에서 강제 에러(존재하는 위젯 콘솔) 또는 `Sentry.captureMessage` 임시 호출로 이벤트 수신 확인

### DB 구축 (GlitchTip이 첫 소비자)

- 기존 `postgres:16-alpine` 재사용. 새 컨테이너 없음.
- runbook(사용자 실행, [[feedback_no_infra_api_mutations]]): postgres 컨테이너 콘솔에서 `CREATE ROLE glitchtip ... ; CREATE DATABASE glitchtip OWNER glitchtip;` → Portainer에 `glitchtip` 스택(웹+worker 겸용 1컨테이너, `DATABASE_URL`은 도커 네트워크로 postgres 연결) → NPM 프록시 호스트(예: `glitchtip.5231.kr`, LAN 전용이면 Cloudflare 미경유).
- 블로그 자체 DB(`mumak_blog`)는 **런타임 데이터가 생길 때** 같은 방식으로 추가 — 첫 후보는 view count/reactions처럼 git으로 못 하는 것.

### about/now DB 전환 — 보류 판정

- 블로그는 완전 SSG(922 routes, ISR 없음) → DB 전환은 해당 라우트를 dynamic/ISR로 바꾸는 아키텍처 변경 동반.
- **결정적 문제: dev.wannysim.com + PR 프리뷰는 Vercel** — 홈서버 LAN의 postgres에 접근 불가. 프리뷰용 DB 노출/이중화 비용이 페이지 2개 가치를 초과.
- now.mdx 변경 빈도 낮고, git push → promote → watchtower(~10분)가 이미 "발행 버튼" 역할. 전환 실익 없음.
- DB로 갈 콘텐츠는 "자주 바뀌고 재빌드가 아까운 런타임 데이터"부터. about/now는 마지막.

### admin 앱 — 보류

- about/now가 MDX/git에 남는 한 admin이 관리할 대상이 없음. view count/reactions도 admin 불필요.
- 실제 필요가 생기면: `apps/admin`을 **Cloudflare에 노출하지 않고 LAN/wireguard 전용**으로 배포(공개 repo여도 코드 노출은 무해, 시크릿은 env). 그 전까지 스캐폴딩 금지.

## Phase 3+ — 점진 확장 (잔여)

- **로그**: Loki 스택 추가 → 기존 grafana에 datasource만 연결.
- **이미지 업로드**: 전용 볼륨 or MinIO. `content/`·`public/`에 쓰지 말 것(이미지 레이어는 사실상 read-only). (후순위로 미룸 · 2026-07-12)

## 놓치기 쉬운 것 / 리스크

1. **DNS/인증서 핸드오프**가 유일하게 되돌리기 껄끄러운 단계 — 테스트 호스트 검증 후 순차 진행.
2. ~~프로덕션 이관 시 Vercel Analytics 소실~~ **해결**: GA4 채택·검증 완료(PR #477 + `G-XYYH688J4W`). Analytics 섹션 참조.
3. **발행 = 재빌드+재배포** 파이프라인 — Vercel promote만큼 쉽게 트리거돼야 함.
4. **시크릿 2곳**(Vercel 프리뷰 + Portainer 프로덕션) 동기화.
5. GHCR 인증 2곳: CI push(`GITHUB_TOKEN` packages:write) / Portainer pull(read PAT).
6. 롤백은 `:<sha>` 태그로.
7. 홈 회선/박스가 프로덕션 SPOF — Cloudflare 캐싱이 완화.

## 열린 항목 (재개 시 확인)

- [x] GHCR 토큰 정리 (2026-07-10) — read 전용 `ghcr-mumak-read`(`read:packages`) 발급, Portainer GHCR 레지스트리와 Watchtower 둘 다 이 read 토큰으로 교체. push는 `ghcr-mumak-blog-push`(`write:packages`, 랩탑 수동 push 전용) + CI는 `GITHUB_TOKEN`. 공용 read 토큰은 Vaultwarden 보관.
- [x] promote.yml에 GHCR 빌드·push 스텝 추가 (이 브랜치, 2026-07-10) — main 반영 후 활성화
- [x] GHCR 패키지 `mumak-blog`에 repo Actions access(Write) 부여 (2026-07-10) — CI `GITHUB_TOKEN` push 가능
- [x] promote.yml + Docker 파일 → **develop 머지 완료** (PR #474 squash, 2026-07-10). GitGuardian pass(시크릿 노출 없음). plan.md는 히스토리에서 제거·gitignore 없이 로컬 untracked로만 유지.
- [x] **release 1.9.0으로 파이프라인 활성화 + E2E 검증 완료 (2026-07-10)** — PR #475(main, merge commit) + 태그 `1.9.0` + back-sync PR #476. back-sync 머지로 develop HEAD가 바뀌자 CI/E2E 그린 → **자동 promote가 발동해 GHCR login/build/push 전부 success**(run 29101976757), 중복 트리거는 idempotency guard가 정확히 skip(run 29101988178). 홈서버 200 OK. 파이프라인 설계대로 동작 확인.
- [x] GitHub Variables 등록 (2026-07-10): `NEXT_PUBLIC_NAVER_TOKEN` + 전환기용 `NEXT_PUBLIC_BASE_URL=http://home.wannysim.com` (GA/GSC는 프로덕션에도 미설정 — 위 runbook 참조)
- [x] **NS Cloudflare 이관 + home https** (2026-07-11) — zone Active, LE 인증서 + Force SSL, canonical https 반영.
- [x] **Analytics GA4** (2026-07-11) — PR #477(게이트 분리) + `NEXT_PUBLIC_GA_ID=G-XYYH688J4W`, 실시간 수집 확인.
- [x] **컷오버 완료 (2026-07-11)** — Origin CA + NPM apex 프록시 호스트 → Cloudflare apex/www orange + Full(strict) → Vercel 프로덕션 도메인 제거 → BASE_URL var 삭제 재빌드(canonical `https://wannysim.com`) → 엣지 검증 전부 통과. 로컬 AdGuard stale 캐시 404 해프닝 포함(런북에 기록). **Vercel 탈출 완료.**
- [x] **release 1.9.1 — promote 개편 활성화 + 실증 (2026-07-11)** — PR #478(Vercel 스텝 제거 + develop|main 이중 배포 소스) → PR #479(main, merge commit) + 태그 `1.9.1` + back-sync #480. **main발 첫 promote 성공**(run 29130482823, `:849cf0f` push). hotfix 직접 머지 경로 실증 완료.
- [x] **Vercel Ignored Build Step (2026-07-11)** — Custom: `[ "$VERCEL_GIT_COMMIT_REF" = "main" ] && exit 0 || exit 1`. release main push 빌드가 **CANCELED**로 skip되고 브랜치 프리뷰는 정상 빌드 — 실검증 통과. orphan 문제 종결.
- [x] **`home` → `blog.wannysim.com` 전환 (2026-07-11)** — 새 LE 인증서(토큰 Roll 재발급, Vaultwarden 보관) + Proxy Host 단일 운용(Advanced `return 301`). 301 경로보존·인증서·http 진입 검증 완료. 상세는 상단 상태 블록.
- [x] `home` 잔재 정리 (2026-07-11) — Cloudflare A `home` 레코드 삭제 + NPM 옛 `home.wannysim.com` LE 인증서 삭제.
- [x] 집 LAN DNS flip-flop 해소 (2026-07-11) — DNS 캐시 정리로 해결. (재발 시: NS 위임 캐시 문제, AdGuard 컨테이너 재시작.)
- [x] **간헐 다운 대응 + GlitchTip 가동 (2026-08-08 완료)** — PR #534(자가복구·리소스 상한, 스택 반영됨) + #535(SDK) + #536(sharp exports 픽스) + #537(DSN Dockerfile ARG 기본값) 전부 머지·배포.
      GlitchTip 스택 가동(`glitchtip.wannysim.com`, 호스트 8060, EMBED_WORKER + PG 겸임, 가입 잠금),
      클라이언트 테스트 이벤트 수신 실증. 외부 uptime 모니터(텔레그램 알림)도 가동.
      **근본 원인 판명: 다운 = watchtower 이미지 교체 순간의 ~10초 공백** (모니터 Down 20:04 = watchtower
      updated 11:04Z 일치). 배포당 짧은 blip은 수용 결정. 무중단이 필요해지면 블루-그린 검토.
      함정 2개 기록: (1) promote.yml은 workflow_run이라 **main 정의로 실행** — develop의 build-arg 추가는
      다음 release 전까지 무효, DSN은 Dockerfile ARG 기본값으로 우회(main 도달 시 vars가 override).
      (2) Next 16.3의 sharp 0.35+는 package.json subpath export 제거 — Dockerfile 검증 스니펫 수정(#536).
- [ ] GSC(Search Console)에서 색인·sitemap 상태 며칠 모니터링 (도메인 속성은 DNS TXT 기반이라 그대로 유효).
- [x] ~~미사용 Vercel 시크릿 삭제~~ → **의도적 보관 결정(2026-08-08)** — 나중에 Vercel로 돌아올 가능성 대비. 워크플로 참조 0이라 방치 리스크는 토큰 자체의 유효기간뿐.
- [ ] Phase 1에 노출된 GHCR write PAT·Portainer 토큰 rotate 최종 점검(공용 read는 이미 정리).
- [x] Portainer에 `mumak-blog-watchtower` 스택 배포 (2026-07-10) — `GHCR_READ_PAT` env 주입. 감시 스코프 `mumak-blog` 컨테이너. **이미지는 `nickfedor/watchtower`** (containrrr는 아카이브+Docker 29 비호환). 로그 정상 — `Watchtower 1.19.0 using Docker API v1.52`, 5분 스케줄 확인. CI GHCR push는 main 반영 후라 그전까진 대기 상태(no-op).
- [x] Spotify 시크릿 — Portainer `blog` 스택 env에 3종 등록(런타임 주입이라 재빌드 불필요), `/api/spotify/now-playing` 정상 응답 확인 (2026-07-09)
- [x] `home.wannysim.com` DNS — A 레코드를 사설 IP → 공인 IP `1.228.10.189`로 교정, **외부망 http 접근 확인 완료 (2026-07-10)**. TLS는 Phase 2 Cloudflare 이관 시.
- [x] NPM 프록시 호스트 (`10.0.0.105:3100` forward + Custom location X-Forwarded 헤더) — NPM은 `proxy.5231.kr`로 접속
- [x] 로컬 Dockerfile 빌드 + 컨테이너 스모크 테스트 (2026-07-09 통과)
- [x] GHCR PAT 발급·docker login·push (`write:packages`)
- [x] Portainer GHCR 레지스트리 등록 + `blog` 스택 배포 (healthy, 2026-07-09)
- [x] 홈서버 내부망 접근 검증 (`http://10.0.0.105:3100/ko/blog` 200)
