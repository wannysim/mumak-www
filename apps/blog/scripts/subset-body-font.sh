#!/usr/bin/env bash
#
# blog 본문 폰트(Pretendard Variable) 서브셋 재생성. 구현은 공용 scripts/subset-pretendard.sh에 있다.
#
# 이 블로그는 wght 400~700과 (Latin + KS X 1001 완성형 한글 2,350자 + 콘텐츠/UI 문자열에 쓰인 글자)만 쓴다.
# 콘텐츠에 KS X 1001 밖 글자(예: 똠, 쓩)가 들어오면 이 스크립트를 다시 돌린다. 재생성 전이라도
# fallback 폰트로 글리프 단위 대체될 뿐 빈 네모(tofu)가 되지는 않는다.
#
# 결과물: fonts/PretendardVariableSubset.woff2 (next/font가 소비 — 커밋 대상)
# 원본:   fonts/PretendardVariable.source.woff2 (빌드 산출물엔 미포함, 다른 앱 서브셋의 원본도 겸한다)
#
# 사용법: apps/blog 디렉터리에서 `bash scripts/subset-body-font.sh`
set -euo pipefail

cd "$(dirname "$0")/../../.."
exec bash scripts/subset-pretendard.sh blog 400:700 content messages src app
