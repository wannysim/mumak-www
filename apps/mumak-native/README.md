# Mumak Native

Expo SDK 54 + expo-router 기반 모바일 앱.

## 주요 기능

- **파일 기반 라우팅**: expo-router (typed routes)
- **다크모드**: `useColorScheme` + `constants/theme.ts` 색 팔레트
- **공유 로직**: `@mumak/shared` (web 앱과 hooks/utils/types/api 공유)

## 기술 스택

| 구분      | 기술                                             |
| --------- | ------------------------------------------------ |
| Framework | Expo SDK 54 (React Native 0.81)                  |
| Routing   | expo-router (typed)                              |
| Animation | react-native-reanimated 4                        |
| Build     | EAS Build (CI 외부)                              |
| Unit Test | Jest + jest-expo + @testing-library/react-native |
| 공유 로직 | @mumak/shared                                    |

## 개발 환경

- Node.js 24.11+
- pnpm
- iOS: Xcode 16+
- Android: Android Studio + JDK 17+

## 실행

```bash
# 의존성 설치 (워크스페이스 루트에서)
pnpm install

# Expo dev server
pnpm --filter mumak-native dev

# 시뮬레이터로 바로 띄우기
pnpm --filter mumak-native ios
pnpm --filter mumak-native android
```

Expo Go 앱이 있으면 dev server의 QR을 찍어 디바이스에서 바로 테스트 가능.

## 검증

CI와 동일한 순서:

```bash
pnpm --filter mumak-native lint
pnpm --filter mumak-native format:check
pnpm --filter mumak-native check-types
pnpm --filter mumak-native test:ci   # 현재 --passWithNoTests, AGENTS.md → 테스트 섹션 참조
pnpm --filter mumak-native build     # 명시적 no-op (네이티브 바이너리는 EAS)
```

자세한 컨벤션은 [`AGENTS.md`](./AGENTS.md) 참조.

## 배포

네이티브 바이너리 빌드는 EAS Build의 영역. CI는 lint / format / check-types / test 검증만 한다. TestFlight·Play Internal Testing 도입 시점에 `eas.json` + GitHub Actions workflow 추가 예정.

---

## 알려진 잔재 / Follow-up 후보

이 앱은 `create-expo-app --template default`로 시작했고, 본격 개발 전이라 템플릿 자산이 그대로 남아 있다. 본격 개발 들어가기 전에 정리 여부를 결정한다.

### Stock 화면 · 컴포넌트

데모용으로 들어온 파일들. 참조 그래프 매핑 결과 다음 그룹으로 분류된다.

| 그룹 | 파일                                                                                                                                                                            | 처리                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| G1   | `assets/images/react-logo*.png` × 4 (3 해상도 + `partial-react-logo.png`)                                                                                                       | G3 이후 고아 자산 — 단순 삭제                                                                      |
| G2   | `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `external-link.tsx`, `ui/collapsible.tsx`, `ui/icon-symbol.ios.tsx`                                                    | G3 화면 비우면 자동으로 0 참조 — 함께 삭제                                                         |
| G3   | `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/modal.tsx`                                                                                                               | placeholder로 교체 (라우팅 유지). `modal.tsx`는 `_layout.tsx`에서 명시 등록 안 됨 → 단순 삭제 가능 |
| G4   | `app/(tabs)/_layout.tsx`, `components/{haptic-tab,themed-text,themed-view}.tsx`, `ui/icon-symbol.tsx`, `constants/theme.ts`, `hooks/use-color-scheme*.ts`, `use-theme-color.ts` | **재설계 시점까지 보류** — 다크모드 토대로 재활용 가치 있음 (§ 재활용 가치 평가)                   |
| G5   | `assets/images/icon.png`, `splash-icon.png`, `favicon.png`, `android-icon-*.png`                                                                                                | **보존** — `app.json`에서 직접 참조 (앱 아이콘/스플래시)                                           |
| G6   | `scripts/reset-project.js` + `package.json` `scripts.reset-project`                                                                                                             | cleanup 마지막 단계에서 제거                                                                       |

#### 권장 cleanup 순서

각 단계 후 `pnpm --filter mumak-native check-types && lint && expo start`(부팅) 검증.

1. **G3 화면 비우기**: `(tabs)/index.tsx`, `explore.tsx`를 `<Text>` placeholder로 교체. `modal.tsx` 삭제.
2. **G2 클러스터 삭제**: `hello-wave`, `parallax-scroll-view`, `external-link`, `ui/collapsible`, `ui/icon-symbol.ios` 5개 파일.
3. **G1 자산 삭제**: `react-logo*.png` × 4.
4. **G4는 실 화면 그릴 때 같이 처리** (탭 구조 재설계 시 `_layout.tsx`+`haptic-tab`+`icon-symbol` 일괄 평가).
5. **G6 제거**: `scripts/reset-project.js` 파일 + `package.json` script entry. README의 이 섹션도 동기화.

#### 재활용 가치 평가

- `themed-text/view` + `use-theme-color` + `constants/theme.ts`: 라이트/다크 토큰 매핑이 이미 짜여 있다. 자체 디자인 시스템 만들기 전까지 **유지 권장**. 향후 `@mumak/ui-native` 공유 패키지로 승격 가치 있음.
- `hooks/use-color-scheme.{ts,web.ts}`: Metro platform resolver를 활용한 분기. 비용 거의 0 — 보존.
- `components/haptic-tab.tsx`: iOS 햅틱 탭 UX. 디자인이 햅틱 포함이면 유지, 아니면 G2와 함께 삭제.
- `components/ui/icon-symbol.tsx` (+ `.ios.tsx`): iOS SF Symbols ↔ Android Material Icons 어댑터. 아이콘 시스템 선택에 따라 결정.

#### 주의

- **`scripts/reset-project.js`를 직접 실행하지 말 것.** `app/`, `components/`, `hooks/`, `constants/`, `scripts/` 전체 디렉터리를 통째로 `app-example/`로 이동하거나 삭제하는 파괴적 동작. 위 단계적 cleanup과 충돌.
- **knip false positive**: knip이 `use-color-scheme.web.ts`, `icon-symbol.ios.tsx`를 unused로 보고하지만 Metro의 platform resolver(`.web.ts`/`.ios.tsx`)가 자동 선택하므로 실 사용 중. **knip 결과를 자동 삭제 도구로 돌리면 안 됨.**
- `expo-router` typed routes 캐시(`.expo/types/router.d.ts`)는 화면 변경 시 stale 가능 — placeholder 교체 후 `pnpm --filter mumak-native clean` 권장.

### 테스트 인프라 — 실행 불가 상태

- `@testing-library/react-native`, `react-test-renderer`, `jest-expo` 설치 완료, `jest.setup.ts`에 mock 정의 완료.
- **`jest-expo ~54` + `jest ^30` + `pnpm`** 조합에서 setup 단계 폭발, `--passWithNoTests`로 CI 그린 유지 중.

#### 진짜 원인 (재조사 결과)

`Runtime._execModule` / `isInsideTestCode` 폭발의 직접 원인은 winter polyfill이 아니라 **두 jest 런타임 충돌**:

> `node_modules/jest-expo/package.json`의 `dependencies`(`@jest/globals`, `@jest/create-cache-key-function`, `babel-jest`, `jest-environment-jsdom`, `jest-snapshot`)가 **전부 `^29.2.1`로 핀**. jest-expo가 자체 트리에 jest 29 런타임을 끌고 들어와서, 앱 레벨 jest 30 CLI/runner와 충돌한다. 테스트 코드의 `expect`/`describe`는 jest-expo 트리의 jest 29 `@jest/globals`를 받는데, runner는 jest 30 — scope 검사가 깨진다. winter polyfill 발화는 이 충돌의 **증상**이지 원인 아님.

**중요**: jest-expo 56(현재 최신 stable, Expo SDK 56)까지도 **여전히 jest 29 deps 핀** 유지. 업스트림이 jest 30으로 갈 가시적 계획 없음 — **한동안 "jest 29 = jest-expo의 정답"**.

#### 해소 (후보 1 채택)

```diff
# apps/mumak-native/package.json
-    "@types/jest": "^30.0.0",
+    "@types/jest": "^29.5.14",
-    "jest": "^30.2.0",
+    "jest": "^29.7.0",
```

근거:

- 후보 1 (jest 29 다운그레이드): 한 줄 변경, 근본 원인 직접 해소. mumak-native만 영향(web 앱은 jest 30 유지).
- 후보 2 (winter polyfill pre-define): getter가 발화하는 **타이밍**이 문제라 값을 미리 박아도 `installGlobal`의 `configurable` descriptor 분기 때문에 우회 어려움. SDK 업데이트마다 깨지기 쉬움.
- 후보 3 (jest-expo upstream): 존재하지 않음 — npm registry 확인 결과 SDK 56까지 jest 29 핀 유지.

검증 절차:

```bash
pnpm install --filter mumak-native
mkdir -p apps/mumak-native/components/__tests__
# sanity test 추가: expect(1).toBe(1)
pnpm --filter mumak-native exec jest --ci    # ReferenceError 없이 통과
pnpm --filter mumak-native test:ci           # --passWithNoTests 제거 후 진짜 통과
pnpm test:ci                                 # 다른 앱 회귀 없음
```

이 PR에서 처리:

- `jest`, `@types/jest` 다운그레이드
- sanity 테스트 1개 추가 (실 동작 증거)
- `apps/mumak-native/AGENTS.md` → 테스트 → 알려진 이슈 섹션을 "해소됨"으로 갱신
- `test:ci`에서 `--passWithNoTests` 제거 (sanity 테스트 추가 후)

후속:

- 핵심 hooks/components에 baseline 테스트 추가
- Coverage threshold 도입 (다음 항목 참조)
- 추후 jest-expo가 jest 30 지원하면 (한참 멀어 보임) jest 30 복귀

### Coverage threshold

- 테스트가 실제로 돌기 시작하면 측정치 기준 baseline을 박고 점진 상향 (blog 패턴 참고).

### Web 빌드 검증

- `pnpm web`(`expo start --web`)으로 web 모드 동작 가능, `react-dom`/`react-native-web` 의존성 있음.
- CI는 web export 검증 안 함. web 실제 배포 의도 없으면 web 관련 deps(`react-dom`, `react-native-web`) 제거 후보. 배포할 거면 `expo export --platform web` step 추가.

### Native 빌드 / 배포 인프라

- `eas.json` 없음 — EAS Build 처음 사용할 때 `eas build:configure`로 생성.
- GitHub Actions에 EAS 워크플로우 없음 — TestFlight / Play Internal Testing 시작 시점에 추가.
- `app.json`의 `slug`, `scheme`, bundle identifier는 현재 stock 값. 실 배포 직전 갱신.

### Secret 패턴 .gitignore

- Expo 템플릿 `.gitignore`는 `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`만 커버.
- 추후 Firebase 도입 시 `google-services.json`, `GoogleService-Info.plist` 패턴을 선제 추가 권장.

### `.env.example`

- 없음. 첫 `EXPO_PUBLIC_*` 환경변수 도입 시점에 같이 추가.

### dependabot

이 앱이 가져온 native deps(`expo-*`, `@react-navigation/*`, `react-native-*`)가 30+개라 dependabot이 활성이면 PR 폭주 가능. `.github/dependabot.yml`은 이미 존재하고 turbo/vitest/next/react/react-types/tailwind/radix-ui 그룹이 정의돼 있다. 다음 3개 그룹 추가 권장:

```yaml
# .github/dependabot.yml — updates[0].groups 아래에 추가
expo:
  patterns: ['expo', 'expo-*', '@expo/*', 'jest-expo']
  update-types: ['minor', 'patch']
react-native:
  patterns: ['react-native', 'react-native-*', 'react-test-renderer', '@testing-library/react-native']
  update-types: ['minor', 'patch']
react-navigation:
  patterns: ['@react-navigation/*']
```

설계 근거:

- **Expo SDK 일관성**: expo-router·expo-image 등이 expo core peer와 어긋나면 빌드 깨짐 → SDK 트랙 한 묶음. `jest-expo`(~54.0.0)도 SDK lock-step.
- **RN core ↔ reanimated ↔ worklets 페어 호환 매트릭스**: RN 0.81 + reanimated 4 + worklets 0.5 + screens + safe-area + gesture-handler 한 묶음. `react-test-renderer`도 RN/React lock-step이라 같은 그룹.
- **React Navigation**: v7 내부 패키지 간 lock-step만 처리.
- **Major bump은 그룹 밖 단독 PR**: `update-types: ['minor', 'patch']`로 제한해서 SDK 54→55, RN 0.81→0.82 같은 major는 사람이 명시적으로 받는 흐름. 기존 grouped 정의(turbo/next 등)는 major 제한이 없으니 일관성 차원에서 통일 검토.
- `react` / `@types/react`는 모노레포 차원이라 기존 `react` / `react-types` 그룹이 mumak-native까지 자동 흡수 — 별도 정의 불필요.

#### 잔존 고려사항

- **Vercel preview (apps/blog)**: `apps/blog/vercel.json`이 `pnpm install --filter=blog... --frozen-lockfile`을 쓰므로 native-only bump PR은 blog 의존 그래프 밖. 다만 lockfile 손상 시 `--frozen-lockfile`이 stale 감지 → blog preview 실패 가능. dependabot rebase 실패 시 수동 개입 필요.
- **Lockfile race**: monthly + limit 10 + lockfile 동시 수정 → 첫 PR 머지 후 나머지 rebase 필요할 가능성. expo·rn 그룹은 lockfile 충돌 빈도 높을 것.
- **첫 Expo SDK bump는 위 테스트 인프라 이슈와 맞물려 노이즈 가능성** → B1(jest 29 다운그레이드) 해소 후 첫 bump 받는 흐름이 안전.
