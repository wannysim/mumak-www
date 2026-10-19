# Storybook 실습 공간

2026-10-15. Figma 파일이 없는 현재 상황에서, 실제 제품 코드로 규칙과 상태를 관찰하는 학습 공간을 만든다(D-012).

## 실행

```bash
pnpm --filter blog storybook
```

[시작 화면](http://127.0.0.1:6006/?path=/story/start-welcome--welcome)을 연다. 시작 화면의 링크 또는 왼쪽 목록으로 이동한다. Language 도구는 ko/en, 상단 Theme 메뉴는 Light/Dark를 바꾼다. 테마는 Storybook의 내장 globals로 관리하며 다른 스토리나 시작 화면 링크로 이동해도 유지된다. 테마 전환은 컴포넌트 미리보기에 적용된다.

Light/Dark는 별도 스토리나 component prop으로 두지 않는다(D-013). 사이드바는 Playground·Disabled·Invalid·Title Only 등 의미 있는 상태를 구분한다. 추가 theme addon 없이 기존 `.dark` CSS와 전역 decorator를 연결했다. 같은 화면에서 테마를 바꿔도 입력한 Controls와 버튼 실행 횟수는 유지된다.

| 메뉴                        | 할 수 있는 것                                             | 실제 원천                               |
| --------------------------- | --------------------------------------------------------- | --------------------------------------- |
| Start / Welcome             | 실습 순서와 범위를 확인하고 각 화면으로 이동              | `stories/start.stories.tsx`             |
| Foundations / Focus         | 독립 token의 역할·현재 CSS 값·실제 키보드 표시 확인       | `packages/ui/src/styles/globals.css`    |
| Components / Button         | variant·size·문구·disabled·invalid 변경, 클릭·키보드 실행 | `@mumak/ui/components/button`           |
| Components / Content card   | 제목 길이·설명·태그 유무 변경, 제목→태그 포커스 이동      | `src/shared/ui/content-card.tsx`        |
| Learning / Focus comparison | 이전 A와 실제 적용 B 비교                                 | 기존 포커스 실습                        |
| Learning / Button contrast  | A/B/C와 A/B/D 비교·실시간 글자 대비·실제 상태             | 실제 Button + 실습 전용 색 후보         |
| Learning / Button loading   | 문구·spinner·너비 유지 비교, 대기·실패·재시도             | 실제 Button + 실습 전용 요청 시뮬레이션 |
| Learning / Button focus     | 여섯 variant·오류·asChild·disabled를 함께 관찰            | 기존 포커스 검증 fixture                |

Controls 변경은 미리보기만 바꾸며 제품 소스를 수정하지 않는다. 카드 링크는 실습 이탈을 막고 실행 결과를 알린다. 실제 라우팅은 제품 E2E의 책임이다. button `label`과 card `title`을 비우면 현재 언어의 예제 문구를 사용한다.

## 경계

- 설정은 `apps/blog/.storybook/`, 예제는 `apps/blog/stories/`에 둔다. 제품 라우트·배포에 포함하지 않는다.
- Storybook을 위해 별도 제품 컴포넌트나 token 생성 계층을 추가하지 않는다. 예제용 `LabPage`는 Storybook 화면의 공통 골격이며 제품 API가 아니다.
- CSS 값은 브라우저에서 읽으므로 테마와 함께 바뀐다. 별도 token 사본을 만들지 않는다.
- 전체 UI 카탈로그·독립 앱·호스팅·CI job은 아직 만들지 않는다. 현재 소비자인 Button·ContentCard에서 관찰과 검증을 쌓는다.
- Figma Variables·component 구축 경험은 후속 미완이다. Storybook으로 해당 역량을 완료했다고 간주하지 않는다.
- 기본 주황색 버튼은 비교 후 D 기본색+E hover를 제품에 적용했다(D-014). A/B/C·D/E의 이전 비교는 학습 이력으로 보존한다. [실습 기록](./button-contrast-lab.md) 참조. 다른 component의 자체 focus override와 Button 밖의 reduced-motion은 남아 있다.

## 검증

```bash
pnpm --filter blog test:storybook
pnpm --filter blog build-storybook
```

`test:focus`는 기존 명령 호환을 위해 같은 Storybook 테스트 스위트를 실행한다. 테스트 서버는 자체 6007 포트를 쓰고 개발용 6006과 분리한다. 시작 화면 진입·실습 링크·Controls·컴포넌트 상호작용·ko/en·모바일 폭을 검사하고 기존 포커스 회귀 검사도 함께 실행한다. 접근성 addon은 관찰용이며 모든 접근성 검증을 통과했다는 의미가 아니다.

브라우저 테스트 서버는 `STORYBOOK_BROWSER_TEST=1`로 addon의 자동 axe 실행을 제외한다. Playwright의 명시적 axe 검사와 동시에 실행되는 충돌을 막기 위한 설정이며, 일반 6006 개발 서버와 정적 build에서는 addon을 유지한다.

2026-10-15 검증: Storybook 브라우저 테스트 16개(기존 포커스 6개 + 학습 공간 10개), 정적 Storybook 빌드, blog 타입·lint·format·단위 테스트 111 suites / 1,080개, `validate:design`이 통과했다. lint에는 기존 경고 9개가 남는다. 리뷰에서 발견한 시작 안내문 대비 부족은 `text-foreground`로 수정하고 ko/en × Light/Dark 모바일 axe 검사로 확인했다. 전역 테마 전환·스토리 이동 시 테마 유지·전환 시 Controls와 컴포넌트 상태 유지도 확인했다. 이번 확장은 제품 컴포넌트·라우트를 수정하지 않아 제품 전체 E2E는 다시 실행하지 않았다. 이전 포커스 적용의 제품 E2E 결과는 [포커스 실습 기록](./focus-lab.md)에 있다.

Controls는 Storybook의 [args](https://storybook.js.org/docs/writing-stories/args)와 [argTypes](https://storybook.js.org/docs/api/arg-types), 테마는 [Toolbars & globals](https://storybook.js.org/docs/essentials/toolbars-and-globals)로 구성한다. 학습 순서·다음 판단 항목의 정본은 [NEXT.md](./NEXT.md)다.

2026-10-16 버튼 대비 실습 추가: 시작 화면의 다섯 번째 링크 또는 **Learning / Button contrast / Compare**에서 연다. 후보 색은 이 스토리의 CSS 범위 안에서만 적용한다. Dark는 세 안 모두 제품 색을 유지한다. 실시간 측정은 단색 바탕·배경 alpha·disabled opacity를 합성하며 disabled는 통과/실패 판정을 하지 않는다. Storybook 브라우저 테스트는 기존 16개 + 비교 실습 9개로 총 25개다. 검증 결과와 한계는 [버튼 대비 실습 기록](./button-contrast-lab.md)에 둔다.

같은 날 사용자 첫 관찰 이후 **Refine** 스토리에 A·B·D를 추가했다. 시작 화면의 다섯 번째 링크는 현재 후속 비교인 Refine으로 이어진다. Compare에는 최초 A·B·C를 보존한다. 두 스토리의 상태·테마·모바일 검사를 합쳐 브라우저 테스트 34개가 통과했다. 제품 적용은 사용자 선택 이후다.

이후 D의 Light hover가 약하다는 관찰에 따라 **Hover** 스토리에서 D/E를 비교한다. 시작 링크도 Hover로 옮겼다. D/E는 기본색이 같고 hover 배경만 다르다. 터치 탭 뒤 hover가 남던 실습 결함은 hover 가능 기기에서만 색·상태를 적용하도록 수정했다. 색 비교와 별도로 pressed·reduced-motion 판단이 남는다. 제품 적용은 아직 하지 않았다.

E 추가와 터치 수정 후 Storybook 브라우저 검사 **44개 통과**. Hover 스토리의 모바일 axe는 D/E 모두 포함한다. 과거 A 비교의 알려진 대비 미달만 별도 예외로 남는다. 재현 테스트는 수정 전 2개 실패, 수정 후 같은 2개 통과로 확인했다.

2026-10-16 제품 반영: 사용자 승인으로 default Button에 D 기본색+E hover와 독립 버튼 역할 token을 적용했다. `Components / Button / Playground`에서 variant를 default로 바꾸면 실제 결과를 볼 수 있다. A는 “적용 전”으로 표시하고 비교 당시 색을 유지한다. Button은 reduced-motion에서 전환을 생략한다. 과거 문단의 미적용·미결정 표기는 그 시점의 이력이며 현재 결정은 D-014·NEXT.md가 정본이다.

제품 반영 후 검증: Storybook **49개 통과**(기존 44개 + 제품 버튼 5개), 정적 Storybook build 통과. reduced-motion에서 터치 active 해제 후 실습의 Pressed 라벨이 남는 결함도 기존 터치 검사로 잡아 수정했다. 제품 build·소비 앱 검증의 범위와 한계는 [실습 기록](./button-contrast-lab.md)에 둔다.

2026-10-19 loading 실습: 시작 화면의 여섯 번째 링크 또는 **Learning / Button loading / Compare**에서 A 문구만, B spinner+문구, C 원래 너비 유지+spinner를 비교한다. 0.3초·1.8초·5초와 성공/실패를 선택할 수 있다. 사용자는 버튼만 보고 진행 중임을 인지했고 너비 유지를 선호하여 C를 선택했다(D-015). 제품 적용은 후속이며 기존 페이지 이동 진행 막대와 공유 Button API는 그대로다. [Loading 실습 기록](./button-loading-lab.md)에 조건과 관찰·선택 근거를 둔다.

Loading 실습 추가 후 전체 Storybook 59개, 정적 Storybook build, Blog 타입·lint·format·단위 테스트 111 suites / 1,080개와 `validate:design` 통과. 기존 lint 경고 9개·build module directive 경고 유지. 검사 도구 충돌의 원인과 수정, 수동 검토 한계는 loading 실습 기록에 남겼다.
