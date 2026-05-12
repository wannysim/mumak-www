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

### 알려진 이슈 (해소 방법 확정)

`jest-expo ~54` + `jest ^30` + `pnpm` 조합에서 모든 테스트가 setup 단계에서 죽는다:

```
ReferenceError: You are trying to `import` a file outside of the scope of the test code.
  at .../expo/src/winter/runtime.native.ts:20
```

**진짜 원인**: winter polyfill 발화는 증상이고, 직접 원인은 **두 jest 런타임 충돌**이다. `node_modules/jest-expo/package.json`의 deps(`@jest/globals`, `babel-jest`, `jest-snapshot` 등)가 **전부 `^29.2.1`로 핀**되어 있어 jest-expo가 자체 트리에 jest 29 런타임을 끌고 들어온다. 앱 레벨 jest 30 CLI/runner는 그 트리 밖이라 `isInsideTestCode` 검사가 깨진다.

**중요 사실**: jest-expo 56(현재 최신 stable, Expo SDK 56)까지도 jest 29 deps 핀 유지. 업스트림이 jest 30으로 갈 가시적 계획 없음.

**채택할 해소 방법**: `apps/mumak-native/package.json`의 `jest` / `@types/jest` devDep을 v29로 다운그레이드.

```diff
-    "@types/jest": "^30.0.0",
+    "@types/jest": "^29.5.14",
-    "jest": "^30.2.0",
+    "jest": "^29.7.0",
```

mumak-native 워크스페이스만 영향, web 앱(blog/mumak-next/mumak-react)은 jest 30 유지.

대안 평가 (참고용):

- `setupFiles`에서 winter polyfill pre-define: 발화 **타이밍**이 문제라 값을 미리 박아도 `installGlobal`의 `configurable` descriptor 분기로 우회 어려움. SDK 마이너 업데이트마다 깨지기 쉬움.
- jest-expo 새 버전: 존재하지 않음. SDK 56까지도 jest 29 핀 유지.

자세한 follow-up 절차는 [`README.md` → 알려진 잔재 → 테스트 인프라](./README.md#테스트-인프라--실행-불가-상태) 참조.

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
