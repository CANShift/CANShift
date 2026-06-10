export interface ChipInfo {
  chipName: string
  description: string
  mac: string
}

const PROBE_BAUD_RATE = 115_200

let esptoolModulePromise: Promise<typeof import('esptool-js')> | null = null

const loadEsptool = (): Promise<typeof import('esptool-js')> => {
  esptoolModulePromise ??= import('esptool-js')
  return esptoolModulePromise
}

const SILENT_TERMINAL = {
  clean: () => undefined,
  writeLine: (_data: string) => undefined,
  write: (_data: string) => undefined,
}

export const probeChip = async (port: SerialPort): Promise<ChipInfo> => {
  const { ESPLoader, Transport } = await loadEsptool()
  const transport = new Transport(port, false)
  try {
    const loader = new ESPLoader({
      transport,
      baudrate: PROBE_BAUD_RATE,
      terminal: SILENT_TERMINAL,
      debugLogging: false,
    })
    const chipName = await loader.main()
    const description = await loader.chip.getChipDescription(loader)
    const mac = await loader.chip.readMac(loader)
    return { chipName, description, mac }
  } finally {
    try {
      await transport.disconnect()
    } catch {
      void 0
    }
  }
}
