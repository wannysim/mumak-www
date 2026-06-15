#!/usr/bin/env bash
#
# 본문 폰트(Pretendard Variable) 서브셋 재생성 스크립트 (C-1, 빌드 다이어트).
#
# next/font/local로 클라이언트에 전송되는 본문 폰트를 다이어트한다. 원본
# PretendardVariable(2.1MB)은 wght 45~920 전 축 + 한자/다국어 글리프까지 포함하지만,
# 이 블로그는 wght 400~700과 (Latin + 전체 현대 한글 + 공통 구두점/기호)만 쓴다.
#
# 결과물:
#   fonts/PretendardVariableSubset.woff2  (~1.24MB, next/font가 소비 — 커밋 대상)
# 소스(커밋되어 있으나 빌드 산출물엔 미포함):
#   fonts/PretendardVariable.source.woff2 (upstream Pretendard variable woff2)
#
# 한자/이모지 등 미포함 글리프는 fallback 폰트(ui-sans-serif)로 per-glyph 대체된다
# (tofu 아님). 전체 현대 한글(AC00-D7A3)을 유지하므로 한국어 본문 tofu 위험은 없다.
# 빌드/CI에는 연결하지 않는 일회성 수동 스크립트다(fontTools는 repo 의존성이 아니다).
#
# 사용법: apps/blog 디렉터리에서 `bash scripts/subset-body-font.sh`
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="fonts/PretendardVariable.source.woff2"
OUT="fonts/PretendardVariableSubset.woff2"
VENV="${TMPDIR:-/tmp}/fontsubset-venv"

# 실제 콘텐츠/UI 문자열을 합쳐 현재 사용 글리프(있다면 한자 포함)를 보장한다.
TEXT_FILE="${TMPDIR:-/tmp}/blog-font-text.txt"
cat content/**/**/*.mdx content/**/*.mdx messages/*.json > "$TEXT_FILE" 2>/dev/null || true

# 유니코드 범위: Latin / 구두점·기호 / 화살표 / CJK 기호 / 한글 자모·음절 전체.
UNICODES="U+0020-007E,U+00A0-00FF,U+2000-206F,U+2070-209F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2460-24FF,U+25A0-25FF,U+2600-26FF,U+3000-303F,U+1100-11FF,U+3130-318F,U+A960-A97F,U+AC00-D7A3,U+D7B0-D7FF,U+FF00-FFEF"

if [ ! -x "$VENV/bin/pyftsubset" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet "fonttools[woff]" brotli
fi

# 1) woff2 → ttf 디컴프레스
"$VENV/bin/python" - "$SRC" <<'PY'
import sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1]); f.flavor = None
f.save("/tmp/Pretendard.decompressed.ttf")
PY

# 2) wght 축을 400~700로 부분 인스턴싱(사용하는 weight만 유지)
"$VENV/bin/fonttools" varLib.instancer /tmp/Pretendard.decompressed.ttf \
  wght=400:700 -o /tmp/Pretendard.instanced.ttf

# 3) 글리프 서브셋 + woff2 재압축
"$VENV/bin/pyftsubset" /tmp/Pretendard.instanced.ttf \
  --output-file="$OUT" --flavor=woff2 \
  --unicodes="$UNICODES" --text-file="$TEXT_FILE" \
  --layout-features='*' --no-hinting --desubroutinize

echo "생성 완료: $OUT ($(wc -c < "$OUT") bytes, 원본 $(wc -c < "$SRC") bytes)"
