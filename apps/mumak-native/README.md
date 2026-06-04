# Mumak Native

Expo SDK 56 + expo-router 기반 모바일 앱.

## 주요 기능

- **파일 기반 라우팅**: expo-router (typed routes)
- **다크모드**: `useColorScheme` + `constants/theme.ts` 색 팔레트
- **공유 로직**: `@mumak/shared` (web 앱과 hooks/utils/types/api 공유)

## 기술 스택

| 구분      | 기술                                              |
| --------- | ------------------------------------------------- |
| Framework | Expo SDK 56 (React Native 0.85)                   |
| Routing   | expo-router (typed)                               |
| Animation | react-native-reanimated 4                         |
| Build     | EAS Build (CI 외부)                               |
| Unit Test | Jest + jest-expo + @testing-library/react-native  |
| Web E2E   | Playwright vs `expo export --platform web` (정적) |
| 공유 로직 | @mumak/shared                                     |

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
pnpm --filter mumak-native test:ci   # Jest + RNTL 단위 테스트 (coverage threshold 적용)
pnpm --filter mumak-native build     # 명시적 no-op (네이티브 바이너리는 EAS)
```

정적+단위+번들 스모크를 한 번에 검증하려면:

```bash
pnpm --filter mumak-native run verify   # check-types → lint → format:check → test:ci → export:web
```

웹 E2E(`react-native-web` 정적 export 기반 Playwright):

```bash
pnpm --filter mumak-native exec playwright install --with-deps chromium
pnpm --filter mumak-native test:e2e --project=chromium
```

자세한 컨벤션은 [`AGENTS.md`](./AGENTS.md) 참조.

## 새 앱으로 복제할 때 바꿀 값

- [ ] app.json: `name`, `slug`, `scheme`
- [ ] app.json: `ios.bundleIdentifier`, `android.package`
- [ ] package.json: `name`, `version`(예: 0.1.0)
- [ ] .maestro/\*.yaml: `appId` (네이티브 E2E 도입 시)
- [ ] assets/images/\*: 앱 아이콘·스플래시 교체

## 배포

네이티브 바이너리 빌드는 EAS Build의 영역. CI는 lint / format / check-types / test 검증만 한다. TestFlight·Play Internal Testing 도입 시점에 `eas.json` + GitHub Actions workflow 추가 예정.

---

## 템플릿 마감 상태 / Follow-up 후보

이 앱은 `create-expo-app --template default`로 시작했고, "폴더만 복사하면 새 앱을 시작할 수 있는 템플릿"으로 마감했다. 아래는 마감된 항목과 남은 follow-up.

### 완료된 마감 (template hardening)

- **Stock 데모 정리**: `react-logo*.png`·`partial-react-logo.png`, `hello-wave`/`parallax-scroll-view`/`external-link`/`ui/collapsible`/`ui/icon-symbol.ios`, `app/modal.tsx`, `scripts/reset-project.js`(+ `reset-project` 스크립트) 제거. `(tabs)/index.tsx`·`explore.tsx`는 접근성 헤딩 앵커를 가진 placeholder로 교체(라우팅 골격 유지).
- **보존(재활용 가치)**: `themed-text/view` + `use-theme-color` + `constants/theme.ts`(라이트/다크 토큰), `hooks/use-color-scheme.{ts,web.ts}`, `components/haptic-tab.tsx`, `components/ui/icon-symbol.tsx`, 앱 아이콘/스플래시 자산.
- **테스트 인프라 해소**: 단위 테스트 실행 가능. `themed-text`/`themed-view`/`use-theme-color` colocate 테스트 + coverage threshold baseline 적용. `test:ci`에서 `--passWithNoTests` 제거.
- **웹 E2E**: `expo export --platform web` 정적 export + Playwright(`e2e/home.spec.ts`). `apps.yml` `hasE2E: true`로 `e2e.yml` 매트릭스에 편입.
- **복제 친화성**: `.env.example` 추가, `app.json`에 `ios.bundleIdentifier`/`android.package` 추가, `package.json`·`app.json` 버전 `0.1.0` 정렬, secret `.gitignore` 패턴(`google-services.json`/`GoogleService-Info.plist`) 선제 추가.

#### 주의 (유지보수)

- **knip false positive**: knip이 `use-color-scheme.web.ts`, `icon-symbol.ios.tsx`를 unused로 보고하지만 Metro의 platform resolver(`.web.ts`/`.ios.tsx`)가 자동 선택하므로 실 사용 중. **knip 결과를 자동 삭제 도구로 돌리면 안 됨.**
- `expo-router` typed routes 캐시(`.expo/types/router.d.ts`)는 화면 변경 시 stale 가능 — 화면 교체 후 `pnpm --filter mumak-native clean` 권장.

#### 테스트 인프라 — 근본 원인 (히스토리 보존)

다음 SDK bump 시 jest 30 지원 재평가 단서로 보존한다.

> 과거 `jest-expo ~54` + `jest ^30` + `pnpm` 조합에서 setup 단계가 `Runtime._execModule` / `isInsideTestCode`로 폭발했다. 직접 원인은 winter polyfill이 아니라 **두 jest 런타임 충돌**: `node_modules/jest-expo/package.json`의 deps(`@jest/globals`, `babel-jest`, `jest-snapshot` 등)가 전부 `^29.2.1`로 핀되어 jest-expo가 자체 트리에 jest 29 런타임을 끌고 들어오는데, 앱 레벨 jest 30 runner와 scope 검사가 어긋났다. **해소**: 앱 jest/@types/jest를 v29로 다운그레이드(mumak-native만 영향, web 앱은 jest 30 유지). jest-expo는 SDK 56까지 jest 29 핀 유지이므로 한동안 "jest 29 = jest-expo의 정답". 추후 jest-expo가 jest 30을 지원하면 복귀 검토.

### 남은 Follow-up

- **Coverage threshold 상향**: 실 화면이 생기면 측정치 기준으로 baseline을 점진 상향(blog 패턴).
- **네이티브 E2E (Maestro)**: 네이티브 충실도(제스처/SF Symbols/햅틱) 필요 시 도입. 에뮬레이터(KVM) 필요 → GitHub Actions 전용.
- **EAS 빌드·배포**: 첫 내부 테스트 배포(TestFlight/Play Internal) 시점에 `eas.json` + 워크플로 추가.

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
