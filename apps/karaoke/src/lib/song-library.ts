import { defaultSong, songs as bundledSongs, type Song } from '@/songs';

export const DEFAULT_PLAYLIST_ID = 'vaundy';
export const FUJII_KAZE_PLAYLIST_ID = 'fujii-kaze';
export const SONG_LIBRARY_SCHEMA_VERSION = 5;
const MIGRATABLE_SONG_LIBRARY_SCHEMA_VERSIONS = new Set([3, 4]);

export type Playlist = {
  id: string;
  name: string;
  songSlugs: string[];
};

export type SongLibrary = {
  schemaVersion: typeof SONG_LIBRARY_SCHEMA_VERSION;
  songs: Song[];
  playlists: Playlist[];
};

type SongDetails = {
  titleJa: string;
  titleKo: string;
};

const seishunSick: Song = {
  slug: 'fujii-kaze-seishun-sick',
  titleJa: '青春病',
  titleKo: '청춘병',
  videoId: 'WRHPEtCeSXo',
};

const fujiiKazeSongs: Song[] = [
  { slug: 'fujii-kaze-matsuri', titleJa: 'まつり', titleKo: '마츠리', videoId: 'Uqwz7ESQ470' },
  {
    slug: 'fujii-kaze-workin-hard',
    titleJa: "Workin' Hard",
    titleKo: '워킹 하드',
    videoId: 'm5zaFbH-CqQ',
  },
  { slug: 'fujii-kaze-nan-nan', titleJa: '何なんw', titleKo: '난난', videoId: '52aoci01npY' },
  { slug: 'fujii-kaze-kirari', titleJa: 'きらり', titleKo: '키라리', videoId: 'o_IyNh6DiLk' },
  { slug: 'fujii-kaze-hana', titleJa: '花', titleKo: '하나', videoId: 'MZveSpig4QM' },
  { slug: 'fujii-kaze-garden', titleJa: 'ガーデン', titleKo: '가든', videoId: 'FXxuIiqUXZ0' },
  { slug: 'fujii-kaze-damn', titleJa: 'damn', titleKo: '댐', videoId: 'WtOSGFHt1sQ' },
  {
    slug: 'fujii-kaze-shinunoga-e-wa',
    titleJa: '死ぬのがいいわ',
    titleKo: '시누노가 이이와',
    videoId: 'iSvutomiqOQ',
  },
  { slug: 'fujii-kaze-tabiji', titleJa: '旅路', titleKo: '타비지', videoId: 'oHBrSoBw03s' },
  {
    slug: 'fujii-kaze-michi-teyu-ku',
    titleJa: '満ちてゆく',
    titleKo: '미치테유쿠',
    videoId: 'gtcVDWBRz20',
  },
  seishunSick,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cleanRequired(value: string, label: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${label}을 입력해 주세요.`);
  return cleaned;
}

export function createDefaultSongLibrary(): SongLibrary {
  return {
    schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
    songs: [...bundledSongs, ...fujiiKazeSongs].map(song => ({ ...song })),
    playlists: [
      {
        id: DEFAULT_PLAYLIST_ID,
        name: 'Vaundy',
        songSlugs: bundledSongs.map(song => song.slug),
      },
      {
        id: FUJII_KAZE_PLAYLIST_ID,
        name: 'Fujii Kaze',
        songSlugs: fujiiKazeSongs.map(song => song.slug),
      },
    ],
  };
}

export function parseSongLibraryStrict(value: unknown): SongLibrary {
  if (
    !isRecord(value) ||
    (value.schemaVersion !== SONG_LIBRARY_SCHEMA_VERSION &&
      !MIGRATABLE_SONG_LIBRARY_SCHEMA_VERSIONS.has(value.schemaVersion as number)) ||
    !Array.isArray(value.songs) ||
    !Array.isArray(value.playlists)
  ) {
    throw new Error('지원하지 않는 곡 보관함 형식입니다.');
  }

  const songs = value.songs.map(candidate => {
    if (!isRecord(candidate)) throw new Error('곡 정보 형식이 올바르지 않습니다.');
    const song = {
      slug: cleanRequired(typeof candidate.slug === 'string' ? candidate.slug : '', '곡 ID'),
      titleJa: cleanRequired(typeof candidate.titleJa === 'string' ? candidate.titleJa : '', '원어 제목'),
      titleKo: cleanRequired(typeof candidate.titleKo === 'string' ? candidate.titleKo : '', '한국어 표기'),
      videoId: typeof candidate.videoId === 'string' ? candidate.videoId : '',
    };
    if (!/^[\w-]{11}$/.test(song.videoId)) throw new Error('YouTube 영상 ID가 올바르지 않습니다.');
    return song;
  });
  const songSlugs = new Set(songs.map(song => song.slug));
  if (songSlugs.size !== songs.length || new Set(songs.map(song => song.videoId)).size !== songs.length) {
    throw new Error('같은 곡 ID 또는 YouTube 영상이 두 번 들어 있습니다.');
  }

  const playlists = value.playlists.map(candidate => {
    if (!isRecord(candidate) || !Array.isArray(candidate.songSlugs)) {
      throw new Error('재생목록 형식이 올바르지 않습니다.');
    }
    const playlist = {
      id: cleanRequired(typeof candidate.id === 'string' ? candidate.id : '', '재생목록 ID'),
      name: cleanRequired(typeof candidate.name === 'string' ? candidate.name : '', '재생목록 이름'),
      songSlugs: candidate.songSlugs.map(slug => {
        if (typeof slug !== 'string' || !songSlugs.has(slug)) {
          throw new Error('재생목록에 찾을 수 없는 곡이 있습니다.');
        }
        return slug;
      }),
    };
    if (new Set(playlist.songSlugs).size !== playlist.songSlugs.length) {
      throw new Error('재생목록에 같은 곡이 두 번 들어 있습니다.');
    }
    return playlist;
  });
  if (
    playlists.length === 0 ||
    new Set(playlists.map(playlist => playlist.id)).size !== playlists.length ||
    playlists.every(playlist => playlist.songSlugs.length === 0)
  ) {
    throw new Error('재생할 곡이 있는 재생목록이 하나 이상 필요합니다.');
  }

  if (MIGRATABLE_SONG_LIBRARY_SCHEMA_VERSIONS.has(value.schemaVersion as number)) {
    const songIndex = songs.findIndex(song => song.slug === seishunSick.slug);
    const existingAudio = songs.find(song => song.videoId === seishunSick.videoId);
    const songSlug = existingAudio?.slug ?? seishunSick.slug;
    if (songIndex >= 0 && !existingAudio) songs[songIndex] = { ...seishunSick };
    else if (songIndex < 0 && !existingAudio) songs.push({ ...seishunSick });

    const playlist = playlists.find(candidate => candidate.id === FUJII_KAZE_PLAYLIST_ID);
    if (playlist && !playlist.songSlugs.includes(songSlug)) playlist.songSlugs.push(songSlug);
  }

  return { schemaVersion: SONG_LIBRARY_SCHEMA_VERSION, songs, playlists };
}

export function parseSongLibrary(value: unknown): SongLibrary {
  try {
    return parseSongLibraryStrict(value);
  } catch {
    return createDefaultSongLibrary();
  }
}

export function songsInPlaylist(library: SongLibrary, playlistId: string): Song[] {
  const playlist = library.playlists.find(candidate => candidate.id === playlistId);
  if (!playlist) return [];
  const bySlug = new Map(library.songs.map(song => [song.slug, song]));
  return playlist.songSlugs.flatMap(slug => {
    const song = bySlug.get(slug);
    return song ? [song] : [];
  });
}

export function resolvePlayback(
  library: SongLibrary,
  requestedPlaylistId: string,
  requestedSongSlug: string
): { playlist: Playlist; songs: Song[]; song: Song } {
  const requested = library.playlists.find(playlist => playlist.id === requestedPlaylistId);
  const playlist =
    (requested?.songSlugs.length ? requested : undefined) ??
    library.playlists.find(candidate => candidate.songSlugs.length > 0) ??
    createDefaultSongLibrary().playlists[0]!;
  const songs = songsInPlaylist(library, playlist.id);
  return {
    playlist,
    songs,
    song: songs.find(candidate => candidate.slug === requestedSongSlug) ?? songs[0] ?? defaultSong,
  };
}

export function parseYouTubeVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId: string | null = null;

    if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v');
      else if (/^\/(?:shorts|embed)\//.test(url.pathname)) videoId = url.pathname.split('/')[2] ?? null;
    } else if (host === 'youtube-nocookie.com' && url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2] ?? null;
    }

    return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export function addPlaylist(library: SongLibrary, id: string, name: string): SongLibrary {
  const cleanedId = cleanRequired(id, '재생목록 ID');
  const cleanedName = cleanRequired(name, '재생목록 이름');
  if (library.playlists.some(playlist => playlist.id === cleanedId)) {
    throw new Error('같은 ID의 재생목록이 이미 있습니다. 재생목록을 초기화한 뒤 다시 시도해 주세요.');
  }
  return {
    ...library,
    playlists: [
      ...library.playlists,
      {
        id: cleanedId,
        name: cleanedName,
        songSlugs: [],
      },
    ],
  };
}

export function renamePlaylist(library: SongLibrary, playlistId: string, name: string): SongLibrary {
  const cleanedName = cleanRequired(name, '재생목록 이름');
  if (!library.playlists.some(playlist => playlist.id === playlistId)) {
    throw new Error('수정할 재생목록을 찾을 수 없습니다.');
  }
  return {
    ...library,
    playlists: library.playlists.map(playlist =>
      playlist.id === playlistId ? { ...playlist, name: cleanedName } : playlist
    ),
  };
}

export function deletePlaylist(library: SongLibrary, playlistId: string): SongLibrary {
  const remaining = library.playlists.filter(playlist => playlist.id !== playlistId);
  if (remaining.length === library.playlists.length) throw new Error('삭제할 재생목록을 찾을 수 없습니다.');
  if (remaining.every(playlist => playlist.songSlugs.length === 0)) {
    throw new Error('재생할 곡이 하나 이상 남아 있어야 합니다.');
  }
  return { ...library, playlists: remaining };
}

export function saveSongToPlaylist(
  library: SongLibrary,
  playlistId: string,
  youtubeUrl: string,
  details: SongDetails
): { library: SongLibrary; song: Song } {
  const playlist = library.playlists.find(candidate => candidate.id === playlistId);
  if (!playlist) throw new Error('곡을 추가할 재생목록을 찾을 수 없습니다.');

  const videoId = parseYouTubeVideoId(youtubeUrl);
  if (!videoId) throw new Error('YouTube 영상 주소를 확인해 주세요.');
  const titleJa = cleanRequired(details.titleJa, '원어 제목');
  const titleKo = cleanRequired(details.titleKo, '한국어 표기');
  const existing = library.songs.find(song => song.videoId === videoId);
  if (existing && playlist.songSlugs.includes(existing.slug)) {
    throw new Error('이미 이 재생목록에 있는 곡입니다.');
  }

  const song: Song = existing
    ? { ...existing, titleJa, titleKo }
    : { slug: `youtube-${videoId}`, titleJa, titleKo, videoId };
  if (!existing && library.songs.some(candidate => candidate.slug === song.slug)) {
    throw new Error('곡 ID가 충돌했습니다. 재생목록을 초기화한 뒤 다시 시도해 주세요.');
  }

  return {
    song,
    library: {
      schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
      songs: existing
        ? library.songs.map(candidate => (candidate.slug === existing.slug ? song : candidate))
        : [...library.songs, song],
      playlists: library.playlists.map(candidate =>
        candidate.id === playlistId ? { ...candidate, songSlugs: [...candidate.songSlugs, song.slug] } : candidate
      ),
    },
  };
}

export function updateSongDetails(library: SongLibrary, songSlug: string, details: SongDetails): SongLibrary {
  const titleJa = cleanRequired(details.titleJa, '원어 제목');
  const titleKo = cleanRequired(details.titleKo, '한국어 표기');
  if (!library.songs.some(song => song.slug === songSlug)) throw new Error('수정할 곡을 찾을 수 없습니다.');
  return {
    ...library,
    songs: library.songs.map(song => (song.slug === songSlug ? { ...song, titleJa, titleKo } : song)),
  };
}

export function removeSongFromPlaylist(library: SongLibrary, playlistId: string, songSlug: string): SongLibrary {
  const playlist = library.playlists.find(candidate => candidate.id === playlistId);
  if (!playlist?.songSlugs.includes(songSlug)) throw new Error('재생목록에서 곡을 찾을 수 없습니다.');
  const totalEntries = library.playlists.reduce((sum, candidate) => sum + candidate.songSlugs.length, 0);
  if (totalEntries <= 1) throw new Error('재생할 곡이 하나 이상 남아 있어야 합니다.');
  return {
    ...library,
    playlists: library.playlists.map(candidate =>
      candidate.id === playlistId
        ? { ...candidate, songSlugs: candidate.songSlugs.filter(slug => slug !== songSlug) }
        : candidate
    ),
  };
}

export function reorderPlaylistSongs(library: SongLibrary, playlistId: string, songs: readonly Song[]): SongLibrary {
  const playlist = library.playlists.find(candidate => candidate.id === playlistId);
  if (!playlist || songs.length !== playlist.songSlugs.length) return library;
  const nextSlugs = songs.map(song => song.slug);
  if (new Set(nextSlugs).size !== nextSlugs.length || nextSlugs.some(slug => !playlist.songSlugs.includes(slug))) {
    return library;
  }
  return {
    ...library,
    playlists: library.playlists.map(candidate =>
      candidate.id === playlistId ? { ...candidate, songSlugs: nextSlugs } : candidate
    ),
  };
}
