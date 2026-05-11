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
