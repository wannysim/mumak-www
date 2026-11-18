import type { CodeProblem } from '@/lib/problems/types';

export const companyProblems: CodeProblem[] = [
  {
    id: 'report-notices',
    title: '신고 처리 알림 집계',
    source: {
      label: '카카오 · 2022 공채 신고 결과 받기 · 기출 재구성',
      url: 'https://tech.kakao.com/posts/488',
    },
    category: '배열·해시',
    difficulty: '실전',
    minutes: 20,
    description: '운영 도구에서 제재 대상이 확정됐다. 각 사용자가 신고했던 대상 중 몇 명이 제재됐는지 표시하자.',
    contract:
      'users는 고유 ID 목록, reports는 [신고자, 대상] 쌍. 모두 등록된 사용자이고 자기 신고는 없다. 서로 다른 신고자 k명 이상이면 제재한다. 사용자 순서대로 알림 수를 반환한다. k ≥ 1.',
    starter: 'function solve(users, reports, k) {\n  // 여기에 구현하세요.\n}',
    solution:
      'function solve(users, reports, k) {\n  const reporters = new Map();\n  const counts = new Map(users.map(id => [id, 0]));\n  for (const [from, target] of reports) {\n    if (!reporters.has(target)) reporters.set(target, new Set());\n    reporters.get(target).add(from);\n  }\n  for (const group of reporters.values()) {\n    if (group.size < k) continue;\n    for (const id of group) counts.set(id, counts.get(id) + 1);\n  }\n  return users.map(id => counts.get(id));\n}',
    steps: ['대상별 신고자 모으기', '제재 기준 적용하기', '사용자 순서 복원하기'],
    hint: '대상별 Set을 두면 같은 사람이 여러 번 눌러도 한 번만 센다.',
    complexity: '사용자 u명, 신고 r건에 평균 시간·공간 O(u+r).',
    followups: ['제재를 취소하면 어떤 알림 상태를 유지해야 할까?'],
    tests: [
      {
        label: '반복 신고',
        args: [
          ['a', 'b'],
          [
            ['a', 'b'],
            ['a', 'b'],
          ],
          2,
        ],
        expected: [0, 0],
      },
      {
        label: '두 대상 제재',
        args: [
          ['b', 'a', 'c', 'd'],
          [
            ['a', 'd'],
            ['b', 'd'],
            ['a', 'c'],
            ['d', 'c'],
          ],
          2,
        ],
        expected: [1, 2, 0, 1],
      },
      {
        label: '빈 신고',
        args: [['q'], [], 1],
        expected: [0],
      },
    ],
  },
  {
    id: 'moving-marker',
    title: '이동하는 마커 따라잡기',
    source: {
      label: '라인 · 2019 인턴 코딩테스트 · 기출 재구성',
      url: 'https://engineering.linecorp.com/ko/blog/2019-firsthalf-line-internship-recruit-coding-test/',
    },
    category: '트리·그래프',
    difficulty: '심화',
    minutes: 35,
    description: '타임라인의 두 마커가 같은 프레임에 같은 칸을 점유하는 최초 시각을 구하자.',
    contract:
      'solve(start, target, limit). 칸은 0~limit(1~500). 매 초 추적자는 한 칸 좌우 또는 현재 좌표의 두 배로 이동한다. 목표는 t번째 초에 오른쪽으로 t칸 이동한다. 처음 겹치면 0, 범위를 떠날 때까지 만나지 못하면 -1.',
    starter: 'function solve(start, target, limit) {\n  // 여기에 구현하세요.\n}',
    solution:
      'function solve(start, target, limit) {\n  let positions = new Set([start]);\n  for (let t = 0; target <= limit; target += ++t) {\n    if (positions.has(target)) return t;\n    const next = new Set();\n    for (const x of positions) {\n      for (const y of [x - 1, x + 1, x * 2]) {\n        if (y >= 0 && y <= limit) next.add(y);\n      }\n    }\n    positions = next;\n  }\n  return -1;\n}',
    steps: ['같은 시각의 위치만 비교하기', '다음 프레임 후보 중복 제거하기'],
    hint: '매 프레임마다 도달 가능한 위치 집합을 새로 만든다.',
    complexity: '범위 L에서 프레임 수는 O(√L). 시간 O(L√L), 공간 O(L).',
    followups: ['상한이 20만이면 홀수·짝수 방문 정보를 어떻게 재사용할까?'],
    tests: [
      {
        label: '시작점 일치',
        args: [2, 2, 8],
        expected: 0,
      },
      {
        label: '두 배 이동',
        args: [3, 5, 12],
        expected: 1,
      },
      {
        label: '과거 방문과 구별',
        args: [3, 6, 18],
        expected: 4,
      },
      {
        label: '목표 이탈',
        args: [0, 7, 7],
        expected: -1,
      },
    ],
  },
  {
    id: 'visible-rows',
    title: '스크롤 목록의 렌더 범위',
    source: {
      label: '네이버 · InfiniteGrid · 기술 자료 응용',
      url: 'https://naver.github.io/egjs-infinitegrid/',
    },
    category: '프론트엔드·비동기',
    difficulty: '기본',
    minutes: 15,
    description: '긴 목록에서 화면에 한 픽셀이라도 걸친 행만 렌더링하도록 인덱스 범위를 구하자.',
    contract:
      'solve(count, rowHeight, top, height)는 [시작, 끝 제외]를 반환한다. 모든 값은 음이 아닌 정수, rowHeight > 0. 빈 화면이나 목록 밖이면 [0,0].',
    starter: 'function solve(count, rowHeight, top, height) {\n  // 여기에 구현하세요.\n}',
    solution:
      'function solve(count, rowHeight, top, height) {\n  const start = Math.floor(top / rowHeight);\n  if (height === 0 || start >= count) return [0, 0];\n  return [start, Math.min(count, Math.ceil((top + height) / rowHeight))];\n}',
    steps: ['픽셀 구간을 반열린 구간으로 표현하기', '마지막 행에서 범위 자르기'],
    hint: '맨 아래 경계에서 새 행이 시작하면 그 행은 보이지 않는다.',
    complexity: '시간·공간 O(1).',
    followups: ['행 높이가 서로 다르면 스크롤할 때마다 전체를 순회해야 할까?'],
    tests: [
      {
        label: '양쪽 일부 노출',
        args: [8, 10, 9, 2],
        expected: [0, 2],
      },
      {
        label: '정확한 경계',
        args: [8, 10, 10, 10],
        expected: [1, 2],
      },
      {
        label: '마지막 행',
        args: [3, 10, 25, 80],
        expected: [2, 3],
      },
      {
        label: '목록 밖',
        args: [2, 10, 20, 5],
        expected: [0, 0],
      },
      {
        label: '높이 0',
        args: [4, 10, 5, 0],
        expected: [0, 0],
      },
    ],
  },
  {
    id: 'cursor-history',
    title: '상품 목록의 다음 페이지 추적',
    source: {
      label: '쿠팡 · 상품 목록 페이징 API · 기술 자료 응용',
      url: 'https://developers-v1.coupangcorp.com/hc/ko/articles/360033645034',
    },
    category: '프론트엔드·비동기',
    difficulty: '실전',
    minutes: 20,
    description: '더 보기 버튼이 같은 페이지를 반복 요청하지 않도록, 저장된 응답에서 요청 순서를 복원하자.',
    contract:
      'pages는 [요청 토큰, 다음 토큰] 쌍이며 요청 토큰은 고유하다. first부터 방문한 토큰 목록을 반환한다. 빈 문자열, 응답 누락, 이미 방문한 토큰 직전에 멈춘다. 토큰은 문자열이다.',
    starter: 'function solve(pages, first) {\n  // 여기에 구현하세요.\n}',
    solution:
      "function solve(pages, first) {\n  const next = new Map(pages);\n  const visited = new Set();\n  let cursor = first;\n  while (cursor !== '' && next.has(cursor) && !visited.has(cursor)) {\n    visited.add(cursor);\n    cursor = next.get(cursor);\n  }\n  return [...visited];\n}",
    steps: ['응답을 요청 토큰으로 찾기', '종료 조건 세 가지 확인하기'],
    hint: '토큰의 숫자처럼 보이는 부분으로 순서를 추측할 수 없다.',
    complexity: '응답 n개에 평균 시간·공간 O(n).',
    followups: ['필터가 바뀐 뒤 도착한 이전 페이지 응답은 어떻게 처리할까?'],
    tests: [
      {
        label: '응답 순서 뒤섞임',
        args: [
          [
            ['b', ''],
            ['a', 'b'],
          ],
          'a',
        ],
        expected: ['a', 'b'],
      },
      {
        label: '순환',
        args: [
          [
            ['0', '02'],
            ['02', '0'],
          ],
          '0',
        ],
        expected: ['0', '02'],
      },
      {
        label: '중간 누락',
        args: [[['a', 'x']], 'a'],
        expected: ['a'],
      },
      {
        label: '첫 응답 없음',
        args: [[], 'a'],
        expected: [],
      },
    ],
  },
  {
    id: 'movie-pages',
    title: '영화 검색 결과 합치기',
    source: {
      label: '배민 · 우아한테크코스 영화 리뷰 · 교육 미션 응용',
      url: 'https://github.com/woowacourse/javascript-movie-review',
    },
    category: '프론트엔드·비동기',
    difficulty: '기본',
    minutes: 15,
    description:
      '더 보기를 눌렀더니 이미 표시된 영화가 새 평점과 함께 돌아왔다. 카드 순서를 유지하면서 최신 평점을 반영하자.',
    contract:
      'pages는 페이지별 [영화 ID, 평점] 쌍의 배열이다. 결과도 같은 쌍의 배열이며 ID가 처음 나온 순서로 정렬한다. 같은 ID의 마지막 평점이 0이어도 갱신한다.',
    starter: 'function solve(pages) {\n  // 여기에 구현하세요.\n}',
    solution:
      'function solve(pages) {\n  const ratings = new Map();\n  for (const page of pages) {\n    for (const [id, score] of page) ratings.set(id, score);\n  }\n  return [...ratings];\n}',
    steps: ['표시 순서 결정하기', '평점 갱신과 새 카드 추가 구분하기'],
    hint: 'Map은 기존 키의 값을 갱신해도 삽입 순서를 보존한다.',
    complexity: '전체 항목 n개, 고유 영화 u개에 평균 시간 O(n), 공간 O(u).',
    followups: ['사용자가 검색어를 바꾼 뒤 이전 응답이 오면 어느 목록에 병합해야 할까?'],
    tests: [
      {
        label: '재평가와 새 영화',
        args: [
          [
            [
              ['b', 3],
              ['a', 4],
            ],
            [
              ['b', 0],
              ['c', 5],
            ],
          ],
        ],
        expected: [
          ['b', 0],
          ['a', 4],
          ['c', 5],
        ],
      },
      {
        label: '페이지 안 중복',
        args: [
          [
            [
              ['x', 2],
              ['x', 4],
            ],
          ],
        ],
        expected: [['x', 4]],
      },
      {
        label: '빈 페이지들',
        args: [[[], []]],
        expected: [],
      },
    ],
  },
  {
    id: 'tab-focus',
    title: '가로 탭의 키보드 포커스',
    source: {
      label: '당근 · SEED Design 탭 · 기술 자료 응용',
      url: 'https://seed-design.io/react/updates/changelog?package=%40seed-design%2Freact-tabs',
    },
    category: '프론트엔드·비동기',
    difficulty: '실전',
    minutes: 20,
    description:
      '마우스 없이 탭을 이동한다. 비활성 탭을 건너뛰고 가장자리에서 반대편으로 돌아가도록 다음 포커스를 정하자.',
    contract:
      'solve(enabled, current, keys). enabled는 탭별 boolean 배열, current는 활성 탭 인덱스다. 배열에는 활성 탭이 하나 이상 있다. Left/Right는 순환, Home/End는 첫/마지막 활성 탭, 다른 키는 무시한다. 마지막 인덱스를 반환한다.',
    starter: 'function solve(enabled, current, keys) {\n  // 여기에 구현하세요.\n}',
    solution:
      "function solve(enabled, current, keys) {\n  const tabs = enabled.flatMap((active, index) => active ? [index] : []);\n  let position = tabs.indexOf(current);\n  for (const key of keys) {\n    if (key === 'Home') position = 0;\n    if (key === 'End') position = tabs.length - 1;\n    if (key === 'Left') position = (position + tabs.length - 1) % tabs.length;\n    if (key === 'Right') position = (position + 1) % tabs.length;\n  }\n  return tabs[position];\n}",
    steps: ['활성 탭만 추리기', '탐색 순번을 원래 인덱스로 변환하기'],
    hint: '전체 DOM 인덱스와 포커스를 받을 수 있는 탭의 순번을 구분한다.',
    complexity: '탭 n개와 키 m개에 시간 O(n+m), 공간 O(n).',
    followups: ['포커스 이동과 패널 선택을 분리하면 Enter는 어떤 상태를 바꿀까?'],
    tests: [
      {
        label: '비활성 건너뛰기',
        args: [[true, false, true], 0, ['Right']],
        expected: 2,
      },
      {
        label: '왼쪽 순환',
        args: [[true, false, true], 0, ['Left']],
        expected: 2,
      },
      {
        label: '처음으로 이동',
        args: [[false, true, true, false], 2, ['Home']],
        expected: 1,
      },
      {
        label: '끝으로 이동하고 다른 키 무시',
        args: [[false, true, true, false], 1, ['End', 'Tab']],
        expected: 2,
      },
      {
        label: '하나만 활성',
        args: [[false, true], 1, ['Right', 'Left']],
        expected: 1,
      },
    ],
  },
  {
    id: 'debounce-log',
    title: '자동 저장이 실행되는 시각',
    source: {
      label: '토스 · es-toolkit debounce · 기술 자료 응용',
      url: 'https://es-toolkit.dev/reference/function/debounce.html',
    },
    category: '프론트엔드·비동기',
    difficulty: '실전',
    minutes: 20,
    description:
      '사용자가 입력을 멈춘 뒤 한 번만 자동 저장한다. 실제 타이머를 쓰지 않고 입력 시각 로그에서 저장 시각을 예측하자.',
    contract:
      'times는 비내림차순 밀리초 정수 배열, wait는 양의 정수다. 마지막 입력 후 wait가 지나면 저장한다. 예약 시각과 다음 입력이 같으면 예약을 먼저 실행한다. 모든 저장 시각을 반환한다.',
    starter: 'function solve(times, wait) {\n  // 여기에 구현하세요.\n}',
    solution:
      'function solve(times, wait) {\n  const saves = [];\n  for (let i = 0; i < times.length; i++) {\n    const due = times[i] + wait;\n    if (i + 1 === times.length || times[i + 1] >= due) saves.push(due);\n  }\n  return saves;\n}',
    steps: ['저장 예약 시각 계산하기', '다음 입력이 예약을 취소하는지 판단하기'],
    hint: '다음 입력이 예약 시각보다 빠를 때만 이전 예약이 취소된다.',
    complexity: '입력 n개에 시간 O(n), 결과 외 공간 O(1).',
    followups: ['컴포넌트가 언마운트될 때 cancel과 flush 중 무엇을 선택할까?'],
    tests: [
      {
        label: '연속 입력',
        args: [[0, 3, 7], 5],
        expected: [12],
      },
      {
        label: '예약과 입력 동시',
        args: [[0, 5, 7], 5],
        expected: [5, 12],
      },
      {
        label: '같은 시각 반복',
        args: [[2, 2, 12], 3],
        expected: [5, 15],
      },
      {
        label: '입력 없음',
        args: [[], 4],
        expected: [],
      },
    ],
  },
];
