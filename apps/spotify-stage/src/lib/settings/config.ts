/**
 * ambient 배경 설정과 테마 선택의 단일 소스.
 * DEFAULT_AMBIENT_CONFIG 의 값이 곧 앱 기본값이다. 컨트롤 패널에서 조정한 값은
 * localStorage 에 저장되고, "이 설정으로" 확정되면 이 기본값을 갱신한다.
 */

export interface AmbientConfig {
  /** 블러된 앨범 아트 배경 레이어의 불투명도 (0~0.8). */
  albumLayerOpacity: number;
  /** 앨범 아트 배경에 Ken Burns(느린 줌/팬) 적용 여부. */
  kenBurns: boolean;
  /** mesh 블롭 불투명도 (0~1). */
  blobOpacity: number;
  /** mesh 블롭 블러 반경(px). */
  blobBlur: number;
  /** 가독성용 어둡기 오버레이 강도 (0~0.7). */
  overlayDarkness: number;
  /** 곡 전환 시 색 morph 시간(ms). */
  morphMs: number;
  /** 사용할 블롭(스와치) 개수 (1~5). */
  blobCount: number;
  /** feTurbulence 기반 액체 왜곡 적용 여부. */
  liquid: boolean;
  /** 액체 왜곡 변위 강도(feDisplacementMap scale). */
  liquidScale: number;
  /** 마우스/자이로 패럴랙스 적용 여부. */
  parallax: boolean;
  /** 패럴랙스 최대 이동량(px). */
  parallaxStrength: number;
}

export const DEFAULT_AMBIENT_CONFIG: AmbientConfig = {
  albumLayerOpacity: 0.3,
  kenBurns: true,
  blobOpacity: 0.5,
  blobBlur: 90,
  overlayDarkness: 0.3,
  morphMs: 1200,
  blobCount: 5,
  liquid: true,
  liquidScale: 36,
  parallax: true,
  parallaxStrength: 24,
};

/** 'auto' 는 실제 device.type 을 따른다. 나머지는 강제 테마. */
export type ThemeChoice = 'auto' | 'computer' | 'smartphone' | 'automobile' | 'tv' | 'fallback';

export const THEME_CHOICES: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'computer', label: 'Computer' },
  { value: 'smartphone', label: 'Smartphone' },
  { value: 'automobile', label: 'Automobile' },
  { value: 'tv', label: 'TV' },
  { value: 'fallback', label: 'Fallback' },
];

export interface StageSettings {
  ambient: AmbientConfig;
  themeChoice: ThemeChoice;
}

export const DEFAULT_SETTINGS: StageSettings = {
  ambient: DEFAULT_AMBIENT_CONFIG,
  themeChoice: 'auto',
};
