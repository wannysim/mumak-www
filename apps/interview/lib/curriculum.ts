export { codeProblems } from '@/lib/problems';
export type { CodeProblem, CodeTest } from '@/lib/problems/types';

type Topic = 'JavaScript' | 'React' | '설계·테스트';
export type Question = {
  id: string;
  topic: Topic;
  title: string;
  minutes: number;
  prompt: string;
  code?: string;
  choices: string[];
  answer: number;
  explanation: string;
  followup: string;
};
export const questions: Question[] = [
  {
    id: 'event-loop',
    topic: 'JavaScript',
    title: '콘솔에는 어떤 순서로 찍힐까?',
    minutes: 3,
    prompt: '동기 코드, microtask, timer의 실행 순서를 설명해 보세요.',
    code: "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nconsole.log('D');",
    choices: ['A → B → C → D', 'A → D → C → B', 'A → C → D → B', 'A → D → B → C'],
    answer: 1,
    explanation:
      '동기 코드 A, D가 먼저 실행됩니다. 현재 task가 끝난 뒤 microtask인 C를 처리하고, 이후 timer task인 B를 실행합니다. 0ms는 즉시 실행을 뜻하지 않습니다.',
    followup: 'microtask가 계속 다른 microtask를 추가한다면 화면 렌더링에 어떤 영향이 있을까요?',
  },
  {
    id: 'state-snapshot',
    topic: 'React',
    title: '세 번 눌렀는데, 왜 하나만?',
    minutes: 3,
    prompt: 'count가 0일 때 이 이벤트 핸들러를 한 번 실행하면 화면의 count는?',
    code: 'setCount(count + 1);\nsetCount(count + 1);\nsetCount(count + 1);',
    choices: ['0', '1', '2', '3'],
    answer: 1,
    explanation:
      '한 렌더에서 읽은 count는 같은 스냅샷입니다. 세 번 모두 1로 교체하는 업데이트를 요청합니다. 이전 값에 누적하려면 setCount(c => c + 1)를 사용합니다.',
    followup:
      '함수형 업데이트를 세 번 호출하면 어떻게 달라지나요? React가 이벤트를 묶어서 처리하는 이유도 설명해 보세요.',
  },
  {
    id: 'race',
    topic: 'React',
    title: '검색 결과가 과거로 돌아간다면',
    minutes: 5,
    prompt: '검색어 A 요청 후 AB를 요청했는데 A 응답이 더 늦게 도착했습니다. 최신 검색 결과를 보장할 방법은?',
    choices: [
      'debounce만 적용한다',
      '모든 응답으로 상태를 갱신한다',
      '요청 ID로 최신 응답인지 확인한다',
      '응답이 빠른 것만 캐싱한다',
    ],
    answer: 2,
    explanation:
      '요청 순서와 완료 순서는 다릅니다. 최신 요청 ID와 응답 ID를 대조하거나 effect cleanup에서 오래된 결과를 무시합니다. AbortController로 불필요한 작업도 취소할 수 있지만, debounce만으로 이미 시작한 요청의 경합을 해결하지는 못합니다.',
    followup: '로딩과 오류도 최신 요청에 귀속되어야 하는 이유는 무엇인가요?',
  },
  {
    id: 'derived-state',
    topic: 'React',
    title: '합계는 어디에 저장할까?',
    minutes: 3,
    prompt: '장바구니의 items가 바뀔 때 합계를 구합니다. 기본 설계로 가장 적절한 것은?',
    choices: [
      'items와 total을 모두 state로 두고 effect로 맞춘다',
      '렌더에서 items로 total을 계산한다',
      'DOM에서 가격 텍스트를 다시 읽는다',
      'total을 전역 변수에 누적한다',
    ],
    answer: 1,
    explanation:
      '원본에서 계산할 수 있는 값은 파생해서 사용하면 동기화 문제와 불필요한 재렌더를 줄일 수 있습니다. 계산이 실제로 비싼 경우 측정 후 useMemo를 고려합니다. useMemo가 정확성을 보장하는 저장소는 아닙니다.',
    followup: '할인 쿠폰이나 서버 확정 가격이 있다면 어떤 값을 원본 상태로 분리하겠어요?',
  },
  {
    id: 'money',
    topic: '설계·테스트',
    title: '0.1 + 0.2가 결제 금액이라면',
    minutes: 4,
    prompt: '원화 장바구니의 금액 계산에서 가장 먼저 정할 규칙은?',
    code: '0.1 + 0.2 === 0.3 // false',
    choices: [
      '표시할 때만 소수점 두 자리로 자른다',
      '원 단위 정수와 반올림 시점을 계약으로 정한다',
      '모든 숫자를 문자열로 이어 붙인다',
      '부동소수점 오차는 항상 무시한다',
    ],
    answer: 1,
    explanation:
      '화폐 단위, 허용 범위, 할인·세금의 반올림 시점을 서버와 합의해야 합니다. 최소 화폐 단위 정수 계산을 기본으로 하되 안전 정수 범위, 환율·분할 계산도 고려합니다. 최종 결제 금액은 서버에서 검증합니다.',
    followup: '전체 할인 후 나눌 때와 품목별 할인 후 더할 때 차이가 나는 경계 테스트를 만들어 보세요.',
  },
  {
    id: 'keys',
    topic: 'React',
    title: '삭제했는데 다른 입력이 사라졌다',
    minutes: 3,
    prompt: '행마다 입력 상태가 있는 목록에서 앞 행을 삭제했더니 값이 엉킵니다. 먼저 확인할 것은?',
    choices: [
      '목록에 index를 key로 쓰고 있는지',
      '컴포넌트 이름이 짧은지',
      'map 대신 for문을 사용했는지',
      '모든 값을 useMemo로 감쌌는지',
    ],
    answer: 0,
    explanation:
      'key는 형제 목록에서 항목의 정체성을 나타냅니다. 삽입·삭제·재정렬이 있는 목록에서 index key는 기존 상태를 다른 항목에 연결할 수 있습니다. 렌더마다 생성한 랜덤 key도 상태를 불필요하게 초기화합니다.',
    followup: '서버 ID가 아직 없는 새 행에는 어떤 안정적인 ID를 부여하겠어요?',
  },
  {
    id: 'closures',
    topic: 'JavaScript',
    title: '클로저는 값을 기억할까?',
    minutes: 4,
    prompt: '아래 코드의 출력은 무엇인가요?',
    code: 'let value = 1;\nconst read = () => value;\nvalue = 2;\nconsole.log(read());',
    choices: ['1', '2', 'undefined', 'ReferenceError'],
    answer: 1,
    explanation:
      '클로저는 생성 시점의 숫자를 복사하는 것이 아니라 렉시컬 환경의 바인딩을 참조합니다. React에서 오래된 콜백이 옛 렌더의 값을 보는 현상은 각 렌더가 별도의 환경을 만들기 때문입니다.',
    followup: 'setInterval 콜백이 첫 렌더의 state를 계속 읽을 때 함수형 업데이트와 ref는 각각 어떤 해결책이 되나요?',
  },
  {
    id: 'idempotence',
    topic: '설계·테스트',
    title: '결제 버튼을 두 번 누르면',
    minutes: 5,
    prompt: '버튼 비활성화만으로 중복 결제를 막을 수 있을까요?',
    choices: [
      '가능하다. 클릭만 막으면 충분하다',
      '아니다. 서버에서 멱등 키와 처리 결과를 관리해야 한다',
      '가능하다. 1초 debounce를 추가하면 된다',
      '아니다. 사용자가 새로고침하지 못하게 해야 한다',
    ],
    answer: 1,
    explanation:
      '네트워크 재시도나 여러 탭에서는 UI 잠금만으로 중복 요청을 막지 못합니다. 동일한 결제 의도의 재시도에는 동일 멱등 키를 사용하고 서버가 원자적으로 처리·결과 재사용을 보장해야 합니다.',
    followup: '결제는 성공했지만 응답만 유실됐다면 어떤 화면과 재시도 동작이 필요할까요?',
  },
  {
    id: 'union',
    topic: 'JavaScript',
    title: '불가능한 상태를 줄이는 타입',
    minutes: 4,
    prompt: '로딩·성공·실패 상태를 가장 명확하게 표현하는 TypeScript 설계는?',
    choices: [
      'loading, error, success boolean 세 개',
      'data: unknown 하나',
      'status로 구분하는 discriminated union',
      '모든 필드를 optional로 만든 객체',
    ],
    answer: 2,
    explanation:
      'status별 필수 필드를 가진 union은 성공인데 data가 없거나 로딩과 실패가 동시에 참인 상태를 줄입니다. switch의 exhaustiveness 검사까지 연결하면 새로운 상태 추가 시 누락도 발견하기 쉽습니다.',
    followup: '이전 데이터를 보여 주면서 갱신하는 상태는 이 모델에 어떻게 추가할까요?',
  },
  {
    id: 'optimistic',
    topic: '설계·테스트',
    title: '낙관적 업데이트가 실패했다',
    minutes: 5,
    prompt: '사용자가 별표를 빠르게 두 번 눌렀습니다. 첫 요청 실패 시 단순히 첫 스냅샷으로 되돌리면?',
    choices: [
      '항상 올바르다',
      '두 번째 요청의 성공 상태를 덮어쓸 수 있다',
      '브라우저가 자동 해결한다',
      '서버 데이터는 무조건 사라진다',
    ],
    answer: 1,
    explanation:
      '여러 mutation이 겹치면 스냅샷 롤백도 경합합니다. 요청별 버전 확인, 직렬화 또는 최신 서버 상태 재검증 등 제품 요구에 맞는 전략을 택해야 합니다.',
    followup: '반응 속도와 구현 복잡도 사이에서 어떤 경우 낙관적 업데이트를 포기하겠어요?',
  },
  {
    id: 'testing',
    topic: '설계·테스트',
    title: '구현보다 행동을 검증하기',
    minutes: 4,
    prompt: '할인 기능 테스트 중 리팩터링에 강하면서 의미 있는 검증은?',
    choices: [
      '내부 함수가 정확히 세 번 호출됐는지',
      'useState를 사용했는지',
      '유효 쿠폰 적용 후 합계와 결제 금액이 일치하는지',
      '변수 이름이 total인지',
    ],
    answer: 2,
    explanation:
      '사용자가 관찰하는 계약을 검증하면 내부 구조가 달라져도 의도한 동작을 지킬 수 있습니다. 유효·만료·최소 금액 경계와 네트워크 실패를 포함하고 테스트가 실제 결함을 잡는지도 확인합니다.',
    followup: '단위 테스트와 E2E에서 각각 어떤 경계를 맡기겠어요?',
  },
  {
    id: 'map',
    topic: 'JavaScript',
    title: '반복 find를 Map으로 바꾸기',
    minutes: 4,
    prompt:
      'n개의 항목마다 m개 목록에서 find로 정보를 찾습니다. Map을 한 번 만들면 시간 복잡도는 보통 어떻게 바뀌나요?',
    choices: ['O(nm) → 평균 O(n + m)', 'O(n + m) → O(nm)', '항상 O(1)', '메모리도 반드시 감소한다'],
    answer: 0,
    explanation:
      'm개를 인덱싱한 뒤 평균 상수 시간 조회를 n번 하면 평균 O(n + m)입니다. 대신 O(m) 메모리와 인덱스 생성 비용이 듭니다. 실제 크기, 중복 키 정책, 데이터 변경 빈도를 함께 봐야 합니다.',
    followup:
      '중복 키가 있을 때 find는 첫 항목을, 일반적인 Map 생성은 마지막 항목을 남깁니다. 의미를 보존하려면 어떻게 해야 할까요?',
  },
];

export const stories = [
  {
    id: 'ownership',
    title: '내가 끝까지 책임진 문제',
    subtitle: '오너십 · 제품 영향',
    prompt: '누가 어떤 불편을 겪고 있었나요? 내가 직접 결정하고 실행한 범위를 구분해 보세요.',
    probes: [
      '왜 그 문제부터 풀었나요?',
      '팀의 성과와 본인의 기여를 어떻게 나눌 수 있나요?',
      '다시 한다면 무엇을 다르게 하겠어요?',
    ],
  },
  {
    id: 'consistency',
    title: '숫자와 상태의 일관성',
    subtitle: '설계 · 정확성',
    prompt: '금액 계산이나 여러 화면의 데이터가 어긋났던 사례를 골라, 원본 데이터와 검증 경계를 설명해 보세요.',
    probes: [
      '반올림과 할인 정책은 어디에서 정했나요?',
      '서버와 프론트의 책임은 어떻게 나눴나요?',
      '어떤 경계값 테스트로 결과를 확인했나요?',
    ],
  },
  {
    id: 'race-story',
    title: '타이밍에 숨어 있던 버그',
    subtitle: '비동기 · 문제 해결',
    prompt: '로그인·로그아웃, 검색, 알림처럼 순서가 엇갈렸던 문제를 시간 순서로 설명해 보세요.',
    probes: ['어떻게 재현했나요?', '취소·무시·직렬화 중 무엇을 택했나요?', '회귀가 없다는 근거는 무엇인가요?'],
  },
  {
    id: 'tradeoff',
    title: '추상화의 적정선',
    subtitle: '재사용 · 트레이드오프',
    prompt: '폼이나 공통 모듈을 정리한 경험에서, 묶은 것과 일부러 남겨 둔 차이를 설명해 보세요.',
    probes: [
      '추상화가 오히려 복잡해지는 기준은?',
      '기존 사용처를 어떻게 이전했나요?',
      '공통 코드 변경의 영향 범위를 어떻게 검증했나요?',
    ],
  },
  {
    id: 'measurement',
    title: '개선했다고 말할 수 있는 근거',
    subtitle: '성능 · 검증',
    prompt: '빌드, 검사 도구, 응답 시간 개선 사례 하나를 골라 측정 조건과 한계를 함께 정리해 보세요.',
    probes: [
      '캐시가 있는 경우와 없는 경우는?',
      '일부 단계 개선과 전체 소요 시간 개선을 구분했나요?',
      '속도 외에 품질이나 비용 변화는?',
    ],
  },
  {
    id: 'disagreement',
    title: '다른 의견과 함께 결정하기',
    subtitle: '협업 · 회고',
    prompt: '의견이 달랐던 실제 사례에서 상대가 중요하게 여긴 것, 결정 기준, 결과를 설명해 보세요.',
    probes: [
      '상대의 우려를 어떻게 확인했나요?',
      '본인의 제안이 채택되지 않아도 어떻게 실행했나요?',
      '결과를 보고 생각을 바꾼 부분은?',
    ],
  },
];

export const storySections = [
  '문제와 맥락',
  '내 역할과 선택',
  '다른 대안과 손해',
  '검증과 결과',
  '다시 한다면',
] as const;
export const resources = [
  {
    title: '토스플레이스 Frontend FAQ',
    description: '공식 합류 여정과 직무 안내',
    url: 'https://toss.im/career/article/place_fe_faq',
  },
  {
    title: 'Frontend Fundamentals',
    description: '가독성 · 예측 가능성 · 응집도 · 결합도',
    url: 'https://frontend-fundamentals.com/code-quality/code/',
  },
  {
    title: '토스 합류 가이드',
    description: '면접 전 공식 안내 다시 보기',
    url: 'https://toss.im/career/joining-guide',
  },
];
