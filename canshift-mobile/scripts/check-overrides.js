// canshift-mobile/scripts/check-overrides.js
// Blocks npm overrides known to break Expo SDK 52 internals.
// See issue #588 for context.
//
// NOTE: tar v7 cannot be overridden — neither globally nor scoped under
// @expo/cli or cacache — because @expo/cli uses the tar v6 extract() API
// internally and upgrading to v7 breaks `expo prebuild`. Track
// https://github.com/expo/expo/issues/XXXXX for when @expo/cli drops tar@6.

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
