# AGENTS.md — `@mumak/shared`

플랫폼 무관 공유 로직 패키지. 웹(`apps/blog`, `apps/mumak-next`, `apps/mumak-react`)과 네이티브(`apps/mumak-native`) 모두에서 import 가능해야 한다.

루트 [`AGENTS.md`](../../AGENTS.md)의 모든 규칙이 적용되며, 이 파일은 `packages/shared/` 하위에서만 추가로 적용되는 규칙을 정의한다.

---

## 핵심 원칙: 플랫폼 무관성

`@mumak/shared`에서 import 또는 참조해서는 **절대 안 되는** 것:

- `react-dom` — DOM은 웹 전용.
- `react-native` — React Native는 네이티브 전용.
- `next/*` — Next.js는 웹 전용.
- DOM 글로벌: `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `HTMLElement` 등.
- Node-only API (`fs`, `path`, `process.cwd()`, `Buffer` 등): RN/브라우저에서 동작하지 않는다.

`tsconfig.json`이 `lib`에서 `DOM`을 제거하므로, DOM 글로벌을 쓰면 타입 에러가 난다 — 그것이 의도다.

### 플랫폼 의존 로직을 피할 수 없을 때

호출자(앱 쪽)가 플랫폼 바인딩을 주입하도록 hook을 설계한다.

```typescript
// Good — caller injects the platform-specific storage
export function useStoredValue<T>(
  key: string,
  storage: { get: (k: string) => T | null; set: (k: string, v: T) => void }
) {
  // ...
}

// Bad — assumes browser
export function useStoredValue<T>(key: string) {
  const value = localStorage.getItem(key); // 타입 에러 + 런타임 실패
  // ...
}
```

---

## 파일 구조

```
src/
├── hooks/    # platform-agnostic React hooks
├── utils/    # pure functions
├── types/    # shared TypeScript types
└── api/      # API client logic (fetch wrappers, schemas)
```

- 모든 export는 `package.json`의 subpath `exports`로 노출. **barrel index 파일 없음.**
- 컴포넌트 파일은 두지 않는다 (UI는 `@mumak/ui` 또는 각 앱에서 정의).

### Import 규칙

```typescript
// Good — 컴포넌트별/파일별 직접 import
import { useDebounced } from '@mumak/shared/hooks/use-debounced';
import { formatDate } from '@mumak/shared/utils/format-date';

// Bad — barrel import 없음
import { useDebounced } from '@mumak/shared';
```

---

## 빌드 / 타입

- **buildless**: 산출물 없음. `package.json` `exports`가 `.ts` 소스를 직접 가리킨다.
- 소비 앱(Next/Vite/Expo)의 번들러가 TS를 직접 컴파일.
- 따라서 ESM이지만, `.ts` 확장자에 대한 호환만 유지하면 됨 (`build` 스크립트 없음).

---

## 체크리스트

새 hook/util 추가 시:

- [ ] `react-dom`, `react-native`, `next/*` import 없는가?
- [ ] DOM 글로벌(`window`, `document` 등) 참조 없는가?
- [ ] 파일이 `src/{hooks,utils,types,api}/` 중 한 곳에 있는가?
- [ ] `package.json` `exports` 패턴으로 자동 노출되는가?
- [ ] named export인가? (default export 금지)
