import type { CodeProblem } from '@/lib/problems/types';

export const linkedListProblems: CodeProblem[] = [
  {
    id: 'list-basic',
    title: '단일 연결 리스트 직접 만들기',
    category: '링크드 리스트',
    difficulty: '기본',
    minutes: 25,
    description: '배열로 흉내 내지 않고 노드의 next를 연결해 삽입·삭제를 구현하세요.',
    contract:
      'solve(operations) → {head, tail, size}. 노드 {value:number,next:Node|null}. ["append",v], ["prepend",v], ["delete",v]는 값이 같은 첫 노드 삭제. 빈 리스트 head/tail=null. tail.next=null. 입력 불변. 채점기는 실제 노드와 tail·size를 검사합니다.',
    starter: 'function solve(operations) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '빈 리스트와 한 노드 삭제 때 head와 tail을 함께 갱신하세요.',
    solution:
      "function solve(operations) {\n  let head=null, tail=null, size=0;\n  for(const [op,value] of operations) {\n    if(op==='append') {\n      const node={value,next:null};\n      if(tail) tail.next=node; else head=node;\n      tail=node; size++;\n    } else if(op==='prepend') {\n      head={value,next:head}; if(!tail) tail=head; size++;\n    } else {\n      let previous=null, node=head;\n      while(node && node.value!==value) { previous=node; node=node.next; }\n      if(!node) continue;\n      if(previous) previous.next=node.next; else head=node.next;\n      if(tail===node) tail=previous;\n      size--;\n    }\n  }\n  return {head,tail,size};\n}",
    complexity: 'append/prepend O(1), delete O(n), 노드 공간 O(n).',
    steps: [
      'head·tail·빈 상태 불변식 그리기',
      '맨 앞·중간·맨 뒤 삭제를 각각 설명',
      '없는 값과 중복 값에서 첫 노드만 제거',
    ],
    followups: ['tail만 있어도 마지막 노드를 O(1)에 지울 수 있나요?', '센티널 노드를 쓰면 어떤 분기가 없어지나요?'],
    tests: [
      {
        label: '여러 노드에서 tail 삭제',
        args: [
          [
            ['append', 1],
            ['append', 2],
            ['delete', 2],
          ],
        ],
        expected: [1],
        mode: 'list',
      },
      {
        label: '마지막 노드 삭제 직후',
        args: [
          [
            ['append', 1],
            ['delete', 1],
          ],
        ],
        expected: [],
        mode: 'list',
      },
      {
        label: '삽입과 중간 삭제',
        args: [
          [
            ['append', 1],
            ['append', 2],
            ['prepend', 0],
            ['delete', 1],
          ],
        ],
        expected: [0, 2],
        mode: 'list',
      },
      {
        label: '마지막 삭제 후 재삽입',
        args: [
          [
            ['append', 3],
            ['delete', 3],
            ['append', 5],
          ],
        ],
        expected: [5],
        mode: 'list',
      },
      {
        label: '중복 첫 노드만 삭제',
        args: [
          [
            ['append', 2],
            ['append', 2],
            ['delete', 2],
            ['delete', 9],
          ],
        ],
        expected: [2],
        mode: 'list',
      },
      {
        label: '빈 리스트',
        args: [[]],
        expected: [],
        mode: 'list',
      },
    ],
    diagram:
      'head → [0 | next] → [1 | next] → [2 | null] ← tail\n삭제 1: previous.next = node.next\nhead → [0 | next] ─────────────→ [2 | null] ← tail',
  },
  {
    id: 'list-reverse',
    title: '노드 참조를 유지하며 뒤집기',
    category: '링크드 리스트',
    difficulty: '실전',
    minutes: 25,
    description: '새 노드를 만들지 않고 next 방향을 뒤집으세요. 이전·현재·다음 포인터의 역할을 설명해 보세요.',
    contract:
      'solve(head) → newHead. 노드 {value,next}, 순환 없음. null 허용. 기존 노드의 next 변경은 허용하며 새 노드로 대체하면 실패. 반환 리스트는 같은 노드 집합을 역순으로 가리켜야 합니다. 테스트 입력 값 배열은 채점기가 실제 노드로 만듭니다.',
    starter: 'function solve(head) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: 'next를 저장한 뒤 연결을 뒤집으세요. 순서를 바꾸면 나머지 리스트를 잃습니다.',
    solution:
      'function solve(head) {\n  let previous=null, current=head;\n  while(current) {\n    const next=current.next;\n    current.next=previous;\n    previous=current; current=next;\n  }\n  return previous;\n}',
    complexity: '시간 O(n), 추가 공간 O(1). 재귀 방식은 호출 스택 O(n).',
    steps: [
      'prev / current / next를 세 단계로 그리기',
      '처리한 구간과 미처리 구간의 불변식',
      '노드 값 중복에도 참조가 보존되는지 확인',
    ],
    followups: ['m번째부터 n번째 노드까지만 뒤집으려면?', 'k개씩 묶어 뒤집을 때 마지막 짧은 묶음은?'],
    tests: [
      {
        label: '세 노드 역순',
        args: [[1, 2, 3]],
        expected: [3, 2, 1],
        mode: 'reverse',
      },
      {
        label: '중복 값의 참조',
        args: [[1, 1, 2]],
        expected: [2, 1, 1],
        mode: 'reverse',
      },
      {
        label: '단일 노드',
        args: [[8]],
        expected: [8],
        mode: 'reverse',
      },
      {
        label: '빈 리스트',
        args: [[]],
        expected: [],
        mode: 'reverse',
      },
    ],
    diagram: 'prev=null    cur=1 → 2 → 3\nprev=1→null  cur=2 → 3\nprev=2→1     cur=3\nprev=3→2→1   cur=null',
  },
  {
    id: 'list-cycle',
    title: '순환 시작 노드 찾기',
    category: '링크드 리스트',
    difficulty: '실전',
    minutes: 30,
    description: 'fast와 slow 포인터로 순환 여부와 순환이 시작하는 실제 노드를 찾으세요.',
    contract:
      'solve(head) → Node|null. 입력 노드·연결 변경 금지. 값이 아니라 실제 시작 노드 참조를 반환. 테스트의 [values,entryIndex]를 채점기가 순환 리스트로 구성하며 -1은 순환 없음. 목표는 추가 공간 O(1).',
    starter: 'function solve(head) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '만난 지점에서 한 포인터를 head로 옮기고 둘 다 한 칸씩 이동하면 입구에서 만납니다.',
    solution:
      'function solve(head) {\n  let slow=head, fast=head;\n  while(fast && fast.next) {\n    slow=slow.next; fast=fast.next.next;\n    if(slow===fast) {\n      let entry=head;\n      while(entry!==slow) { entry=entry.next; slow=slow.next; }\n      return entry;\n    }\n  }\n  return null;\n}',
    complexity: '시간 O(n), 추가 공간 O(1). Set 방식은 비교 기준으로 O(n) 공간.',
    steps: [
      '직선 길이 a·입구부터 만남 b·순환 길이 c 표시',
      '2(a+b)−(a+b)가 c의 배수인 이유',
      '입구에서 동시에 만나는 이유 설명',
    ],
    followups: ['순환 길이도 구하려면?', '두 리스트가 합류하는 노드 탐색과 어떻게 연결될까요?'],
    tests: [
      {
        label: '중간 진입',
        args: [[3, 2, 0, -4], 1],
        expected: 1,
        mode: 'cycle',
      },
      {
        label: '자기 루프',
        args: [[5], 0],
        expected: 0,
        mode: 'cycle',
      },
      {
        label: '값 중복은 순환 아님',
        args: [[1, 1, 1], -1],
        expected: -1,
        mode: 'cycle',
      },
      {
        label: '빈 리스트',
        args: [[], -1],
        expected: -1,
        mode: 'cycle',
      },
    ],
    diagram:
      'head → A → B → C → D\n           ↑       │\n           └───────┘\n직선 길이 a, 순환 길이 c를 표시해 설명하기',
  },
  {
    id: 'list-deque',
    title: '이중 연결 덱 구현',
    category: '링크드 리스트',
    difficulty: '실전',
    minutes: 35,
    description: '앞뒤 삽입·삭제를 O(1)에 지원하는 덱을 만들어 보세요. 정방향과 역방향 연결이 모두 맞아야 합니다.',
    contract:
      'solve(operations) → {head,tail,size,removed}. 노드는 {value,prev,next}. 명령 ["pushFront",v], ["pushBack",v], ["popFront"], ["popBack"]. removed는 pop 결과 순서, 빈 덱 pop은 null. head.prev=tail.next=null. 입력 불변.',
    starter: 'function solve(operations) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '노드가 하나일 때 삭제하면 양 끝을 모두 null로 만드세요.',
    solution:
      "function solve(operations) {\n  let head=null,tail=null,size=0;\n  const removed=[];\n  for(const [op,value] of operations) {\n    if(op==='pushFront') {\n      const node={value,prev:null,next:head};\n      if(head) head.prev=node; else tail=node;\n      head=node; size++;\n    } else if(op==='pushBack') {\n      const node={value,prev:tail,next:null};\n      if(tail) tail.next=node; else head=node;\n      tail=node; size++;\n    } else if(op==='popFront') {\n      removed.push(head ? head.value : null);\n      if(head) { head=head.next; size--; if(head) head.prev=null; else tail=null; }\n    } else {\n      removed.push(tail ? tail.value : null);\n      if(tail) { tail=tail.prev; size--; if(tail) tail.next=null; else head=null; }\n    }\n  }\n  return {head,tail,size,removed};\n}",
    complexity: '각 연산 O(1), 노드 공간 O(n), pop 결과 공간 O(명령 수).',
    steps: ['prev.next / next.prev 대칭 불변식', '0→1→2→1→0 전이 그리기', '양 끝 pop 후 다시 push 검증'],
    followups: ['원형 센티널 덱으로 바꾸면?', '단조 덱을 써서 이동 구간 최댓값을 구하려면?'],
    tests: [
      {
        label: '양방향 연결',
        args: [
          [
            ['pushBack', 1],
            ['pushBack', 2],
            ['pushFront', 0],
          ],
        ],
        expected: {
          values: [0, 1, 2],
          removed: [],
        },
        mode: 'deque',
      },
      {
        label: '양 끝 제거',
        args: [[['pushBack', 1], ['pushBack', 2], ['pushFront', 0], ['popFront'], ['popBack']]],
        expected: {
          values: [1],
          removed: [0, 2],
        },
        mode: 'deque',
      },
      {
        label: '소진 후 재사용',
        args: [[['popFront'], ['pushBack', 1], ['popBack'], ['pushFront', 2], ['popFront'], ['popBack']]],
        expected: {
          values: [],
          removed: [null, 1, 2, null],
        },
        mode: 'deque',
      },
    ],
    diagram:
      'null ← [head] ⇄ [middle] ⇄ [tail] → null\n분리: node.prev.next = node.next\n      node.next.prev = node.prev\n양 끝에서는 null 분기 또는 센티널 사용',
  },
  {
    id: 'lru-cache',
    title: 'LRU 캐시 설계와 구현',
    category: '링크드 리스트',
    difficulty: '심화',
    minutes: 45,
    description:
      '최근 사용한 키를 유지하고 용량 초과 시 가장 오래 사용하지 않은 키를 제거하세요. Map 조회와 이중 연결 리스트의 역할을 분리해 설명하세요.',
    contract:
      'solve(capacity, operations) → get 결과 배열. ["put",key,value], ["get",key]. 키는 문자열, 값은 정수. 없는 키는 null. get과 기존 키 put도 최근 사용으로 갱신. capacity≥0. 목표 평균 O(1) get/put. 입력 불변.',
    starter: 'function solve(capacity, operations) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: 'Map은 키→노드, 리스트 앞은 최근 사용, 뒤는 제거 대상입니다. 조회도 노드 이동을 일으킵니다.',
    solution:
      "function solve(capacity, operations) {\n  const nodes=new Map(), head={next:null}, tail={prev:head}, result=[];\n  head.next=tail;\n  function detach(node) { node.prev.next=node.next; node.next.prev=node.prev; }\n  function recent(node) {\n    node.prev=head; node.next=head.next; head.next.prev=node; head.next=node;\n  }\n  for(const [op,key,value] of operations) {\n    let node=nodes.get(key);\n    if(op==='get') {\n      result.push(node ? node.value : null);\n      if(node) { detach(node); recent(node); }\n    } else if(capacity>0) {\n      if(node) { node.value=value; detach(node); }\n      else { node={key,value}; nodes.set(key,node); }\n      recent(node);\n      if(nodes.size>capacity) { const oldest=tail.prev; detach(oldest); nodes.delete(oldest.key); }\n    }\n  }\n  return result;\n}",
    complexity:
      '평균 get/put O(1), 캐시 O(capacity), 결과 공간 O(get 수). 자동 검사는 동작을 확인하며 시간 복잡도는 별도로 설명·검토합니다.',
    steps: [
      'Map만 / 배열만 썼을 때 비용 비교',
      '노드 분리·앞에 삽입을 화이트보드로 그리기',
      'get 갱신·덮어쓰기·capacity=0 검증',
    ],
    followups: [
      'TTL과 LRU는 어떤 정책 차이가 있나요?',
      '여러 요청이 같은 키를 동시에 로드하면 어떻게 중복을 합칠까요?',
      'LFU에서는 어떤 구조가 추가될까요?',
    ],
    tests: [
      {
        label: 'get이 최근 사용 갱신',
        args: [
          2,
          [
            ['put', 'a', 1],
            ['put', 'b', 2],
            ['get', 'a'],
            ['put', 'c', 3],
            ['get', 'b'],
            ['get', 'c'],
          ],
        ],
        expected: [1, null, 3],
      },
      {
        label: '기존 키 덮어쓰기',
        args: [
          2,
          [
            ['put', 'a', 1],
            ['put', 'b', 2],
            ['put', 'a', 4],
            ['put', 'c', 3],
            ['get', 'a'],
            ['get', 'b'],
          ],
        ],
        expected: [4, null],
      },
      {
        label: '용량 영',
        args: [
          0,
          [
            ['put', 'a', 1],
            ['get', 'a'],
          ],
        ],
        expected: [null],
      },
      {
        label: '특수 키와 영 값',
        args: [
          1,
          [
            ['put', '__proto__', 0],
            ['get', '__proto__'],
            ['put', 'x', 2],
            ['get', '__proto__'],
          ],
        ],
        expected: [0, null],
      },
    ],
    diagram:
      'Map: a → nodeA, b → nodeB\n최근 HEAD ⇄ A ⇄ B ⇄ TAIL 오래됨\nget(b): HEAD ⇄ B ⇄ A ⇄ TAIL\nput(c), 용량 2: HEAD ⇄ C ⇄ B ⇄ TAIL\n제거: A를 리스트와 Map 양쪽에서 삭제',
  },
  {
    id: 'list-random',
    title: '임의 포인터 리스트 깊은 복사',
    category: '링크드 리스트',
    difficulty: '심화',
    minutes: 40,
    description:
      'next 외에 random 포인터가 있는 리스트를 복사하세요. 값만 복사하거나 random을 원본에 연결하면 안 됩니다.',
    contract:
      'solve(head) → clonedHead. 노드는 {value,next,random}. next 순환 없음. random은 null 또는 같은 리스트 노드(자기 자신 포함). 입력 변경 금지, 모든 복사 노드는 원본과 다른 참조. 테스트 [values,randomIndexes]에서 -1은 null.',
    starter: 'function solve(head) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '첫 순회에서 원본→복사 Map을 만들고 두 번째에서 next와 random을 이어보세요.',
    solution:
      'function solve(head) {\n  const copies=new Map();\n  for(let node=head;node;node=node.next) copies.set(node,{value:node.value,next:null,random:null});\n  for(let node=head;node;node=node.next) {\n    const copy=copies.get(node);\n    copy.next=copies.get(node.next) || null;\n    copy.random=copies.get(node.random) || null;\n  }\n  return copies.get(head) || null;\n}',
    complexity:
      '시간 O(n), 추가 Map O(n), 출력 노드 O(n). 입력을 일시 변경해도 된다면 끼워 넣기 방식으로 Map을 제거할 수 있습니다.',
    steps: ['동일 값과 동일 노드 구분', 'random 순환도 대응하는 2단계 복사', '원본 보존·독립 참조 검증'],
    followups: [
      '원본 사이에 복사 노드를 끼우는 O(1) 추가 공간 풀이를 그려보세요.',
      '일반 그래프 복사와 무엇이 같고 다른가요?',
    ],
    tests: [
      {
        label: '자기 참조와 앞뒤 연결',
        args: [
          [7, 7, 3],
          [2, 1, 0],
        ],
        expected: {
          values: [7, 7, 3],
          random: [2, 1, 0],
        },
        mode: 'copy-random',
      },
      {
        label: 'null random',
        args: [
          [1, 2],
          [-1, -1],
        ],
        expected: {
          values: [1, 2],
          random: [-1, -1],
        },
        mode: 'copy-random',
      },
      {
        label: '빈 복사',
        args: [[], []],
        expected: {
          values: [],
          random: [],
        },
        mode: 'copy-random',
      },
    ],
  },
];
