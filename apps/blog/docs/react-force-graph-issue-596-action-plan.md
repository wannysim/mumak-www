# react-force-graph issue #596 조사 및 PR 액션 플랜

## 배경

- 관련 이슈: https://github.com/vasturiano/react-force-graph/issues/596
- 작성자: `wannysim`
- 증상: Next.js App Router 환경에서 `react-force-graph-3d`가 렌더된 페이지를 떠난 뒤 browser back/forward navigation으로 다시 돌아오면 graph canvas는 보이지만 drag, zoom, node click 같은 interaction이 동작하지 않는 문제
- 우리 사용처: `apps/blog`의 `/[locale]/graph` 페이지

이 문서는 이슈 #596에 작성했던 원인 분석이 현재도 유효한지, 우리 코드의 실제 사용 방식에 해당하는지, upstream PR을 만들기 위해 어떤 작업을 해야 하는지 정리한다.

## 현재 결론

이슈 #596의 핵심 원인 분석은 여전히 유효하다.

우리 `apps/blog` 사용 방식도 재현 조건에 해당한다. 현재 `apps/blog`는 `react-force-graph-3d@1.29.1`을 사용하고, lockfile상 이 패키지는 `react-kapsule@2.5.7`에 의존한다. npm 기준으로 `react-kapsule` 최신 버전도 `2.5.7`이므로, 이 문제가 upstream release로 해결된 상태는 아니다.

PR contribution 대상은 `react-force-graph`가 아니라 `react-kapsule`이 맞다. `react-force-graph-3d`의 React wrapper가 내부적으로 `react-kapsule`을 사용하고, 문제가 되는 lifecycle guard는 `react-kapsule`의 `useEffectOnce` 구현에 있기 때문이다.

## maintainer 답변 요약

`react-force-graph` maintainer는 이슈 #596에 대해 다음 취지로 답변했다.

- unmount 이후 React fiber가 다시 remount될 수 있다는 동작은 maintainer가 익숙하지 않은 영역이다.
- 기존 코드는 unmount 이후 internal state가 dereference되고 garbage collected된다고 가정한다.
- 설명한 접근이 기존 앱에 부작용을 만들 것 같지는 않다.
- `react-kapsule` 쪽으로 PR을 열어도 된다.

따라서 PR을 열 때는 이슈 #596을 명시적으로 링크하고, `react-kapsule`의 cleanup 이후 재초기화 문제를 regression test로 고정하는 방향이 적절하다.

## 우리 코드와의 대응 관계

### dependency 상태

`apps/blog/package.json`:

- `react`: `^19.2.6`
- `react-dom`: `^19.2.6`
- `react-force-graph-3d`: `^1.29.1`

`pnpm-lock.yaml`:

- `react-force-graph-3d@1.29.1`
- `3d-force-graph@1.79.1`
- `react-kapsule@2.5.7`
- `three-render-objects@1.40.4`

현재 npm latest 확인 결과:

- `react-kapsule`: `2.5.7`
- `react-force-graph-3d`: `1.29.1`
- `3d-force-graph`: `1.80.0`
- `three-render-objects`: `1.42.0`

즉 `react-kapsule`과 `react-force-graph-3d`는 latest에서도 아직 같은 상태다.

### route 및 mount 조건

`apps/blog/app/[locale]/(immersive)/graph/page.tsx`에서 `GraphView`를 렌더한다.

`apps/blog/src/features/graph/ui/graph-view.tsx`는 `GraphCanvas`를 다음처럼 client-only dynamic component로 올린다.

```tsx
const GraphCanvas = dynamic(() => import('./graph-canvas').then(m => ({ default: m.GraphCanvas })), {
  ssr: false,
});
```

`apps/blog/src/features/graph/ui/graph-toolbar.tsx`의 back button은 history가 있으면 `router.back()`을 호출한다.

```tsx
const hasHistory = window.history.length > 1 && document.referrer !== '';
if (hasHistory) {
  router.back();
} else {
  router.push(`/${locale}`);
}
```

따라서 사용자는 graph page를 client-side navigation으로 떠났다가 browser history 기반으로 되돌아오는 경로를 실제로 자주 밟는다.

### ForceGraph 사용 방식

`apps/blog/src/features/graph/ui/graph-canvas.tsx`에서 `react-force-graph-3d`를 동적으로 import하고 다음 interaction props를 사용한다.

- `onNodeClick`
- `enableNodeDrag={true}`
- `enableNavigationControls={true}`
- `ref={fgRef}`

이슈 #596의 증상인 drag, zoom, click interaction 불능과 직접 연결된다.

## 현재 workaround

`GraphCanvas`에는 이미 workaround가 있다.

요지는 다음과 같다.

1. `GraphCanvas` mount 후 `hasMountedRef.current = true`로 표시한다.
2. 같은 component instance가 다시 effect를 받는 상황을 감지하면 `graphKey`를 증가시킨다.
3. `<ForceGraph key={graphKey}>`로 child component를 강제 remount한다.

```tsx
const hasMountedRef = useRef(false);
const [graphKey, setGraphKey] = useState(0);

useEffect(() => {
  if (FORCE_GRAPH_REMOUNT_WORKAROUND && hasMountedRef.current) {
    setGraphKey(prev => prev + 1);
  }
  hasMountedRef.current = true;

  // ...
}, []);

<ForceGraph key={FORCE_GRAPH_REMOUNT_WORKAROUND ? graphKey : undefined} />;
```

이 workaround는 upstream fix 전까지 타당하다. 다만 upstream fix가 merge/release되면 실제 E2E로 확인한 뒤 제거하는 것이 목표다.

## 원인 분석

문제가 되는 layer는 다음 순서로 이어진다.

1. `react-force-graph-3d`는 React wrapper다.
2. 이 wrapper는 `react-kapsule`을 사용해 kapsule component lifecycle을 React lifecycle에 연결한다.
3. `react-kapsule`의 `useEffectOnce`는 Strict Mode의 development-only dummy cleanup을 피하려고 `effectCalled`, `renderAfterCalled` ref를 사용한다.
4. real cleanup 이후 이 ref들이 reset되지 않으면, React가 같은 hook state/ref를 재사용하는 remount 경로에서 다음 setup이 실행되지 않는다.
5. 그 결과 `comp(domEl.current)`가 다시 호출되지 않고 ForceGraph instance가 정상적으로 재초기화되지 않는다.
6. canvas DOM은 남거나 다시 보일 수 있지만, 내부 controls/renderer/listeners 상태가 복구되지 않아 interaction이 죽는다.

핵심은 real cleanup 뒤에 `effectCalled`와 `renderAfterCalled`가 계속 `true`로 남는다는 점이다.

## 3d-force-graph #732와의 관계

연관 이슈: https://github.com/vasturiano/3d-force-graph/issues/732

기존 조사에서는 `3d-force-graph`의 `_destructor`가 controls, renderer, scene resource cleanup을 충분히 하지 않는 문제도 함께 언급했다.

이 부분은 현재 upstream에서 별도 처리된 상태에 가깝다. maintainer는 #732에서 `three-render-objects` dependency destructor가 이 cleanup을 처리한다고 답했다. 최신 `3d-force-graph@1.80.0`은 `three-render-objects:^1.41`에 의존하고, 현재 최신 `three-render-objects`는 `1.42.0`이다.

다만 우리 lockfile은 아직 `3d-force-graph@1.79.1`과 `three-render-objects@1.40.4`를 사용한다. 따라서 resource cleanup 개선을 위해 dependency update를 검토할 수는 있다.

하지만 #596의 핵심 원인인 `react-kapsule` 재초기화 skip 문제는 `3d-force-graph` update만으로 해결되지 않는다. PR의 중심은 #732가 아니라 #596과 `react-kapsule`이어야 한다.

## upstream PR 목표

목표는 `react-kapsule`에서 real cleanup 이후 internal lifecycle refs를 reset하여, 같은 hook state/ref가 재사용되는 remount 경로에서도 kapsule component initialization이 다시 실행되도록 하는 것이다.

예상 수정 위치:

- `react-kapsule/src/index.js`
- `useEffectOnce`

예상 수정 방향:

```js
return () => {
  if (!renderAfterCalled.current) return;

  try {
    destroyFunc.current?.();
  } finally {
    destroyFunc.current = undefined;
    effectCalled.current = false;
    renderAfterCalled.current = false;
  }
};
```

중요한 조건:

- Strict Mode dummy cleanup에서는 destructor를 실행하지 않아야 한다.
- real cleanup에서는 기존 destructor를 실행해야 한다.
- real cleanup 이후에는 다음 mount에서 setup이 다시 실행될 수 있도록 refs를 reset해야 한다.
- destructor가 throw하더라도 refs는 reset되는 편이 다음 lifecycle 복구 관점에서 안전하다.

## PR 전후 재현 테스트 suite 계획

### 목적

PR 전에는 실패하고, PR 후에는 통과하는 regression test를 upstream repo에 추가한다.

테스트는 browser back/forward 자체를 그대로 E2E로 재현하기보다, `react-kapsule`의 lifecycle invariant를 최소 단위로 검증하는 것이 좋다.

검증할 invariant:

- real cleanup 이후 component가 다시 mounted/setup될 때 kapsule initialization이 다시 실행된다.
- Strict Mode dummy cleanup에서는 destructor가 실행되지 않는다.
- real cleanup에서는 destructor가 정확히 실행된다.

### test infra 확인

먼저 `react-kapsule` repo에 기존 test infra가 있는지 확인한다.

있으면 기존 runner와 style을 따른다.

없으면 최소한의 test infra를 추가한다.

후보:

- `vitest`
- `@testing-library/react`
- `jsdom`

### 테스트 케이스 후보

1. `runs kapsule initialization on first mount`
   - 첫 mount에서 kapsule component 생성/init이 호출되는지 확인한다.

2. `runs destructor on real unmount`
   - render 이후 실제 unmount에서 destructor가 호출되는지 확인한다.

3. `reruns initialization after real cleanup when hook state is reused`
   - bug의 핵심 regression test다.
   - real cleanup 이후 같은 hook state/ref가 재사용되는 remount-like 경로에서 initialization이 다시 실행되어야 한다.

4. `does not run destructor during StrictMode dummy cleanup`
   - 기존 `useEffectOnce`가 보호하려던 Strict Mode 동작을 깨지 않았는지 확인한다.

### 재현 방식 메모

가장 어려운 부분은 React 내부 fiber reuse 상황을 test runner에서 안정적으로 재현하는 것이다.

가능한 접근:

- `react-kapsule` public wrapper를 실제로 렌더하고 unmount/remount하면서 init/destructor call count를 검증한다.
- 이 방식으로 bug가 바로 재현되지 않으면, `useEffectOnce`를 test 가능한 internal unit으로 분리하거나 export하지 않는 helper 단위에서 lifecycle sequence를 검증하는 구조를 검토한다.
- upstream maintainer가 작은 변경을 선호할 가능성이 있으므로, test-only export나 큰 구조 변경은 최후 수단으로 둔다.

## PR 본문 초안

제목 후보:

```text
Fix useEffectOnce re-initialization after real cleanup
```

본문에 포함할 내용:

```md
This fixes a lifecycle edge case where `useEffectOnce` does not allow a kapsule component to initialize again after a real cleanup if React reuses the same hook state/ref during a remount-like navigation path.

In that case `effectCalled` and `renderAfterCalled` remain `true`, so the next setup skips initialization and the wrapped component is left in a torn-down state.

The change resets the internal refs after the real destructor runs, while preserving the existing guard that avoids running the destructor during React Strict Mode's development-only dummy cleanup.

Refs vasturiano/react-force-graph#596.
```

테스트 섹션:

```md
Tests:

- Added regression coverage for re-initialization after real cleanup.
- Verified Strict Mode dummy cleanup still does not call the destructor.
```

## 우리 repo 후속 작업

upstream PR이 merge되고 `react-kapsule` 새 버전이 release된 뒤 진행한다.

1. `apps/blog` dependency lock 갱신
   - `react-kapsule` 새 버전이 `react-force-graph-3d` dependency range로 자동 반영되는지 확인한다.
   - 필요하면 lockfile override 또는 upstream package update를 검토한다.

2. `3d-force-graph` update 검토
   - 별도 cleanup 개선을 위해 `3d-force-graph@1.80.0` 이상으로 lock이 올라가는지 확인한다.
   - 이 작업은 #596 fix와 별개로 다룬다.

3. workaround 제거 가능성 확인
   - `apps/blog/src/features/graph/ui/graph-canvas.tsx`의 `FORCE_GRAPH_REMOUNT_WORKAROUND` 제거를 검토한다.
   - 제거 전 browser back/forward E2E를 추가하거나 수동 재현으로 interaction 복구를 확인한다.

4. E2E 보강
   - 현재 `apps/blog/e2e/graph.spec.ts`는 graph page 진입, tab, back button, canvas/fallback visibility를 확인한다.
   - 여기에 다음 시나리오를 추가한다.

```ts
test('should keep graph interactions after browser back and forward navigation', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('link', { name: 'Graph' }).click();
  await expect(page).toHaveURL(/\/en\/graph/);
  await expect(page.locator('canvas')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/en$/);

  await page.goForward();
  await expect(page).toHaveURL(/\/en\/graph/);
  await expect(page.locator('canvas')).toBeVisible();

  // 가능하면 wheel/drag/click 이후 observable state까지 검증한다.
});
```

canvas interaction은 DOM assertion만으로 충분하지 않을 수 있으므로, 가능하면 다음 중 하나를 함께 검토한다.

- node click 이후 detail panel open 여부
- wheel/drag 이후 canvas screenshot 또는 camera state 변화
- test-only debug hook 없이 관찰 가능한 UI state 확보

## 작업 순서

1. `react-kapsule` fork/clone
2. 기존 test/build tooling 확인
3. issue #596 재현 조건과 maintainer 답변을 PR 설명용으로 정리
4. regression test 추가
5. test가 현재 코드에서 실패하는지 확인
6. `useEffectOnce` cleanup reset 수정
7. test 통과 확인
8. lint/build 등 repo 검증 실행
9. branch push
10. PR 생성
11. PR 본문에 `Refs vasturiano/react-force-graph#596` 포함
12. PR merge/release 이후 `apps/blog` dependency update 및 workaround 제거 검토

## 리스크와 확인 포인트

- React fiber reuse는 public API로 명시적으로 제어하기 어려우므로, upstream test에서 실제 browser history를 완전히 재현하기보다 lifecycle invariant를 테스트하는 편이 안정적이다.
- Strict Mode dummy cleanup 방어를 깨면 기존 사용자가 development에서 destructor side effect를 겪을 수 있다.
- real cleanup 이후 refs reset은 기존 정상 unmount-only 앱에는 실질적인 부작용이 거의 없어야 한다.
- destructor가 여러 번 호출되지 않는지 call count test가 필요하다.
- `3d-force-graph` resource cleanup 문제와 `react-kapsule` re-initialization 문제를 PR에서 섞지 않는 편이 review가 쉽다.

## 현재 판단

PR을 진행할 근거는 충분하다.

가장 설득력 있는 PR은 큰 구조 변경 없이 `react-kapsule`의 `useEffectOnce` cleanup branch만 수정하고, 다음 두 가지를 테스트로 고정하는 형태다.

1. real cleanup 후 re-initialization 가능
2. Strict Mode dummy cleanup guard 유지

이 방향이면 maintainer가 이슈 #596에서 허용한 범위와도 맞고, 우리 `apps/blog`의 실제 workaround 제거 경로와도 직접 연결된다.
