#!/bin/bash
# PR의 base 브랜치 ruleset이 요구하는 status check가 모두 통과할 때까지 기다린다.
# 사용법: .ai/skills/release/scripts/wait-required-checks.sh <pr-number> [interval-seconds]  (저장소 루트에서 실행)
#
# `gh pr checks --required --watch`를 쓰지 않는 이유: required check인 `CI Success`·`E2E Success`는
# 다른 job 전부를 `needs`로 기다리는 집계 job이라, 실행 막바지에야 check run이 생긴다. 그 전에는
# gh가 "no required checks reported"를 내고 바로 끝나서 기다린 것처럼 보이지만 실제로는 아무것도
# 기다리지 않는다. 그래서 required 목록은 ruleset에서 읽고, check run이 아직 없으면 대기로 본다.
#
# 종료 코드: 0 = 전부 pass, 1 = 하나라도 fail/cancel, 2 = 입력·조회 오류

set -euo pipefail

PR_NUMBER="${1:-}"
INTERVAL="${2:-30}"

if [ -z "$PR_NUMBER" ]; then
    echo "사용법: $0 <pr-number> [interval-seconds]" >&2
    exit 2
fi

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
BASE=$(gh pr view "$PR_NUMBER" --json baseRefName --jq .baseRefName)
REQUIRED=$(gh api "repos/$REPO/rules/branches/$BASE" \
    --jq '[.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context] | unique | .[]')

if [ -z "$REQUIRED" ]; then
    echo "$BASE ruleset에서 required status check를 읽지 못했다. ruleset을 직접 확인하라." >&2
    exit 2
fi

echo "PR #$PR_NUMBER ($BASE) required checks: $(echo "$REQUIRED" | paste -sd ',' - | sed 's/,/, /g')"

while :; do
    CHECKS=$(gh pr checks "$PR_NUMBER" --json name,bucket --jq '.[] | "\(.name)\t\(.bucket)"' || true)
    WAITING=()

    while IFS= read -r context; do
        # 같은 이름의 check run이 여러 개일 수 있다(재실행 등). 전부 pass여야 통과로 본다.
        buckets=$(printf '%s\n' "$CHECKS" | awk -F'\t' -v c="$context" '$1 == c { print $2 }')
        if [ -z "$buckets" ]; then
            WAITING+=("$context(미생성)")
        elif printf '%s\n' "$buckets" | grep -qE '^(fail|cancel)$'; then
            echo "실패: $context" >&2
            exit 1
        elif printf '%s\n' "$buckets" | grep -qvE '^(pass|skipping)$'; then
            WAITING+=("$context(pending)")
        fi
    done <<< "$REQUIRED"

    if [ "${#WAITING[@]}" -eq 0 ]; then
        echo "모든 required check 통과"
        exit 0
    fi

    echo "$(date +%T) 대기: ${WAITING[*]}"
    sleep "$INTERVAL"
done
