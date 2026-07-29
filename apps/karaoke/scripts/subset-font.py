"""Pretendard Variable을 한국어 실사용 범위로 서브셋한다.

원본 2MB는 모바일 첫 로딩에 그대로 얹히는데, 대부분이 실제로 쓰이지 않는
확장 한글 음절이다. KS X 1001 완성형 2350자 + 라틴/구두점만 남기면 449KB가 된다.
빠진 희귀 음절은 시스템 폰트로 글자 단위 폴백되므로 깨지지 않는다.

    python3 scripts/subset-font.py <원본.woff2> <출력.woff2>

서브셋은 SIL OFL상 수정본이므로 Pretendard 예약명을 그대로 쓰지 않는다.
출력의 사용자 표시명은 Mumak Sans Variable로 바꾸고 저작권·라이선스 메타데이터는
원본 그대로 보존한다.

의존성: pip install fonttools brotli
"""

import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

DERIVED_FAMILY_NAME = 'Mumak Sans Variable'
DERIVED_POSTSCRIPT_NAME = 'MumakSansVariable'
SOURCE_POSTSCRIPT_PREFIX = 'PretendardVariable-'


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


def rename_derived_font(font: TTFont) -> None:
    """OFL 예약명을 쓰지 않도록 사용자에게 보이는 name table 필드를 교체한다."""
    revision = font['head'].fontRevision
    replacements = {
        1: DERIVED_FAMILY_NAME,
        3: f'{revision:.3f};MUMAK;{DERIVED_POSTSCRIPT_NAME}',
        4: DERIVED_FAMILY_NAME,
        6: f'{DERIVED_POSTSCRIPT_NAME}-Regular',
        16: DERIVED_FAMILY_NAME,
        25: DERIVED_POSTSCRIPT_NAME,
    }

    for record in font['name'].names:
        replacement = replacements.get(record.nameID)
        current_name = record.toUnicode()
        if current_name.startswith(SOURCE_POSTSCRIPT_PREFIX):
            replacement = current_name.replace(SOURCE_POSTSCRIPT_PREFIX, f'{DERIVED_POSTSCRIPT_NAME}-', 1)
        if replacement is not None:
            record.string = replacement.encode(record.getEncoding())

    remaining_instance_names = [
        record.toUnicode() for record in font['name'].names if record.toUnicode().startswith(SOURCE_POSTSCRIPT_PREFIX)
    ]
    if remaining_instance_names:
        raise ValueError(f'예약명이 남은 named instance가 있습니다: {remaining_instance_names}')


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
    rename_derived_font(font)
    subset.save_font(font, dst, options)
    font.close()

    print(f'{os.path.getsize(src) / 1024:.0f} KB -> {os.path.getsize(dst) / 1024:.0f} KB')


if __name__ == '__main__':
    main(*sys.argv[1:3])
