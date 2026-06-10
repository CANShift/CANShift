---
title: "Release process"
description: "Tagging a release, writing the changelog, publishing to GitHub."
sidebar:
  order: 3
---

import { Aside, Steps } from "@astrojs/starlight/components";

CANShift releases are driven by `tburkhalterr/CANShift` GitHub Releases. The
docs site pulls them at build time and renders the public changelog, so
release descriptions need to be substantive.

## Versioning

- **Firmware**: `canshift-firmware/package.json::version` — the build script
  bakes it into `APP_VERSION_STR`. Semver.
- **Core schema**: `canshift-core/src/index.ts::CURRENT_SCHEMA_VERSION` —
  bumped only when `dashboard.json` / `signals.json` shape changes in a way
  the firmware needs to reject old configs for. Independent of firmware
  semver.
- **Tuner / docs / mobile**: each ships its own `package.json::version`.
  No global lockstep.

The firmware semver bumps the most often. Schema version is the gate that
forces a re-burn from the tuner.

## Release-notes structure

Every release description follows this template (also documented in
[Changelog](/changelog/)):

```markdown
## [Version] — YYYY-MM-DD

### 🚗 For the driver
- (UX, new widgets, hardware support, etc.)

### 🔧 For the tuner / installer
- (config, calibration, ECU parameters)

### 🔬 Firmware / dev
- (build flags, schema, Rust ports, refactors)

### ⚠️ Breaking
- (concrete impact + required action — re-flash, re-burn config, etc.)

### PRs
- #XXXX — ...
```

<Aside type="caution" title="Don't ship empty">
A release reduced to "see commit log" or a bare list of PR titles renders as
a useless changelog entry. Group by audience; lead with what the driver
notices.
</Aside>

## Steps

<Steps>

1. **Bump firmware version** in `canshift-firmware/package.json`. Commit on
   `main` via PR with title `chore(firmware): bump to <version>`.

2. **Bump schema version** if any breaking change to `dashboard.json` /
   `signals.json` landed since the last release. Otherwise leave alone.

3. **Cut the tag** locally:

   ```bash
   git tag firmware/v1.2.3
   git push origin firmware/v1.2.3
   ```

4. **Build the artefacts** — the release workflow runs on the tag push and
   produces signed firmware binaries.

5. **Open the GitHub Release** for the tag, paste the structured template
   above, fill in real content from the PR stream since the previous tag.
   Use `gh release create` or the web UI.

6. **Attach the firmware binaries** to the release. The flasher (hosted at
   `canshift-tuner.vercel.app/firmware`) reads the GitHub Releases API to
   list available firmware versions — your release will show up there
   within ~1 minute.

7. **Smoke-test** by re-flashing a dash from the tuner using the new release.

</Steps>

## Patch vs minor vs major

- **Patch** (1.2.3 → 1.2.4): bug fix, no UX change, no schema change.
  Re-flash is optional unless the user hit the bug.
- **Minor** (1.2.x → 1.3.0): new feature, no breaking change. Re-flash
  recommended.
- **Major** (1.x → 2.0): breaking change. Driver MUST re-flash AND re-burn
  config. Spell out the migration in the `⚠️ Breaking` section.

## Pre-releases

Tag with a suffix to mark a pre-release (e.g. `firmware/v1.3.0-rc.1`).
GitHub Releases recognises the suffix and badges it as "pre-release". The
flasher lists pre-releases behind a toggle.
