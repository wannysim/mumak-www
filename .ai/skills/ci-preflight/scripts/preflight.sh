#!/bin/bash
# CI Preflight 검증 스크립트
# 사용법: ./scripts/preflight.sh [app-name] [--with-build] [--with-e2e]
# app-name 미지정 시 변경된 부분만 검증

set -e

APP_NAME=""
WITH_BUILD=false
WITH_E2E=false

for arg in "$@"; do
    case "$arg" in
        --with-build)
            WITH_BUILD=true
            ;;
        --with-e2e)
            WITH_E2E=true
            ;;
        *)
            if [ -z "$APP_NAME" ]; then
                APP_NAME="$arg"
            else
                echo "알 수 없는 인자: $arg"
                exit 1
            fi
            ;;
    esac
done

FILTER_VALUE="[origin/develop...HEAD]"
if [ -n "$APP_NAME" ]; then
    FILTER_VALUE="$APP_NAME"
    echo "앱 지정: $APP_NAME"
else
    echo "변경된 부분만 검증 (origin/develop 기준)"
fi

run_step() {
    local label="$1"
    shift

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$label"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    "$@"
}

run_step "1/4 Type Check" pnpm turbo run check-types --filter="$FILTER_VALUE"
run_step "2/4 Lint" pnpm turbo run lint --filter="$FILTER_VALUE"
run_step "3/4 Format Check" pnpm turbo run format:check --filter="$FILTER_VALUE"
run_step "4/4 Test" pnpm turbo run test:ci --filter="$FILTER_VALUE"

if [ "$WITH_BUILD" = true ]; then
    run_step "5/6 Build" pnpm turbo run build --filter="$FILTER_VALUE"
fi

if [ "$WITH_E2E" = true ]; then
    if [ "$WITH_BUILD" = false ]; then
        echo ""
        echo "주의: --with-e2e는 보통 --with-build와 함께 사용하는 것이 안전합니다."
    fi

    E2E_INCLUDE_DRAFT=true run_step "6/6 E2E" pnpm turbo run test:e2e --filter="$FILTER_VALUE"
fi

echo ""
echo "모든 검증 통과!"
