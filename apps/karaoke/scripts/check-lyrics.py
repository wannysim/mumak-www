"""public/lyrics/*.json이 앱이 기대하는 모양인지 확인한다.

싱크 편집 모드로 손수 만든 JSON은 붙여 넣다가 어긋나기 쉽다. 특히 시간이 순증가하지
않으면 `currentLineIndex`의 findLastIndex가 엉뚱한 줄을 고른다(정렬을 전제한다).

    python3 scripts/check-lyrics.py
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

APP_ROOT = pathlib.Path(__file__).resolve().parent.parent
SONGS_DIR = APP_ROOT / 'src' / 'songs'
LYRICS_DIR = APP_ROOT / 'public' / 'lyrics'


def known_slugs() -> set[str]:
    slugs = set()
    for path in SONGS_DIR.glob('*.ts'):
        match = re.search(r"slug:\s*'([^']+)'", path.read_text())
        if match:
            slugs.add(match.group(1))
    return slugs


def check(path: pathlib.Path, slugs: set[str]) -> list[str]:
    problems: list[str] = []
    if path.stem not in slugs:
        problems.append(f'src/songs에 없는 slug다 (오타이거나 곡 파일이 빠졌다)')

    try:
        lines = json.loads(path.read_text())
    except json.JSONDecodeError as error:
        return problems + [f'JSON 파싱 실패: {error}']

    if not isinstance(lines, list) or not lines:
        return problems + ['배열이 아니거나 비어 있다']

    previous = -1.0
    for index, line in enumerate(lines):
        where = f'{index}번째 줄'
        if not isinstance(line, dict):
            problems.append(f'{where}: 객체가 아니다')
            continue

        missing = [key for key in ('time', 'jp', 'pron', 'ko') if key not in line]
        if missing:
            problems.append(f'{where}: {", ".join(missing)} 없음')
            continue

        time = line['time']
        if not isinstance(time, (int, float)) or time < 0:
            problems.append(f'{where}: time이 0 이상의 숫자가 아니다 ({time!r})')
        elif time < previous:
            problems.append(f'{where}: time이 뒤로 갔다 ({previous} -> {time})')
        else:
            previous = float(time)

        if not str(line['jp']).strip():
            problems.append(f'{where}: jp가 비었다')

    return problems


def main() -> None:
    if not LYRICS_DIR.exists():
        print('public/lyrics 없음. 아직 만든 가사가 없다.')
        return

    slugs = known_slugs()
    files = sorted(LYRICS_DIR.glob('*.json'))
    if not files:
        print('public/lyrics 비어 있음.')
        return

    failed = False
    for path in files:
        problems = check(path, slugs)
        if problems:
            failed = True
            print(f'✗ {path.name}')
            for problem in problems:
                print(f'    {problem}')
        else:
            count = len(json.loads(path.read_text()))
            filled = sum(1 for line in json.loads(path.read_text()) if line['pron'] and line['ko'])
            note = '' if filled == count else f' (발음·번역 미완 {count - filled}줄)'
            print(f'✓ {path.name}  {count}줄{note}')

    missing = sorted(slugs - {path.stem for path in files})
    if missing:
        print(f'\n가사 없는 곡: {", ".join(missing)}')

    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
