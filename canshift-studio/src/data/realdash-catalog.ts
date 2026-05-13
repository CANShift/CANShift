// realdash-catalog.ts — Eagerly-loaded index of all bundled RealDash CAN XML descriptors.
//
// Vite resolves import.meta.glob at build time, so all XMLs ship inside the
// renderer bundle as raw strings. No runtime fetch or filesystem access needed.

// import.meta.glob<true, 'default', string> types the result correctly.
const xmlModules = import.meta.glob<true, 'default', string>('../assets/realdash/**/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface RealDashProfile {
  id: string
  manufacturer: string
  name: string
  xml: string
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
  .map(([filePath, xml]) => {
    const parts = filePath.split('/')
    const manufacturer = parts.at(-2) ?? 'Unknown'
    const filename = parts.at(-1) ?? filePath
    return {
      id: filePath,
      manufacturer,
      name: toDisplayName(filename),
      xml,
    }
  })
  .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name))
