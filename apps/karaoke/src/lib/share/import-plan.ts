import type { KaraokeShareBundle, ShareScopeKind } from '@/lib/share/bundle';
import {
  parseSongLibraryStrict,
  SONG_LIBRARY_SCHEMA_VERSION,
  type Playlist,
  type SongLibrary,
} from '@/lib/song-library';
import type { Song } from '@/songs';

export type ShareImportPlan = {
  library: SongLibrary;
  summary: {
    kind: ShareScopeKind;
    songCount: number;
    playlistCount: number;
    lyricCount: number;
    includesLyrics: boolean;
    newSongCount: number;
    changedSongCount: number;
    newPlaylistCount: number;
    changedPlaylistCount: number;
    removedSongCount: number;
    removedPlaylistCount: number;
  };
};

function songsFromBundle(bundle: KaraokeShareBundle): Song[] {
  if (bundle.scope.kind === 'library') return bundle.scope.library.songs;
  if (bundle.scope.kind === 'playlist') return bundle.scope.songs;
  return [bundle.scope.song];
}

function sameSong(left: Song, right: Song): boolean {
  return (
    left.slug === right.slug &&
    left.videoId === right.videoId &&
    left.titleJa === right.titleJa &&
    left.titleKo === right.titleKo
  );
}

function samePlaylist(left: Playlist, right: Playlist): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.songSlugs.length === right.songSlugs.length &&
    left.songSlugs.every((slug, index) => slug === right.songSlugs[index])
  );
}

function upsertSongs(current: readonly Song[], incoming: readonly Song[]): Song[] {
  const incomingBySlug = new Map(incoming.map(song => [song.slug, song]));
  const result = current.map(song => incomingBySlug.get(song.slug) ?? song);
  const currentSlugs = new Set(current.map(song => song.slug));
  result.push(...incoming.filter(song => !currentSlugs.has(song.slug)));
  return result;
}

export function createShareImportPlan(
  currentLibrary: SongLibrary,
  bundle: KaraokeShareBundle,
  targetPlaylistId: string
): ShareImportPlan {
  const current = parseSongLibraryStrict(currentLibrary);
  const incomingSongs = songsFromBundle(bundle);
  const currentBySlug = new Map(current.songs.map(song => [song.slug, song]));
  const currentByVideo = new Map(current.songs.map(song => [song.videoId, song]));
  if (bundle.scope.kind !== 'library') {
    for (const song of incomingSongs) {
      const slugMatch = currentBySlug.get(song.slug);
      const videoMatch = currentByVideo.get(song.videoId);
      if (slugMatch && slugMatch.videoId !== song.videoId) {
        throw new Error(`${song.slug} 곡 ID가 이 기기의 다른 영상과 연결되어 있습니다.`);
      }
      if (videoMatch && videoMatch.slug !== song.slug) {
        throw new Error(`${song.titleJa} 영상이 이 기기에서 다른 곡 ID로 저장되어 있습니다.`);
      }
    }
  }

  let library: SongLibrary;
  if (bundle.scope.kind === 'library') {
    library = bundle.scope.library;
  } else if (bundle.scope.kind === 'playlist') {
    const incomingPlaylist = bundle.scope.playlist;
    library = {
      schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
      songs: upsertSongs(current.songs, incomingSongs),
      playlists: current.playlists.some(playlist => playlist.id === incomingPlaylist.id)
        ? current.playlists.map(playlist => (playlist.id === incomingPlaylist.id ? incomingPlaylist : playlist))
        : [...current.playlists, incomingPlaylist],
    };
  } else {
    const target = current.playlists.find(playlist => playlist.id === targetPlaylistId);
    if (!target) throw new Error('공유 곡을 담을 재생목록을 찾을 수 없습니다.');
    const sharedSong = bundle.scope.song;
    library = {
      schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
      songs: upsertSongs(current.songs, incomingSongs),
      playlists: current.playlists.map(playlist =>
        playlist.id === target.id && !playlist.songSlugs.includes(sharedSong.slug)
          ? { ...playlist, songSlugs: [...playlist.songSlugs, sharedSong.slug] }
          : playlist
      ),
    };
  }
  library = parseSongLibraryStrict(library);

  const incomingPlaylists =
    bundle.scope.kind === 'library'
      ? bundle.scope.library.playlists
      : bundle.scope.kind === 'playlist'
        ? [bundle.scope.playlist]
        : [];
  const currentPlaylistById = new Map(current.playlists.map(playlist => [playlist.id, playlist]));
  const incomingSongSlugs = new Set(incomingSongs.map(song => song.slug));
  const incomingPlaylistIds = new Set(incomingPlaylists.map(playlist => playlist.id));
  return {
    library,
    summary: {
      kind: bundle.scope.kind,
      songCount: incomingSongs.length,
      playlistCount: incomingPlaylists.length,
      lyricCount: bundle.lyrics?.length ?? 0,
      includesLyrics: bundle.lyrics !== undefined,
      newSongCount: incomingSongs.filter(song => !currentBySlug.has(song.slug)).length,
      changedSongCount: incomingSongs.filter(song => {
        const stored = currentBySlug.get(song.slug);
        return stored ? !sameSong(stored, song) : false;
      }).length,
      newPlaylistCount: incomingPlaylists.filter(playlist => !currentPlaylistById.has(playlist.id)).length,
      changedPlaylistCount: incomingPlaylists.filter(playlist => {
        const stored = currentPlaylistById.get(playlist.id);
        return stored ? !samePlaylist(stored, playlist) : false;
      }).length,
      removedSongCount:
        bundle.scope.kind === 'library' ? current.songs.filter(song => !incomingSongSlugs.has(song.slug)).length : 0,
      removedPlaylistCount:
        bundle.scope.kind === 'library'
          ? current.playlists.filter(playlist => !incomingPlaylistIds.has(playlist.id)).length
          : 0,
    },
  };
}
