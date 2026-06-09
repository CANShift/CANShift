# Release Process — CANShift

> 🚨 **Pre-#1351.** Steps referencing `canshift-studio-web` builds, SPIFFS-SPA gates, `canshift-spiffs-*.bin`, and `0x370000` SPIFFS offset are stale. Post-#1351 the SPA pipeline is gone and SPIFFS lives at `0x310000`. The actual release pipeline (`.github/workflows/release.yml`) has been simplified accordingly — read the workflow file as ground truth. See [`#1351`](https://github.com/tburkhalterr/CANShift/issues/1351).

How a version bump in `canshift-firmware/package.json` becomes a published
GitHub Release with firmware artifacts attached to it. Concrete steps,
what ships, what doesn't, how to validate before promoting, and how to
roll back.

> Source of truth for the workflow:
> [`.github/workflows/release.yml`](../.github/workflows/release.yml).
> If this document and that file disagree, the workflow wins — please open
> a PR to sync the doc.

---

## Cadence

CANShift releases on **every version bump merged to `main`**. There is no
fixed schedule. The pipeline keys off the `version` field in
[`canshift-firmware/package.json`](../canshift-firmware/package.json):

- Version unchanged → workflow exits idempotently. No release created.
- Version new → workflow builds firmware, creates a **draft** GitHub
  Release, and uploads artifacts.

This means a contributor can land any number of non-release PRs back to
back; only the PR that bumps the version triggers a publish.

---

## What Ships

Since the firmware-only pipeline landed in #1077 (and the studio
artifacts were dropped in #1106), every release attaches exactly three
firmware artifacts:

| Artifact                                                | Size (approx) | Audience |
|---------------------------------------------------------|---------------|----------|
| `canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin`      | ~1.2 MB       | First-flash via [canshift.tmbk.ch](https://canshift.tmbk.ch). Contains bootloader + partition table + firmware in one image. |
| `canshift-firmware-vX.Y.Z-crowpanel_28-firmware.bin`    | ~1.1 MB       | Mobile OTA payload — what `canshift-mobile` POSTs to `/ota` over the dash's softAP. Firmware partition only; HMAC trailer verified by the dash. |
| `canshift-spiffs-vX.Y.Z-crowpanel_28.bin`               | ~640 KB       | SPIFFS data partition image. Carries default config JSON, embedded fonts, and the gzipped `canshift-studio-web` SPA. Written by canshift.tmbk.ch on first-flash. |

All three are produced by the `firmware-release` job in
[`release.yml`](../.github/workflows/release.yml) and uploaded to the
draft Release. The release is created in **draft** state — a maintainer
must promote it to published after manual validation (see below).

---

## What Does NOT Ship

The following are intentionally absent from GitHub Releases. Each has its
own distribution path:

- **Electron Studio installer** (`canshift-studio.dmg`, `.exe`,
  `.AppImage`). The Electron `canshift-studio/` package was decommissioned
  post-cutover; the canonical Studio is now
  [`canshift-studio-web`](../canshift-studio-web/), and that ships in the
  firmware SPIFFS image above. Users get the matching Studio version
  automatically because it rides on the firmware they flashed.
- **Mobile app artifacts** (`.ipa`, `.apk`, `.aab`). `canshift-mobile` is
  distributed through TestFlight (iOS) and the Google Play Store
  (Android) on its own cadence, decoupled from firmware versioning.
- **`canshift-flasher` web bundle.** The flasher lives in a separate
  repo, [`tburkhalterr/canshift-flasher`](https://github.com/tburkhalterr/canshift-flasher),
  and is auto-deployed to [canshift.tmbk.ch](https://canshift.tmbk.ch)
  by Vercel on every push to that repo's `main`. It reads the same
  GitHub Releases feed at runtime — no rebuild needed when a new
  firmware version drops.
- **Source archives** — GitHub auto-generates `Source code (zip)` /
  `(tar.gz)` for every release. We don't add anything to them.

---

## Bumping the Version

The release pipeline reads exactly one file. Bumping it is the entire
contract.

1. Branch from `main` (or roll the bump into an existing feature PR):
   ```
   type/<package>/short-description   ← e.g. chore/release/v0.12.0
   ```
2. Edit [`canshift-firmware/package.json`](../canshift-firmware/package.json),
   bump the `version` field:
   ```jsonc
   {
     "name": "canshift-firmware",
     "version": "0.12.0"  // ← bump this
   }
   ```
3. (Optional) Update `README.md` / `CHANGELOG.md` if your bump warrants
   it. Most do.
4. Commit (Conventional Commits — subject only, no body):
   ```
   chore(release): bump v0.12.0
   ```
5. Open a PR with `gh pr create`. Wait for CI green.
6. Merge. The `Release` workflow fires on the merge commit.

**The same value flows to the firmware automatically.**
[`canshift-firmware/scripts/extra_targets.py`](../canshift-firmware/scripts/extra_targets.py)
reads `canshift-firmware/package.json` and injects the version as the
`APP_VERSION_STR` macro into the firmware build. The splash screen, BLE
STATUS characteristic, and `/status` HTTP endpoint all surface this
value. Release tag and firmware splash therefore cannot disagree.

---

## What the Pipeline Does

[`.github/workflows/release.yml`](../.github/workflows/release.yml) runs
on every push to `main`. Two jobs in series:

### Job 1 — `check-version`

1. Checks out the repo.
2. Reads `canshift-firmware/package.json` `version` → exposes
   `tag=vX.Y.Z`.
3. Queries `gh release view vX.Y.Z`. If a Release with that tag already
   exists, sets `should_release=false`. The next job is gated on this
   flag — the workflow exits idempotently for non-bump pushes.

### Job 2 — `firmware-release` (gated on `should_release=true`)

1. Checks out the repo, sets up Python 3.12, restores the PlatformIO
   cache.
2. Installs PlatformIO CLI (`pip install platformio`).
3. **Writes `canshift-firmware/secrets.ini`** with `OTA_HMAC_SECRET` from
   the repo secret of the same name. The build hard-fails on a missing
   secret — see [Common Issues](#common-issues) below.
4. **Builds production firmware** — `pio run -e crowpanel_28`.
5. **Asserts `APP_VERSION_STR` was injected** into the linked ELF:
   - Positive: `strings firmware.elf | grep "v${VERSION}"` must hit
     (matches the splash label literal `"v" APP_VERSION_STR`, which
     survives even with `APP_LOG_LEVEL=1` because it's a plain string
     passed to `lv_label_set_text`).
   - Negative: `strings firmware.elf | grep "0.0.0-unset"` must NOT hit
     (that's the fallback the extra-script macro defaults to if injection
     failed).
   - Either assertion failing aborts the workflow before any artifact is
     uploaded — preventing a release with mismatched / missing version.
6. **Builds SPIFFS image** — `pio run --target buildfs -e crowpanel_28`.
   Pulls in the freshly-built `canshift-studio-web` SPA via
   [`sync_studio_web.py`](../canshift-firmware/scripts/sync_studio_web.py).
7. **Stages release assets** using `esptool merge_bin`:
   - `merged.bin` = bootloader@0x1000 + partitions@0x8000 +
     firmware@0x10000, in one image (canshift.tmbk.ch flashes this).
   - `firmware.bin` = the bare firmware partition (mobile OTA payload).
   - `spiffs.bin` = the SPIFFS image.
8. **Creates GitHub Release in draft state** if it doesn't already exist
   (`gh release create vX.Y.Z --draft`).
9. **Uploads artifacts** with up to 5 retries (`gh release upload
   --clobber`). The retry loop tolerates the brief delay between the
   release being created and the asset endpoint becoming ready.
10. **Flags 0.x as prerelease** — any tag matching `v0.*` is marked as a
    prerelease via `gh release edit --prerelease`. Drop this step (or
    tighten the regex) once we cut v1.0.0.

A passing run produces a draft Release at
`https://github.com/tburkhalterr/CANShift/releases/tag/vX.Y.Z` with all
three artifacts attached.

---

## Manual Hardware Validation

**Required before promoting a draft to published.** A green CI run only
proves the binary compiles, links, signs, and contains the right version
literal — it cannot prove the dash boots or that the SPA loads. Run all
five steps on at least one fielded dash before flipping the prerelease /
draft flags.

1. **USB-flash a dev dash with the merged image.** Open
   [canshift.tmbk.ch](https://canshift.tmbk.ch) in a Chromium-based
   browser, plug in the dash, pick the draft release from the version
   dropdown, flash. Watch the splash for `vX.Y.Z` — wrong version here
   means the ELF assertion was bypassed somehow; abort the release.
2. **Verify AP + dash-hosted Studio loop.** Join the
   `CANShift-XXXX` Wi-Fi network, browse to `http://canshift.local` (or
   the AP IP). The Studio SPA must load, the WS indicator must turn
   green, and pushing a trivial config change (e.g. rename a widget)
   must persist across a reboot.
3. **Verify CAN ingest.** Wire the dash to a known-good ECU bench setup
   (or a CAN simulator). Confirm at least one live signal — typically
   RPM — moves on the dash and in the Studio Diagnostics panel.
4. **Verify mobile OTA from the previous published version.** Flash a
   second dash with the **previous** published version's merged image.
   Pair the mobile app, trigger an OTA to the new firmware payload. The
   dash must reboot into the new slot, the splash must read the new
   `vX.Y.Z`, and the boot must complete without the OTA bootloader
   rolling back to the previous slot (rollback fires if the dash
   crashes before `esp_ota_mark_app_valid_cancel_rollback()` lands — see
   [`boot_sequence.cpp`](../canshift-firmware/src/boot/boot_sequence.cpp)).
5. **Verify CAN error visibility in Studio.** Trigger at least one
   recoverable CAN error (disconnect / reconnect the transceiver). The
   error must appear in the Studio Diagnostics panel sourced from the
   firmware's `ErrorStore`. This catches regressions in the WS
   `/diag` path.

If any step fails, leave the release as a draft and open a `bug:`
issue describing what regressed. Do NOT publish a partially-validated
release — users following the install link will pick it up.

---

## Promoting a Draft to Published

After all five validation steps pass, flip the flags. Either:

**CLI (preferred for traceability):**
```sh
gh release edit vX.Y.Z --draft=false
# For non-0.x releases that are NOT prereleases, also:
gh release edit vX.Y.Z --prerelease=false
```

**Web UI:**
1. Navigate to
   `https://github.com/tburkhalterr/CANShift/releases/tag/vX.Y.Z`.
2. Click "Edit release" → uncheck "Set as a pre-release" (if applicable)
   and "Set as a draft" → "Update release".

canshift.tmbk.ch picks up the published Release on its next refresh
(client-side query against the GitHub API — no Vercel rebuild needed).
Mobile OTA users see the new payload the next time the app polls.

---

## Rolling Back

The release pipeline does not auto-rollback. If a published release
turns out to be broken in the field, recovery options in increasing
order of effort:

1. **Re-flash via canshift.tmbk.ch.** The previous version's merged
   image is still attached to its own Release. Users follow the same
   USB-flash flow with the older version selected from the dropdown.
   This is the canonical recovery path for fielded dashes.
2. **Mobile users with the older OTA payload cached.** The mobile app
   keeps the last downloaded `firmware.bin` in its private build folder
   until it's garbage-collected. If a user noticed the regression
   immediately and hasn't restarted the app, the previous payload may
   still be on disk and triggerable from the "Reinstall previous" path
   (where the mobile UI exposes it).
3. **Yank the bad release.** Mark the broken Release as a draft
   (`gh release edit vX.Y.Z --draft=true`). canshift.tmbk.ch and mobile
   will stop offering it for new installs. Existing field devices keep
   running whatever they have until step 1 or 2 is taken.
4. **Hotfix release.** Cut `vX.Y.(Z+1)` with the fix. Same pipeline,
   same validation. Drafts of intermediate broken versions stay drafts
   forever as a paper trail.

**Do not delete a published release.** Deleting breaks the changelog
trail and orphans any cached URLs in mobile / canshift.tmbk.ch. Drafting
or yanking is always preferred over deletion.

---

## Common Issues

Issues seen in real release runs, with the root cause and fix.

### `OTA_HMAC_SECRET` repo secret missing

```
::error::OTA_HMAC_SECRET repo secret is not set — see #978 for setup.
```

The "Write secrets.ini for production firmware" step explicitly fails
fast if the env var is empty. Fix: set `OTA_HMAC_SECRET` under **Settings
→ Secrets and variables → Actions → New repository secret**. Generate
the value with `openssl rand -hex 32`. The same value must be configured
on whatever OTA backend signs the binaries the workflow consumes —
rotating it is a release-line break (pre-rotation devices reject the
new binaries until USB-reflashed).

### SPIFFS too small (`buildfs` fails)

```
*** [.pio/build/crowpanel_28/spiffs.bin] Error 1
Error: The script ... attempted to access ... beyond the filesystem image size
```

The SPIFFS partition is sized in [`ota_4mb_wifi.csv`](../canshift-firmware/ota_4mb_wifi.csv);
data exceeding it causes `mkspiffs` to abort. Fix path:
- Check what grew — usually new SPA chunks landed in
  `canshift-firmware/data/web/` and pushed the total past budget.
- Either trim the SPA build (Vite chunk-size warnings in the
  `canshift-studio-web` build log point at the culprit) or, if the data
  genuinely needs more room, expand the SPIFFS partition. Expanding
  shrinks the app slots and constrains future firmware growth — discuss
  in an issue before doing it.
- Fix landed in #1135 expanded the SPIFFS slot once already; see that
  PR for the partition-table edit pattern.

### `APP_VERSION_STR` assertion fails

```
::error::APP_VERSION_STR mismatch — no 'v0.12.0' literal in firmware.elf
```

Two root causes:
- **Macro injection broken.** `extra_targets.py` failed to read
  `canshift-firmware/package.json` (permissions, malformed JSON, missing
  `version` field). Run `python canshift-firmware/scripts/extra_targets.py`
  locally inside a `pio run -v` to see the trace.
- **The splash label literal was changed.** The CI assertion relies on
  `"v" APP_VERSION_STR` appearing verbatim in
  [`boot_sequence.cpp`](../canshift-firmware/src/boot/boot_sequence.cpp)
  and surviving the linker as a string. If the splash code was refactored
  to format the version differently (e.g. `snprintf("Version %s", …)`)
  the literal won't be in the ELF anymore. Either restore the literal or
  update the workflow assertion to match the new one.

### `0.0.0-unset` appears in the ELF

```
::error::APP_VERSION_STR fell back to 0.0.0-unset in firmware.elf
```

Same root cause as macro-injection-broken above, but caught by the
negative-signal assertion. The fallback macro lives in
[`include/app_config.h`](../canshift-firmware/include/app_config.h) and
fires when `extra_targets.py` doesn't replace it. Always investigate —
the dash would silently ship with no usable version string otherwise.

### `gh release upload` 404 / retry exhaustion

Briefly observed when the release is created and the asset endpoint
isn't ready yet. The workflow already retries up to 5 times with 30 s
backoff between attempts. If all 5 fail, the underlying issue is
probably a GitHub API outage — check
[githubstatus.com](https://www.githubstatus.com) and re-run the failed
job once it's green.

---

## Decommissioning History

- **Before #1077.** Releases attached both an Electron Studio installer
  (DMG / NSIS / AppImage built by `electron-builder`) and the firmware
  binaries. Users installed Studio locally, plugged the dash via USB,
  and pushed configs over serial. Mobile artifacts were also published
  in the early monorepo period before TestFlight / Play Store became
  the canonical mobile distribution.
- **#1077 — dash-hosted Studio.** The Studio SPA
  (`canshift-studio-web`) was built and embedded inside the firmware
  image via `board_build.embed_files`. Atomic version pairing: a user
  joining the dash AP gets exactly the Studio that was built against
  the firmware they're running.
- **#1106 — pipeline trimmed to firmware-only.** Electron installer
  builds + mobile artifact uploads removed from the workflow. The
  Electron Studio was kept compilable for the cutover window but no
  longer published.
- **#1117 — partition-table shift.** SPIFFS moved from `0x310000` to
  `0x370000` to enlarge the app slots. Pre-#1117 dashes must be
  USB-reflashed once to migrate — OTA from old to new layout is
  unsafe.
- **#1123 — SPA moved from firmware image to SPIFFS.** Embedding the
  SPA in the firmware blew the `_wifi` env past its 1728 KB slot.
  Moving the gzipped SPA into `data/web/` (SPIFFS) recovered ~185 KB
  of flash. The pipeline now produces and publishes a separate
  `spiffs.bin` artifact for first-flash.
- **`canshift-studio/` decommission (this PR).** With the dash-hosted
  Studio validated end-to-end on fielded devices and the standalone
  flasher (`canshift.tmbk.ch`) covering first-flash + recovery, the
  Electron package was dropped from the monorepo. The version
  source-of-truth moved from `canshift-studio/package.json` to
  `canshift-firmware/package.json` — firmware is the only artifact in
  releases now, so the version naturally tracks the firmware.
  [`release.yml`](../.github/workflows/release.yml) and
  [`extra_targets.py`](../canshift-firmware/scripts/extra_targets.py)
  are the only two readers; both were updated in the same PR.

---

## Where to read next

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — C4-style architecture; the
  build & flash section there overlaps with this doc.
- [`FIRST_FLASH.md`](FIRST_FLASH.md) — pre-flight checklist for the
  first time a freshly-flashed dash gets plugged into a vehicle.
- [`canshift-firmware/README.md`](../canshift-firmware/README.md) —
  on-device perspective: partition layout, OTA framing, secure-boot
  state.
- [`.github/workflows/release.yml`](../.github/workflows/release.yml) —
  the workflow itself. Keep this doc and that file in sync.
