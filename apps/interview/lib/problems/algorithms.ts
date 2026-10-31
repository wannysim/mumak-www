import type { CodeProblem } from '@/lib/problems/types';

export const algorithmProblems: CodeProblem[] = [
  {
    id: 'window-fixed',
    title: '연속 k일 최대 매출',
    category: '슬라이딩 윈도우',
    difficulty: '기본',
    minutes: 15,
    description: '고정 크기 구간의 합을 다시 계산하지 않고 한 칸씩 갱신하세요. 음수 매출 보정도 포함합니다.',
    contract:
      'solve(values, k) → number | null. 정수 배열, 1 ≤ k. k가 길이보다 크면 null. 빈 배열도 null. 입력은 수정하지 않습니다. 모든 합은 안전 정수입니다.',
    starter: 'function solve(values, k) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '첫 구간 합으로 최댓값을 초기화하세요. 0으로 시작하면 전부 음수일 때 틀립니다.',
    solution:
      'function solve(values, k) {\n  if (k > values.length) return null;\n  let sum = 0;\n  for (let i = 0; i < k; i++) sum += values[i];\n  let best = sum;\n  for (let right = k; right < values.length; right++) {\n    sum += values[right] - values[right - k];\n    best = Math.max(best, sum);\n  }\n  return best;\n}',
    complexity: '시간 O(n), 공간 O(1). 각 값은 최대 두 번 더하거나 뺍니다.',
    steps: ['O(nk) 풀이부터 비용 설명', '나가는 값과 들어오는 값 표시', '전부 음수·k=n·빈 입력 확인'],
    followups: [
      '매출이 스트림으로 계속 들어오면 어떤 값을 보관할까요?',
      '합이 아니라 최댓값이면 똑같이 뺄 수 있을까요?',
    ],
    tests: [
      {
        label: '겹치는 구간',
        args: [[2, 1, 5, 1, 3, 2], 3],
        expected: 9,
      },
      {
        label: '전부 음수',
        args: [[-5, -2, -8], 2],
        expected: -7,
      },
      {
        label: '전체 길이',
        args: [[3, 2], 2],
        expected: 5,
      },
      {
        label: '구간 없음',
        args: [[], 1],
        expected: null,
      },
      {
        label: '한 칸',
        args: [[1, -1, 8], 1],
        expected: 8,
      },
    ],
  },
  {
    id: 'window-unique',
    title: '중복 없는 가장 긴 구간',
    category: '슬라이딩 윈도우',
    difficulty: '실전',
    minutes: 25,
    description: '문자열에서 중복 문자가 없는 연속 구간의 최대 길이를 구하세요. 왼쪽 경계가 뒤로 움직이지 않게 하세요.',
    contract:
      'solve(text) → number. ASCII 문자열이며 길이 0~100000. 입력 불변. 부분수열이 아니라 연속 부분문자열입니다.',
    starter: 'function solve(text) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '문자별 마지막 위치를 저장하고 left = Math.max(left, last + 1)로 갱신하세요.',
    solution:
      'function solve(text) {\n  const last = new Map();\n  let left = 0, best = 0;\n  for (let right = 0; right < text.length; right++) {\n    const previous = last.get(text[right]);\n    if (previous !== undefined) left = Math.max(left, previous + 1);\n    last.set(text[right], right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}',
    complexity: '시간 O(n), 공간 O(min(n, 문자 집합 크기)).',
    steps: [
      '중복 제거 후 유지할 불변식 설명',
      'abba에서 left가 뒤로 가는 오류 추적',
      '각 포인터가 n번 이하 이동하는 이유 설명',
    ],
    followups: ['최대 k종의 문자를 허용한다면?', '이모지와 결합 문자를 한 글자로 센다면 계약이 어떻게 달라질까요?'],
    tests: [
      {
        label: '경계 후퇴 방지',
        args: ['abba'],
        expected: 2,
      },
      {
        label: '빈 문자열',
        args: [''],
        expected: 0,
      },
      {
        label: '전부 동일',
        args: ['aaaaa'],
        expected: 1,
      },
      {
        label: '중간 중복',
        args: ['pwwkew'],
        expected: 3,
      },
      {
        label: '마지막 위치 0',
        args: ['abca'],
        expected: 3,
      },
    ],
    diagram: '문자   a b b a\nright  0 1 2 3\nleft   0 0 2 2\n유지: [left, right] 안에는 중복 없음',
  },
  {
    id: 'window-cover',
    title: '필요한 문자를 덮는 최소 구간',
    category: '슬라이딩 윈도우',
    difficulty: '심화',
    minutes: 40,
    description:
      '필요한 문자의 개수까지 모두 포함하는 가장 짧은 연속 구간을 찾으세요. 빈도와 종류 수를 구분해야 합니다.',
    contract:
      'solve(text, required) → string. ASCII 문자열. 없거나 required가 비면 빈 문자열. 길이가 같으면 가장 왼쪽 구간. 입력 불변.',
    starter: 'function solve( text, required) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '필요 개수에서 창 안의 개수를 빼서 추적하세요. 모두 채우면 왼쪽을 줄입니다.',
    solution:
      "function solve(text, required) {\n  if (!required.length) return '';\n  const need = new Map();\n  for (const c of required) need.set(c, (need.get(c) || 0) + 1);\n  let missing = required.length, left = 0, start = 0, size = Infinity;\n  for (let right = 0; right < text.length; right++) {\n    const c = text[right];\n    if (need.has(c)) {\n      if (need.get(c) > 0) missing--;\n      need.set(c, need.get(c) - 1);\n    }\n    while (missing === 0) {\n      if (right - left + 1 < size) { start = left; size = right - left + 1; }\n      const leaving = text[left++];\n      if (need.has(leaving)) {\n        need.set(leaving, need.get(leaving) + 1);\n        if (need.get(leaving) > 0) missing++;\n      }\n    }\n  }\n  return size === Infinity ? '' : text.slice(start, start + size);\n}",
    complexity: '시간 O(n+m), 공간 O(문자 집합 크기). 이중 while이지만 left와 right는 각각 n번 이하 이동합니다.',
    steps: ['중복 요구 aa를 예시로 계약 확인', 'missing=0일 때만 축소', '같은 길이·불가능·빈 조건 검증'],
    followups: [
      '합계가 목표 이상인 최소 구간과 어떤 점이 같나요?',
      '음수 값이 있는 합계 문제에도 단조롭게 축소할 수 있나요?',
    ],
    tests: [
      {
        label: '중복 요구',
        args: ['caaab', 'aab'],
        expected: 'aab',
      },
      {
        label: '가운데 최소 구간',
        args: ['ADOBECODEBANC', 'ABC'],
        expected: 'BANC',
      },
      {
        label: '불가능',
        args: ['a', 'aa'],
        expected: '',
      },
      {
        label: '빈 요구',
        args: ['abc', ''],
        expected: '',
      },
      {
        label: '동률 왼쪽',
        args: ['baxb', 'ab'],
        expected: 'ba',
      },
    ],
  },
  {
    id: 'prefix-sum',
    title: '합이 목표인 연속 구간 개수',
    category: '배열·해시',
    difficulty: '실전',
    minutes: 25,
    description: '음수가 포함된 정수 배열에서 합이 target인 연속 구간의 개수를 구하세요.',
    contract: 'solve(values, target) → number. 빈 구간은 제외. 배열 길이 ≤10000, 합은 안전 정수. 입력 불변.',
    starter: 'function solve(values, target) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '현재 누적합에서 target을 뺀 누적합이 이전에 몇 번 등장했는지 세세요. 초기 합 0은 1회입니다.',
    solution:
      'function solve(values, target) {\n  const counts = new Map([[0, 1]]);\n  let prefix = 0, answer = 0;\n  for (const value of values) {\n    prefix += value;\n    answer += counts.get(prefix - target) || 0;\n    counts.set(prefix, (counts.get(prefix) || 0) + 1);\n  }\n  return answer;\n}',
    complexity: '평균 시간 O(n), 공간 O(n).',
    steps: ['슬라이딩 윈도우가 음수에 취약한 이유', '빈 prefix를 포함한 식 도출', '조회와 현재 prefix 추가 순서 설명'],
    followups: ['최장 구간 길이를 구하려면 Map 값은 무엇이 될까요?', '스트림 입력에서 메모리 상한을 어떻게 정할까요?'],
    tests: [
      {
        label: '중복 합',
        args: [[1, 1, 1], 2],
        expected: 2,
      },
      {
        label: '음수와 영',
        args: [[1, -1, 0], 0],
        expected: 3,
      },
      {
        label: '모두 영',
        args: [[0, 0, 0], 0],
        expected: 6,
      },
      {
        label: '빈 배열',
        args: [[], 3],
        expected: 0,
      },
    ],
  },
  {
    id: 'intervals',
    title: '겹치는 예약 시간 합치기',
    category: '탐색·정렬',
    difficulty: '실전',
    minutes: 25,
    description: '정렬되지 않은 닫힌 구간들을 겹치거나 경계가 닿으면 합치세요.',
    contract:
      'solve(intervals) → [number, number][]. start ≤ end, 정수. 결과는 시작점 오름차순. 입력 배열과 내부 구간 모두 수정 금지.',
    starter: 'function solve(intervals) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '복제 후 시작점으로 정렬하고 마지막 결과의 끝점만 늘리세요.',
    solution:
      'function solve(intervals) {\n  const sorted = intervals.map(pair => [...pair]).sort((a,b) => a[0]-b[0]);\n  const result = [];\n  for (const interval of sorted) {\n    const last = result[result.length - 1];\n    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);\n    else result.push(interval);\n  }\n  return result;\n}',
    complexity: '시간 O(n log n), 복제·출력 공간 O(n).',
    steps: ['닫힌 구간과 반열린 구간 구분', '포함되는 구간·경계 접촉 추적', 'sort의 입력 변경 방지'],
    followups: ['겹치지 않는 회의실의 최소 개수를 구하려면?', '이미 정렬된 스트림이면?'],
    tests: [
      {
        label: '정렬 및 병합',
        args: [
          [
            [8, 10],
            [1, 3],
            [2, 6],
            [10, 12],
          ],
        ],
        expected: [
          [1, 6],
          [8, 12],
        ],
      },
      {
        label: '포함과 같은 시작',
        args: [
          [
            [1, 10],
            [1, 2],
            [3, 4],
          ],
        ],
        expected: [[1, 10]],
      },
      {
        label: '빈 목록',
        args: [[]],
        expected: [],
      },
    ],
  },
  {
    id: 'lower-bound',
    title: '중복 값의 첫 위치 찾기',
    category: '탐색·정렬',
    difficulty: '기본',
    minutes: 20,
    description: '정렬된 배열에서 target 이상인 첫 원소의 위치를 이분 탐색으로 찾으세요.',
    contract: 'solve(values, target) → index. 오름차순 정수 배열. 모든 값이 작으면 length. 빈 배열이면 0. 입력 불변.',
    starter: 'function solve(values, target) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '[left, right) 범위와 right=length로 시작하면 별도 정답 변수가 필요 없습니다.',
    solution:
      'function solve(values, target) {\n  let left = 0, right = values.length;\n  while (left < right) {\n    const mid = left + Math.floor((right-left)/2);\n    if (values[mid] < target) left = mid + 1;\n    else right = mid;\n  }\n  return left;\n}',
    complexity: '시간 O(log n), 공간 O(1).',
    steps: ['반열린 범위로 불변식 선언', '같은 값일 때 왼쪽을 택하는 이유', '매 반복마다 범위가 줄어드는지 설명'],
    followups: [
      'target보다 큰 첫 위치는 어느 조건을 바꾸나요?',
      '정답 가능 여부가 단조로운 최소 용량 문제로 확장하면?',
    ],
    tests: [
      {
        label: '중복의 첫 위치',
        args: [[1, 2, 2, 2, 4], 2],
        expected: 1,
      },
      {
        label: '끝 이후',
        args: [[1, 3], 4],
        expected: 2,
      },
      {
        label: '맨 앞',
        args: [[2, 3], 1],
        expected: 0,
      },
      {
        label: '빈 배열',
        args: [[], 1],
        expected: 0,
      },
      {
        label: '값 사이',
        args: [[1, 5], 3],
        expected: 1,
      },
    ],
  },
  {
    id: 'brackets',
    title: '중첩 괄호 검증',
    category: '스택·큐',
    difficulty: '기본',
    minutes: 15,
    description: '괄호가 올바른 순서로 닫혔는지 확인하세요.',
    contract: 'solve(text) → boolean. 입력은 ()[]{} 문자로만 이루어집니다. 빈 문자열은 true. 입력 불변.',
    starter: 'function solve(text) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '닫는 괄호를 만났을 때 가장 최근 여는 괄호와 대응해야 합니다.',
    solution:
      "function solve(text) {\n  const stack = [], pair = {')':'(', ']':'[', '}':'{'};\n  for (const c of text) {\n    if ('([{'.includes(c)) stack.push(c);\n    else if (stack.pop() !== pair[c]) return false;\n  }\n  return stack.length === 0;\n}",
    complexity: '시간 O(n), 공간 O(n).',
    steps: ['개수만 세면 안 되는 이유', '스택의 의미 정의', '남은 여는 괄호와 빈 스택 검증'],
    followups: ['오류가 난 첫 위치도 반환한다면?', '문자열 리터럴 안의 괄호는 무시해야 한다면?'],
    tests: [
      {
        label: '중첩 성공',
        args: ['{[()]}'],
        expected: true,
      },
      {
        label: '교차 괄호',
        args: ['([)]'],
        expected: false,
      },
      {
        label: '남은 괄호',
        args: ['(('],
        expected: false,
      },
      {
        label: '닫기만 있음',
        args: [')'],
        expected: false,
      },
      {
        label: '빈 입력',
        args: [''],
        expected: true,
      },
    ],
  },
  {
    id: 'next-warmer',
    title: '다음 더 높은 값까지 거리',
    category: '스택·큐',
    difficulty: '실전',
    minutes: 30,
    description: '각 날짜에서 처음으로 더 따뜻한 날까지 며칠인지 구하세요. 없으면 0입니다.',
    contract: 'solve(values) → number[]. 정수 배열. 같은 값은 더 높은 값이 아닙니다. 입력 불변.',
    starter: 'function solve(values) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '아직 답을 못 찾은 인덱스를 단조 스택에 저장하세요.',
    solution:
      'function solve(values) {\n  const stack = [], answer = Array(values.length).fill(0);\n  for (let i = 0; i < values.length; i++) {\n    while (stack.length && values[stack[stack.length-1]] < values[i]) {\n      const previous = stack.pop(); answer[previous] = i - previous;\n    }\n    stack.push(i);\n  }\n  return answer;\n}',
    complexity: '시간 O(n), 공간 O(n). 각 인덱스는 한 번 들어가고 한 번 나옵니다.',
    steps: ['O(n²) 탐색에서 재사용할 정보 찾기', '스택의 값이 내림차순인 이유', '같은 값과 증가·감소 배열 검증'],
    followups: ['원형 배열이면?', '슬라이딩 윈도우 최댓값에는 왜 덱이 필요할까요?'],
    tests: [
      {
        label: '증감 반복',
        args: [[73, 74, 75, 71, 69, 72, 76, 73]],
        expected: [1, 1, 4, 2, 1, 1, 0, 0],
      },
      {
        label: '같은 값',
        args: [[5, 5, 6]],
        expected: [2, 1, 0],
      },
      {
        label: '감소',
        args: [[3, 2, 1]],
        expected: [0, 0, 0],
      },
      {
        label: '빈 배열',
        args: [[]],
        expected: [],
      },
    ],
  },
  {
    id: 'tree-level',
    title: '트리를 레벨별로 읽기',
    category: '트리·그래프',
    difficulty: '실전',
    minutes: 25,
    description: '이진 트리를 같은 깊이끼리 묶어서 왼쪽부터 반환하세요.',
    contract:
      'solve(root) → number[][]. root는 null 또는 {value, left, right}. 노드 값은 중복될 수 있고 자식은 null. 입력 노드를 수정하지 않습니다.',
    starter: 'function solve(root) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '큐에 넣는 시점과 현재 레벨 끝 인덱스를 분리하세요. shift를 반복하면 비용이 늘 수 있습니다.',
    solution:
      'function solve(root) {\n  if (!root) return [];\n  const queue = [root], levels = [];\n  let head = 0;\n  while (head < queue.length) {\n    const end = queue.length, level = [];\n    while (head < end) {\n      const node = queue[head++]; level.push(node.value);\n      if (node.left) queue.push(node.left);\n      if (node.right) queue.push(node.right);\n    }\n    levels.push(level);\n  }\n  return levels;\n}',
    complexity:
      '시간 O(n), 이 구현의 큐 공간 O(n). 소비한 슬롯을 비우고 재사용하는 큐는 최대 너비에 비례하게 줄일 수 있습니다.',
    steps: ['BFS와 DFS 선택 이유', '레벨 경계를 큐 길이로 고정', '편향 트리와 중복 값 확인'],
    followups: [
      '재귀 DFS로 구현하면 호출 스택은 얼마나 필요한가요?',
      'DOM 트리 탐색에서 방문 조건은 어떻게 달라질까요?',
    ],
    tests: [
      {
        label: '두 레벨',
        args: [
          {
            value: 1,
            left: {
              value: 2,
              left: null,
              right: null,
            },
            right: {
              value: 2,
              left: null,
              right: null,
            },
          },
        ],
        expected: [[1], [2, 2]],
      },
      {
        label: '빈 트리',
        args: [null],
        expected: [],
      },
      {
        label: '오른쪽 편향',
        args: [
          {
            value: 1,
            left: null,
            right: {
              value: 3,
              left: null,
              right: null,
            },
          },
        ],
        expected: [[1], [3]],
      },
    ],
  },
  {
    id: 'graph-distance',
    title: '최소 연결 횟수 찾기',
    category: '트리·그래프',
    difficulty: '실전',
    minutes: 30,
    description: '방향 그래프에서 start부터 end까지의 최소 간선 수를 구하세요.',
    contract:
      'solve(graph, start, end) → number. graph[i]는 인접 정점 번호 배열, 정점은 0..n-1. start/end 유효. 도달 불가 -1. 중복 간선·자기 루프·순환 허용. 입력 불변.',
    starter: 'function solve(graph, start, end) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '방문 표시는 꺼낼 때가 아니라 큐에 넣을 때 합니다.',
    solution:
      'function solve(graph, start, end) {\n  const distance = Array(graph.length).fill(-1), queue = [start];\n  distance[start] = 0;\n  for (let head = 0; head < queue.length; head++) {\n    const node = queue[head];\n    if (node === end) return distance[node];\n    for (const next of graph[node]) if (distance[next] === -1) {\n      distance[next] = distance[node] + 1; queue.push(next);\n    }\n  }\n  return -1;\n}',
    complexity: '시간 O(V+E), 공간 O(V). 간선에 가중치가 있으면 이 보장은 성립하지 않습니다.',
    steps: [
      '최단 경로에서 BFS가 가능한 조건',
      '순환·중복으로 큐가 폭증하지 않게 방문 시점 결정',
      '도달 불가와 같은 정점 확인',
    ],
    followups: ['가중치가 0 또는 1이면?', '실제 경로도 반환하려면 어떤 배열이 더 필요한가요?'],
    tests: [
      {
        label: '순환과 최단 경로',
        args: [[[1, 2], [2, 3], [0, 3], []], 0, 3],
        expected: 2,
      },
      {
        label: '도달 불가',
        args: [[[1], [], []], 0, 2],
        expected: -1,
      },
      {
        label: '자기 루프',
        args: [[[0, 1], []], 0, 1],
        expected: 1,
      },
      {
        label: '같은 정점',
        args: [[[]], 0, 0],
        expected: 0,
      },
    ],
  },
  {
    id: 'dependency-cycle',
    title: '모듈 의존성 순환 검출',
    category: '트리·그래프',
    difficulty: '심화',
    minutes: 35,
    description: '선행 작업 관계가 주어졌을 때 모든 작업을 완료할 수 있는지 판정하세요.',
    contract: 'solve(count, edges) → boolean. [a,b]는 a 완료 후 b 가능. count≥0, 정점 유효, 중복 간선 허용. 입력 불변.',
    starter: 'function solve(count, edges) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '진입 차수 0인 정점부터 제거했을 때 모든 정점을 제거할 수 있는지 보세요.',
    solution:
      'function solve(count, edges) {\n  const graph = Array.from({length:count}, () => []), indegree = Array(count).fill(0);\n  for (const [a,b] of edges) { graph[a].push(b); indegree[b]++; }\n  const queue = [];\n  for (let i=0;i<count;i++) if (indegree[i] === 0) queue.push(i);\n  for (let head=0;head<queue.length;head++) {\n    for (const next of graph[queue[head]]) if (--indegree[next] === 0) queue.push(next);\n  }\n  return queue.length === count;\n}',
    complexity: '시간 O(V+E), 공간 O(V+E).',
    steps: ['간선 방향을 먼저 그림으로 확인', '진입 차수와 준비 큐 추적', '연결되지 않은 순환도 검증'],
    followups: ['실행 가능한 순서 하나도 반환한다면?', '작업 시간이 다르면 전체 최소 완료 시간을 어떻게 구할까요?'],
    tests: [
      {
        label: '여러 선행 작업',
        args: [
          4,
          [
            [0, 1],
            [0, 2],
            [1, 3],
            [2, 3],
          ],
        ],
        expected: true,
      },
      {
        label: '분리된 순환',
        args: [
          4,
          [
            [0, 1],
            [2, 3],
            [3, 2],
          ],
        ],
        expected: false,
      },
      {
        label: '자기 의존',
        args: [1, [[0, 0]]],
        expected: false,
      },
      {
        label: '중복 간선',
        args: [
          2,
          [
            [0, 1],
            [0, 1],
          ],
        ],
        expected: true,
      },
      {
        label: '빈 작업',
        args: [0, []],
        expected: true,
      },
    ],
  },
  {
    id: 'heap-kth',
    title: '스트림의 k번째 큰 값',
    category: '힙',
    difficulty: '심화',
    minutes: 40,
    description: '숫자를 하나씩 받으면서 지금까지 k번째로 큰 값을 반환하세요. k개 미만이면 null입니다.',
    contract:
      'solve(values, k) → (number|null)[]. 1≤k, 중복도 별도 값으로 셉니다. 매 입력마다 전체 정렬하지 말고 크기 k 최소 힙을 직접 구현해 보세요. 입력 불변.',
    starter: 'function solve(values, k) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '힙에는 상위 k개만 보관하고 루트는 그중 최솟값입니다.',
    solution:
      'function solve(values, k) {\n  const heap = [], answer = [];\n  function up(index) {\n    while (index > 0) {\n      const parent = Math.floor((index-1)/2);\n      if (heap[parent] <= heap[index]) break;\n      [heap[parent],heap[index]]=[heap[index],heap[parent]]; index=parent;\n    }\n  }\n  function down() {\n    let index=0;\n    while (index*2+1 < heap.length) {\n      let child=index*2+1;\n      if (child+1<heap.length && heap[child+1]<heap[child]) child++;\n      if (heap[index]<=heap[child]) break;\n      [heap[index],heap[child]]=[heap[child],heap[index]]; index=child;\n    }\n  }\n  for (const value of values) {\n    if (heap.length<k) { heap.push(value); up(heap.length-1); }\n    else if (value>heap[0]) { heap[0]=value; down(); }\n    answer.push(heap.length<k ? null : heap[0]);\n  }\n  return answer;\n}',
    complexity:
      '시간 O(n log k), 보조 공간 O(k), 출력 O(n). 자동 테스트는 결과를 검사하며 복잡도는 설명·코드 검토로 확인합니다.',
    steps: ['루트가 전체 최솟값이어야 하는 이유', '삽입·루트 교체·sift-down을 그림으로 설명', '중복·음수·k=1 확인'],
    followups: ['k가 계속 바뀐다면 같은 구조로 충분할까요?', '임의 값 삭제가 필요하면 어떤 인덱스가 추가될까요?'],
    tests: [
      {
        label: '실시간 갱신',
        args: [[4, 5, 8, 2, 10], 3],
        expected: [null, null, 4, 4, 5],
      },
      {
        label: '중복과 음수',
        args: [[-1, -1, -2, 3], 2],
        expected: [null, -1, -1, -1],
      },
      {
        label: '하나만 유지',
        args: [[3, 2, 5], 1],
        expected: [3, 3, 5],
      },
      {
        label: '빈 스트림',
        args: [[], 2],
        expected: [],
      },
    ],
  },
  {
    id: 'coin-change',
    title: '최소 동전 개수',
    category: 'DP·백트래킹',
    difficulty: '실전',
    minutes: 30,
    description: '동전을 무제한 사용할 때 amount를 만드는 최소 개수를 구하세요. 불가능하면 -1입니다.',
    contract: 'solve(coins, amount) → number. coins는 서로 다른 양의 정수, 0≤amount≤10000. 입력 불변.',
    starter: 'function solve(coins, amount) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '그리디가 [1,3,4], 6에서 실패하는 이유를 먼저 설명하고 dp[x]를 정의하세요.',
    solution:
      'function solve(coins, amount) {\n  const dp=Array(amount+1).fill(Infinity); dp[0]=0;\n  for(let sum=1;sum<=amount;sum++) {\n    for(const coin of coins) if(coin<=sum) dp[sum]=Math.min(dp[sum],dp[sum-coin]+1);\n  }\n  return dp[amount] === Infinity ? -1 : dp[amount];\n}',
    complexity: '시간 O(amount × 동전 종류), 공간 O(amount).',
    steps: ['그리디 반례 설명', '상태·초기값·점화식 정의', '불가능 상태 전파와 amount=0 확인'],
    followups: ['사용한 동전 목록도 복원하려면?', '각 동전을 한 번만 사용할 수 있다면 반복 순서는?'],
    tests: [
      {
        label: '그리디 반례',
        args: [[1, 3, 4], 6],
        expected: 2,
      },
      {
        label: '불가능',
        args: [[2], 3],
        expected: -1,
      },
      {
        label: '금액 영',
        args: [[], 0],
        expected: 0,
      },
      {
        label: '동전 없음',
        args: [[], 5],
        expected: -1,
      },
      {
        label: '큰 동전',
        args: [[7, 2, 3], 12],
        expected: 3,
      },
    ],
  },
  {
    id: 'combinations',
    title: '중복 없는 선택 조합',
    category: 'DP·백트래킹',
    difficulty: '실전',
    minutes: 25,
    description: '1부터 n까지 k개를 고르는 모든 조합을 오름차순으로 생성하세요.',
    contract: 'solve(n, k) → number[][]. 0≤n≤12, 0≤k≤n. 내부와 전체 결과 모두 사전순. k=0이면 [[]]. 입력 불변.',
    starter: 'function solve(n, k) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: '다음 선택을 이전 값보다 크게 제한하고 남은 숫자가 부족하면 가지치기하세요.',
    solution:
      'function solve(n, k) {\n  const result=[], path=[];\n  function visit(start) {\n    if(path.length===k) { result.push([...path]); return; }\n    for(let value=start;value<=n-(k-path.length)+1;value++) {\n      path.push(value); visit(value+1); path.pop();\n    }\n  }\n  visit(1); return result;\n}',
    complexity: '출력 수 C(n,k)에 대해 복사 시간 O(k × C(n,k)), 재귀·경로 O(k), 결과 공간 O(k × C(n,k)). k=0은 상수.',
    steps: ['순열과 조합의 차이', 'path 참조를 복제해야 하는 이유', '남은 선택 수로 탐색 범위 제한'],
    followups: [
      '후보에 같은 값이 있다면 중복 제거는 어디서 할까요?',
      '첫 결과만 필요하면 반환 구조를 어떻게 바꾸겠어요?',
    ],
    tests: [
      {
        label: '일반 조합',
        args: [4, 2],
        expected: [
          [1, 2],
          [1, 3],
          [1, 4],
          [2, 3],
          [2, 4],
          [3, 4],
        ],
      },
      {
        label: '선택 영',
        args: [3, 0],
        expected: [[]],
      },
      {
        label: '전체 선택',
        args: [3, 3],
        expected: [[1, 2, 3]],
      },
      {
        label: '빈 후보',
        args: [0, 0],
        expected: [[]],
      },
    ],
  },
];
