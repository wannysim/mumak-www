"""Pretendard Variable을 한국어 실사용 범위로 서브셋한다.

원본 2MB는 모바일 첫 로딩에 그대로 얹히는데, 대부분이 실제로 쓰이지 않는
확장 한글 음절이다. KS X 1001 완성형 2350자 + 라틴/구두점만 남기면 449KB가 된다.
빠진 희귀 음절은 시스템 폰트로 글자 단위 폴백되므로 깨지지 않는다.

    python3 scripts/subset-font.py <원본.woff2> <출력.woff2>

의존성: pip install fonttools brotli
"""

import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont


def ks_x_1001_hangul() -> set[int]:
    """KS X 1001 완성형 한글 2350자.

    EUC-KR에서 이 음절들은 0xB0A1~0xC8FE에 배치된다. 파이썬의 euc_kr 코덱은
    UHC(cp949) 확장까지 받아주기 때문에 인코딩 성공 여부만으로는 거를 수 없고,
    lead byte 범위까지 봐야 한다.
    """
    result = set()
    for cp in range(0xAC00, 0xD7A4):
        try:
            encoded = chr(cp).encode('euc_kr')
        except UnicodeEncodeError:
            continue
        if len(encoded) == 2 and 0xB0 <= encoded[0] <= 0xC8 and 0xA1 <= encoded[1] <= 0xFE:
            result.add(cp)
    return result


def main(src: str, dst: str) -> None:
    font = TTFont(src)
    available = set()
    for table in font['cmap'].tables:
        available |= set(table.cmap.keys())
    font.close()

    wanted = ks_x_1001_hangul()
    wanted |= set(range(0x0020, 0x007F))  # 기본 라틴
    wanted |= set(range(0x00A0, 0x0100))  # 라틴-1 보충
    wanted |= set(range(0x2010, 0x2030))  # 구두점
    wanted |= set(range(0x3130, 0x3164))  # 한글 호환 자모
    wanted |= {0x2032, 0x2033, 0x203B, 0x20A9, 0x20AC, 0x2122}
    wanted |= {0x266A, 0x266B, 0x3001, 0x3002, 0x300C, 0x300D, 0x30FC}

    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True

    font = subset.load_font(src, options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=sorted(wanted & available))
    subsetter.subset(font)
    subset.save_font(font, dst, options)
    font.close()

    print(f'{os.path.getsize(src) / 1024:.0f} KB -> {os.path.getsize(dst) / 1024:.0f} KB')


if __name__ == '__main__':
    main(*sys.argv[1:3])
