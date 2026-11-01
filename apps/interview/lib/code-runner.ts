import { workerSource } from '@/lib/code-worker';
import type { CodeTest } from '@/lib/curriculum';

type TestResult = { label: string; passed: boolean; detail: string };
export type RunResult = { results: TestResult[]; error?: string };

// User code is evaluated only in a disposable Worker created by an opaque-origin frame.
// Blob workers inherit the frame CSP: no network, no parent-origin storage/cookies.

export function runCode(code: string, tests: CodeTest[], signal?: AbortSignal): Promise<RunResult> {
  if (signal?.aborted) return Promise.resolve({ results: [], error: '실행이 취소됐어요.' });
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.title = '격리된 코드 실행 환경';
    frame.hidden = true;
    const id = crypto.randomUUID();
    let finished = false;
    function finish(result: RunResult) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      signal?.removeEventListener('abort', cancel);
      frame.remove();
      resolve(result);
    }
    function cancel() {
      finish({ results: [], error: '실행이 취소됐어요.' });
    }
    const timeout = window.setTimeout(
      () => finish({ results: [], error: '실행 환경을 시작하지 못했어요. 이 브라우저에서 다시 시도해 주세요.' }),
      5000
    );
    function receive(event: MessageEvent) {
      if (event.source !== frame.contentWindow || event.data?.id !== id) return;
      if (event.data.ready) {
        frame.contentWindow?.postMessage({ id, code, tests }, '*');
        return;
      }
      const result = event.data.result;
      if (
        result &&
        Array.isArray(result.results) &&
        result.results.length <= tests.length &&
        result.results.every(
          (item: unknown) =>
            item !== null &&
            typeof item === 'object' &&
            'label' in item &&
            typeof item.label === 'string' &&
            'passed' in item &&
            typeof item.passed === 'boolean' &&
            'detail' in item &&
            typeof item.detail === 'string'
        ) &&
        (result.error === undefined || typeof result.error === 'string')
      )
        finish(result);
      else finish({ results: [], error: '실행 결과 형식이 올바르지 않아요.' });
    }
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', cancel, { once: true });
    frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none';"><script>
      const id = ${JSON.stringify(id)};
      let started = false;
      window.onmessage = event => {
        if (event.source !== parent || event.data.id !== id || started) return;
        started = true;
        let worker, url, timer;
        const finish = result => { clearTimeout(timer); if(worker) worker.terminate(); if(url) URL.revokeObjectURL(url); parent.postMessage({ id, result }, '*'); };
        try {
          url = URL.createObjectURL(new Blob([${JSON.stringify(workerSource)}], { type: 'text/javascript' }));
          worker = new Worker(url);
          timer = setTimeout(() => finish({ results: [], error: '2초 실행 제한에 도달했어요. 반복문의 종료 조건을 확인해 주세요.' }), 2000);
          worker.onmessage = event => finish(event.data);
          worker.onerror = () => finish({ results: [], error: '코드를 실행하지 못했어요. 문법과 브라우저 지원을 확인해 주세요.' });
          worker.postMessage(event.data);
        } catch { finish({ results: [], error: '격리된 실행 환경을 시작하지 못했어요.' }); }
      };
      parent.postMessage({ id, ready: true }, '*');
    </script>`;
    document.body.append(frame);
  });
}
