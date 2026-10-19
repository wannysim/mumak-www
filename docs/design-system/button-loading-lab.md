# 버튼 loading 비교

2026-10-19. **원래 너비를 유지하는 C의 spinner 표현을 선택했다(D-015).** 제품 적용은 후속이며 단계 1 전체 완료가 아니다. PR #634 병합 커밋 `51a500f`에서 `feature/button-loading-lab`으로 분기했다.

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
- 현재 PR 범위는 실습과 선택 기록이다. 실제 소비처의 요청 연결, 제품 상태 알림과 reduced-motion 대체 표현, 공유 API는 후속 범위다.

## 검증

실습 브라우저 테스트는 실제 입력의 중복 방지·포커스·재시도, 선택한 대기 시간, 요청별 독립 횟수, C 너비 유지, ko/en × Light/Dark의 모바일 pending/실패 axe, 테마 전환 중 상태 유지, reduced-motion, 터치 입력을 다룬다. 시간은 Playwright clock으로 진행한다.

초기 검사에서 테스트 도구 간 충돌을 확인했다. clock을 완전히 멈추면 axe의 내부 타이머와 Storybook의 테마 갱신도 멈춘다. axe 검사 중에는 1ms씩 최대 1000ms까지만 시간을 진행하고, 1800ms 요청이 여전히 pending인지 다시 확인한다. 자식 frame 없는 직접 스토리 페이지의 axe는 in-page 모드(`setLegacyMode`)로 실행해 임시 페이지 종료와 context clock의 경합을 피한다. 이 모드는 cross-origin iframe 검사를 지원하지 않으므로 해당 구조의 검사에 재사용하지 않는다.

기존 대비 검사에서도 Storybook addon과 Playwright의 axe가 동시에 실행되어 `Axe is already running` 오류가 발생했다. 테스트 서버의 `STORYBOOK_BROWSER_TEST=1`에서만 addon을 제외하고 Playwright가 axe 실행을 맡는다. 일반 개발 서버·정적 build의 접근성 addon은 유지한다. 검사 대상이나 대비 기준을 완화하지 않았다. 최초 로그는 `/tmp/button-loading-storybook.log`, 중간 검사는 `/tmp/button-loading-targeted.log`다.

제품 동작과 라우트는 변경하지 않는다. 제품 전체 E2E 대신 Storybook 브라우저 검사와 정적 Storybook build를 검증 대상으로 삼는다. 실제 기기 터치 편의성·스크린리더 음성·모든 브라우저는 자동 검사로 보장하지 않는다.

### 실행 결과

- Blog `check-types → lint → format:check → test:ci --maxWorkers=2` 통과. 단위 테스트 111 suites / 1,080개, 기존 lint 경고 9개 유지. 단위 전체 로그: `/tmp/button-loading-jest.log`.
- `test:storybook --workers=1`: **59 passed**(기존 49 + loading 10). 최종 로그: `/tmp/button-loading-storybook-final.log`.
- `build-storybook` 통과. 기존 module directive 경고 유지. 로그: `/tmp/button-loading-build.log`.
- `validate:design`: 160개 파일 통과. 이 검사는 Storybook 후보의 시각적 판단을 대신하지 않는다.
- 별도 Python Playwright로 개발 서버의 한국어 Light 기본/대기, 영어 Dark 모바일 실패 화면을 조작·캡처했다. pageerror 0건. `/tmp/button-loading-light-idle.png`, `/tmp/button-loading-light-pending.png`, `/tmp/button-loading-dark-mobile-failure.png`를 육안 확인했다.
- design-reviewer·verifier의 정적 검토에서 차단 항목 없음. 사용자 선호 판단은 위 C 선택으로 기록했으며, 실제 스크린리더 음성 검토는 미실시다.
