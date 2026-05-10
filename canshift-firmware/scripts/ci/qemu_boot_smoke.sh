#!/usr/bin/env bash
# qemu_boot_smoke.sh — boot smoke-test gate for canshift-firmware (issue #486).
#
# Boots a merged 4 MB flash image under espressif/qemu and asserts that the
# firmware reaches steady state in under 30 s. Two log markers are required:
#   - "CANShift v* starting" — emitted by main.cpp::setup() (exactly once)
#   - "[BOOT] Ready"         — emitted by page_manager.cpp once the first
#                              widget update tick succeeds (at least once)
#
# Multiple "starting" lines indicate a boot loop (panic + auto-reset).
#
# Usage: qemu_boot_smoke.sh <merged.bin>
set -euo pipefail
IMG="${1:?usage: qemu_boot_smoke.sh <merged.bin>}"
LOG="$(mktemp)"
TIMEOUT=30

timeout --preserve-status "${TIMEOUT}s" \
  docker run --rm -v "$PWD:/work" -w /work espressif/qemu:esp-develop-20240606 \
    qemu-system-xtensa -nographic -no-reboot -machine esp32 \
    -drive file="${IMG}",if=mtd,format=raw -serial mon:stdio \
  | tee "$LOG" || true

START_COUNT=$(grep -cE 'CANShift v.* starting' "$LOG" || true)
READY_COUNT=$(grep -cF '[BOOT] Ready' "$LOG" || true)

echo "starting markers: $START_COUNT, ready markers: $READY_COUNT"
[ "$START_COUNT" -ge 1 ] || { echo "::error::missing 'CANShift v* starting' marker"; exit 1; }
[ "$READY_COUNT" -ge 1 ] || { echo "::error::missing '[BOOT] Ready' marker — boot did not complete"; exit 1; }
[ "$START_COUNT" -eq 1 ] || { echo "::error::boot loop detected ($START_COUNT 'starting' lines)"; exit 1; }
echo "boot smoke OK"
