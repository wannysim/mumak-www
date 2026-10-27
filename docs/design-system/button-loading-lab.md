# 버튼 loading 비교

> 현재 공통 계약과 제품 적용·미이전·검증 범위는 [인터랙션 계약](./interaction-contracts.md)과 [지원 현황](./support-matrix.md#7-인터랙션-적용-현황)을 참조한다. 아래 실습 결과는 당시 범위의 증거다.

2026-10-19. **원래 너비를 유지하는 C의 spinner 표현을 선택했다(D-015).** 후속으로 admin 로그인에 적용했다. 단계 1 전체 완료가 아니다. PR #634 병합 커밋 `51a500f`에서 `feature/button-loading-lab`으로 분기했다.

2026-10-20 후속 D-017: 공유 `LoadingButton`을 만들고 admin 요청 버튼 6종과 Storybook C를 이전했다. 최초 선택·로그인 적용의 기록은 보존하며, 최신 계약과 적용 범위는 위 정본을 따른다.

[Storybook 비교](http://127.0.0.1:6006/?path=/story/learning-button-loading--compare&globals=locale:ko;theme:light). 실행은 `pnpm --filter blog storybook`. 시작 화면의 여섯 번째 링크로도 연다.

## 사용자 문제와 경계

버튼을 누른 뒤 응답까지 시간이 걸리면 요청이 시작됐는지, 다시 눌러야 하는지, 대기가 끝났는지 알기 어렵다. 같은 가상 저장 작업에서 대기 표현을 비교한다. 실습의 저장은 네트워크 요청이나 데이터 변경 없이 타이머로 결과를 재현한다.

Blog에는 `src/app/providers/progress-provider.tsx`의 페이지 이동 진행 막대가 이미 있고 locale layout에 연결돼 있다. 내부 링크 클릭과 경로·쿼리 변경으로 동작하며 실측 전송률은 아니다. 이 실습은 한 버튼이 시작한 작업을 다룬다. 기존 페이지 이동 표시를 교체하거나 두 역할을 공통화하지 않는다.

## 비교 조건

| 안  | 대기 중 버튼 내용                 | 너비                                        |
| --- | --------------------------------- | ------------------------------------------- |
| A   | 저장 중…                          | 문구에 따라 변함                            |
| B   | spinner + 저장 중…                | 내용에 따라 변함                            |
| C   | spinner, 보조기술용 저장 중… 이름 | 숨긴 기존 문구의 자리를 남겨 원래 너비 유지 |

세 안 모두 실제 `@mumak/ui/components/button`의 default 색·크기·포커스·pressed를 사용한다. spinner는 lucide `LoaderCircle`이다. 대기 시간은 300/1800/5000ms, 결과는 성공/실패로 고를 수 있다. 세 안 함께 실행하거나 개별 버튼을 실행한다. 실행 중 조건 변경은 막고, 완료 후 같은 버튼으로 재시도한다.

문구와 spinner 유무 외에 너비 유지 방식도 다르므로 단일 변수 실험은 아니다. B도 공간을 미리 확보하면 너비를 유지할 수 있다. 사용자는 너비 유지와 spinner-only를 함께 선호하여 C를 선택했다. 모든 사용자·배치에서 C가 더 낫다는 결론은 아니다.

공통 동작은 비교를 위한 임시 조건이며 제품 loading 계약의 확정이 아니다.

- pending 요청은 동기 ref 잠금으로 중복 실행을 막는다. 각 후보의 시작한 요청 수를 표시한다. 완료 후 새 입력은 새 요청이다.
- 네이티브 button과 Space/Enter 동작을 유지한다. `aria-disabled`로 대기 중 사용 불가를 전달하고 이벤트 처리에서 추가 실행을 막는다. HTML `disabled`를 사용하지 않아 포커스와 Tab 접근이 남는다.
- 버튼에 `aria-busy`, 버튼 밖에 처음부터 존재하는 `role=status`·`aria-atomic=true` 영역을 둔다. A/B/C 이름을 보조기술용 상태 문구에 포함한다. spinner는 장식으로 숨기며 C에도 접근 가능한 이름을 남긴다.
- 세 안 아래에 같은 loading/성공/실패 문구를 표시한다. 상태 메시지로 포커스를 강제로 옮기지 않는다.
- reduced-motion에서는 회전을 멈춘다. C의 정적인 아이콘과 외부 상태 문구로 충분한지 사용자 관찰이 필요하다.
- Light/Dark 전환에서 진행 중 타이머·횟수·선택 조건을 유지한다. 스토리를 떠나면 타이머를 정리한다.

접근성 구현 참고: [WAI Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [ARIA22 상태 메시지](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22). 실제 스크린리더의 음성 출력은 별도 수동 검토 대상이다.

## 관찰 순서

1. 기본 1.8초에서 함께 실행: 요청이 시작됐다고 언제 이해했는가?
2. 0.3초와 5초: 짧은 깜박임, 긴 기다림, 폭 변화는 어떻게 느껴지는가?
3. Tab·Space·Enter·연속 클릭: 포커스를 찾을 수 있고 추가 요청이 막히는가?
4. 실패 후 재시도: 끝났다는 것과 다시 할 수 있다는 것이 명확한가?
5. Light/Dark·모바일·reduced-motion: 표현과 의미가 유지되는가?

표시 지연 임계값, 성공 아이콘, 취소, 서버 중복 방지, 공유 Button의 loading API는 아직 정하지 않는다.

## 사용자 판단

- C의 원래 너비 유지를 선호했다. 버튼 크기 변화가 주변 배치를 움직일 수 있다는 점을 피하고 싶다고 설명했다.
- 방금 실행한 작업은 spinner만으로도 진행 중임을 알 수 있다고 판단했다. 사용자는 아래 상태 문구를 읽은 것이 아니라 버튼만 보고 판단했다고 확인했다.
- 선택 원칙: “방금 누른 버튼의 spinner로 진행 상태를 전달하고, 상태가 바뀌어도 버튼 크기와 주변 배치를 유지한다.”
- 대안·비용·되돌릴 조건은 [D-015](./decision-log.md#d-015-버튼-loading은-원래-너비를-유지하는-spinner-표현을-선택한다)에 기록했다. 실습 화면의 아래 문구는 비교 이력으로 남긴다. 이를 보고 판단했다는 근거로 해석하지 않는다.
- PR #635의 범위는 실습과 선택 기록이었다. 이후 admin 로그인 요청 연결과 상태 알림은 아래 제품 적용 절에 기록한다. 공유 API와 reduced-motion 대체 표현의 확정은 후속 범위다.

## 검증

실습 브라우저 테스트는 실제 입력의 중복 방지·포커스·재시도, 선택한 대기 시간, 요청별 독립 횟수, C 너비 유지, ko/en × Light/Dark의 모바일 pending/실패 axe, 테마 전환 중 상태 유지, reduced-motion, 터치 입력을 다룬다. 시간은 Playwright clock으로 진행한다.

초기 검사에서 테스트 도구 간 충돌을 확인했다. clock을 완전히 멈추면 axe의 내부 타이머와 Storybook의 테마 갱신도 멈춘다. axe 검사 중에는 1ms씩 최대 1000ms까지만 시간을 진행하고, 1800ms 요청이 여전히 pending인지 다시 확인한다. 자식 frame 없는 직접 스토리 페이지의 axe는 in-page 모드(`setLegacyMode`)로 실행해 임시 페이지 종료와 context clock의 경합을 피한다. 이 모드는 cross-origin iframe 검사를 지원하지 않으므로 해당 구조의 검사에 재사용하지 않는다.

기존 대비 검사에서도 Storybook addon과 Playwright의 axe가 동시에 실행되어 `Axe is already running` 오류가 발생했다. 테스트 서버의 `STORYBOOK_BROWSER_TEST=1`에서만 addon을 제외하고 Playwright가 axe 실행을 맡는다. 일반 개발 서버·정적 build의 접근성 addon은 유지한다. 검사 대상이나 대비 기준을 완화하지 않았다. 최초 로그는 `/tmp/button-loading-storybook.log`, 중간 검사는 `/tmp/button-loading-targeted.log`다.

PR #635에서는 제품 동작과 라우트를 변경하지 않았다. 당시에는 제품 전체 E2E 대신 Storybook 브라우저 검사와 정적 Storybook build를 검증 대상으로 삼았다. 실제 기기 터치 편의성·스크린리더 음성·모든 브라우저는 자동 검사로 보장하지 않는다.

### 실행 결과

- Blog `check-types → lint → format:check → test:ci --maxWorkers=2` 통과. 단위 테스트 111 suites / 1,080개, 기존 lint 경고 9개 유지. 단위 전체 로그: `/tmp/button-loading-jest.log`.
- `test:storybook --workers=1`: **59 passed**(기존 49 + loading 10). 최종 로그: `/tmp/button-loading-storybook-final.log`.
- `build-storybook` 통과. 기존 module directive 경고 유지. 로그: `/tmp/button-loading-build.log`.
- `validate:design`: 160개 파일 통과. 이 검사는 Storybook 후보의 시각적 판단을 대신하지 않는다.
- 별도 Python Playwright로 개발 서버의 한국어 Light 기본/대기, 영어 Dark 모바일 실패 화면을 조작·캡처했다. pageerror 0건. `/tmp/button-loading-light-idle.png`, `/tmp/button-loading-light-pending.png`, `/tmp/button-loading-dark-mobile-failure.png`를 육안 확인했다.
- design-reviewer·verifier의 정적 검토에서 차단 항목 없음. 사용자 선호 판단은 위 C 선택으로 기록했으며, 실제 스크린리더 음성 검토는 미실시다.

## 제품 적용: admin 로그인

사용자가 2026-10-19 admin 로그인 적용을 선택했다. PR #635의 실습·C 선택 기록이 develop에 병합된 `913c3ad6`에서 후속 작업을 시작했다.

- 범위: `apps/admin/components/admin-session.tsx`의 로그인 제출 버튼. 기존 `w-full` 너비는 이미 고정돼 있으므로 이 화면에서 너비 흔들림 결함을 고쳤다는 뜻은 아니다. C의 spinner-only와 크기 유지 원칙을 실제 요청에 연결했다.
- 표현: 원래 문구의 공간을 남긴 채 감추고 기존 공유 `Spinner`를 가운데 겹친다. 대기 문구는 화면에 추가하지 않으며 버튼의 접근 가능한 이름과 별도 `role=status`로 전달한다. reduced-motion에서는 기존 실습과 같이 회전을 멈춘다.
- 제출: 동기 ref 잠금으로 클릭·Space·Enter·폼 제출 중복을 막는다. 대기 중에는 토큰 입력을 readOnly로 유지하고, 로그인 버튼은 aria-disabled/aria-busy로 상태를 전달하면서 포커스를 유지한다.
- 완료: 실패 메시지는 기존 상태 영역에 보이고 즉시 재시도할 수 있다. 성공하면 로그인 폼이 사라지므로 로그아웃 버튼으로 포커스를 이동한다. 초기부터 로그인된 페이지에서는 포커스를 강제로 옮기지 않는다.
- 범위 밖: 공유 Button의 loading API, 이미지 발행·로그아웃 loading, 인증 서버·쿠키 계약, Blog 페이지 진행 표시. 다른 버튼을 공통화하기 전에 실제 요구를 확인한다.
- 한계: 화면의 폭 보존과 상태 속성을 자동 검사해도 스크린리더의 실제 발화나 정적인 spinner의 인지 충분성은 보증하지 않는다. 두 항목은 수동 관찰 후 필요하면 비교 실습으로 돌아간다.

### admin 적용 검증

- `pnpm turbo run check-types --filter=admin` (의존 task인 제품 build 포함) → `lint` → `format:check` → `test:ci` 통과. lint 경고 0건, Jest 15 suites / 158개 통과. 인증 라우트·세션 회귀 검사를 포함한다.
- `CI=1 pnpm --filter admin test:e2e --workers=2 --retries=0 --reporter=line`: Chromium·Firefox·WebKit 합계 24개 통과. 로그인 pending·실패·재시도·성공, 입력/버튼 Enter·Space·포인터 중복, 크기·포커스, reduced-motion 및 기존 업로드·세션 보존을 검증했다. 지연 실패는 네트워크 interception으로 제어하고 성공 재시도는 로컬 인증 서버를 사용한다.
- Python Playwright로 기본·대기·실패, 모바일 reduced-motion을 캡처했다. 대기 화면을 육안 확인했고 pageerror 0건이었다. 실제 토큰이나 외부 인증·R2 요청은 사용하지 않았다.
- verifier 검토에서 차단 항목 없음. 실제 스크린리더 발화·사용자의 reduced-motion 인지 평가는 미실시다.

## 후속 공통화 — D-017

2026-10-20. 실제 요청의 표현이 소비처별로 복제되지 않도록 `@mumak/ui/components/loading-button`을 추가했다. 기존 Button과 Spinner를 조합하며 `loading`과 필수 `loadingLabel`을 받는다. 원래 children은 레이아웃에 남겨 너비를 유지하고, 대기 중 spinner·접근 가능한 이름·busy/disabled 의미와 클릭 차단을 제공한다. native button 전용이며 기존 Button의 `asChild` API를 바꾸지 않는다.

admin 로그인·로그아웃·발행·새로고침·더 불러오기·재시도 6종과 Storybook C를 같은 구현으로 이전했다. 폼의 직접 제출까지 막는 동기 guard와 상태 안내는 앱이 소유한다. 목록 최초 조회는 버튼 요청과 구분하고, 요청을 시작한 버튼에만 spinner를 표시한다. 실패 후 재시도 버튼을 유지하며 성공 후 버튼이 사라질 때 새로고침으로 포커스를 연결한다. 로그아웃 성공 후에는 로그인 입력으로 이동한다.

발행 단계 안내와 기존 페이지 이동 진행 표시는 유지한다. 받은 목록의 폴더 필터는 동기 동작이고, clipboard pending 모델·다른 앱의 요청 버튼은 아직 이전 범위 밖이다. 공유 API가 생겼다는 이유로 모든 앱의 loading 이전이 완료된 것은 아니다.

검증:

- admin 타입·lint·format·빌드, 단위 16 suites / 163개 통과. 공유 버튼의 ref·native form·중복 방지, 소비 요청의 성공·실패·재시도를 포함한다.
- admin E2E Chromium·Firefox·WebKit 합계 33개 통과. 로그인과 함께 발행·목록·로그아웃의 대기 너비, 포커스, 중복 요청 차단과 실패 재시도를 확인했다.
- Storybook 기존 69개 검사에 공유 구현을 사용하는 loading 비교 10개가 포함된다. C의 ko/en·Light/Dark·모바일·reduced-motion·실패 재시도 검증을 유지했다.
- JSDOM의 파일 업로드 helper와 native required 검증 간 차이로 단위 테스트의 재시도는 직접 form submit을 사용한다. 실제 파일 선택과 버튼 클릭 재시도는 위 3브라우저 E2E로 별도 확인했다.

서버 차원의 요청 중복 방지, 실제 스크린리더 발화와 정적 spinner의 인지 충분성은 이 검증의 완료 범위가 아니다. 공통 계약과 소비처 상태는 [인터랙션 계약](./interaction-contracts.md)·[지원 현황](./support-matrix.md#7-인터랙션-적용-현황)을 따른다.
