# apps/mumak-native — AGENTS.md

Expo (React Native + expo-router) 앱. 공통 규칙은 루트 [`AGENTS.md`](../../AGENTS.md) 참조.

---

## 디렉터리 구조

Expo 템플릿 기본 구조를 따른다. FSD는 도입하지 않는다 (모바일 화면 단위가 비교적 작아서 과한 추상화).

```
apps/mumak-native/
├── app/                  # expo-router file-based routes
│   ├── _layout.tsx       # root stack
│   ├── (tabs)/           # tab group
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── explore.tsx
│   └── modal.tsx
├── components/           # 재사용 컴포넌트
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   └── ui/               # 더 작은 primitive
├── hooks/                # 커스텀 hook
├── constants/            # 색·폰트·고정값
├── assets/               # 이미지·폰트
├── metro.config.js       # pnpm monorepo 호환 설정
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

---

## 환경 변수

- 런타임에 클라이언트로 노출되는 값은 `EXPO_PUBLIC_*` 접두어를 붙인다 (Expo가 빌드 시 inline).
- 시크릿(API key 등)은 EAS Secrets 또는 서버 사이드 경유로 처리. 클라이언트 번들에 박지 않는다.
- 로컬 개발용 env는 `.env.local` (gitignore됨). 코드 안에서는 `process.env.EXPO_PUBLIC_XXX`로 접근.

---

## 테스트

### 현재 상태

- Jest + `jest-expo` 프리셋, `@testing-library/react-native`, `react-test-renderer` 설치 완료.
- `jest.setup.ts`에 `react-native-reanimated`/`expo-router`/`expo-haptics` 기본 mock.
- **`test:ci`는 `--passWithNoTests`로 통과 중**. 실제 테스트 실행은 아직 막혀 있다.

### 알려진 이슈

`jest-expo ~54` + `jest ^30` + `pnpm` 조합에서 Expo의 winter polyfill이 lazy로 등록하는 globals
(`__ExpoImportMetaRegistry`, `structuredClone` 등)의 getter가 jest 셋업 단계에서 발화하며
`Runtime._execModule`이 `isInsideTestCode === false` 검사에서 던지는 에러로 죽는다.

```
ReferenceError: You are trying to `import` a file outside of the scope of the test code.
  at .../expo/src/winter/runtime.native.ts:20
```

첫 실제 테스트를 작성하기 전에 해소해야 한다. 후보:

1. `jest`를 v29로 다운그레이드 (해당 워크스페이스만 override).
2. `setupFiles`(setupFilesAfterEnv 아님)에서 winter polyfill 전부 pre-define.
3. `jest-expo` 업스트림 패치 / 더 새 버전 적용.

### 테스트 작성 컨벤션 (해소 후)

- 위치: 소스와 colocate된 `__tests__/` 폴더.
- 파일명: `{소스파일}.test.{ts,tsx}`.
- selector는 접근성 기반: `getByRole`, `getByLabelText`, `getByText` 우선. `testID`는 마지막 수단.
- 새 `expo-*` 모듈이나 native module을 컴포넌트가 쓰면 `jest.setup.ts`의 mock을 확장한다.
- E2E (Detox/Maestro)는 별도 PR로 도입 예정.

### Coverage threshold

- 실제 테스트가 돌기 시작하면 측정치 기준으로 baseline을 박고 점진 상향한다 (blog 패턴 참고).

---

## Web 빌드

- `pnpm web` 으로 `expo start --web` 가능. `react-native-web`을 통해 RN primitive가 DOM으로 렌더된다.
- 현재 web 빌드는 **CI 검증 대상이 아니다**. web 산출물을 실제 배포할 계획이 생기면 `expo export --platform web` 검증 step을 `ci.yml`에 추가한다.
- web 전용 분기가 필요하면 `*.web.ts` 파일명 컨벤션 사용 (e.g. `hooks/use-color-scheme.web.ts`).

---

## 빌드 / 배포

- `pnpm dev`(또는 `pnpm start`)로 Expo dev server 기동.
- **실제 네이티브 빌드는 EAS Build의 영역**. CI(`pnpm build`)는 의도적 no-op이다.
- TestFlight / Internal Testing 도입 시점에 `eas.json` + EAS workflow 추가.

CI 검증 대상: `lint` · `format:check` · `check-types` · `test:ci` · `build`(no-op) 5단계.

---

## Metro 설정

`metro.config.js`는 pnpm 모노레포 호환:

- `watchFolders`: workspace 루트.
- `nodeModulesPaths`: 앱 로컬 + workspace 루트.
- `disableHierarchicalLookup`: pnpm isolated linker 호환.
- `unstable_enableSymlinks` + `unstable_enablePackageExports`: pnpm 심볼릭 링크 해석.

새 워크스페이스 패키지를 추가했는데 Metro가 못 찾으면 이 파일을 우선 의심한다.

---

## 자주 묻는 함정

- **`react-native-vector-icons` 직접 import 금지** — `@expo/vector-icons` 경유.
- **`Image` 컴포넌트** — `react-native`의 것보다 `expo-image`가 캐싱·blur·placeholder 면에서 우수.
- **AsyncStorage** — 도입 시 `@react-native-async-storage/async-storage`. Expo는 더 이상 자체 storage 안 제공.
- **screen size / safe area** — `react-native-safe-area-context`의 `useSafeAreaInsets`. 노치 / Dynamic Island 대응.
