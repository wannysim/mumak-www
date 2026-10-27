# 헤더·GraphToolbar 배치 실습

타깃 C의 원칙을 실제 배치에 옮겨 비교한다. 사용자는 비교 화면을 먼저 보고 판단하기로 했으며, 추가로 헤더의 `Wan Sim`을 제거하고 햄버거 메뉴 안에 `Home`을 두는 후보를 제안했다. 비교 후 **헤더 배치 C를 선택했다(D-018). 헤더·연결된 GraphToolbar의 제품 이전을 구현했으며 검증 결과는 아래에 기록한다**이다.

## 사용자 선택

사용자는 처음에 C가 좋아 보인다고 평가했고, 뒤로 버튼이 있는 영역은 새 헤더가 아니라 Garden GraphToolbar의 별도 배치 재현이라는 설명을 확인한 뒤 “C가 좋구나”라고 선택했다. 헤더의 이름을 제거하고 모바일 메뉴 첫 항목에 Home을 두며, 데스크톱에는 Home 링크를 직접 표시하는 방향을 채택한다. 이번 확인의 기기와 구체적인 선호 이유는 추가로 보고되지 않았으므로 실기기 검증 완료로 기록하지 않는다.

첫 제품 이전 단위는 헤더 Navigation·MobileMenu·모바일 검색과 공유 SwitcherDropdown, 이를 함께 쓰는 GraphToolbar 및 ThemeSwitcher placeholder다. 공유 `IconButton`으로 이 연결된 배치를 함께 이전한다. 나머지 아이콘 소비처는 적용 현황에서 미이전으로 계속 추적한다. 메뉴를 먼저 열어야 하는 Home 접근과 4px 간격에서의 오탭은 실제 제품에서 재검토할 조건이다.

## 비교 조건

| 후보               | 홈 진입                                      | 아이콘 타깃 | 헤더 오른쪽 간격 |
| ------------------ | -------------------------------------------- | ----------- | ---------------- |
| A 현재 구성        | Wan Sim 링크                                 | 28px        | 8px              |
| B 이름 유지 + 44px | Wan Sim 링크                                 | 44px        | 4px              |
| C Home을 메뉴로    | 모바일 메뉴 첫 항목 Home, 데스크톱 Home 링크 | 44px        | 4px              |

헤더 높이는 모두 64px, 아이콘 그림 크기는 유지한다. B/C의 시각적 표면은 28px이며 타깃 공간을 레이아웃에 확보한다. GraphToolbar 전환 버튼은 A 28px, B/C 44px, 간격은 모두 4px다. 뒤로 버튼의 표면은 기존 36px를 유지하고 B/C 타깃만 44px로 넓힌다. 최초 타깃 실습의 C와 이번 헤더 후보 C는 별도 선택이다.

A→B는 타깃과 필요한 공간 재배치를, B→C는 이름과 홈 진입 위치를 비교한다. C의 메뉴 안 `Home`은 사용자 제안에 따라 ko/en에서 같은 표기를 사용한다. 메뉴가 없는 데스크톱에는 Home을 직접 보여주는 안을 준비했다. 브랜드 이름은 홈 본문 미리보기에 남겨 헤더 제거와 사이트 전체 제거를 구분한다.

## 조작과 관찰

- 시작 화면 아홉 번째 링크 또는 **Learning / Header layout / Compare**.
- 모바일 화면 폭 그대로 렌더링한다. 타깃 영역 표시를 켜서 표면과 실제 클릭 범위를 구분한다.
- 메뉴의 Home·Blog·Garden, 검색의 예제 페이지와 그래프 뒤로 버튼을 누르면 해당 후보 안의 본문 미리보기가 바뀐다. 외부 페이지로 이동하지 않는다.
- 테마·언어 메뉴는 Storybook globals를 바꿔 모든 후보에 같은 조건을 적용한다. 제품의 System 테마 선택과 실제 locale 라우팅은 실습 범위 밖이다.
- 관찰: 가장자리를 눌렀을 때의 편의성, 홈으로 돌아가는 과정, 이름이 없어진 뒤 여백과 사이트 식별. Home을 메뉴 안으로 옮기는 모바일 후보는 메뉴를 먼저 열어야 하므로 조작 단계가 하나 늘어난다.

## 구현 경계

`stories/header-layout-preview.tsx`가 공유 Button·Sheet·Dropdown·Command를 합성한다. 서버 컴포넌트 Navigation이나 제품 GraphToolbar를 그대로 렌더링한 것은 아니다. 기존 레이아웃 치수와 반응형 전환을 재현하며, 페이지·검색은 fixture다. 검색의 데스크톱 단축키 표기·실제 검색 인덱스·그래프 캔버스·hydration placeholder는 재현하지 않는다. 제품 소비처는 D-018에 따라 별도로 이전했으며, B/C 미리보기는 제품과 같은 공유 IconButton을 사용한다.

44px 표현은 공유 `IconButton`으로 승격했다. 스토리의 `LabIconButton`은 A의 기존 Button과 B/C의 공유 IconButton을 선택하는 비교 어댑터다. 내비게이션 메뉴와 popup은 하나의 native button에 Radix의 ref·이벤트·aria 상태를 연결하고 안쪽 표면은 비조작 span이다. 포커스는 실제 타깃 경계에 표시한다. 제품의 SwitcherDropdown·MobileMenu·ThemeSwitcher·모바일 SiteSearch·GraphToolbar가 같은 표현을 사용한다. 헤더의 skeleton도 변경한 공간을 확보한다.

## 검증과 한계

브라우저 검사는 320/390/640/768/1280px에서 B/C 타깃 크기·비중첩·컨테이너 경계·좌우 그룹 간격을 확인한다. ko/en × Light/Dark, 메뉴 Home의 active 상태, 검색·메뉴를 닫은 뒤 포커스, 터치 가장자리 실행과 globals 전환을 다룬다.

초기 검사에서 검색 Dialog의 모바일/데스크톱 두 Trigger가 같은 Radix ref를 공유해 숨겨진 버튼으로 포커스를 돌리는 실습 결함을 발견했다. 닫힐 때 현재 보이는 트리거로 복귀하도록 수정했다.

Chromium 모바일 에뮬레이션에서는 4px 간격 중앙의 touch 입력이 인접 언어 버튼을 실행하는 경우를 관찰했다. 코드에 확장 overlay는 없으며, 타깃 bounding box 비중첩과 DOM hit test는 별도 검사한다. 브라우저의 touch 보정 가능성이 있으므로 빈 공간에 대한 pointer 검사와 touch 검사를 구분한다. **비중첩 통과를 실제 손가락 오탭이 없다는 보증으로 사용하지 않는다.** 4px 간격의 편의성은 사용자 실기기 비교 후 재검토한다.

검증 결과: blog 타입 검사·lint·포맷 검사 통과(lint 기존 경고 9개), 단위 테스트 111개 suite / 1,080개 test 통과, `validate:design` 160개 파일 통과. 시작 안내와 새 헤더 실습의 Playwright 18개 검사 및 Storybook 정적 빌드가 통과했다. 제품 라우팅·실제 보조기술 발화·모든 브라우저·실기기 사용성 검증은 이 실습의 자동 검사만으로 완료 처리하지 않는다.

## D-018 제품 이전 검증

제품에 Home 경로를 추가하면서 `/` 활성 판정을 정확히 일치하는 경우로 제한했다. 모바일 메뉴 닫기와 첫 Home 링크가 겹치지 않도록 닫기 아래에 공간을 확보했다. 기본 Button과 다른 앱, 나머지 아이콘 소비처는 변경하지 않았다. 새 IconButton의 native ref·Enter/Space·disabled·Radix popup 상태/포커스 복귀를 단위 검사하고, 실제 제품의 ko/en·Light/Dark·320–1280px 배치·Home 이동·메뉴/검색·switcher·GraphToolbar를 E2E로 검사한다. 검증에서 제품 검색을 닫을 때 포커스가 복귀하지 않는 결함을 발견했다. CommandDialog·SearchPalette에 선택적인 focus hook을 전달하고, SiteSearch가 클릭으로 연 버튼과 단축키 원점을 기억해 복귀하도록 수정했다. 열린 상태에서 반응형 트리거가 사라지면 현재 보이는 검색 버튼을 사용한다. 이때 다른 CommandDialog 소비처의 기본 동작은 바꾸지 않는다.

GraphControls는 타깃 36px를 유지하되 위쪽 간격을 8px 확보하고 검색 아이콘에 접근 가능한 이름을 추가했다. Home은 헤더 전용 번역 키를 사용해 기존 breadcrumb·JSON-LD의 한국어 ‘홈’을 유지한다.

최종 검증 결과:

- blog 타입·lint·포맷·`validate:design`(160개 파일), 공유 UI lint·포맷 통과. 기존 lint 경고는 유지한다.
- 전체 단위 112 suites / 1,089개 통과. 이후 검색 포커스·번역 범위 보완 후 관련 65개, 마지막 pointer 복귀 보완 후 검색 관련 20개를 다시 실행해 통과했다.
- Storybook 시작 안내·헤더 비교 18개와 정적 빌드 통과. 제품 Next 빌드 통과.
- 제품 ko/en × Light/Dark 8개 시나리오를 Chromium·Firefox·WebKit에서 실행해 24개 모두 재시도 없이 통과했다. 320/390/640/768/1280px 타깃·비중첩·Home 경로/active·메뉴 닫기/포커스·검색 pointer/shortcut/양방향 breakpoint 복귀·테마/언어 전환·GraphToolbar 인접 간격을 포함한다.
- 기존 Home·Navigation·i18n·Graph Chromium 회귀 66개 통과.
- LAN 제품 미리보기에서 모바일/데스크톱·Light/Dark를 직접 확인했다. Chromium 터치 에뮬레이션의 메뉴 가장자리 탭·Home 이동·테마 변경 통과, page error 0건. 실제 휴대폰·스크린리더 검증과 나머지 미이전 소비처는 완료 범위가 아니다.

PR #639의 첫 CI에서는 Codecov patch 47.05%가 기준 80%에 미달했다. 기존 검색 단위 테스트가 CommandDialog를 대체하면서 autofocus callback을 실행하지 않은 것이 원인이었다. 실제 Dialog·검색·단축키를 연결한 포커스 회귀 9개를 추가했다. JSDOM에서는 대상별 가시성만 대체하며 클릭·단축키·원점 초기화·body·원점 제거·양방향 breakpoint 복귀를 검사한다. 추가 후 전체 단위 113 suites / 1,098개 통과, SiteSearch line coverage 98.18%, function coverage 100%를 확인했다. 실제 CSS breakpoint와 브라우저 포커스는 위 E2E 결과로 구분한다.
