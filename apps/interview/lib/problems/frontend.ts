import type { CodeProblem } from '@/lib/problems/types';

export const frontendProblems: CodeProblem[] = [
  {
    id: 'search-reducer',
    title: '늦은 검색 응답을 무시하는 상태 머신',
    category: '프론트엔드·비동기',
    difficulty: '실전',
    minutes: 30,
    description:
      '입력과 응답이 교차해도 최신 검색에 해당하는 데이터·오류만 반영하세요. React reducer로 옮길 수 있는 순수 전이 함수를 구현합니다.',
    contract:
      'solve(events) → 매 이벤트 후 상태 배열. 초기 {requestId:null,status:"idle",data:[],error:null}. start {type:"start",id}는 data/error를 비우고 loading. success {type:"success",id,data}, error {type:"error",id,error}는 현재 loading 요청 ID일 때만 수용. reset은 초기 상태. id는 재사용하지 않는 문자열. 이전 스냅샷과 입력 수정 금지.',
    starter: 'function solve(events) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: 'stale 응답뿐 아니라 완료된 요청의 중복 응답과 reset 뒤 응답도 무시하세요.',
    solution:
      "function solve(events) {\n  const initial=() => ({requestId:null,status:'idle',data:[],error:null});\n  let state=initial(); const history=[];\n  for(const event of events) {\n    if(event.type==='start') state={requestId:event.id,status:'loading',data:[],error:null};\n    else if(event.type==='reset') state=initial();\n    else if(state.status==='loading' && state.requestId===event.id) {\n      if(event.type==='success') state={...state,status:'success',data:[...event.data]};\n      else state={...state,status:'error',error:event.error};\n    }\n    history.push(state);\n  }\n  return history;\n}",
    complexity: '이벤트 O(n)과 수용한 데이터 복사 비용. 출력 스냅샷 공간 O(n + 복사 데이터).',
    steps: [
      'A 시작→AB 시작→AB 완료→A 오류를 시간축으로 그리기',
      '상태 전이와 무시 조건 구현',
      'reset·중복 응답·재시도 검증',
    ],
    followups: [
      '실제 fetch에는 AbortController를 어떻게 연결하나요?',
      'debounce만으로 응답 순서 역전을 막을 수 있나요?',
      'React에서 로딩·오류 안내의 접근성은 어떻게 검증할까요?',
    ],
    tests: [
      {
        label: '이전 오류는 최신 결과 유지',
        args: [
          [
            {
              type: 'start',
              id: 'a',
            },
            {
              type: 'start',
              id: 'ab',
            },
            {
              type: 'success',
              id: 'ab',
              data: ['hit'],
            },
            {
              type: 'error',
              id: 'a',
              error: 'late',
            },
          ],
        ],
        expected: [
          {
            requestId: 'a',
            status: 'loading',
            data: [],
            error: null,
          },
          {
            requestId: 'ab',
            status: 'loading',
            data: [],
            error: null,
          },
          {
            requestId: 'ab',
            status: 'success',
            data: ['hit'],
            error: null,
          },
          {
            requestId: 'ab',
            status: 'success',
            data: ['hit'],
            error: null,
          },
        ],
      },
      {
        label: 'reset 뒤 응답',
        args: [
          [
            {
              type: 'start',
              id: 'a',
            },
            {
              type: 'reset',
            },
            {
              type: 'success',
              id: 'a',
              data: [1],
            },
          ],
        ],
        expected: [
          {
            requestId: 'a',
            status: 'loading',
            data: [],
            error: null,
          },
          {
            requestId: null,
            status: 'idle',
            data: [],
            error: null,
          },
          {
            requestId: null,
            status: 'idle',
            data: [],
            error: null,
          },
        ],
      },
      {
        label: '완료 뒤 중복과 재시도',
        args: [
          [
            {
              type: 'start',
              id: 'a',
            },
            {
              type: 'error',
              id: 'a',
              error: 'fail',
            },
            {
              type: 'success',
              id: 'a',
              data: [1],
            },
            {
              type: 'start',
              id: 'b',
            },
          ],
        ],
        expected: [
          {
            requestId: 'a',
            status: 'loading',
            data: [],
            error: null,
          },
          {
            requestId: 'a',
            status: 'error',
            data: [],
            error: 'fail',
          },
          {
            requestId: 'a',
            status: 'error',
            data: [],
            error: 'fail',
          },
          {
            requestId: 'b',
            status: 'loading',
            data: [],
            error: null,
          },
        ],
      },
    ],
    diagram:
      '사용자: start(a) ─ start(ab) ──────────\n응답:                  success(ab) → error(a)\n화면: loading   → loading → success 유지',
  },
  {
    id: 'emitter',
    title: '구독·해제 가능한 이벤트 버스',
    category: '프론트엔드·비동기',
    difficulty: '실전',
    minutes: 30,
    description:
      '이벤트 이름별로 콜백을 등록하고 해제하는 구독 시스템을 설계하세요. UI의 이벤트 정리와 연결해 설명해 보세요.',
    contract:
      'solve(operations) → 호출 로그 문자열 배열. ["on",event,id], ["once",event,id], ["off",event,id], ["emit",event,payload]. id는 이벤트별 구독 키로 중복 등록은 무시. off 후 재등록은 끝 순서. 호출은 등록 순서대로 `${id}:${payload}`. once는 첫 emit 후 해제. event/id/payload 문자열. 입력 불변.',
    starter: 'function solve(operations) {\n  // 요구사항을 확인하고 구현해 보세요.\n}',
    hint: 'Map<event,Map<id,once>>를 사용하면 특수 문자열 키와 등록 순서를 다루기 쉽습니다.',
    solution:
      "function solve(operations) {\n  const events=new Map(), log=[];\n  for(const [op,event,value,payload] of operations) {\n    if(op==='on' || op==='once') {\n      if(!events.has(event)) events.set(event,new Map());\n      if(!events.get(event).has(value)) events.get(event).set(value,op==='once');\n    } else if(op==='off') {\n      events.get(event)?.delete(value);\n    } else {\n      const listeners=events.get(event);\n      if(listeners) for(const [id,once] of [...listeners]) {\n        if(once) listeners.delete(id);\n        log.push(id+':'+value);\n      }\n    }\n  }\n  return log;\n}",
    complexity: '평균 등록·해제 O(1), emit O(구독자 수), 공간 O(구독자 + 출력 로그).',
    steps: ['중복 등록과 해제 정책 합의', 'once 삭제 시점과 순서 확인', '다른 이벤트·특수 키·재등록 검증'],
    followups: [
      '실제 콜백이 emit 안에서 구독을 바꾼다면 스냅샷 정책은?',
      '재귀 emit 시 once 콜백을 호출 전에 제거해야 하는 이유는?',
      'React effect cleanup에서 어떻게 구독 해제하겠어요?',
    ],
    tests: [
      {
        label: 'once와 일반 구독',
        args: [
          [
            ['on', 'tick', 'a'],
            ['once', 'tick', 'b'],
            ['emit', 'tick', '1'],
            ['emit', 'tick', '2'],
          ],
        ],
        expected: ['a:1', 'b:1', 'a:2'],
      },
      {
        label: '중복과 해제 후 순서',
        args: [
          [
            ['on', 'x', 'a'],
            ['on', 'x', 'a'],
            ['on', 'x', 'b'],
            ['off', 'x', 'a'],
            ['on', 'x', 'a'],
            ['emit', 'x', 'v'],
          ],
        ],
        expected: ['b:v', 'a:v'],
      },
      {
        label: '특수 이벤트와 분리',
        args: [
          [
            ['on', '__proto__', 'a'],
            ['on', 'x', 'b'],
            ['emit', '__proto__', 'ok'],
            ['off', 'x', 'missing'],
          ],
        ],
        expected: ['a:ok'],
      },
      {
        label: '구독 없음',
        args: [[['emit', 'x', 'v']]],
        expected: [],
      },
    ],
  },
];
