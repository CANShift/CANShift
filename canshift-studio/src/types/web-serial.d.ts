// Minimal Web Serial API type declarations for esptool-js usage.
// These augment the global Navigator interface so navigator.serial is typed.
// The full spec is at https://wicg.github.io/serial/

interface SerialPortFilter {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[]
}

interface SerialPortOpenOptions {
  baudRate: number
}

interface SerialPort extends EventTarget {
  open(options: SerialPortOpenOptions): Promise<void>
  close(): Promise<void>
  forget(): Promise<void>
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface Navigator {
  readonly serial: Serial
}
