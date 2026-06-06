# @mumak/playwright-config

모노레포 앱 공통 Playwright E2E 설정 factory.

`apps/*/playwright.config.ts`가 거의 동일하게 중복되던 것을 단일 소스로 통합한다.
앱마다 달라지는 표면만 옵션으로 받고, 나머지(브라우저 매트릭스, reporter, retries, trace,
reuse 로직, CI/FORCE_COLOR ↔ NO_COLOR 정규화)는 패키지가 고정한다.

## 사용

```ts
// apps/<app>/playwright.config.ts
import { createPlaywrightConfig } from '@mumak/playwright-config/create-playwright-config';

export default createPlaywrightConfig({
  port: 3002,
  command: 'pnpm start:e2e',
  extraEnv: { E2E_INCLUDE_DRAFT: '1' }, // 선택
});
```

## 옵션

| 옵션               | 필수 | 기본값    | 설명                                                 |
| ------------------ | ---- | --------- | ---------------------------------------------------- |
| `port`             | O    | -         | `baseURL` / `webServer.url`에 사용되는 E2E 서버 포트 |
| `command`          | O    | -         | webServer 기동 명령 (`pnpm start:e2e` 등)            |
| `ciWorkers`        | X    | `2`       | CI에서 브라우저 job당 worker 수. 로컬은 항상 `'50%'` |
| `webServerTimeout` | X    | `120_000` | webServer 기동 타임아웃(ms). 느린 빌드는 늘린다      |
| `extraEnv`         | X    | `{}`      | webServer 프로세스에 추가 주입할 env                 |

## Escape hatch

반환값은 일반 config 객체다. 드물게 추가 커스터마이즈가 필요하면 호출부에서 spread로 override한다.

```ts
const base = createPlaywrightConfig({ port: 3000, command: 'pnpm start:e2e' });
export default { ...base, timeout: 60_000 };
```

추상화는 "중복 제거 + 드리프트 방지"가 목적이다. 리포터/플러그인/프로젝트 커스터마이즈처럼
앱별 분기가 커지는 책임은 이 패키지로 끌어오지 않는다.
