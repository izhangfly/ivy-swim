#!/usr/bin/env bash
# Stamp every asset reference in the HTML with the current version so a deploy
# can never be served from a stale browser cache.
set -euo pipefail
cd "$(dirname "$0")"
V="${1:-$(date +%Y%m%d%H%M%S)}"
for f in static/*.html; do
  perl -pi -e 's{(href="styles\.css)(\?v=[^"]*)?"}{$1?v='"$V"'"}g;
               s{(src="(?:i18n|core|p-[a-z]+)\.js)(\?v=[^"]*)?"}{$1?v='"$V"'"}g' "$f"
done
perl -pi -e 's{(\@import url\(.fonts\.css)(\?v=[^)'"'"']*)?(.\))}{$1?v='"$V"'$3}' static/styles.css
sed -i '' -E "s/^APP_VERSION = .*/APP_VERSION = '$V'/" server.py 2>/dev/null || \
  sed -i -E "s/^APP_VERSION = .*/APP_VERSION = '$V'/" server.py
echo "stamped version $V"
