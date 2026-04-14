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

function buildAskResponse(reason, command) {
  return {
    continue: true,
    permission: 'ask',
    user_message: reason,
    agent_message: `[project hook] Review this command before running: ${command}`,
  };
}

function getResponse(command) {
  const normalized = command.trim();

  if (!normalized) {
    return { continue: true, permission: 'allow' };
  }

  if (/\bgit\s+push\b/.test(normalized)) {
    return buildAskResponse('`git push` 실행 전 브랜치와 원격을 다시 확인해 주세요.', normalized);
  }

  if (/\brm\s+-rf\b/.test(normalized)) {
    return buildAskResponse('대량 삭제 명령입니다. 삭제 대상 경로를 다시 확인해 주세요.', normalized);
  }

  if (/\b(prisma\s+migrate\s+reset|prisma\s+db\s+push)\b/.test(normalized)) {
    return buildAskResponse('데이터베이스 상태를 바꿀 수 있는 명령입니다. 의도를 다시 확인해 주세요.', normalized);
  }

  if (/\b(drop\s+table|truncate\s+table|delete\s+from|update\s+\w+\s+set|insert\s+into)\b/i.test(normalized)) {
    return buildAskResponse('SQL write 또는 destructive query로 보입니다. 다시 확인해 주세요.', normalized);
  }

  return { continue: true, permission: 'allow' };
}

try {
  const raw = await readInput();
  const payload = raw ? JSON.parse(raw) : {};
  const command = typeof payload.command === 'string' ? payload.command : '';

  printJson(getResponse(command));
} catch {
  printJson({ continue: true, permission: 'allow' });
}
