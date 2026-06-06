#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ -n "${CI:-}" ] || [ -n "${FORCE_COLOR:-}" ]; then
  exec env NO_COLOR= playwright test "$@"
fi

exec playwright test "$@"
