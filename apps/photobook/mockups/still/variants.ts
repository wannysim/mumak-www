// G0 정지 화면 시안의 장면·변형 목록. 개요(index.html)와 장면(scene.html)이 같은 목록을 읽는다.
// 결정 ID는 open-decisions.md(2026-11-13 커밋 6c2e456a 판)의 시점별 행 순서 번호다. 문서가 바뀌면 번호가 밀릴 수 있어 제목을 함께 둔다.

const decisionTitles = {
  'G0-03': '앞·뒤 표지 = fursona 명함 앞면·뒷면 (확정)',
  'G0-04': '앞·뒤 표지와 책등에 넣을 정보, 그림 포함 여부',
  'G0-05': '닫힌 책 형태·재질·조명·그림자·바깥 여백 (방향 확정: 미니멀)',
  'G0-06': '색 값 (확정: blog 컬러셋)과 포인트 색 쓰는 곳',
  'G0-08': '책 안 화면 구성과 펼침면 비율',
  'G0-09': '세로 휴대폰 배치 (확정: 한 쪽씩)',
  'G0-12': '사진 쪽 여백·비율과 감상 크기, 가로 사진 배치, 두 쪽 걸침',
  'G1-05': '서체 후보와 라이선스 (미정, 지금은 임시 서체)',
  'G1-06': '다크 모드 (미정, 시안은 라이트만)',
  'G2-03': '클릭 넘김 영역의 배치와 표시 (미정, 화살표는 임시)',
  'G4-01': '러닝 헤드 항목·문구, 닫힌 책에서 보일지 (미정, 문구는 임시)',
} as const;

type DecisionId = keyof typeof decisionTitles;

type SceneId = 'closed' | 'spread' | 'phone';

type VariantLetter = 'a' | 'b' | 'c';

type StillScene = {
  id: SceneId;
  number: number;
  title: string;
  viewport: { width: number; height: number };
  note: string;
};

type StillVariant = {
  id: `${SceneId}-${VariantLetter}`;
  sceneId: SceneId;
  letter: VariantLetter;
  summary: string;
  decisionIds: readonly DecisionId[];
  folio: string;
};

const stillScenes: readonly StillScene[] = [
  {
    id: 'closed',
    number: 1,
    title: '닫힌 책 첫 화면',
    viewport: { width: 1440, height: 900 },
    note: 'CSS 3D 정지 포즈. 흰 표지·두께·쪽 단면, 책 아래 옅은 그림자, 위쪽 가장자리로 부록 레코드가 살짝 나온다.',
  },
  {
    id: 'spread',
    number: 2,
    title: '펼친 책',
    viewport: { width: 1440, height: 900 },
    note: '쪽 비율 3:4(임시). 가운데 접힘 그늘과 바깥 가장자리 두께는 아주 옅게. 양옆 화살표는 임시 표시. 사진 크기는 이 뷰포트의 CSS px.',
  },
  {
    id: 'phone',
    number: 3,
    title: '세로 휴대폰, 한 쪽씩 보기',
    viewport: { width: 390, height: 844 },
    note: '러닝 헤드는 이름과 쪽 번호만 남기고 상태 줄은 숨긴다(세 변형 공통, 임시). 넘김 화살표는 두지 않았다. 사진 크기는 이 뷰포트의 CSS px.',
  },
];

const stillVariants: readonly StillVariant[] = [
  {
    id: 'closed-a',
    sceneId: 'closed',
    letter: 'a',
    summary: '거의 정면, 살짝 기울어 앞쪽 종이 단면이 조금 보인다. 표지는 글자만.',
    decisionIds: ['G0-05', 'G0-04', 'G0-03'],
    folio: '앞표지',
  },
  {
    id: 'closed-b',
    sceneId: 'closed',
    letter: 'b',
    summary: '3/4 각도로 책등이 보인다. 표지에 fursona 그림 자리를 둔다.',
    decisionIds: ['G0-04', 'G0-05', 'G0-03'],
    folio: '앞표지',
  },
  {
    id: 'closed-c',
    sceneId: 'closed',
    letter: 'c',
    summary: '뒷면 3/4. 명함 뒷면 정보와 위쪽으로 나온 레코드 가장자리가 보인다.',
    decisionIds: ['G0-03', 'G0-04', 'G0-05'],
    folio: '뒤표지',
  },
  {
    id: 'spread-a',
    sceneId: 'spread',
    letter: 'a',
    summary: '두 쪽에 가로 사진 한 장씩, 같은 크기(약 365×243), 큰 여백.',
    decisionIds: ['G0-08', 'G0-12'],
    folio: '04–05/24',
  },
  {
    id: 'spread-b',
    sceneId: 'spread',
    letter: 'b',
    summary: '왼쪽은 비우고 오른쪽에만 사진(약 365×243). 잡지 리듬.',
    decisionIds: ['G0-08', 'G0-12'],
    folio: '04–05/24',
  },
  {
    id: 'spread-c',
    sceneId: 'spread',
    letter: 'c',
    summary: '가로 사진 한 장이 두 쪽에 걸친다(약 771×514). 접힘이 사진을 지난다.',
    decisionIds: ['G0-12', 'G0-08'],
    folio: '04–05/24',
  },
  {
    id: 'phone-a',
    sceneId: 'phone',
    letter: 'a',
    summary: '쪽이 화면 폭을 거의 채우고, 가로 사진을 쪽 폭의 88%로 크게(약 323×216).',
    decisionIds: ['G0-09', 'G0-12'],
    folio: '05/24',
  },
  {
    id: 'phone-b',
    sceneId: 'phone',
    letter: 'b',
    summary: '쪽을 조금 줄이고 오른쪽에 남은 쪽들의 두께를 보인다. 세로 사진(약 183×302).',
    decisionIds: ['G0-09', 'G0-12'],
    folio: '05/24',
  },
  {
    id: 'phone-c',
    sceneId: 'phone',
    letter: 'c',
    summary:
      'B와 같은 쪽에 가로 사진을 데스크톱과 같은 여백(쪽 폭의 72%)으로 둔다(약 227×151). 사진이 얼마나 작아지는지 본다.',
    decisionIds: ['G0-12', 'G0-09'],
    folio: '05/24',
  },
];

function findStillScene(sceneId: SceneId): StillScene {
  const scene = stillScenes.find(candidate => candidate.id === sceneId);
  if (!scene) {
    throw new Error(`알 수 없는 장면: ${sceneId}`);
  }
  return scene;
}

// 깨진 퍼센트 인코딩(예: #%E0%A4%A)은 decodeURIComponent가 URIError를 던진다. 모르는 변형과 같이 취급해 목록을 보인다.
function decodeHashValue(hash: string): string | undefined {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return undefined;
  }
}

function findStillVariantByHash(hash: string): StillVariant | undefined {
  const variantId = decodeHashValue(hash);
  if (variantId === undefined) {
    return undefined;
  }
  return stillVariants.find(variant => variant.id === variantId);
}

function sceneHref(variant: StillVariant): string {
  return `./scene.html#${variant.id}`;
}

function variantLabel(variant: StillVariant): string {
  const scene = findStillScene(variant.sceneId);
  return `${scene.number} ${scene.title} ${variant.letter.toUpperCase()}`;
}

export {
  decisionTitles,
  findStillVariantByHash,
  sceneHref,
  stillScenes,
  stillVariants,
  variantLabel,
  type DecisionId,
  type StillScene,
  type StillVariant,
};
