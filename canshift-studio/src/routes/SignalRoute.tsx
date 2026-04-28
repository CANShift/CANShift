// SignalRoute.tsx — CAN signal mapping editor
// TODO: Implement signal frame and byte position editor

export default function SignalRoute() {
  return (
    <div style={{ flex: 1, padding: 24 }}>
      <h2 style={{ marginBottom: 16, fontSize: 18 }}>Signal Mapping</h2>
      <p style={{ color: '#555555', fontSize: 13 }}>
        CAN signal frame editor — TODO
      </p>
      <p style={{ color: '#444444', fontSize: 12, marginTop: 8 }}>
        Edit CAN frame IDs, byte positions, scaling, and signal names.
        Changes are saved to signals.json and pushed to the device.
      </p>
    </div>
  )
}
