# 다음 정거장

출퇴근 중 짧은 프론트엔드 면접 연습을 위한 개인 공간. 공개 메뉴에 연결하지 않으며 서버의 접속 키 인증과 검색 제외를 적용한다. 자료는 자체 제작 연습 문제이며 실제 채용 시험 문제가 아니다.

## 화면 설계

- 색: 안개색 `#F4F7FB`, 남색 `#172B4D`, 파랑 `#375BEB`, 살구 `#F3B760`, 흰색 `#FFFFFF`, 보조 글자 `#61718A`.
- 서체: 로컬 Pretendard. 코드는 시스템 고정폭 글꼴.
- 데스크톱: 왼쪽 탐색 → 오늘의 시간 선택과 추천 연습 → 학습 경로.
- 모바일: 한 열 콘텐츠 + 엄지로 누르기 쉬운 하단 탐색. 문제에서 다음 행동은 하단에 배치.
- 이동 중: 선택형 코드 읽기, 생각하고 답 확인, 경력 답변 메모. 책상에서는 JavaScript 코드 작성·테스트 실행.
- 모든 수치는 실제 저장 기록에서 계산. 빈 상태를 가짜 기록으로 채우지 않는다. 짧은 시간에도 완료 경험을 주되, 타이머 종료가 답안을 지우지 않는다.

## 실행과 비공개 설정

`pnpm --filter interview setup:local`은 기존 설정을 덮어쓰지 않고 `.env.local`과 `.local-access-key`(권한 600)를 만든다. 둘 다 Git에서 제외된다. 기본 주소는 `http://localhost:3008`이다. `pnpm --filter interview build` 후 `pnpm --filter interview start`로 실행하고 키 파일의 내용으로 로그인한다. 개발 주소를 쓰려면 생성 시 `INTERVIEW_ORIGIN=http://interview.mumak.localhost:1355`를 지정한다.

배포 환경에는 다음 서버 전용 값을 직접 설정한다. `NEXT_PUBLIC_` 접두사는 사용하지 않는다.

| 변수                                   | 값                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `INTERVIEW_ORIGIN`                     | 실제 HTTPS origin. 경로·쿼리·후행 슬래시 없음                          |
| `INTERVIEW_TOKEN_SHA256`               | 무작위 32바이트 이상 접속 키의 SHA-256 hex                             |
| `INTERVIEW_SESSION_SECRET`             | 별도로 생성한 무작위 32바이트 hex                                      |
| `INTERVIEW_STORE_KEY`                  | 환경별 고유 Redis key. 운영·개발·테스트 분리                           |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis 서버 전용 REST 주소·토큰 (`UPSTASH_REDIS_REST_*`도 지원) |

설정이 없거나 잘못되면 접근을 차단한다. 7일간 HttpOnly 세션을 유지하며 로그아웃하면 쿠키를 삭제한다. 키/비밀값 회전 시 기존 세션은 무효다. 공개 링크를 숨기거나 robots.txt만으로 비공개를 보장하지 않는다. 외부 공개 시 HTTPS 및 호스팅 측 요청 제한을 함께 설정한다. Vercel 프로젝트 `mumak-www-interview`의 Root Directory는 `apps/interview`, Node.js는 24.x다. 설치는 `pnpm install --filter interview... --frozen-lockfile`, 빌드는 `cd ../.. && pnpm turbo run build --filter=interview`를 사용한다. `.vercelignore`로 로컬 비밀 파일을 배포 업로드에서도 제외한다.

## 기록과 코드 실행

동일한 개인 접속 키로 로그인한 모든 기기는 하나의 서버 기록을 공유한다. 풀이·코드·메모·타이머를 Upstash Redis에 저장하며 TTL을 두지 않는다. `INTERVIEW_STORE_KEY`는 접속 키와 독립적이라 키를 교체해도 기록이 유지된다. 저장소는 무료 플랜, Tokyo 리전, eviction/autoUpgrade/prodPack 비활성화로 구성했다.

- 800ms 입력 디바운스, 서버의 원자적 revision 비교로 오래된 기기의 전체 덮어쓰기 차단. 응답이 유실된 쓰기는 동일 ID로 재시도한다.
- 화면 복귀·온라인 복귀·보이는 동안 30초 간격으로 동기화. 충돌 시 초안을 보관하고 서버 기록/이 기기 기록 중 사용자가 선택한다.
- 열린 화면에서 통신이 끊기면 localStorage outbox에 초안 보관. Web Locks로 탭별 outbox 소유권을 잠가 복제 탭 덮어쓰기를 방지하고 닫힌 탭의 미전송 초안을 복구한다. 읽을 수 없는 outbox는 원본을 건드리지 않고 건너뛰며, 이 기기 기록을 읽지 못한 상태에서는 서버 기록을 이 기기 기록으로 교체할 수 없다.
- 서비스 워커는 없다. 완전히 오프라인인 상태에서 웹사이트를 처음 열거나 HTML까지 새로 불러오는 기능은 지원하지 않는다. 최신 Safari/Chrome 등 Web Locks 지원 브라우저가 필요하다.
- 백업 가져오기와 초기화는 계정 전체 기록을 바꾼다. 로그아웃은 기기의 초안을 삭제하지 않는다. 로컬 URL의 이전 기록은 기록 탭에서 백업 후 운영 URL에서 가져온다.

근거: [Upstash REST](https://upstash.com/docs/redis/features/restapi), [Durable Storage](https://upstash.com/docs/redis/features/durability), [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

코드 실행은 `allow-scripts`만 허용한 opaque-origin iframe 안의 Blob Worker에서 수행한다. 네트워크는 CSP로 차단하며 실행은 2초 후 중단한다. React/TypeScript 컴파일러가 아닌 JavaScript 함수 연습이다. 지원 브라우저에서 실제 테스트를 실행하지만 보안 평가용 런타임이나 채점 서버는 아니다.

근거: [MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox), [Blob Worker의 CSP 상속](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy).

## 검증

`pnpm --filter interview check-types`, `lint`, `format:check`, `test:ci`, `build`, `test:e2e` 순으로 확인한다. E2E는 3008 포트에서 빌드 결과를 시작하며 실제 자격 증명 대신 테스트 전용 환경을 주입한다.

## 검증 범위 (2026-11-01)

- TypeScript, Oxlint, Oxfmt, 프로덕션 빌드, 앱 범위 Knip.
- 인증·입력 검증·API 권한/장애·25개 문제의 실제 채점기 단위 테스트 51개. 원본 노드 대신 복사본 반환, 잘못된 tail/prev, 작업을 실행하지 않은 가짜 결과 등의 오답도 거부하는지 검증한다.
- Chromium, WebKit 데스크톱, iPhone 설정 WebKit 전체 102건 통과 후 2MB/저장/백업 관련 18건 및 tail 삭제 채점 관련 3건 재검증 통과(새 용량 경계 3건 포함): 로그인, 풀이·타이머·메모, 코드 실행/제한, 백업, 저장 공간 부족, 손상된 기록, 기기 간 동기화, 동시 수정 충돌, API 장애 중 초안 복구, 탭 복제 회귀.
- 실제 Upstash에서 저장·재조회, CAS 충돌 409, 같은 요청 재시도, 개발 기록 복원 확인. UI 동기화 회귀 테스트는 제어 가능한 API fixture를 사용하므로 실제 DB 점검과 별개다.
- Firefox는 이 Mac의 브라우저 시작 오류로 검증하지 못했다. CI 프로젝트는 유지한다. 모바일 WebKit 검증은 실물 iPhone 검증이 아니다.

## 추가 검증 (2026-11-02)

- TypeScript, Oxlint, Oxfmt, 프로덕션 빌드, Jest 63개 통과.
- `CI=1` 전체 매트릭스(Chromium·Firefox·WebKit 데스크톱·iPhone 설정 WebKit) 각 47개, 총 188개 E2E 통과(재시도 0). 새 채점 사례, 손상 outbox·오프라인 복구, 코드 북마크·복습 필터, 모바일 코드·메모 전용 초안의 데스크톱 이어가기를 포함한다. 이 Mac에서 Firefox도 실행됐다.
- 결함 재주입: 채점 수정 3건(최초 이벤트 객체 참조, 최소 포함 창 왼쪽 동률, 트리 3레벨)을 되돌리면 해당 단위 테스트 3개가, outbox 복구 수정을 되돌리면 새 sync E2E 3개가, 읽을 수 없는 outbox 보호를 되돌리면 sync E2E 2개가 실패한다.
- 27개 모범답안의 공개 채점 사례 115개 확인. 신규 중간 단계 윈도우 2문제는 길이 0~4 입력 완전탐색 1,573개와 대표 오답 회귀로 검증한다.
- Chromium 320·390·768·1440px에서 이어가기·학습 경로·코드 화면 가로 넘침 없음. 실물 휴대폰 키보드 검증은 아니다.
- E2E는 테스트 전용 진행 API fixture를 사용한다. 운영 Redis·학습 기록을 사용하거나 배포하지 않았다.

## 문제와 설명 연습

27개 코드 문제를 9개 분야·기본/실전/심화로 분류한다. 기초 몸풀기(합계 누적·Set) 다음 슬라이딩 윈도우 5단계와 연결 리스트 6단계는 순서대로 학습하는 경로를 제공한다. 각 문제의 계약·입출력 예시·경계 조건·힌트·정답·복잡도·추가 질문을 확인하고, 화이트보드 텍스트 메모에 노드/상태 변화와 설명을 남길 수 있다. 코드와 메모는 기존 서버 기록과 함께 저장한다. 오늘 화면의 ‘코드·메모 이어가기’에서 작성한 코드나 화이트보드 메모가 있는 문제를 바로 열 수 있다(교육 과정 순서로 최대 3개, 최근 작업순 아님). 코드 문제도 실행 없이 ‘다시 보기’에 저장하고 분야·난이도로 복습 목록을 좁힐 수 있다.

[조사 근거와 범위](docs/curriculum-research.md)에 공식 자료, 난이도 선정 이유, 실제 출제와의 구분을 기록했다. 외부의 확정되지 않은 출제 빈도를 표시하지 않는다. JSX 렌더링·자유 그림판·복잡도 자동 증명은 지원하지 않는다.

## 재배포

이 앱 전용 Vercel 프로젝트에 연결한 저장소 루트에서 다음을 실행한다. CLI가 앱 디렉터리의 리전 설정도 읽도록 경로를 명시한다. 프로젝트 기본 함수 리전도 `hnd1`로 설정한다.

```sh
vercel deploy --prod --yes --archive=tgz --local-config apps/interview/vercel.json
```

운영 인증/DB 값은 Vercel의 Production 환경에만 설정하며 Preview에는 운영 기록을 연결하지 않는다. Git 자동 배포 연결은 설정하지 않았다. PR 병합과 별개로 위 명령으로 검증된 소스를 배포한다. 롤백은 Vercel의 이전 정상 배포를 복원하되, 새 문제 기록을 모르는 이전 버전은 엄격한 스키마 검증으로 읽기를 거부할 수 있으므로 기능 확장 전후 데이터 호환성을 먼저 확인한다.

운영 주소: https://mumak-www-interview.vercel.app
