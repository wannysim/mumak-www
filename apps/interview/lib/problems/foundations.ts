import type { CodeProblem } from '@/lib/problems/types';

export const foundationProblems: CodeProblem[] = [
  {
    id: 'cart',
    category: '배열·해시',
    difficulty: '기본',
    complexity: '시간 O(n), 추가 공간 O(1).',
    steps: ['합계와 할인 정책 확인', '빈 목록과 쿠폰 초과 사례 설명', 'reduce 구현과 테스트'],
    followups: ['비율 할인과 반올림 정책은 어디에 둘까요?', '클라이언트 합계만 믿고 결제해도 될까요?'],
    title: '장바구니 합계 계산',
    minutes: 10,
    description: '품목별 금액을 합하고 정액 쿠폰을 적용하세요. 합계는 0보다 작아지면 안 됩니다.',
    contract:
      'solve(items, coupon) → number. price, quantity, coupon은 0 이상의 정수이며 모든 계산은 안전 정수 범위입니다. 통화는 원 단위입니다.',
    starter: 'function solve(items, coupon) {\n  // 품목 합계에서 쿠폰을 차감하세요.\n  return 0;\n}',
    hint: 'reduce로 price × quantity를 합한 뒤 Math.max로 최솟값을 제한해 보세요.',
    solution:
      'function solve(items, coupon) {\n  const subtotal = items.reduce(\n    (sum, item) => sum + item.price * item.quantity, 0\n  );\n  return Math.max(0, subtotal - coupon);\n}',
    tests: [
      {
        label: '여러 품목과 쿠폰',
        args: [
          [
            { price: 1200, quantity: 2 },
            { price: 800, quantity: 1 },
          ],
          500,
        ],
        expected: 2700,
      },
      { label: '빈 장바구니', args: [[], 0], expected: 0 },
      { label: '합계보다 큰 쿠폰', args: [[{ price: 500, quantity: 1 }], 1000], expected: 0 },
      {
        label: '수량 0과 쿠폰 없음',
        args: [
          [
            { price: 1000, quantity: 0 },
            { price: 300, quantity: 3 },
          ],
          0,
        ],
        expected: 900,
      },
    ],
  },
  {
    id: 'events',
    category: '배열·해시',
    difficulty: '기본',
    complexity: '평균 시간 O(n), 추가 공간 O(n). Set은 ID 중복만 추적합니다.',
    steps: ['최초 값과 순서 보존 확인', 'Set의 역할 설명', '특수 키와 입력 불변 검증'],
    followups: ['마지막 이벤트를 남기도록 바꾸면?', '이벤트가 메모리보다 크면?'],
    title: '중복 이벤트 정리',
    minutes: 10,
    description: '재전송된 이벤트에서 ID별 최초 이벤트만 남기세요. 원래 순서를 보존하고 입력을 수정하지 마세요.',
    contract:
      'solve(events) → array. 각 이벤트는 문자열 id와 value를 갖습니다. 같은 id에서는 처음 등장한 객체를 유지합니다.',
    starter: 'function solve(events) {\n  return events;\n}',
    hint: 'Set으로 이미 본 ID를 추적하세요. Map을 무조건 덮어쓰면 마지막 이벤트를 남기게 됩니다.',
    solution:
      'function solve(events) {\n  const seen = new Set();\n  return events.filter(event => {\n    if (seen.has(event.id)) return false;\n    seen.add(event.id);\n    return true;\n  });\n}',
    tests: [
      {
        label: '최초 이벤트 유지',
        mode: 'events',
        args: [
          [
            { id: 'a', value: 1 },
            { id: 'b', value: 2 },
            { id: 'a', value: 99 },
          ],
        ],
        expected: [
          { id: 'a', value: 1 },
          { id: 'b', value: 2 },
        ],
      },
      { label: '빈 배열', args: [[]], expected: [], mode: 'events' },
      {
        label: '특수한 문자열 ID',
        mode: 'events',
        args: [
          [
            { id: '__proto__', value: 1 },
            { id: '', value: 2 },
            { id: '__proto__', value: 3 },
          ],
        ],
        expected: [
          { id: '__proto__', value: 1 },
          { id: '', value: 2 },
        ],
      },
    ],
  },
  {
    id: 'queue',
    category: '프론트엔드·비동기',
    difficulty: '실전',
    complexity: '작업 관리 시간 O(n), 결과 공간 O(n), 실행 루프 O(min(n, limit)).',
    steps: ['순서와 동시 실행 계약 확인', '공유 인덱스가 안전한 이유 설명', '서로 다른 지연 시간으로 검증'],
    followups: ['실패하면 나머지를 중단할지 계속할지?', '취소와 재시도에도 동시 실행 제한을 유지하려면?'],
    title: '동시 실행 수 제한하기',
    minutes: 15,
    description:
      '비동기 작업을 limit개까지만 동시에 실행하세요. 완료 순서와 관계없이 결과는 입력 순서로 반환해야 합니다.',
    contract:
      'async solve(tasks, limit) → Promise<array>. tasks는 인자 없는 Promise 반환 함수의 배열입니다. limit은 1 이상의 정수이고, 이 연습에서는 모든 작업이 성공합니다.',
    starter:
      'async function solve(tasks, limit) {\n  // 동시 실행 수와 결과 순서를 함께 지켜보세요.\n  return Promise.all(tasks.map(task => task()));\n}',
    hint: '공유 인덱스를 증가시키며 다음 작업을 가져가는 실행 루프를 limit개 만드세요. 결과는 가져간 인덱스 위치에 저장합니다.',
    solution:
      'async function solve(tasks, limit) {\n  let next = 0;\n  const results = new Array(tasks.length);\n  async function worker() {\n    while (next < tasks.length) {\n      const index = next++;\n      results[index] = await tasks[index]();\n    }\n  }\n  await Promise.all(\n    Array.from({ length: Math.min(limit, tasks.length) }, worker)\n  );\n  return results;\n}',
    tests: [
      { label: '최대 2개 실행 · 입력 순서 유지', args: [[40, 10, 20, 5], 2], expected: [0, 1, 2, 3], queue: true },
      { label: '직렬 실행', args: [[10, 5, 10], 1], expected: [0, 1, 2], queue: true },
      { label: '빈 작업 목록', args: [[], 3], expected: [], queue: true },
    ],
  },
];
