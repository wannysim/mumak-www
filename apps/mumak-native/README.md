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

데모용으로 들어온 파일들. 실제 사용 안 할 거면 삭제, 참고용으로 둘 거면 유지.

- 화면: `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/modal.tsx`
- 컴포넌트: `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `external-link.tsx`, `themed-text.tsx`, `themed-view.tsx`, `haptic-tab.tsx`, `ui/collapsible.tsx`, `ui/icon-symbol.tsx`, `ui/icon-symbol.ios.tsx`
- 자산: `assets/images/react-logo*.png` (3 해상도 + partial)
- 스크립트: `scripts/reset-project.js` — 템플릿 초기화 용도, 한 번 쓰고 버릴 것

### 테스트 인프라 — 실행 불가 상태

- `@testing-library/react-native`, `react-test-renderer`, `jest-expo` 설치 완료, `jest.setup.ts`에 mock 정의 완료.
- 그러나 **`jest-expo ~54` + `jest ^30` + `pnpm`** 조합에서 Expo winter polyfill이 `Runtime._execModule`의 scope 검사에 걸려 모든 테스트가 setup 단계에서 죽음. `--passWithNoTests`로 CI는 그린.
- 해소 후보 (자세히는 [AGENTS.md → 테스트](./AGENTS.md#테스트)):
  1. `pnpm.overrides`로 mumak-native만 jest 29 핀.
  2. `setupFiles`에서 winter polyfill 전체 pre-define.
  3. jest-expo 패치 / 새 버전 적용.

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

- 이 앱이 가져온 native deps(`expo-*`, `@react-navigation/*`, `react-native-*`)가 30+개라 dependabot이 활성이면 PR 폭주 가능.
- `.github/dependabot.yml`에 expo/react-native 관련 grouped update 정의 권장 (별도 PR).
