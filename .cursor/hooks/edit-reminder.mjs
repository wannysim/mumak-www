import process from 'node:process';

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readInput() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

const editTools = new Set(['Write', 'Edit', 'Delete', 'MultiEdit', 'ApplyPatch', 'EditNotebook']);

try {
  const raw = await readInput();
  const payload = raw ? JSON.parse(raw) : {};
  const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : '';

  if (!editTools.has(toolName)) {
    printJson({});
    process.exit(0);
  }

  printJson({
    additional_context:
      '[project hook] 파일을 수정했습니다. 동작 변화나 회귀 가능성이 있다면 `ci-preflight` 스킬 또는 `verifier` 서브에이전트로 검증 범위를 다시 확인하세요.',
  });
} catch {
  printJson({});
}
