#!/bin/sh
set -e
pkg="$1"
shift
cd "$(dirname "$0")/../../$pkg" || exit 0
[ -x node_modules/.bin/eslint ] || exit 0
node_modules/.bin/eslint --fix --no-warn-ignored "$@"
