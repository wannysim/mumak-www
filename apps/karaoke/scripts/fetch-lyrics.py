"""곡의 타임스탬프 가사 뼈대를 만든다.

lrclib(공개 LRC 데이터베이스)에서 싱크 가사를 찾아, 실제 재생할 YouTube 음원과
길이가 가장 가까운 후보를 골라 `[{time, jp, pron, ko}]` JSON으로 떨어뜨린다.
`pron`과 `ko`는 빈 문자열로 두고 사람이(또는 에이전트가) 채운다.

    python3 scripts/fetch-lyrics.py time-paradox
    python3 scripts/fetch-lyrics.py time-paradox --write

`--write` 없이는 stdout으로만 낸다. 가사는 저작물이라 `public/lyrics/`는 gitignore이고
커밋되지 않는다.

## 알아 둘 것

- **제목 표기가 갈린다.** lrclib은 등록자가 붙인 이름을 쓴다. 「タイムパラドックス」는
  로마자 "Time Paradox"로만 올라와 있어서 원제로만 찾으면 0건이 나온다. 그래서 원제 ·
  로마자 · 자유 검색을 모두 시도한다.
- **길이로 판별한다.** 같은 곡도 MV / 앨범 / 리레코딩이 섞여 있고 타임스탬프가 어긋난다.
  실제로 재생할 videoId의 길이와 가장 가까운 후보를 골라야 싱크가 맞는다.
- 후보가 없으면 앱의 싱크 편집 모드로 직접 찍어야 한다. docs/LYRICS.md 참고.
"""

from __future__ import annotations  # macOS 기본 python3(3.9)에서 `int | None` 표기를 쓰기 위해

import argparse
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

APP_ROOT = pathlib.Path(__file__).resolve().parent.parent
SONGS_DIR = APP_ROOT / 'src' / 'songs'
LYRICS_DIR = APP_ROOT / 'public' / 'lyrics'

UA = {'User-Agent': 'Mozilla/5.0 (karaoke lyrics helper)'}


def read_song(slug: str) -> dict[str, str]:
    """src/songs/<slug>.ts에서 videoId와 제목을 읽는다."""
    path = SONGS_DIR / f'{slug}.ts'
    if not path.exists():
        sys.exit(f'{path} 없음. slug를 확인해라.')

    source = path.read_text()

    def field(name: str) -> str:
        match = re.search(rf"{name}:\s*'([^']*)'", source)
        if not match:
            sys.exit(f'{path}에서 {name}를 찾지 못했다.')
        return match.group(1)

    return {'videoId': field('videoId'), 'titleJa': field('titleJa'), 'titleKo': field('titleKo')}


def youtube_duration(video_id: str) -> int | None:
    """워치 페이지에서 lengthSeconds를 긁는다. API 키 없이 길이만 알면 된다."""
    request = urllib.request.Request(f'https://www.youtube.com/watch?v={video_id}', headers=UA)
    html = urllib.request.urlopen(request, timeout=20).read().decode('utf-8', 'ignore')
    match = re.search(r'"lengthSeconds":"(\d+)"', html)
    return int(match.group(1)) if match else None


def search_lrclib(title: str) -> list[dict]:
    """원제 · 아티스트 조합 · 자유 검색을 모두 시도해 중복 없이 모은다."""
    attempts = [
        {'artist_name': 'Vaundy', 'track_name': title},
        {'track_name': title},
        {'q': f'{title} Vaundy'},
    ]
    seen: dict[int, dict] = {}
    for params in attempts:
        url = 'https://lrclib.net/api/search?' + urllib.parse.urlencode(params)
        try:
            results = json.load(urllib.request.urlopen(url, timeout=20))
        except Exception:
            continue
        for item in results:
            if item.get('syncedLyrics'):
                seen[item['id']] = item
    return list(seen.values())


def parse_lrc(text: str) -> list[dict]:
    """[mm:ss.xx] 태그를 초로 편다. 한 줄에 태그가 여러 개면 각각 별도 줄이 된다."""
    lines: list[dict] = []
    for raw in text.splitlines():
        content = re.sub(r'\[\d+:\d+(?:\.\d+)?\]', '', raw).strip()
        if not content:
            continue
        for match in re.finditer(r'\[(\d+):(\d+(?:\.\d+)?)\]', raw):
            seconds = int(match.group(1)) * 60 + float(match.group(2))
            lines.append({'time': round(seconds, 2), 'jp': content, 'pron': '', 'ko': ''})
    lines.sort(key=lambda line: line['time'])
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('slug', help='src/songs/<slug>.ts 의 slug')
    parser.add_argument('--title', help='lrclib 검색에 쓸 제목. 기본은 곡 파일의 원제')
    parser.add_argument('--write', action='store_true', help='public/lyrics/<slug>.json에 저장')
    args = parser.parse_args()

    song = read_song(args.slug)
    duration = youtube_duration(song['videoId'])
    if duration is None:
        sys.exit(f'YouTube에서 {song["videoId"]} 길이를 읽지 못했다.')

    titles = [args.title] if args.title else [song['titleJa'], song['titleKo']]
    candidates: list[dict] = []
    for title in titles:
        candidates += search_lrclib(title)
    candidates = list({item['id']: item for item in candidates}.values())

    print(f'{args.slug}: YouTube {duration}s, 싱크 가사 후보 {len(candidates)}건', file=sys.stderr)
    if not candidates:
        sys.exit('후보 없음. 앱의 싱크 편집 모드로 직접 만들어야 한다 (docs/LYRICS.md).')

    best = min(candidates, key=lambda item: abs(item['duration'] - duration))
    gap = abs(best['duration'] - duration)
    print(f"  선택: id={best['id']} '{best['trackName']}' / {best['artistName']} "
          f"{best['duration']}s (차이 {gap:.1f}s)", file=sys.stderr)
    if gap > 2:
        print(f'  경고: 길이 차이가 {gap:.1f}s다. 싱크가 어긋날 수 있으니 들어 보고 판단해라.', file=sys.stderr)

    lines = parse_lrc(best['syncedLyrics'])
    print(f'  {len(lines)}줄', file=sys.stderr)

    payload = '[\n' + ',\n'.join(json.dumps(line, ensure_ascii=False) for line in lines) + '\n]\n'
    if args.write:
        LYRICS_DIR.mkdir(parents=True, exist_ok=True)
        target = LYRICS_DIR / f'{args.slug}.json'
        target.write_text(payload)
        print(f'  -> {target.relative_to(APP_ROOT)}', file=sys.stderr)
    else:
        sys.stdout.write(payload)


if __name__ == '__main__':
    main()
