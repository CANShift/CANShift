![CANShift](../logo/logo_1.png)

# CANShift Mobile

iPhone companion app for the automotive dashboard system.

---

## IMPORTANT: Current Phase — USB First

> **This app is NOT being built now.**
>
> **Current phase: USB first.**
> **iPhone app: planned for a later phase.**
> **The desktop app (`canshift-studio`) is the primary configuration tool at the beginning.**

This folder is documentation and planning only.
No significant implementation work is being done here until Phase 1 (USB + desktop) is complete and stable.

---

## Why Not Now?

Phase 1 establishes the core system:
- Firmware is validated on real hardware
- Desktop app provides full configuration capability
- JSON config schema is stable
- USB communication protocol is proven
- Signal mapping is complete and tested with the MaxxECU

Building the mobile app before the core is stable would create rework.
The iPhone app is intentionally deferred to Phase 2+.

---

## Future Purpose

The iPhone app will be a **companion and configuration tool** for the dashboard.
It is not a replacement for the desktop app — it is a faster field tool.

**What it will do:**
- Connect to the ESP32 dashboard over Wi-Fi or Bluetooth
- View live dashboard data on the phone (mirror or companion view)
- Select a saved configuration profile on the device
- Apply quick settings (brightness, theme day/night, active page)
- Load/save config JSON from/to the phone
- Push a new config file to the dashboard
- View basic diagnostics (CAN signal status, error flags)
- Trigger simple actions (reset, page jump)

**What it will NOT do (desktop remains authoritative):**
- Full visual drag-drop layout editing (desktop only)
- Asset management and image upload (desktop only)
- Complex signal mapping editor (desktop only)
- Firmware update / flash (desktop only)

---

## Future Connectivity Options

### Wi-Fi
- ESP32 runs as a Wi-Fi access point (AP mode) or connects to an existing network (STA mode)
- Recommended: AP mode in the car (no router needed)
- REST or WebSocket API on the ESP32 for config exchange
- iPhone connects to the ESP32 AP network

### Bluetooth Low Energy (BLE)
- ESP32 exposes a GATT service for config exchange
- Suitable for small config packets and status reads
- Lower bandwidth than Wi-Fi — better for simple commands

**Recommendation:** Wi-Fi first for Phase 2 (higher bandwidth, easier JSON transfer).
BLE as a complementary channel for quick commands.

---

## Technology Plan

**Framework:** React Native (bare workflow, not Expo Go)

Reasons:
- Reuses TypeScript code from `canshift-core`
- Shared config domain types between desktop and mobile
- Single codebase for future Android support if needed

**State:** Zustand (same as desktop app — minimal learning overhead)

**Networking:**
- Wi-Fi: `axios` or `fetch` for REST, `socket.io-client` or native WebSocket for live data
- BLE: `react-native-ble-plx`

**Navigation:** React Navigation 6

---

## Reuse from canshift-core

The `canshift-core` package will be consumed directly:

```json
// package.json
"dependencies": {
  "@tmbk/canshift-core": "^1.0.0"  // or file:../canshift-core during dev
}
```

The following from `canshift-core` are directly reusable:
- `DashboardConfig`, `PageConfig`, `WidgetConfig` TypeScript types
- `SignalMapping` types
- `ThemeConfig` types
- JSON schema validators (`validateDashboardConfig`, etc.)
- Config versioning utilities (`migrateConfig`)

This is a primary reason `canshift-core` is designed as a portable, framework-agnostic TypeScript package with no Node.js or Electron-specific code.

---

## Prerequisites (for when implementation starts)

- Xcode 15+ with iOS SDK
- Node.js 20+
- React Native CLI: `npm install -g react-native`
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer account (for device deployment)
- iOS 16+ target deployment (covers the vast majority of devices)

---

## Phased Roadmap for the iPhone App

### Pre-requisites (must complete first)
- [ ] Phase 1 firmware stable and running on real hardware
- [ ] USB config sync working between firmware and desktop app
- [ ] JSON config schema finalized in `canshift-core`
- [ ] Wi-Fi or BLE transport layer implemented in firmware (`src/hal/wifi/` or `src/hal/ble/`)

### Phase 2A — Wi-Fi Foundation
- [ ] Scaffold React Native project
- [ ] Add `canshift-core` dependency
- [ ] Implement Wi-Fi connection to ESP32 AP
- [ ] Implement config download from device (GET /config)
- [ ] Implement config push to device (PUT /config)
- [ ] Basic profile selection screen

### Phase 2B — Quick Controls
- [ ] Live signal view (mirror key gauges)
- [ ] Theme toggle (day/night)
- [ ] Page navigation shortcuts
- [ ] Brightness control

### Phase 2C — Diagnostics
- [ ] Signal status list (active / timeout / error)
- [ ] CAN frame log (raw view)
- [ ] Device info (firmware version, uptime)

### Phase 3 — Polish & BLE
- [ ] BLE support as alternative transport
- [ ] Offline config editing
- [ ] Profile library (save/load multiple configs)

---

## File Structure (Planned)

```
canshift-mobile/
├── README.md                   (this file — planning document)
├── .gitkeep                    (placeholder to keep folder in git)
└── (future) src/
    ├── App.tsx
    ├── navigation/
    ├── screens/
    │   ├── ConnectScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── ProfileScreen.tsx
    │   ├── QuickSettingsScreen.tsx
    │   └── DiagnosticsScreen.tsx
    ├── services/
    │   ├── wifi.service.ts
    │   └── ble.service.ts
    ├── stores/
    │   └── device.store.ts
    └── hooks/
        └── useDevice.ts
```

---

## Connections to Other Projects

- **canshift-core** → will consume types and validators (same as desktop app)
- **canshift-firmware** → will communicate with it over Wi-Fi/BLE (future)
- **canshift-studio** → desktop remains primary; mobile is companion only

---

## Resume Work From Here

This folder requires no action in Phase 1.

When Phase 2 begins:
1. Confirm firmware Wi-Fi AP mode is working
2. Define the REST or WebSocket API contract in `docs/future-wireless-strategy.md`
3. Scaffold the React Native project here
4. Install `canshift-core` as a dependency
5. Implement `wifi.service.ts` — connect to ESP32 AP and exchange config
