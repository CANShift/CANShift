#!/usr/bin/env bash
# scripts/apply-icon-radius.sh
# Applies an Apple-style rounded-rectangle mask to the Electron app icon.
# Apple squircle corner radius ≈ 22.37% of icon size (verified against macOS icons).
#
# Usage: bash scripts/apply-icon-radius.sh
# Requires: ImageMagick 7 (brew install imagemagick)

set -euo pipefail

SRC="canshift-studio/assets/icon.png"
DEST="canshift-studio/assets/icon.png"

# Resolve script directory so this works from any working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SRC="${REPO_ROOT}/${SRC}"
DEST="${REPO_ROOT}/${DEST}"
TMP="${REPO_ROOT}/canshift-studio/assets/.icon_tmp.png"

if [[ ! -f "${SRC}" ]]; then
  echo "Error: source icon not found at ${SRC}" >&2
  exit 1
fi

# Read actual image dimensions
SIZE=$(magick identify -format "%w" "${SRC}")

# Apple rounded-rectangle radius ≈ 22.37% of the icon side
RADIUS=$(echo "${SIZE} * 0.2237" | bc | cut -d. -f1)

echo "Icon: ${SIZE}×${SIZE}px  Radius: ${RADIUS}px"

# 1. Generate a white rounded-rectangle mask at full size
# 2. Composite the original image using the mask as an alpha channel
# 3. The result has the corners trimmed to transparent

magick \
  \( "${SRC}" \) \
  \( -size "${SIZE}x${SIZE}" xc:none \
     -fill white \
     -draw "roundrectangle 0,0,$((SIZE - 1)),$((SIZE - 1)),${RADIUS},${RADIUS}" \
  \) \
  -alpha off \
  -compose CopyOpacity \
  -composite \
  "${TMP}"

mv "${TMP}" "${DEST}"

echo "Done → ${DEST}"
