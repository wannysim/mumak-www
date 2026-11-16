import type { Vec2 } from './vector';

/**
 * fold 모델의 좌표계 (책 기준, 모델 좌표).
 *
 * - 단위: CSS px, 시간은 ms, 속도는 px/ms.
 * - 책등이 x=0이다. 넘어가는 쪽은 x∈[0, width], y∈[0, height]에 놓이고 y는 아래로 증가한다.
 * - 넘어가는 쪽은 항상 x>0 쪽에서 x<0 쪽으로 넘어간다. 그래서 "넘기는 방향"은 모델 좌표에서 -x다.
 * - 화면 좌표와 모델 좌표의 변환은 이 파일이 맡는다. 나머지 모듈은 모델 좌표만 안다.
 *
 * 변환이 다루는 두 매개변수:
 * - TurnDirection: 'forward'는 오른쪽(또는 아래) 쪽을 넘겨 다음 펼침으로, 'backward'는 왼쪽(또는 위) 쪽을
 *   넘겨 이전 펼침으로 간다. backward는 화면을 책등 기준으로 거울 반사해 같은 모델로 푼다.
 * - SpineAxis: 'vertical'은 좌우 두 쪽 펼침(세로 책등), 'horizontal'은 위아래 배치(가로 책등)다.
 *   spikes.md S2-6(펼침면 배치 매개변수). 어느 배치를 쓸지는 사용자 G0 결정이며 여기서 정하지 않는다.
 */
export type PageSize = {
  /** 책등에서 바깥 가장자리까지 거리(px). 모델 x 방향. */
  readonly width: number;
  /** 책등 방향 길이(px). 모델 y 방향. */
  readonly height: number;
};

export type TurnDirection = 'forward' | 'backward';

export type SpineAxis = 'vertical' | 'horizontal';

export type BookFrame = {
  readonly spineAxis: SpineAxis;
  /** 책등의 시작점 화면 좌표(px). vertical이면 책등 위쪽 끝, horizontal이면 책등 왼쪽 끝. */
  readonly spineOrigin: Vec2;
};

/** 화면 좌표 → 모델 좌표. */
export function toModelPoint(screenPoint: Vec2, frame: BookFrame, direction: TurnDirection): Vec2 {
  const relative = {
    x: screenPoint.x - frame.spineOrigin.x,
    y: screenPoint.y - frame.spineOrigin.y,
  };
  return toModelVector(relative, frame, direction);
}

/** 모델 좌표 → 화면 좌표. toModelPoint의 역변환. */
export function toScreenPoint(modelPoint: Vec2, frame: BookFrame, direction: TurnDirection): Vec2 {
  const relative = toScreenVector(modelPoint, frame, direction);
  return {
    x: relative.x + frame.spineOrigin.x,
    y: relative.y + frame.spineOrigin.y,
  };
}

/** 위치가 아닌 벡터(속도 등)의 화면 → 모델 변환. 평행 이동 없이 축만 바꾼다. */
export function toModelVector(screenVector: Vec2, frame: BookFrame, direction: TurnDirection): Vec2 {
  const sign = direction === 'forward' ? 1 : -1;
  if (frame.spineAxis === 'vertical') {
    return { x: sign * screenVector.x, y: screenVector.y };
  }
  return { x: sign * screenVector.y, y: screenVector.x };
}

/** 모델 벡터 → 화면 벡터. toModelVector의 역변환. */
export function toScreenVector(modelVector: Vec2, frame: BookFrame, direction: TurnDirection): Vec2 {
  const sign = direction === 'forward' ? 1 : -1;
  if (frame.spineAxis === 'vertical') {
    return { x: sign * modelVector.x, y: modelVector.y };
  }
  return { x: modelVector.y, y: sign * modelVector.x };
}

/**
 * 화면에서 잰 한 쪽의 크기 → 모델 PageSize.
 * vertical이면 화면 폭이 모델 width, horizontal이면 화면 높이가 모델 width다(책등에서 멀어지는 방향).
 */
export function toModelPageSize(
  screenPage: { readonly screenWidth: number; readonly screenHeight: number },
  spineAxis: SpineAxis
): PageSize {
  if (spineAxis === 'vertical') {
    return { width: screenPage.screenWidth, height: screenPage.screenHeight };
  }
  return { width: screenPage.screenHeight, height: screenPage.screenWidth };
}
