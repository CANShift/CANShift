// canshift-mobile/scripts/check-overrides.js
// Blocks npm overrides historically known to break Expo internals.
// See issue #588 for context.
//
// History:
//   - SDK 52 actively crashed with `tar@>=7` (extract() undefined) and
//     `@xmldom/xmldom@>=0.9` (parseFromString mimeType undefined). The
//     mobile package pinned `@xmldom/xmldom@0.8.13` to keep installs
//     reproducible.
//   - SDK 55 (PR #1149) no longer pulls `tar` as a direct dep and accepts
//     the 0.8 line of `@xmldom/xmldom` internally (via @expo/plist). The
//     mobile package now relaxes those pins.
//
// This guard stays in place as a paper trail: if a contributor adds an
// override that reintroduces either incompatible major, preinstall fails
// loud rather than producing a silently broken install.

const pkg = require('../package.json');
const overrides = pkg.overrides || {};

const BLOCKED = [
  {
    name: 'tar',
    matches: (spec) => /(^|[^\d])7\./.test(spec) || /^[~^]?7/.test(spec),
    reason:
      "tar v7 breaks Expo prebuild (Cannot read properties of undefined reading 'extract'). Scoped overrides under @expo/cli or cacache have the same effect.",
  },
  {
    name: '@xmldom/xmldom',
    matches: (spec) => /(^|[^\d])0\.9\./.test(spec) || /^[~^]?0\.9/.test(spec),
    reason:
      'xmldom v0.9 breaks @expo/plist parseFromString (mimeType undefined).',
  },
];

const failures = [];

// Check top-level overrides
for (const { name, matches, reason } of BLOCKED) {
  const spec = overrides[name];
  if (typeof spec === 'string' && matches(spec)) {
    failures.push(`${name}@${spec} — ${reason}`);
  }
}

// Check scoped overrides (e.g. overrides["@expo/cli"]["tar"])
for (const [scopeKey, scopeVal] of Object.entries(overrides)) {
  if (typeof scopeVal !== 'object' || scopeVal === null) continue;
  for (const { name, matches, reason } of BLOCKED) {
    const spec = scopeVal[name];
    if (typeof spec === 'string' && matches(spec)) {
      failures.push(`${scopeKey} > ${name}@${spec} — ${reason}`);
    }
  }
}

if (failures.length > 0) {
  const list = failures.map((line) => `  - ${line}`).join('\n');
  console.error(
    `\n[canshift-mobile] ERROR: incompatible override(s) detected:\n${list}\n\nRemove or downgrade the override(s) before reinstalling.\n`,
  );
  process.exit(1);
}
