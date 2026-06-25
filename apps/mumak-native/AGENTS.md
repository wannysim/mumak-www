# apps/mumak-native — AGENTS.md

Expo (React Native + expo-router) 앱. 공통 규칙은 루트 [`AGENTS.md`](../../AGENTS.md) 참조.

---

## 디렉터리 구조

Expo 템플릿 기본 구조를 따른다. FSD는 도입하지 않는다 (모바일 화면 단위가 비교적 작아서 과한 추상화).

```
apps/mumak-native/
├── app/                  # expo-router file-based routes
│   ├── _layout.tsx       # root stack + AppProviders + ErrorBoundary re-export
│   ├── +not-found.tsx    # 매칭 안 되는 경로의 404 화면
│   └── (tabs)/           # tab group
│       ├── _layout.tsx
│       ├── index.tsx
│       └── explore.tsx
├── components/           # 재사용 컴포넌트
│   ├── providers.tsx     # provider 합성 루트 (GestureHandler·SafeArea·Theme)
│   ├── error-boundary.tsx# expo-router route ErrorBoundary fallback
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   └── ui/               # 더 작은 primitive
├── hooks/                # 커스텀 hook
├── constants/            # 색·폰트·고정값
│   ├── theme.ts          # Colors·Fonts 단일 출처
│   └── env.ts            # 타입·검증을 거친 EXPO_PUBLIC_* 접근자 (Env)
├── assets/               # 이미지·폰트
├── e2e/                  # Playwright 웹 E2E (web export 대상)
├── maestro/              # Maestro 네이티브 E2E (실기기/에뮬 + 빌드 필요)
│   ├── config.yaml
│   └── flows/            # smoke.yaml 등 플로우
├── metro.config.js       # pnpm monorepo 호환 설정
├── playwright.config.ts  # 웹 E2E 설정 (PORT 3003)
├── jest.config.mjs
└── jest.setup.ts
```

규칙:

- `app/` 하위는 라우트 전용. 라우트 외 컴포넌트는 `components/`로 옮긴다.
- 파일명은 kebab-case (`themed-text.tsx`). FSD `ui/` 예외(PascalCase)는 적용하지 않는다.
- 더 큰 화면 단위 단위는 `app/{section}/_layout.tsx` 또는 expo-router 그룹(`(group)/`)으로 분리한다.

---

## 라우팅 (expo-router)

파일 기반 라우팅. 컨벤션:

- `app/index.tsx` → `/`
- `app/(tabs)/foo.tsx` → 탭 그룹 안의 `/foo`
- `app/[id].tsx` → 동적 라우트
- `app/_layout.tsx` → 부모 레이아웃 (Stack/Tabs/Drawer)
- `app/modal.tsx` → modal presentation (root `_layout.tsx`에서 `presentation: 'modal'` 지정)

이동:

```typescript
import { useRouter, Link } from 'expo-router';

// 컴포넌트 안
const router = useRouter();
router.push('/explore');
router.replace({ pathname: '/[id]', params: { id: '42' } });

// JSX 안
<Link href="/explore">탐색으로</Link>;
```

타입 안전 라우트는 `app.json`의 `experiments.typedRoutes: true`로 활성화돼 있다. `.expo/types/router.d.ts`가 자동 생성된다.

---

## 앱 골격 (provider 루트 · 에러 바운더리)

`app/_layout.tsx`는 화면을 직접 렌더하지 않고 **`AppProviders`**(`components/providers.tsx`)로 감싼 뒤 `Stack`만 둔다. 새 전역 provider가 필요하면 루트 레이아웃이 아니라 `AppProviders` 안에 추가한다 — provider 합성은 한 군데에서만 한다.

현재 합성 순서: `GestureHandlerRootView` → `SafeAreaProvider` → `ThemeProvider`. (`GestureHandlerRootView`는 `flex: 1`이 필수라 최상단.)

라우트 에러는 `components/error-boundary.tsx`의 `ErrorBoundary`(expo-router `ErrorBoundaryProps` 시그니처)가 받는다. `app/_layout.tsx`가 이걸 `export { ErrorBoundary }`로 재노출하면 expo-router가 해당 세그먼트의 에러 바운더리로 사용한다. 특정 세그먼트만 다른 fallback이 필요하면 그 세그먼트의 `_layout.tsx`에서 별도 `ErrorBoundary`를 export한다.

매칭되지 않는 경로는 `app/+not-found.tsx`가 받는다. 웹 export에서도 `/+not-found` static route로 생성된다.

---

## 컴포넌트 패턴

- **DOM 엘리먼트 금지**: `<div>`, `<span>`, `<button>` 등 사용 불가.
- `react-native` primitive 사용: `View`, `Text`, `Pressable`, `ScrollView`, `Image`.
- 가능하면 Expo 모듈 우선: `expo-image` (`<Image>` 대신), `expo-router`, `expo-haptics`, `expo-symbols`.
- 함수 컴포넌트 + named export. props는 `React.ComponentProps<>`로 RN primitive 타입을 확장.

```typescript
import { View, type ViewProps } from 'react-native';

function ThemedView({ style, ...props }: ViewProps & { variant?: 'card' | 'plain' }) {
  // ...
}

export { ThemedView };
```

`app/` 하위 라우트 파일만 default export (expo-router 요구사항).

---

## 스타일링

- **Tailwind / shadcn / `@mumak/ui` 금지**. 웹 전용.
- 기본은 `StyleSheet.create` + RN `style` prop. 인라인 객체는 동적 값에만.
- 다크모드는 `useColorScheme()` + `Colors[scheme]` 또는 `useThemeColor()` hook 경유. `constants/theme.ts`의 `Colors`가 단일 출처.

```typescript
import { StyleSheet, View, Text } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

function PostCard({ title }: { title: string }) {
  const background = useThemeColor({}, 'background');
  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: '600' },
});
```

---

## 상태 관리

- 기본은 React 자체(`useState`, `useReducer`, Context). 추가 라이브러리 도입 전 두 번 생각한다.
- 비동기/서버 상태가 생기면 `@tanstack/react-query` 우선 (web 앱과 동일 패턴).
- 글로벌 클라이언트 상태가 생기면 `zustand` 우선 (가벼움). Redux는 도입하지 않는다.
- 어떤 라이브러리든 도입 시 이 파일에 결정 기록을 남긴다.

---

## 공유 로직

- 플랫폼 무관 로직(`hooks`, `utils`, `types`, `api`)은 `@mumak/shared`에서 가져온다.
- 새 공유 로직이 필요하면 `packages/shared/src/{hooks,utils,types,api}/` 아래 추가하고 거기서 import한다.
- web 전용 로직(`@mumak/ui`, `next/*`, `react-dom`, DOM 글로벌)은 절대 import하지 않는다.
- 동작 레퍼런스: `constants/env.ts`가 `@mumak/shared/types/app-environment`의 `isAppEnvironment`(런타임 함수)를 소비한다. 이 경로가 Metro 해석·pnpm symlink·tsconfig path를 모두 통과하므로, 새 공유 모듈을 추가할 때 import 패턴 기준으로 삼는다.

---

## 환경 변수

- 런타임에 클라이언트로 노출되는 값은 `EXPO_PUBLIC_*` 접두어를 붙인다 (Expo가 빌드 시 inline).
- 시크릿(API key 등)은 EAS Secrets 또는 서버 사이드 경유로 처리. 클라이언트 번들에 박지 않는다.
- 로컬 개발용 env는 `.env.local` (gitignore됨).
- **컴포넌트에서 `process.env.EXPO_PUBLIC_*`를 직접 읽지 말고 `constants/env.ts`의 `Env`를 통한다.** `Env`는 import 시점에 값을 검증(예: `EXPO_PUBLIC_APP_ENV`가 enum 밖이면 throw)하므로 오설정을 부팅 시 빠르게 드러낸다.
- 새 공개 env가 생기면 (1) `.env.example`에 주석으로 추가, (2) `AppEnv` 타입과 `Env`에 필드 추가, (3) 검증 로직은 순수 함수로 분리해 colocate 테스트(`constants/__tests__/env.test.ts` 패턴)로 덮는다. `process.env.EXPO_PUBLIC_*`는 babel이 transform 타임에 inline하므로, 런타임 `process.env` 변경에 의존하는 테스트는 피한다.

---

## 테스트

### 현재 상태

- Jest + `jest-expo` 프리셋, `@testing-library/react-native`, `react-test-renderer` 설치 완료.
- `jest.setup.ts`에 `react-native-reanimated`/`expo-router`/`expo-haptics`/`react-native-gesture-handler`/`react-native-safe-area-context` 기본 mock.
- **단위 테스트 실행 가능** — `themed-text`/`themed-view`/`use-theme-color` colocate 테스트 + coverage threshold baseline 적용. `test:ci`에서 `--passWithNoTests` 제거됨.
- 웹 E2E는 Playwright(`expo export --platform web` 정적 export 대상). 실행 순서는 `README.md` 검증 섹션 참조.

### 알려진 이슈 — jest 30 충돌 (해소됨)

`jest-expo` + `jest ^30` + `pnpm` 조합에서 모든 테스트가 setup 단계에서 죽던 문제는 **jest 29 다운그레이드로 해소**되었다(`jest` `^29.7.0`, `@types/jest` `^29.5.14`). mumak-native 워크스페이스만 영향, web 앱(blog/mumak-next/mumak-react)은 jest 30 유지.

근본 원인(히스토리 — 다음 SDK bump 시 jest 30 재평가 단서):

> `ReferenceError: ... import a file outside of the scope of the test code`(winter polyfill 발화)는 증상이고, 직접 원인은 **두 jest 런타임 충돌**. `node_modules/jest-expo/package.json`의 deps(`@jest/globals`, `babel-jest`, `jest-snapshot` 등)가 전부 `^29.2.1`로 핀되어 jest-expo가 자체 트리에 jest 29 런타임을 끌고 들어오는데, 앱 레벨 jest 30 runner는 그 트리 밖이라 `isInsideTestCode` 검사가 깨진다. jest-expo는 SDK 56까지 jest 29 핀 유지 → 당분간 "jest 29 = jest-expo의 정답". jest-expo가 jest 30을 지원하면 복귀 검토.

### 테스트 작성 컨벤션

- 위치: 소스와 colocate된 `__tests__/` 폴더.
- 파일명: `{소스파일}.test.{ts,tsx}`.
- selector는 접근성 기반: `getByRole`, `getByLabelText`, `getByText` 우선. `testID`는 마지막 수단.
- 새 `expo-*` 모듈이나 native module을 컴포넌트가 쓰면 `jest.setup.ts`의 mock을 확장한다.

### 네이티브 E2E (Maestro)

웹 E2E(Playwright)와 별개로, 실제 네이티브 런타임을 검증하는 스모크는 Maestro로 둔다.

- 위치: `maestro/config.yaml` + `maestro/flows/*.yaml`. 실행: `pnpm --filter mumak-native test:e2e:native` (= `maestro test maestro/`).
- 현재 플로우: `flows/smoke.yaml` — 부팅 → `Home` 헤더 확인 → `tab-explore` 탭 → `Second tab placeholder.` 확인 → `tab-home` 복귀. 부팅 + `AppProviders` 트리 + expo-router 탭 내비게이션이 살아있는지를 한 번에 막는 회귀 안전망.
- **셀렉터**: 화면 본문은 텍스트로 단언하되, **탭 바는 텍스트가 아니라 `id`(tabBarButtonTestID)로 탭한다.** 탭 라벨은 아이콘+라벨·안전영역 때문에 텍스트 매칭이 불안정하다. `tab-home`/`tab-explore` id는 (1) `app/(tabs)/_layout.tsx`의 `Tabs.Screen` options, (2) `flows/smoke.yaml`, (3) `tab-layout.test.tsx`(계약 고정) 세 곳이 일치해야 한다.
- 공통 전제: 앱이 **자체 bundle id(`com.example.mumaknative`)로 설치된 빌드**여야 한다. Expo Go(`host.exp.exponent`)로는 안 된다. `appId`는 `app.json`의 `ios.bundleIdentifier`/`android.package`와 항상 일치시킨다.

로컬 (iOS, 검증됨):

1. `pnpm --filter mumak-native exec expo run:ios` — 디버그 빌드를 시뮬레이터에 설치하고 Metro를 띄운다. (`expo run:ios`는 `ios/`를 prebuild로 생성한다 — gitignore됨. 이때 prebuild가 `package.json`의 `ios`/`android` 스크립트를 `run:*`로 덮으면 되돌린다. 기본값은 Expo Go용 `expo start --*` 유지.)
2. Maestro CLI + Java 설치 (CLI는 JVM 앱이라 Java 필수). 공식 설치: `curl -fsSL https://get.maestro.mobile.dev | bash`.
3. `pnpm --filter mumak-native test:e2e:native`.

CI (Android): `.github/workflows/maestro.yml` — `expo prebuild` + Gradle **release APK(JS 번들 내장)** 를 Android 에뮬레이터(reactivecircus/android-emulator-runner)에 설치해 돌린다. EAS 계정 불필요. PR #447에서 1회 실측 통과 검증함.

- **게이팅(의도적 보수)**: PR 필수 체크가 아니다. 콜드 빌드+에뮬레이터로 ~30분이라 PR마다 돌리기엔 무겁다. `workflow_dispatch` + main push(native paths)에서만 돈다. 필요해지면 `pull_request` 편입을 재검토한다.
- **release APK를 쓰는 이유**: 디버그 APK는 런타임에 Metro에서 JS를 받는데, CI에선 번들 로드 타이밍 때문에 검은 화면으로 flaky했다. release 빌드는 JS를 내장(standalone)해 Metro/`adb reverse` 없이 결정적으로 뜬다. Expo 템플릿 release buildType은 기본 debug 키스토어로 서명하므로 키스토어 설정 불필요.
- macOS 러너(iOS) 대신 ubuntu(Android)를 쓴다 — 비용 10배 차이.

- 새 핵심 플로우(로그인, 딥링크 등)가 생기면 `flows/`에 파일을 추가하고 `tags`로 분류한다.

### Coverage threshold

- 실제 테스트가 돌기 시작하면 측정치 기준으로 baseline을 박고 점진 상향한다 (blog 패턴 참고).

---

## Web 빌드

- `pnpm web` 으로 `expo start --web` 가능. 루트에서는 `pnpm --filter mumak-native web`을 사용한다. `react-native-web`을 통해 RN primitive가 DOM으로 렌더된다.
- `pnpm export:web`(`expo export --platform web --output-dir dist`)으로 정적 export. 루트에서는 `pnpm --filter mumak-native export:web`을 사용한다. 이 산출물은 **번들 스모크 + 웹 E2E의 토대**다(시뮬레이터 없이 클라우드에서 검증 가능).
- 웹 E2E는 `apps.yml` `hasE2E: true`로 `e2e.yml`에 편입(chromium/firefox/webkit). 실 배포는 아직 계획 없음.
- web 전용 분기가 필요하면 `*.web.ts` 파일명 컨벤션 사용 (e.g. `hooks/use-color-scheme.web.ts`).

---

## 빌드 / 배포

- 앱 디렉터리에서는 `pnpm dev`(또는 `pnpm start`)로, 루트에서는 `pnpm --filter mumak-native dev`로 Expo dev server를 기동.
- **실제 네이티브 빌드는 EAS Build의 영역**. CI(`pnpm build`)는 의도적 no-op이다.
- TestFlight / Internal Testing 도입 시점에 `eas.json` + EAS workflow 추가.

CI 검증 대상: `lint` · `format:check` · `check-types` · `test:ci` · `build`(no-op) + 웹 E2E(`test:e2e`, `hasE2E: true`).

---

## Metro 설정

`metro.config.js`는 pnpm 모노레포 호환:

- `watchFolders`: workspace 루트.
- `nodeModulesPaths`: 앱 로컬 + workspace 루트.
- `unstable_enableSymlinks` + `unstable_enablePackageExports`: pnpm 심볼릭 링크 해석.
- **`disableHierarchicalLookup`은 켜지 말 것** — Expo 공식 가이드에서 pnpm store 패키지 해석을 막아 phantom dep 에러를 유발한다고 명시. 현재 Expo는 pnpm isolated 모드를 지원하므로 hoist 설정도 불필요.

새 워크스페이스 패키지를 추가했는데 Metro가 못 찾으면 이 파일을 우선 의심한다.

---

## 자주 묻는 함정

- **`react-native-vector-icons` 직접 import 금지** — `@expo/vector-icons` 경유.
- **`Image` 컴포넌트** — `react-native`의 것보다 `expo-image`가 캐싱·blur·placeholder 면에서 우수.
- **AsyncStorage** — 도입 시 `@react-native-async-storage/async-storage`. Expo는 더 이상 자체 storage 안 제공.
- **screen size / safe area** — `react-native-safe-area-context`의 `useSafeAreaInsets`. 노치 / Dynamic Island 대응.
