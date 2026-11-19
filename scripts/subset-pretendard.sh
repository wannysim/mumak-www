#!/usr/bin/env bash
#
# 앱별 본문 폰트(Pretendard Variable) 서브셋 생성 스크립트.
#
# 원본 PretendardVariable(2.1MB)은 wght 45~920 전 축과 한자·다국어 글리프를 담는다.
# 각 앱이 실제로 쓰는 wght 범위와 (Latin + KS X 1001 완성형 한글 2,350자 + 앱 텍스트에 쓰인 글자)만
# 남긴다. 그 밖의 글자는 fallback 폰트로 글리프 단위 대체될 뿐 빈 네모(tofu)가 되지 않는다.
# 새 콘텐츠에 KS X 1001 밖 글자가 들어오면 이 스크립트를 다시 돌린다.
#
# 빌드/CI에 연결하지 않는 수동 스크립트다(fontTools는 repo 의존성이 아니다).
#
# 사용법 (repo 루트에서):
#   bash scripts/subset-pretendard.sh <app> <wght 범위> <텍스트 경로...>
# 예:
#   bash scripts/subset-pretendard.sh interview 300:700 app components lib
#
# 결과물: apps/<app>/fonts/PretendardVariableSubset.woff2 (커밋 대상, next/font/local이 소비)
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: $0 <app> <wght-min:wght-max> <text-path...>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$1"
WGHT="$2"
shift 2
APP_DIR="$ROOT/apps/$APP"
SRC="$ROOT/apps/blog/fonts/PretendardVariable.source.woff2"
OUT="$APP_DIR/fonts/PretendardVariableSubset.woff2"
WORK="$(mktemp -d)"
VENV="${TMPDIR:-/tmp}/fontsubset-venv"
trap 'rm -rf "$WORK"' EXIT

# 앱 텍스트(소스·콘텐츠·메시지)를 모아 실제 사용 글자를 보장한다. 테스트 파일은 뺀다.
TEXT_FILE="$WORK/text.txt"
(
  cd "$APP_DIR"
  for path in "$@"; do
    find "$path" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mdx' -o -name '*.md' -o -name '*.json' \) \
      -not -path '*/__tests__/*' -not -path '*/node_modules/*' -exec cat {} +
  done
) > "$TEXT_FILE"
# 공유 UI 컴포넌트의 문자열도 함께 넣는다.
find "$ROOT/packages/ui/src" -type f -name '*.tsx' -exec cat {} + >> "$TEXT_FILE"

# KS X 1001 완성형 한글 2,350자(EUC-KR 0xB0A1~0xC8FE)
python3 -c "print(''.join(bytes([a, b]).decode('euc_kr') for a in range(0xB0, 0xC9) for b in range(0xA1, 0xFF)))" >> "$TEXT_FILE"

# Latin / 구두점·기호 / 화살표 / CJK 기호 / 한글 자모. 한글 음절은 위 TEXT_FILE로만 넣는다.
UNICODES="U+0020-007E,U+00A0-00FF,U+2000-206F,U+2070-209F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2460-24FF,U+25A0-25FF,U+2600-26FF,U+3000-303F,U+1100-11FF,U+3130-318F,U+A960-A97F,U+D7B0-D7FF,U+FF00-FFEF"

if [ ! -x "$VENV/bin/pyftsubset" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet "fonttools[woff]" brotli
fi

"$VENV/bin/python" - "$SRC" "$WORK/decompressed.ttf" <<'PY'
import sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1]); f.flavor = None
f.save(sys.argv[2])
PY

"$VENV/bin/fonttools" varLib.instancer "$WORK/decompressed.ttf" "wght=$WGHT" -o "$WORK/instanced.ttf"

mkdir -p "$(dirname "$OUT")"
"$VENV/bin/pyftsubset" "$WORK/instanced.ttf" \
  --output-file="$OUT" --flavor=woff2 \
  --unicodes="$UNICODES" --text-file="$TEXT_FILE" \
  --layout-features='*' --no-hinting --desubroutinize

echo "생성 완료: $OUT ($(wc -c < "$OUT") bytes, 원본 $(wc -c < "$SRC") bytes, wght $WGHT)"
