# apps/mumak-native — AGENTS.md

Expo (React Native + expo-router) 앱. 공통 규칙은 루트 [`AGENTS.md`](../../AGENTS.md) 참조.

---

## 라우팅

- 파일 기반 라우팅: `app/` 디렉터리 (expo-router).
- 레이아웃: `app/_layout.tsx`.
- 탭 그룹: `app/(tabs)/`.

## 컴포넌트

- **DOM 엘리먼트 금지**: `<div>`, `<span>`, `<button>` 등 사용 불가.
- `react-native` primitives 사용: `View`, `Text`, `Pressable`, `ScrollView`, `Image` 등.
- 가능하면 Expo 모듈 우선: `expo-image` (`<Image>` 대신), `expo-router`, `expo-haptics`, `expo-symbols`.

## 스타일링

- `StyleSheet.create` 또는 `View`의 `style` prop.
- `tailwindcss`/`shadcn`/`@mumak/ui` **금지** — 웹 전용.

## Import 규칙

```typescript
// Good
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { identity } from '@mumak/shared/utils/identity';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Bad — 웹 전용
import { Button } from '@mumak/ui/components/button';
import 'next/link';
```

## 공유 로직

- 플랫폼 무관 로직(`hooks`, `utils`, `types`, `api`)은 `@mumak/shared`에서 가져온다.
- 새 공유 로직이 필요하면 `packages/shared/src/{hooks,utils,types,api}/` 아래 추가하고, 거기서 import한다.

## 빌드 / CI

- `pnpm dev`(또는 `pnpm start`) 로 Expo dev server 기동.
- **실제 네이티브 빌드는 EAS Build의 영역**. CI(`pnpm build`)는 의도적 no-op이다.
- CI 검증 대상: `lint`, `format:check`, `check-types`, `test:ci` (4개).

## 테스트

- Unit: Jest + `jest-expo` preset.
- 테스트 파일: `__tests__/` 폴더에 `*.test.{ts,tsx}`.
- E2E(Detox/Maestro)는 별도 워크플로우로 추후 도입.

## Metro 설정

- `metro.config.js`는 pnpm 모노레포 호환 설정(`watchFolders`, `nodeModulesPaths`, `unstable_enableSymlinks`).
- 새 워크스페이스 패키지를 추가했는데 Metro가 못 찾으면 이 파일을 우선 확인한다.
