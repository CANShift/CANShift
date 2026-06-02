# canshift-mobile — Security triage

This document tracks the npm audit findings for `canshift-mobile` and their
classification. Re-triage quarterly or after every Expo SDK upgrade.

Last audit: 2026-06-02 (Expo SDK 52, jest-expo 52).
Findings: 16 (3 low, 13 high). All transitive dev-tooling. The previously
moderate `ws` finding from the 2026-05-08 sweep was cleared by a non-breaking
`npm audit fix` that lifted `ws` past the affected window; the table below is
the residual after that pass.

## Classification key

- **runtime** — code path reaches user devices in production builds.
- **build-tooling** — only runs during `expo prebuild` / `expo install` /
  EAS build on developer machines and CI.
- **test-tooling** — only runs in Jest under `npm test`.
- **false-positive** — advisory disputed or doesn't apply to our usage.

## Findings

| # | Source package | Advisory | Severity | Class | Rationale |
|---|----------------|----------|----------|-------|-----------|
| 1 | `tar` (<=7.5.10 — we are on 6.x) | [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v), [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97), [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx), [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96), [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256), [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w) — hardlink/symlink path traversal + APFS Unicode race during archive extraction | high | build-tooling | Pulled in by `@expo/cli` and `cacache` during `expo prebuild` / `npm install`. Never bundled into the iOS/Android app. Trigger requires extracting an attacker-crafted tarball, which only happens against npm registry traffic on a dev machine or CI runner. Fix path is Expo SDK 55+ (semver-major) — deferred to the planned SDK upgrade (#436). The `preinstall` guard in `package.json` already blocks the breaking tar v7 fork. Re-triaged 2026-06-02 against the open `#882` audit. |
| 2 | `@xmldom/xmldom` (<0.8.12) | [GHSA-wh4c-j3r5-mjhp](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp), [GHSA-2v35-w6hq-6mfw](https://github.com/advisories/GHSA-2v35-w6hq-6mfw), and 3 siblings — XML injection / uncontrolled recursion during XML serialization | high | build-tooling | Pulled in by `@expo/plist` to read/write iOS plist files during `expo prebuild`. We control the input plists (our own `app.json` projection). Trigger requires the build to parse attacker-crafted XML. Fix path is Expo SDK 55 (semver-major). The `preinstall` guard blocks the breaking xmldom v0.9 fork. |
| 3 | `cacache` | inherits `tar` | high | build-tooling | Same as #1 — used by `@expo/cli` only at install/build time. |
| 4 | `@expo/cli` | inherits #1 + #2 + #3 | high | build-tooling | Build-time CLI. Not in the app bundle. |
| 5 | `@expo/config` | inherits `@expo/config-plugins` | high | build-tooling | Build-time config resolution. Not in the app bundle. |
| 6 | `@expo/config-plugins` | inherits `@expo/plist` (#2) | high | build-tooling | Build-time config plugin runner. Not in the app bundle. |
| 7 | `@expo/metro-config` | inherits `@expo/config` | high | build-tooling | Metro bundler config. Runs on developer machine / CI; not on user devices. |
| 8 | `@expo/plist` | inherits `@xmldom/xmldom` (#2) | high | build-tooling | iOS plist read/write during prebuild. Not in the app bundle. |
| 9 | `@expo/prebuild-config` | inherits `@expo/config-plugins` | high | build-tooling | Prebuild config resolution. Not in the app bundle. |
| 10 | `expo` | inherits all the above | high | build-tooling | The umbrella SDK package surfaces the transitive vulnerabilities of its CLI/build chain. The runtime portion of `expo` is not affected by these advisories. |
| 11 | `expo-asset` | inherits `expo-constants` | high | build-tooling | Same chain as above (pulls `@expo/config` at build time). |
| 12 | `expo-constants` | inherits `@expo/config` | high | build-tooling | Same chain as above. |
| 13 | `jest-expo` | inherits `@expo/config` + `jest-environment-jsdom` | high | test-tooling | Jest preset; runs only under `npm test`, never on user devices. |
| 14 | `jest-environment-jsdom` | inherits `jsdom` | low | test-tooling | Jest DOM env. Tests only. |
| 15 | `jsdom` | inherits `http-proxy-agent` | low | test-tooling | DOM polyfill for Jest. Tests only. |
| 16 | `http-proxy-agent` | inherits `@tootallnate/once` | low | test-tooling | HTTP agent pulled in by `jsdom`. Tests only. |
| 17 | `@tootallnate/once` (<3.0.1) | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) — incorrect control flow scoping (CVSS 3.3 / local) | low | test-tooling | Pulled in by `http-proxy-agent` -> `jsdom` -> `jest-environment-jsdom`. Tests only. |

## Status summary

- **Runtime impact:** 0 findings.
- **Build-tooling:** 12 findings (all rooted in `tar` and `@xmldom/xmldom`,
  blocked from being upgraded by the Expo SDK 52 internals — see the
  `preinstall` guard in `package.json` and #382).
- **Test-tooling:** 5 findings (all rooted in `jsdom` via `jest-expo`).
- **False-positive:** 0.
- **Fix path:** Expo SDK 55 upgrade closes 16/17. The remaining one is
  `@tootallnate/once` which the SDK 55 upgrade also resolves transitively
  (via `jest-expo@55`). No standalone fix is applied here because every
  finding requires a semver-major bump that we are not ready to take.

## Why no `npm audit fix --force`

`npm audit fix --force` is what introduced the broken overrides removed in #382.
Both `tar@7` and `@xmldom/xmldom@0.9` break Expo SDK 52 prebuild internals
(`tar.extract` undefined, `DOMParser.parseFromString` mimeType undefined). The
`preinstall` script in `package.json` blocks them from being re-introduced.

Manual triage only. Track Expo SDK 55 upgrade as the remediation path for the
build-tooling chain.

## Unmaintained-package decisions

### `clsx` — kept

`expo-doctor` flags `clsx` as unmaintained per the React Native Directory
metadata. False positive: clsx 2.1.1 (latest) was released April 2024, the
API is stable, the package is ~200 LOC, has no native code, and no network
surface. We use it inside `cn()` together with `tailwind-merge` for
class-name composition; replacing it would not eliminate the surface area.

Decision: keep, pinned to `^2.1.1`, excluded from
`expo.doctor.reactNativeDirectoryCheck` in `package.json`.

## Re-triage trigger

Re-run this triage when any of the following happen:

- A new advisory appears that is NOT covered by the table above.
- We bump Expo SDK or jest-expo (expected to clear most of the table).
- A finding's classification changes from build/test-tooling to runtime.
