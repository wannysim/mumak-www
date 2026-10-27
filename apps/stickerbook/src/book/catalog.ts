export type Photograph = {
  id: string;
  title: string;
  src: string;
  alt: string;
  note: string;
  source: string;
  exif?: { camera?: string; lens?: string; aperture?: string; shutter?: string; iso?: number };
};

export const photographs: Photograph[] = [
  {
    id: 'meadow',
    title: 'The quiet outside',
    src: '/photos/meadow.jpg',
    alt: '해가 떠오르는 산 능선',
    note: '조금 더 천천히 바라보기',
    source: '1500534623283-312aade485b7',
  },
  {
    id: 'lake',
    title: 'A place to pause',
    src: '/photos/lake.jpg',
    alt: '잔잔한 호수에 비친 산과 작은 집',
    note: '아무것도 하지 않아도 좋은 곳',
    source: '1470770841072-f978cf4d019e',
  },
  {
    id: 'forest',
    title: 'Into the green',
    src: '/photos/forest.jpg',
    alt: '울창한 숲 사이로 들어오는 빛',
    note: '빛이 머물다 간 자리',
    source: '1441974231531-c6227db76b6e',
  },
  {
    id: 'mountain',
    title: 'Far from here',
    src: '/photos/mountain.jpg',
    alt: '구름 아래 높이 솟은 산봉우리',
    note: '멀리 와서 찾은 작은 순간',
    source: '1464822759023-fed622ff2c3b',
  },
  {
    id: 'night',
    title: 'After the blue',
    src: '/photos/night.jpg',
    alt: '별이 가득한 밤하늘과 눈 덮인 산',
    note: '밤이 깊어질수록 선명해지는 것들',
    source: '1519681393784-d120267933ba',
  },
  {
    id: 'deer',
    title: 'Little encounters',
    src: '/photos/deer.jpg',
    alt: '숲속에서 만난 사슴',
    note: '우연히 마주친 다정함',
    source: '1472396961693-142e6e269027',
  },
];

// Stable placement: never re-randomize a page during a turn or resize.
export function stickerPlacements(index: number) {
  const layouts = [
    [
      { x: 64, y: 46, size: 62, rotation: -17 },
      { x: 337, y: 513, size: 68, rotation: 13 },
    ],
    [
      { x: 328, y: 43, size: 58, rotation: 21 },
      { x: 61, y: 511, size: 66, rotation: -11 },
      { x: 267, y: 532, size: 54, rotation: 8 },
    ],
    [
      { x: 104, y: 42, size: 60, rotation: 9 },
      { x: 305, y: 516, size: 68, rotation: -24 },
      { x: 78, y: 530, size: 54, rotation: 17 },
    ],
    [
      { x: 333, y: 42, size: 64, rotation: -14 },
      { x: 103, y: 514, size: 66, rotation: 23 },
    ],
    [
      { x: 62, y: 44, size: 66, rotation: 16 },
      { x: 333, y: 514, size: 60, rotation: -19 },
    ],
    [
      { x: 304, y: 42, size: 62, rotation: -8 },
      { x: 58, y: 514, size: 58, rotation: 20 },
      { x: 263, y: 529, size: 66, rotation: -16 },
    ],
  ];
  return layouts[index % layouts.length]!.map((placement, slot) => ({ ...placement, id: index * 3 + slot }));
}
export function tapePlacements(index: number) {
  const layouts = [
    [{ x: 111, y: 0, rotation: -12 }],
    [
      { x: 35, y: 8, rotation: -36 },
      { x: 344, y: 340, rotation: -25 },
    ],
    [{ x: 254, y: 0, rotation: 9 }],
    [
      { x: 44, y: 9, rotation: -28 },
      { x: 343, y: 8, rotation: 39 },
    ],
    [
      { x: 178, y: 0, rotation: -7 },
      { x: 296, y: 354, rotation: 12 },
    ],
    [{ x: 329, y: 14, rotation: 32 }],
  ];
  return layouts[index % layouts.length]!;
}

export function exifLabel(photo: Photograph) {
  if (!photo.exif) return 'EXIF 미제공 · 샘플 사진';
  return (
    [
      photo.exif.camera,
      photo.exif.lens,
      photo.exif.aperture,
      photo.exif.shutter,
      photo.exif.iso ? `ISO ${photo.exif.iso}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ') || 'EXIF 미제공'
  );
}
