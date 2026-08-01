import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FIRMWARE_CAPS, STRING_CAPS } from '../constants/firmware-caps.js'
import { LAYOUT_GRID } from '../layout-grid.js'
import { SIGNAL_BYTE_LENGTHS } from '../schemas/signal.js'

const here = dirname(fileURLToPath(import.meta.url))
const APP_CONFIG = resolve(here, '../../../canshift-firmware/include/app_config.h')
const CONFIG_TYPES = resolve(here, '../../../canshift-firmware/src/config/config_types.h')
const CONFIG_FILE_LOADERS = resolve(
  here,
  '../../../canshift-firmware/src/config/config_file_loaders.inc'
)

const extractDefine = (source: string, name: string): number | null => {
  const pattern = new RegExp(`#define\\s+${name}\\s+(\\d+)`)
  const match = pattern.exec(source)
  return match ? Number.parseInt(match[1] ?? '', 10) : null
}

const describeIfFirmware = existsSync(APP_CONFIG) ? describe : describe.skip

describeIfFirmware('firmware-caps parity', () => {
  const source = readFileSync(APP_CONFIG, 'utf8')

  it('MAX_PAGES matches firmware CONFIG_MAX_PAGES', () => {
    const firmware = extractDefine(source, 'CONFIG_MAX_PAGES')
    expect(firmware).not.toBeNull()
    expect(FIRMWARE_CAPS.MAX_PAGES).toBe(firmware)
  })
})

const describeIfTypes = existsSync(CONFIG_TYPES) ? describe : describe.skip

describeIfTypes('string caps firmware parity (config_types.h buffers minus NUL)', () => {
  const source = readFileSync(CONFIG_TYPES, 'utf8')

  const extractStructArrayLen = (structName: string, fieldName: string): number | null => {
    const structMatch = new RegExp(`struct\\s+${structName}\\s*\\{([\\s\\S]*?)\\n\\};`).exec(source)
    if (!structMatch) return null
    const fieldPattern = new RegExp(`char\\s+${fieldName}\\[(\\w+)\\]`)
    const fieldMatch = fieldPattern.exec(structMatch[1] ?? '')
    if (!fieldMatch) return null
    const size = fieldMatch[1] ?? ''
    if (/^\d+$/.test(size)) return Number.parseInt(size, 10)
    return extractDefine(source, size)
  }

  const cases: [keyof typeof STRING_CAPS, string, string][] = [
    ['SIGNAL_NAME', 'CfgSignalDef', 'name'],
    ['SIGNAL_UNIT', 'CfgSignalDef', 'unit'],
    ['WIDGET_LABEL', 'CfgButtonParams', 'label'],
    ['WIDGET_LABEL', 'CfgButtonState', 'label'],
    ['GAUGE_PREFIX', 'CfgGaugeParams', 'prefix'],
    ['WIDGET_PREFIX_SUFFIX', 'CfgGaugeParams', 'suffix'],
    ['WIDGET_PREFIX_SUFFIX', 'CfgLabelParams', 'prefix'],
    ['WIDGET_PREFIX_SUFFIX', 'CfgLabelParams', 'suffix'],
    ['ICON_PATH', 'CfgButtonParams', 'iconPath'],
    ['IMAGE_PATH', 'CfgImageParams', 'imagePath'],
    ['PROTOCOL', 'CfgSignalConfig', 'protocol'],
    ['BINDING_SIGNAL', 'CfgInputBinding', 'signal'],
  ]

  it.each(cases)('%s fits firmware %s.%s', (cap, structName, fieldName) => {
    const bufferSize = extractStructArrayLen(structName, fieldName)
    expect(bufferSize).not.toBeNull()
    expect(STRING_CAPS[cap]).toBe((bufferSize ?? 0) - 1)
  })
})

const describeIfLoaders = existsSync(CONFIG_FILE_LOADERS) ? describe : describe.skip

describeIfLoaders('signal byteLength firmware parity', () => {
  it('SIGNAL_BYTE_LENGTHS matches the firmware byteLenValid check', () => {
    const source = readFileSync(CONFIG_FILE_LOADERS, 'utf8')
    const match = /byteLenValid\s*=([^;]+);/.exec(source)
    expect(match).not.toBeNull()
    const firmwareLengths = [...(match?.[1] ?? '').matchAll(/byteLength\s*==\s*(\d+)/g)]
      .map((m) => Number.parseInt(m[1] ?? '', 10))
      .sort((a, b) => a - b)
    expect(firmwareLengths).toEqual([...SIGNAL_BYTE_LENGTHS])
  })
})

const LAYOUT_GRID_RS = resolve(here, '../../../canshift-firmware/rust/layout-grid/src/lib.rs')

const describeIfLayoutGrid = existsSync(LAYOUT_GRID_RS) ? describe : describe.skip

describeIfLayoutGrid('layout grid firmware parity (rust/layout-grid)', () => {
  const source = readFileSync(LAYOUT_GRID_RS, 'utf8')

  const extractRustConst = (name: string): number | null => {
    const pattern = new RegExp(`pub const ${name}: u(?:8|16|32) = (\\d+);`)
    const match = pattern.exec(source)
    return match ? Number.parseInt(match[1] ?? '', 10) : null
  }

  const cases: [keyof typeof LAYOUT_GRID, string][] = [
    ['COLUMNS', 'COLUMNS'],
    ['ROWS', 'ROWS'],
    ['GUTTER', 'GUTTER'],
    ['FRAME_PADDING', 'FRAME_PADDING'],
  ]

  it.each(cases)('LAYOUT_GRID.%s matches the rust crate %s', (tsName, rustName) => {
    const firmware = extractRustConst(rustName)
    expect(firmware).not.toBeNull()
    expect(LAYOUT_GRID[tsName]).toBe(firmware)
  })
})
