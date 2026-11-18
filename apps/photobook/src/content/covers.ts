import type { CoverSide } from '@/model/book/rotation';

type CoverArt = {
  readonly src: string;
  /** 그림이 오기 전과 판형 밖 여백에 깔리는 표지 바탕색. 그림 파일의 바탕색과 같다. */
  readonly background: string;
};

/**
 * 앞·뒤표지 그림. 2026-11-18 사용자가 준 Meoru 명함 앞뒷면이다(원본·변환은 public/assets.md).
 * 명함 판형은 5:9(2228×4010)이고 쪽 판형(geometry.ts PAGE_ASPECT)과 다르면 object-fit: cover로 가운데를 맞춰 자른다.
 */
export const COVER_ART: Readonly<Record<CoverSide, CoverArt>> = {
  front: { src: `${import.meta.env.BASE_URL}covers/front.webp`, background: '#ff9738' },
  back: { src: `${import.meta.env.BASE_URL}covers/back.svg`, background: '#4614c4' },
};

/** 뒤표지 QR이 여는 주소. 화면 읽기 사용자는 QR을 찍을 수 없으니 설명 문구로 같은 주소를 준다. */
export const COVER_QR_URL = 'x.com/Meoru_butler';
