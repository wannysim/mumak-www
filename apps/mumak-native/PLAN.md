# mumak-native 템플릿 견고화 — 실행 런북 (AI 에이전트용)

본격 앱 개발에 앞서 `apps/mumak-native/`를 **"폴더만 복사하면 바로 새 앱을 시작할 수 있는 템플릿"** 으로 마감하기 위한 **자율 실행 가능 런북**. 클라우드 환경의 AI 에이전트가 이 문서만 보고 STEP을 순서대로 수행하고, 마지막에 **성공 여부를 스스로 검증**할 수 있도록 작성한다.

- 작성일: 2026-06-04
- 브랜치: `chore/mumak-native-template-hardening` (base: `develop`)
- 범위: `apps/mumak-native/` + E2E 편입을 위한 루트 `.github/app-config/apps.yml` 1줄.
- 실행 주체: 클라우드 AI 에이전트(Linux 컨테이너 가정). 사람은 트리거만.

---

## 0. 이 문서 사용법 (에이전트 실행 규약)

1. **그룹 순서**: A(안전) → B(템플릿 마감) → T(테스트/검증 구성). C(EAS)는 네이티브 배포 트리거 시 별도.
2. **각 STEP은**: `목적 / 정확한 변경(파일 전체 또는 diff) / 적용 명령 / 기대 출력 / 검증 / 롤백` 6요소를 갖는다. 명시된 파일 내용은 **그대로 생성/치환**한다.
3. **STEP마다 검증을 통과**한 뒤 다음으로 간다. 실패 시 그 STEP의 롤백 후 중단·보고.
4. **최종 검증**은 §9의 머신 체크 가능한 성공 기준 + §5의 클라우드 검증 프로토콜로 판정.
5. 멱등성: 이미 적용된 STEP은 재실행해도 안전해야 한다(파일 내용 일치 확인 후 skip).

### 실행 환경 전제

| 항목                  | 값                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------- |
| OS                    | Linux 컨테이너 (CI/클라우드)                                                                  |
| Node                  | `24.11.1` (`.nvmrc`)                                                                          |
| 패키지 매니저         | pnpm (워크스페이스 루트에서 `pnpm install`)                                                   |
| 시뮬레이터/에뮬레이터 | **없음** — 단위·웹E2E·번들 스모크만 클라우드 자체검증. 네이티브E2E(T-4)는 GitHub Actions 전용 |

---

## 1. 점검 스냅샷 (실측 · 2026-06-04)

| 단계                               | 결과          | 비고                                                      |
| ---------------------------------- | ------------- | --------------------------------------------------------- |
| `check-types` (`tsc --noEmit`)     | 통과          | 깨끗                                                      |
| `lint` (`oxlint .`)                | 통과          | 0 warnings / 0 errors, 23 files                           |
| `test:ci` (`jest --ci --coverage`) | 통과          | `__tests__/smoke.test.ts`의 `1+1=2` 1개뿐, 실 커버리지 0% |
| `format:check` (`oxfmt --check .`) | **로컬 실패** | `coverage/` 생성물 검사 → [A-1]                           |

핵심 버전 사실(실측): **Expo SDK 56 / React Native 0.85.3 / React 19.2.3 / jest 29.7.0(jest-expo lock-step) / TypeScript 6.0.3**. 문서 표기는 SDK 54 / RN 0.81 / jest 30으로 어긋남 → [A-3].

CI 인프라 사실(실측):

- `ci.yml`의 `validate` 매트릭스는 `apps.yml` 기반 → **mumak-native 이미 포함**(lint/format/check-types/test:ci/build/coverage 자동 실행). codecov flag `mumak-native`도 배선됨.
- `e2e.yml`은 `apps.yml`의 `hasE2E: true` 앱만 매트릭스화(Playwright 컨테이너, chromium/firefox/webkit). mumak-native는 현재 `hasE2E: false`.
- `turbo.json`에 `test:e2e`(`dependsOn: ["build"]`), `test:ci` 태스크 정의 존재. `mumak-native#build`는 no-op.

---

## 2. A그룹 — 즉시 처리 (안전·무논쟁)

### [A-1] `format:check` 로컬 실패 수정

- **목적**: 테스트를 한 번이라도 돌려 `coverage/`가 생기면 `format:check`가 깨지는 함정 제거.
- **근본 원인**: oxfmt는 cwd 로컬 `.gitignore`만 존중. mumak-native `.gitignore`에 `coverage`/`.turbo` 없음(blog엔 `/coverage` 있어 회피). 루트 `.oxfmtrc.jsonc`의 `coverage/**`는 루트 기준이라 미적용.
- **변경**: `apps/mumak-native/.gitignore` 끝에 추가
  ```gitignore
  # test infra artifacts (oxfmt가 로컬 .gitignore만 존중 → format:check가 coverage/dist 검사 방지)
  /coverage
  .turbo/
  ```
  > `dist/`는 이미 무시됨. 웹 E2E(T-3) 도입 시에도 `dist/`가 추가로 안전.
- **적용 명령**: 위 두 줄을 파일 끝에 append.
- **기대/검증**(이미 1회 재현·수정 확인): `pnpm --filter mumak-native test:ci && pnpm --filter mumak-native format:check` → "All matched files use the correct format".
- **롤백**: 추가한 두 줄 제거.

### [A-2] `test:ci`에서 `--passWithNoTests` 제거

- **목적**: 실제 테스트가 도는데 남은 플래그 제거 → 테스트 0개 회귀를 CI가 잡도록.
- **변경**: `apps/mumak-native/package.json`
  ```diff
  -    "test:ci": "jest --ci --coverage --passWithNoTests",
  +    "test:ci": "jest --ci --coverage",
  ```
- **검증**: `pnpm --filter mumak-native test:ci` 통과(스모크/baseline 존재 시).
- **롤백**: 플래그 복원.

### [A-3] 문서 drift 일괄 정정

- **목적**: "이미 해결된 문제"의 재작업 방지.

| 파일                        | 현재(stale)                                  | 정정                                                                  |
| --------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| `README.md` 제목/스택 표    | "Expo **SDK 54** / RN **0.81**"              | "Expo **SDK 56** / RN **0.85**"                                       |
| `jest.config.mjs` L1–6 주석 | "jest **30** incompat … `--passWithNoTests`" | jest 29 해소 반영, 주석 축약                                          |
| `jest.setup.ts` L1 주석     | "jest-expo **SDK 54** + jest **30**"         | "jest-expo **SDK 56** + jest **29**"                                  |
| `AGENTS.md` 테스트 섹션     | "미해결 / `--passWithNoTests`로 통과 중"     | **"jest 29 다운그레이드로 해소됨"** + 원인분석은 히스토리로 압축 보존 |

- **원인분석 보존 이유**: 다음 SDK bump 시 jest 30 지원 재평가 단서.
- **검증**: 육안 정합 + `pnpm --filter mumak-native format:check`(마크다운 포함).

---

## 3. B그룹 — 템플릿 마감

### [B-1] Stock 데모 잔재 정리

`create-expo-app --template default` 데모 제거. README의 G1–G6 매핑을 신뢰하되 아래는 **실측 반영**.

#### B-1a 삭제 (orphan 검증 완료)

```bash
# G1 자산
rm apps/mumak-native/assets/images/react-logo.png \
   apps/mumak-native/assets/images/react-logo@2x.png \
   apps/mumak-native/assets/images/react-logo@3x.png \
   apps/mumak-native/assets/images/partial-react-logo.png
# G2 컴포넌트
rm apps/mumak-native/components/hello-wave.tsx \
   apps/mumak-native/components/parallax-scroll-view.tsx \
   apps/mumak-native/components/external-link.tsx \
   apps/mumak-native/components/ui/collapsible.tsx \
   apps/mumak-native/components/ui/icon-symbol.ios.tsx
# G6 파괴적 스크립트 (직접 실행 금지, 파일째 제거)
rm apps/mumak-native/scripts/reset-project.js
```

그리고 `package.json`에서 script 제거:

```diff
-    "reset-project": "node ./scripts/reset-project.js",
```

#### B-1b 화면 placeholder 교체 (라우팅 골격 유지, E2E 앵커 포함)

`app/(tabs)/index.tsx` — 전체 치환:

```tsx
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" accessibilityRole="header">
        Home
      </ThemedText>
      <ThemedText>Edit app/(tabs)/index.tsx to start building.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
```

`app/(tabs)/explore.tsx` — 전체 치환:

```tsx
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ExploreScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" accessibilityRole="header">
        Explore
      </ThemedText>
      <ThemedText>Second tab placeholder.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
```

> `accessibilityRole="header"`는 react-native-web에서 `role="heading"`으로 렌더 → 웹 E2E의 `getByRole('heading', { name: 'Home' })`와 RNTL `getByRole`이 둘 다 잡는다. 토대(`ThemedText`/`ThemedView`)가 실제로 렌더됨을 E2E가 증명하는 앵커.

`app/modal.tsx` — **삭제** + `app/_layout.tsx`에서 등록 라인 제거(실측: README와 달리 **L19에 등록돼 있음**):

```bash
rm apps/mumak-native/app/modal.tsx
```

```diff
# app/_layout.tsx
       <Stack>
         <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
-        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
       </Stack>
```

#### B-1 보존 (G4/G5)

`components/{themed-text,themed-view,haptic-tab}.tsx`, `components/ui/icon-symbol.tsx`, `hooks/{use-color-scheme.ts,use-color-scheme.web.ts,use-theme-color.ts}`, `constants/theme.ts`, 앱 아이콘/스플래시 자산.

#### B-1 검증/주의

- 검증: `pnpm --filter mumak-native clean && pnpm --filter mumak-native check-types && lint && format:check`. 그 후 T-2 번들 스모크로 부팅 대체 검증.
- 주의: `*.web.ts`/`*.ios.tsx`는 Metro resolver가 자동 선택 → knip 오탐. **knip 자동 삭제 금지.** typed routes 캐시 stale 가능 → `clean` 선행.

### [B-2] 토대 컴포넌트 단위 테스트 추가 — §T-1로 상세화

요약: `themed-text`, `themed-view`, `use-theme-color`에 colocate 단위 테스트 추가 + jest coverage threshold baseline. 전체 파일 내용·threshold 절차는 **§T-1** 참조.

### [B-3] 복제 친화성 보강

- **README "복제 후 바꿀 값" 체크리스트** 추가:

  ```markdown
  ## 새 앱으로 복제할 때 바꿀 값

  - [ ] app.json: `name`, `slug`, `scheme`
  - [ ] app.json: `ios.bundleIdentifier`, `android.package` (신규 추가)
  - [ ] package.json: `name`, `version`(예: 0.1.0)
  - [ ] .maestro/\*.yaml: `appId` (네이티브 E2E 도입 시)
  - [ ] assets/images/\*: 앱 아이콘·스플래시 교체
  ```

- **버전 정합**: `package.json` 1.6.2 vs `app.json` 1.0.0 → 템플릿 기준값(예: `0.1.0`)으로 정렬.
- **`.env.example`** 추가(추적 대상):
  ```dotenv
  # 공개 값만 EXPO_PUBLIC_ 접두어 (빌드 시 번들 inline). 시크릿은 금지 → EAS env(C-3).
  # EXPO_PUBLIC_API_BASE_URL=
  ```
- **secret `.gitignore` 패턴** 선제 추가:
  ```gitignore
  google-services.json
  GoogleService-Info.plist
  ```
- **`@mumak/shared` 배선 증명**(선택): placeholder 화면에 공유 util/type 예시 import 1줄.
- 검증: `check-types && lint && format:check`, `.env.example`이 `.env*.local`에 안 걸리고 추적되는지 확인.

---

## 4. T그룹 — 테스트 & 클라우드 검증 구성 (핵심)

### T-0 검증 피라미드 (클라우드 실행 가능성 기준)

| 티어               | 도구                                   | 클라우드(Linux 컨테이너)                 | 비고                         |
| ------------------ | -------------------------------------- | ---------------------------------------- | ---------------------------- |
| 정적 게이트        | tsc / oxlint / oxfmt                   | 가능                                     | 즉시                         |
| 단위 (T-1)         | Jest + `@testing-library/react-native` | 가능                                     | headless, 이미 설치됨        |
| 번들 스모크 (T-2)  | `expo export --platform web`           | 가능                                     | "실제로 번들된다" 증명       |
| 웹 E2E (T-3)       | Playwright vs 웹 export                | 가능                                     | 기존 `e2e.yml` 인프라 재사용 |
| 네이티브 E2E (T-4) | Maestro + Android 에뮬레이터           | 불가(AI 컨테이너) / 가능(GitHub Actions) | 선택·금상첨화                |

> 클라우드 AI의 **자체 성공판정은 정적+단위+번들+웹E2E**로 충분. 네이티브 E2E는 GitHub Actions에 위임.

### T-1 단위 테스트 (Jest + RN Testing Library)

설치 상태(실측): `@testing-library/react-native ^13.3.3`, `react-test-renderer 19.2.3`, `jest 29.7.0`, `jest-expo ~56` — **추가 설치 불필요**.

**스타일 단언은 `StyleSheet.flatten` + `objectContaining`으로** 한다(별도 jest matcher 셋업 의존 제거 → 멱등·견고).

`components/__tests__/themed-text.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemedText } from '../themed-text';

describe('ThemedText', () => {
  it('renders its children', () => {
    render(<ThemedText>Hello</ThemedText>);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('applies the title style for type="title"', () => {
    render(<ThemedText type="title">Title</ThemedText>);
    const flat = StyleSheet.flatten(screen.getByText('Title').props.style);
    expect(flat).toEqual(expect.objectContaining({ fontSize: 32, fontWeight: 'bold' }));
  });

  it('exposes a heading role when requested', () => {
    render(
      <ThemedText type="title" accessibilityRole="header">
        Home
      </ThemedText>
    );
    expect(screen.getByRole('header', { name: 'Home' })).toBeTruthy();
  });
});
```

`components/__tests__/themed-view.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemedView } from '../themed-view';
import { Colors } from '@/constants/theme';

describe('ThemedView', () => {
  it('applies the themed background color', () => {
    render(<ThemedView testID="tv" />);
    const flat = StyleSheet.flatten(screen.getByTestId('tv').props.style);
    expect(flat.backgroundColor).toBe(Colors.light.background);
  });

  it('honors an explicit lightColor override', () => {
    render(<ThemedView testID="tv" lightColor="#abcabc" />);
    const flat = StyleSheet.flatten(screen.getByTestId('tv').props.style);
    expect(flat.backgroundColor).toBe('#abcabc');
  });
});
```

`hooks/__tests__/use-theme-color.test.ts`:

```ts
import { renderHook } from '@testing-library/react-native';

import { useThemeColor } from '../use-theme-color';
import { Colors } from '@/constants/theme';

describe('useThemeColor', () => {
  it('returns the light token by default', () => {
    const { result } = renderHook(() => useThemeColor({}, 'background'));
    expect(result.current).toBe(Colors.light.background);
  });

  it('prefers an explicit override color', () => {
    const { result } = renderHook(() => useThemeColor({ light: '#abcabc' }, 'background'));
    expect(result.current).toBe('#abcabc');
  });
});
```

**Coverage threshold (ratchet 정책 · blog 패턴)**: 테스트 추가 후 측정 → 측정 floor로 baseline 고정. `jest.config.mjs`에 추가:

```js
// 1) pnpm --filter mumak-native test:ci 실행
// 2) coverage/coverage-summary.json 의 total.{statements,branches,functions,lines}.pct 확인
// 3) 각 측정치보다 한 단계 낮은 값으로 아래 채움(예: 측정 62% → 60). 이후 측정이 오르면 함께 상향.
coverageThreshold: {
  global: { statements: 0, branches: 0, functions: 0, lines: 0 }, // ← 측정 후 치환
},
```

> 초기엔 placeholder 화면 때문에 global 커버리지가 낮다. 무리한 목표 대신 **현재 측정 floor**로 잠그고 점진 상향(회귀 방지가 목적).

검증: `pnpm --filter mumak-native test:ci` → 4개 이상 테스트 통과 + threshold 충족.

### T-2 번들 스모크 (`expo export --platform web`)

- **목적**: 시뮬레이터 없이 "앱이 실제로 번들된다"를 클라우드에서 증명(부팅 검증 대체). placeholder 교체(B-1) 회귀를 잡는다.
- `package.json` scripts 추가:
  ```jsonc
  "export:web": "expo export --platform web --output-dir dist",
  ```
- **실증 완료**(2026-06-04, 현재 데모 상태): `expo export --platform web` 8.9s 번들 성공(React Compiler + reanimated 4 포함), 정적 라우트 `/`·`/explore`·`(tabs)/explore` 등 HTML 생성. placeholder 교체 후에도 동일 동작 예상(placeholder는 더 단순).
- 검증: `pnpm --filter mumak-native export:web` 종료코드 0 + `dist/index.html` 생성. (`dist/`는 A-1로 무시됨.)

### T-3 웹 E2E (Playwright vs 웹 export) — 에뮬레이터 불필요

mumak-native는 `react-native-web` + `app.json` `web.output: "static"` → 웹 정적 export 가능. 기존 `e2e.yml`(Playwright 컨테이너)에 그대로 편입한다.

#### T-3a devDependencies 추가

```jsonc
// apps/mumak-native/package.json devDependencies
"@playwright/test": "^1.58.2",
"serve": "^14.2.4"
```

> `@playwright/test ^1.58.2`는 다른 앱(`apps/mumak-react`)·`e2e.yml` 컨테이너 `mcr.microsoft.com/playwright:v1.58.2-noble`와 정합(실측). 버전 drift 시 컨테이너 태그와 맞춘다.

#### T-3b scripts 추가

```jsonc
"serve:web": "serve dist --listen 3002 --no-port-switching",
"preview:e2e": "pnpm export:web && pnpm serve:web",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed",
"test:e2e:debug": "playwright test --debug"
```

#### T-3c `playwright.config.ts` (mumak-react 패턴, PORT만 3002)

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 3002;
const isCI = !!process.env.CI;
const shouldReuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_SERVER === 'true' || process.env.PLAYWRIGHT_REUSE_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : '50%',
  reporter: isCI ? [['html'], ['github']] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: isCI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm preview:e2e',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: shouldReuseExistingServer,
    timeout: 180_000, // expo export(최초)가 느릴 수 있어 여유
  },
});
```

#### T-3d E2E 스펙 `e2e/home.spec.ts` (접근성 기반·견고)

```ts
import { expect, test } from '@playwright/test';

test.describe('mumak-native (web export)', () => {
  test('home tab renders the themed heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('explore route renders', async ({ page }) => {
    // 정적 export 라우트 직접 진입(탭바 셀렉터 결합 회피). 실 UI 구축 후 클릭 내비로 확장 가능.
    await page.goto('/explore');
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  });
});
```

> 최소·접근성 기반으로 시작(AGENTS.md selector 원칙). "토대가 웹에서 실제로 렌더되고 라우팅이 동작"을 증명. 화면이 생기면 스펙을 늘린다.

#### T-3e 루트 `.github/app-config/apps.yml` — E2E 활성화 (1줄)

```diff
   - app: mumak-native
     type: expo
-    hasE2E: false
+    hasE2E: true # web export(react-native-web) 기반 Playwright E2E
```

> 이 한 줄로 `e2e.yml` 매트릭스에 mumak-native가 chromium/firefox/webkit으로 자동 편입된다. `turbo.json`의 `test:e2e`(`dependsOn: ["build"]`)는 그대로 적용(native build는 no-op이라 export는 `preview:e2e`가 수행).

검증(로컬/클라우드): `pnpm --filter mumak-native exec playwright install --with-deps chromium` 후 `pnpm --filter mumak-native test:e2e -- --project=chromium` → 2 passed.

### T-4 네이티브 E2E (Maestro) — 선택 · GitHub Actions 전용

> AI 컨테이너에선 실행 불가(에뮬레이터/KVM 필요). 네이티브 제스처·SF Symbols·햅틱 같은 **네이티브 충실도**가 필요할 때 도입. iOS는 macOS 러너 필요.

flow `apps/mumak-native/.maestro/home.yaml`:

```yaml
# appId는 app.json의 android.package / ios.bundleIdentifier 와 일치해야 한다(B-3에서 설정)
appId: com.example.mumaknative
---
- launchApp
- assertVisible: 'Home'
```

CI(스캐폴드, **도입 시 Expo+Maestro 공식 문서로 step 검증**) `.github/workflows/native-e2e.yml`:

```yaml
name: Native E2E (Maestro)
on:
  workflow_dispatch: {}
jobs:
  android:
    runs-on: ubuntu-latest # KVM 가속 필요
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/actions/setup-node-pnpm
      - run: pnpm install --frozen-lockfile
      - name: Prebuild + debug APK
        working-directory: apps/mumak-native
        run: |
          npx expo prebuild --platform android --no-install
          ./android/gradlew -p android :app:assembleDebug
      - name: Run Maestro on emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          arch: x86_64
          script: |
            curl -Ls "https://get.maestro.mobile.dev" | bash
            export PATH="$PATH:$HOME/.maestro/bin"
            adb install -r apps/mumak-native/android/app/build/outputs/apk/debug/app-debug.apk
            maestro test apps/mumak-native/.maestro/
```

> 대안: EAS Build + Maestro(`eas workflow`의 e2e job) — C그룹과 함께 도입 시 평가. 현 단계에선 문서로만 둔다.

---

## 5. 클라우드 검증 프로토콜 (에이전트 자체 성공판정)

A/B/T 적용 후, 에이전트는 아래를 **순서대로** 실행하고 **모두 종료코드 0**이면 성공으로 판정한다.

### 5-1 단일 진입점 스크립트 (선택: `package.json`에 추가)

```jsonc
// apps/mumak-native/package.json scripts — 정적+단위+번들 한 방 검증(E2E 제외: 브라우저 별도)
"verify": "pnpm check-types && pnpm lint && pnpm format:check && pnpm test:ci && pnpm export:web"
```

### 5-2 에이전트 실행 시퀀스

```bash
# 0) 워크스페이스 루트에서 설치
pnpm install --frozen-lockfile

# 1) 정적 게이트 + 단위 + 번들 스모크 (단일 진입점)
pnpm --filter mumak-native run verify

# 2) 웹 E2E (브라우저 미존재 환경이면 먼저 설치)
pnpm --filter mumak-native exec playwright install --with-deps chromium
pnpm --filter mumak-native test:e2e -- --project=chromium
```

### 5-3 성공 판정 매트릭스

| 신호                       | 통과 기준                                        |
| -------------------------- | ------------------------------------------------ |
| `verify` 종료코드          | `0` (types/lint/format/test:ci/export 모두 통과) |
| `test:ci` 커버리지         | threshold 충족 + 테스트 ≥ 4                      |
| `export:web`               | `dist/index.html` 생성                           |
| `test:e2e`                 | 2 passed (chromium)                              |
| CI `ci.yml` "CI Success"   | green (PR 푸시 시)                               |
| CI `e2e.yml` "E2E Success" | green (hasE2E:true 편입 후)                      |

> 사람이 PR을 열면 `ci.yml`(mumak-native validate + coverage→codecov)과 `e2e.yml`(chromium/firefox/webkit)이 자동 실행되어 위 로컬 판정을 CI에서 재확인한다.

---

## 6. CI 통합 요약 (추가 배선 거의 없음)

- **단위/타입/포맷/빌드**: `ci.yml`의 `validate` 매트릭스가 `apps.yml`로 mumak-native를 **이미** 돌림. 코드만 추가하면 자동 검증.
- **coverage**: `ci.yml` coverage job에 codecov flag `mumak-native` **이미** 배선. threshold 추가 시 PR에서 강제.
- **웹 E2E**: `apps.yml` `hasE2E: true` 1줄(T-3e) → `e2e.yml` 자동 편입. 별도 워크플로 작성 불필요.
- **네이티브 E2E**: 별도 `native-e2e.yml`(T-4), workflow_dispatch 수동. 선택.

---

## 7. C그룹 — EAS 빌드·배포 인프라 (도입 런북)

> 트리거: 첫 내부 테스트 배포(iOS TestFlight / Android Play Internal). 그 전까지 문서로만 준비(실 자격증명·스토어 계정 전제). 스캐폴드 키/문법은 도입 시 `eas build:configure` 산출물 + 공식 문서로 재검증.

### C-1 `eas.json` 빌드 프로파일

```jsonc
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote", "requireCommit": true },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "channel": "development" },
    "preview": { "distribution": "internal", "channel": "preview" },
    "production": { "channel": "production", "autoIncrement": true },
  },
  "submit": { "production": {} },
}
```

### C-2 자격증명

- 권장: EAS 원격 관리("Let EAS handle it"). iOS Distribution Cert + Provisioning Profile, Android Upload Keystore(분실 시 복구 불가 → EAS 관리+백업). `eas credentials`로 조회. 키 파일 커밋 금지.

### C-3 환경변수 / 시크릿

- 공개값: `EXPO_PUBLIC_*`(번들 inline, 시크릿 아님). 시크릿: EAS Environment Variables(`eas env:create`, visibility sensitive/secret). CI 비대화형 빌드용 `EXPO_TOKEN`.

### C-4 버전 / 런타임 버전

- 사용자 버전 `app.json` `version`; 빌드 번호는 `appVersionSource: remote` + `autoIncrement`. 런타임 버전 `app.json`에 `"runtimeVersion": { "policy": "fingerprint" }`(네이티브 변경 해시 게이팅) 권장.

### C-5 CI: 빌드 자동화 (2택)

- **A(권장) EAS Workflows** `apps/mumak-native/.eas/workflows/*.yml`(build/submit/update 선언적). **B(대안) GitHub Actions** `expo/expo-github-action@v8` + `EXPO_TOKEN`으로 `eas build --non-interactive`. 기존 GH Actions 일관성이 중요하면 B. 둘 다 별도 PR.

### C-6 제출 / C-7 OTA

- `eas submit -p ios|android --profile production`(스토어). `eas update --branch <channel>`(OTA, `expo-updates`). 채널은 C-1 build `channel`과 매칭.

### C-8 모노레포(pnpm+Turborepo) 주의

- `eas build`는 `apps/mumak-native/`에서 실행, eas-cli가 워크스페이스 감지. `apps/mumak-native/.easignore`로 업로드 슬리밍. 루트 `package.json` `packageManager` 고정(재현성). `metro.config.js` 이미 모노레포 대응. no-op `build` 스크립트는 EAS와 무관.

### C-9 도입 체크리스트

- [ ] `eas login` → `eas init`(projectId/owner)
- [ ] `eas build:configure` → C-1 프로파일 정리
- [ ] 자격증명 EAS 원격 설정
- [ ] EAS env + `EXPO_TOKEN`
- [ ] 런타임 버전(fingerprint) + `appVersionSource: remote`
- [ ] `.easignore` 추가
- [ ] `eas build -p ios|android --profile preview` 성공
- [ ] `eas submit`(TestFlight/Internal)
- [ ] CI 워크플로(C-5) 별도 PR
- [ ] (선택) `expo-updates` + `eas update`

---

## 8. 실행 순서 (오케스트레이션)

1. **A-1 → A-2 → A-3** (안전 수정)
2. `pnpm --filter mumak-native run verify` 통과 확인(A-1 효과로 format도 통과)
3. **B-1** 데모 정리 (B-1a 삭제 → B-1b placeholder/modal 제거 → script 제거)
4. **T-1** 단위 테스트 추가 → 측정 → threshold 고정 (= B-2)
5. **T-2** 번들 스모크(`export:web`) 통과
6. **T-3** 웹 E2E 셋업(devDeps→scripts→config→spec→apps.yml) → `test:e2e` 통과
7. **B-3** 복제 친화성
8. **§5 클라우드 검증 프로토콜** 전체 통과
9. (선택) **T-4** 네이티브 E2E 스캐폴드 / **C** EAS 런북은 트리거 시

## 9. 성공 기준 (Definition of Done · 머신 체크 가능)

- [ ] `pnpm --filter mumak-native run verify` 종료코드 0 (types/lint/format/test:ci/export)
- [ ] `pnpm --filter mumak-native test:ci` — 테스트 ≥ 4, coverage threshold 충족
- [ ] `pnpm --filter mumak-native export:web` — `dist/index.html` 생성
- [ ] `pnpm --filter mumak-native test:e2e -- --project=chromium` — 2 passed
- [ ] 데모 잔재 0 (react-logo·hello-wave·modal·reset-project 제거, 화면 placeholder)
- [ ] `apps.yml` mumak-native `hasE2E: true`
- [ ] 문서가 실제 상태(SDK 56·RN 0.85·jest 29)와 일치 + "복제 후 바꿀 값" 체크리스트 존재
- [ ] (CI) `ci.yml` "CI Success" + `e2e.yml` "E2E Success" green

## 10. 보류 / 리스크 & 롤백

- **보류**: web 실배포(`expo export` step를 배포에 연결), dependabot expo/RN 그룹(루트 파일·별도 PR), 네이티브 E2E/EAS(트리거 시).
- **리스크/롤백**:
  - A그룹: 설정/문서/플래그 — 전부 git revert.
  - B-1 삭제: orphan 검증(G1–G6) 선행, T-2 번들 스모크로 회귀 즉시 감지. knip 오탐 파일 자동삭제 금지.
  - T-3 E2E: `expo export` 웹 호환 이슈(reanimated 등) 가능 → placeholder는 reanimated 미사용이라 안전. 실패 시 export 로그 우선 확인.
  - C그룹: 실 자격증명/스토어 영향 → `preview`/`internal` 선검증 후 production.
