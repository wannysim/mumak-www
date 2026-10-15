# Storybook 실습 공간

2026-10-15. Figma 파일이 없는 현재 상황에서, 실제 제품 코드로 규칙과 상태를 관찰하는 학습 공간을 만든다(D-012).

## 실행

```bash
pnpm --filter blog storybook
```

[시작 화면](http://127.0.0.1:6006/?path=/story/start-welcome--welcome)을 연다. 시작 화면의 링크 또는 왼쪽 목록으로 이동한다. Language 도구는 ko/en, 상단 Theme 메뉴는 Light/Dark를 바꾼다. 테마는 Storybook의 내장 globals로 관리하며 다른 스토리나 시작 화면 링크로 이동해도 유지된다. 테마 전환은 컴포넌트 미리보기에 적용된다.

Light/Dark는 별도 스토리나 component prop으로 두지 않는다(D-013). 사이드바는 Playground·Disabled·Invalid·Title Only 등 의미 있는 상태를 구분한다. 추가 theme addon 없이 기존 `.dark` CSS와 전역 decorator를 연결했다. 같은 화면에서 테마를 바꿔도 입력한 Controls와 버튼 실행 횟수는 유지된다.

| 메뉴                        | 할 수 있는 것                                             | 실제 원천                            |
| --------------------------- | --------------------------------------------------------- | ------------------------------------ |
| Start / Welcome             | 실습 순서와 범위를 확인하고 각 화면으로 이동              | `stories/start.stories.tsx`          |
| Foundations / Focus         | 독립 token의 역할·현재 CSS 값·실제 키보드 표시 확인       | `packages/ui/src/styles/globals.css` |
| Components / Button         | variant·size·문구·disabled·invalid 변경, 클릭·키보드 실행 | `@mumak/ui/components/button`        |
| Components / Content card   | 제목 길이·설명·태그 유무 변경, 제목→태그 포커스 이동      | `src/shared/ui/content-card.tsx`     |
| Learning / Focus comparison | 이전 A와 실제 적용 B 비교                                 | 기존 포커스 실습                     |
| Learning / Button focus     | 여섯 variant·오류·asChild·disabled를 함께 관찰            | 기존 포커스 검증 fixture             |

Controls 변경은 미리보기만 바꾸며 제품 소스를 수정하지 않는다. 카드 링크는 실습 이탈을 막고 실행 결과를 알린다. 실제 라우팅은 제품 E2E의 책임이다. button `label`과 card `title`을 비우면 현재 언어의 예제 문구를 사용한다.

## 경계

- 설정은 `apps/blog/.storybook/`, 예제는 `apps/blog/stories/`에 둔다. 제품 라우트·배포에 포함하지 않는다.
- 새 token이나 제품 컴포넌트를 추가하지 않는다. 예제용 `LabPage`는 Storybook 화면의 공통 골격이며 제품 API가 아니다.
- CSS 값은 브라우저에서 읽으므로 테마와 함께 바뀐다. 별도 token 사본을 만들지 않는다.
- 전체 UI 카탈로그·독립 앱·호스팅·CI job은 아직 만들지 않는다. 현재 소비자인 Button·ContentCard에서 관찰과 검증을 쌓는다.
- Figma Variables·component 구축 경험은 후속 미완이다. Storybook으로 해당 역량을 완료했다고 간주하지 않는다.
- 기본 주황색 버튼 글자 대비, 다른 component의 자체 focus override, reduced-motion은 후속이다.

## 검증

```bash
pnpm --filter blog test:storybook
pnpm --filter blog build-storybook
```

`test:focus`는 기존 명령 호환을 위해 같은 Storybook 테스트 스위트를 실행한다. 테스트 서버는 자체 6007 포트를 쓰고 개발용 6006과 분리한다. 시작 화면 진입·실습 링크·Controls·컴포넌트 상호작용·ko/en·모바일 폭을 검사하고 기존 포커스 회귀 검사도 함께 실행한다. 접근성 addon은 관찰용이며 모든 접근성 검증을 통과했다는 의미가 아니다.

2026-10-15 검증: Storybook 브라우저 테스트 16개(기존 포커스 6개 + 학습 공간 10개), 정적 Storybook 빌드, blog 타입·lint·format·단위 테스트 111 suites / 1,080개, `validate:design`이 통과했다. lint에는 기존 경고 9개가 남는다. 리뷰에서 발견한 시작 안내문 대비 부족은 `text-foreground`로 수정하고 ko/en × Light/Dark 모바일 axe 검사로 확인했다. 전역 테마 전환·스토리 이동 시 테마 유지·전환 시 Controls와 컴포넌트 상태 유지도 확인했다. 이번 확장은 제품 컴포넌트·라우트를 수정하지 않아 제품 전체 E2E는 다시 실행하지 않았다. 이전 포커스 적용의 제품 E2E 결과는 [포커스 실습 기록](./focus-lab.md)에 있다.

Controls는 Storybook의 [args](https://storybook.js.org/docs/writing-stories/args)와 [argTypes](https://storybook.js.org/docs/api/arg-types), 테마는 [Toolbars & globals](https://storybook.js.org/docs/essentials/toolbars-and-globals)로 구성한다. 학습 순서·다음 판단 항목의 정본은 [NEXT.md](./NEXT.md)다.
