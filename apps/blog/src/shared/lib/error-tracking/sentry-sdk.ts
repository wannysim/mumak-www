// lazy 청크의 진입점. `import('@sentry/nextjs')`를 직접 하면 모듈 네임스페이스 전체
// (replay, feedback 등)가 살아남아 tree-shaking이 안 된다. 쓰는 export만 정적으로 다시 내보내
// 번들러가 나머지를 걷어내게 한다.
export { captureException, init } from '@sentry/nextjs';
