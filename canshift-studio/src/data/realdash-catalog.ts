// realdash-catalog.ts — Lazy-loaded index of all bundled RealDash CAN XML descriptors.
//
// Only the metadata (id, manufacturer, name) is in the main chunk. Each XML
// string is a separate Vite code-split chunk loaded on demand — keeping ~354 KB
// of XML out of the renderer main bundle.

// Without `eager`, each module is a () => Promise<string> loader function.
const xmlModules = import.meta.glob<string>('../assets/realdash/**/*.xml', {
  query: '?raw',
  import: 'default',
})

export interface RealDashProfile {
  id: string
  manufacturer: string
  name: string
  /** Load the raw XML string on demand. */
  load: () => Promise<string>
}

function toDisplayName(filename: string): string {
  return filename
    .replace(/\.xml$/, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
}

export const REALDASH_CATALOG: RealDashProfile[] = Object.entries(xmlModules)
  .map(([filePath, load]) => {
    const parts = filePath.split('/')
    const manufacturer = parts.at(-2) ?? 'Unknown'
    const filename = parts.at(-1) ?? filePath
    return {
      id: filePath,
      manufacturer,
      name: toDisplayName(filename),
      load,
    }
  })
  .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name))
