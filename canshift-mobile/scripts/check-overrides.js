// canshift-mobile/scripts/check-overrides.js
// Blocks npm overrides known to break Expo SDK 52 internals.
// See issue #588 for context.

const pkg = require('../package.json');
const overrides = pkg.overrides || {};

const BLOCKED = [
  {
    name: 'tar',
    matches: (spec) => /(^|[^\d])7\./.test(spec) || /^[~^]?7/.test(spec),
    reason:
      "tar v7 breaks Expo prebuild (Cannot read properties of undefined reading 'extract').",
  },
  {
    name: '@xmldom/xmldom',
    matches: (spec) => /(^|[^\d])0\.9\./.test(spec) || /^[~^]?0\.9/.test(spec),
    reason:
      'xmldom v0.9 breaks @expo/plist parseFromString (mimeType undefined).',
  },
];

const failures = [];
for (const { name, matches, reason } of BLOCKED) {
  const spec = overrides[name];
  if (typeof spec === 'string' && matches(spec)) {
    failures.push(`${name}@${spec} — ${reason}`);
  }
}

if (failures.length > 0) {
  const list = failures.map((line) => `  - ${line}`).join('\n');
  console.error(
    `\n[canshift-mobile] ERROR: incompatible override(s) detected:\n${list}\n\nRemove or downgrade the override(s) before reinstalling.\n`,
  );
  process.exit(1);
}
