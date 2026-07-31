import { fukakouryoku } from './fukakouryoku';
import { hanauranai } from './hanauranai';
import { kaijuNoHanauta } from './kaiju-no-hanauta';
import { koikazeNiNosete } from './koikaze-ni-nosete';
import { napori } from './napori';
import { odoriko } from './odoriko';
import { shiwaawase } from './shiwaawase';
import { timeParadox } from './time-paradox';
import { tokyoFlash } from './tokyo-flash';

export type Song = {
  slug: string;
  titleJa: string;
  titleKo: string;
  /** 공식 YouTube 영상 ID */
  videoId: string;
};

export const defaultSong: Song = kaijuNoHanauta;

export const songs: Song[] = [
  kaijuNoHanauta,
  odoriko,
  tokyoFlash,
  fukakouryoku,
  napori,
  hanauranai,
  koikazeNiNosete,
  shiwaawase,
  timeParadox,
];

/** 목록을 순환하며 offset만큼 떨어진 곡. 마지막 다음은 처음으로 돌아간다. */
export function songAt(list: readonly Song[], from: Song, offset: number): Song {
  const index = list.indexOf(from);
  return list[(index + offset + list.length) % list.length] ?? defaultSong;
}
