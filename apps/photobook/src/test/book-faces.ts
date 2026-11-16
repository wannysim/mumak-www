import type { Vec3 } from '@/model/book/quaternion';
import type { BookFace, Orientation } from '@/model/book/rotation';
import { faceNormal, facingOf } from '@/model/book/rotation';

/** 같은 정도로 향하면 앞의 면을 고른다. */
const BOOK_FACES: readonly BookFace[] = ['front', 'spine', 'back', 'fore', 'top', 'bottom'];

function mostFacing(facing: (normal: Vec3) => number): BookFace {
  let best: BookFace = 'front';
  let bestFacing = -Infinity;
  for (const face of BOOK_FACES) {
    const value = facing(faceNormal(face));
    if (value > bestFacing) {
      best = face;
      bestFacing = value;
    }
  }
  return best;
}

/**
 * 테스트용: 면 법선이 보는 사람 쪽을 가장 많이 향한 면. 자세가 어느 면을 정면에 두는지 확인할 때 쓴다.
 * 앱은 면 이름을 보이지 않는다(닫힌 책의 러닝 헤드 쪽 번호 자리는 비운다, 2026-11-16 사용자 결정).
 */
export function facingFace(orientation: Orientation): BookFace {
  return mostFacing(normal => facingOf(orientation, normal));
}

/**
 * 테스트용: 그려진 닫힌 책(.closed-book)의 transform 끝 matrix3d(자세)로 본 facingFace.
 * CSS matrix3d는 열 우선이라 3·7·11번째 값(0부터 2·6·10)이 회전 행렬의 z 행이다.
 */
export function renderedFacingFace(book: HTMLElement): BookFace {
  const values = /matrix3d\(([^)]*)\)/.exec(book.style.transform)?.[1]?.split(',').map(Number);
  if (values === undefined) {
    throw new Error(`닫힌 책 자세(matrix3d)를 찾지 못했다: ${book.style.transform}`);
  }
  const [zx, zy, zz] = [values[2] ?? 0, values[6] ?? 0, values[10] ?? 0];
  return mostFacing(normal => zx * normal.x + zy * normal.y + zz * normal.z);
}
