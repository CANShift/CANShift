import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FIRMWARE_CAPS } from '../constants/firmware-caps.js'
import { SIGNAL_BYTE_LENGTHS } from '../schemas/signal.js'

const here = dirname(fileURLToPath(import.meta.url))
const APP_CONFIG = resolve(here, '../../../canshift-firmware/include/app_config.h')
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
