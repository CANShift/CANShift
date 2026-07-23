export const TRANSPORT_ERROR_MESSAGES: Record<string, string> = {
  no_port_selected: 'No port selected — click Connect device and pick your dash.',
  webserial_unavailable:
    'WebSerial is not available in this browser — use Chrome, Edge, Brave or Opera.',
  streams_unavailable:
    'The port opened but exposes no data streams — unplug/replug the dash and try again.',
  connection_closed: 'The connection to the dash was closed — check the cable and reconnect.',
  auto_reconnect_failed:
    'Automatic reconnect failed — click Connect device to pick the port again.',
  connect_failed: 'Could not connect to the dash — check the cable and try again.',
  open_failed: 'Could not open the port — unplug/replug the dash and try again.',
  ack_timeout: 'The dash did not respond in time — check the cable and retry.',
  not_connected: 'No dash connected — connect the device first.',
  disconnected: 'The dash was disconnected before it could respond.',
  queue_full: 'The dash is busy with other commands — wait a moment and retry.',
  read_error: 'Lost the data stream while reading — check the cable and reconnect.',
  send_failed: 'Sending to the dash failed — check the cable and retry.',
  device_error: 'The dash reported an error — open the Logs page for details.',
  unknown_error: 'Something went wrong on the dash — open the Logs page for details.',
}

export const humanizeTransportError = (code: string): string => {
  const exact = TRANSPORT_ERROR_MESSAGES[code]
  if (exact !== undefined) return exact
  const lower = code.toLowerCase()
  if (lower.includes('failed to open') || lower.includes('already open')) {
    return 'Port busy — close other apps using it (PlatformIO Monitor, Arduino IDE, `screen`, another browser tab) and click Connect device again.'
  }
  if (lower.includes('notfounderror') || lower.includes('not found')) {
    return 'Device not found — check the cable and unplug/replug the dash.'
  }
  if (lower.includes('access denied') || lower.includes('permission')) {
    return 'Permission denied — re-grant access via Connect device.'
  }
  return code
}
