# CANShift Roadmap

## Current Phase: Phase 1 — USB First

---

## Phase 1 — Foundation (Current)

**Goal:** A working dashboard that can be configured via USB from the desktop app.

### Phase 1A — Hardware Bringup
- [ ] Verify all pin assignments in `board_config.h` against CrowPanel 2.8" schematic
- [ ] Build firmware in simulation mode — confirm display initializes
- [ ] Upload SPIFFS filesystem (`pio run --target uploadfs`)
- [ ] Confirm LVGL renders pages with example config
- [ ] Calibrate touch input (XPT2046 calibration routine)
- [ ] Wire CAN transceiver, disable sim mode, confirm TWAI initializes

### Phase 1B — CAN Signal Validation
- [ ] Connect to MaxxECU Street with 500kbps CAN
- [ ] Verify frame IDs in MaxxECU software match signals.json
- [ ] Confirm RPM signal decoded correctly
- [ ] Validate coolant temp, oil temp, oil pressure signals
- [ ] Validate speed, gear, lambda signals
- [ ] Tune signal timeout values for actual ECU update rate

### Phase 1C — UI Polish
- [ ] Complete gauge widget arc rendering
- [ ] Add unit labels below gauge values
- [ ] Implement rev limiter flash overlay testing at configured RPM
- [ ] Test page navigation (tap buttons)
- [ ] Implement top bar map name update from signal store
- [ ] Test day-mode readability in sunlight (backlight max, high contrast)

### Phase 1D — Desktop App USB Sync
- [ ] Wire Electron IPC bridge (main ↔ renderer)
- [ ] Implement preload script with type-safe IPC
- [ ] Implement USB port list and connect flow in DeviceRoute
- [ ] Implement `pushConfig` — serialize JSON and write to SPIFFS via USB
- [ ] Implement firmware acknowledge of config push
- [ ] Test end-to-end: edit layout in desktop → push → firmware reloads

### Phase 1E — Desktop Editor Foundation
- [ ] Implement drag-drop canvas with 320×240 viewport
- [ ] Implement widget selection and property panel
- [ ] Implement signal binding UI (assign signal to widget)
- [ ] Implement page management (add/remove/rename pages)
- [ ] Implement File → Open / Save / Save As

---

## Phase 2 — Feature Complete Dashboard

**Goal:** Full dashboard capability with all planned widgets and screens.

### Phase 2A — Widget Library
- [ ] Tachometer with colored arc sectors (green/yellow/red)
- [ ] Speed large digit display
- [ ] Gear indicator (styled, large)
- [ ] Boost/MAP gauge with vacuum-to-boost range
- [ ] AFR/lambda display with lean/rich color coding
- [ ] Oil pressure bar with danger threshold
- [ ] Battery voltage with low/high alerts
- [ ] Lap/session timer widget
- [ ] Warning light array (MIL, launch control, traction cut, flat shift)

### Phase 2B — Visual Assets
- [ ] Custom icon sprites for warning indicators (PNG/BMP)
- [ ] CANShift boot logo as BMP or C array
- [ ] Per-page background images (BMP stored in SPIFFS)
- [ ] Day/night theme switching (manual or automatic based on time/brightness)

### Phase 2C — Desktop Visual Editor
- [ ] Full drag-drop canvas with snapping
- [ ] Multi-widget selection and alignment tools
- [ ] Theme editor with live preview
- [ ] Signal mapping full editor
- [ ] Config version management in UI

---

## Phase 3 — Wireless Configuration (Wi-Fi / BLE)

**Goal:** iPhone companion app and wireless config sync.

### Phase 3A — Firmware Wi-Fi Stack
- [ ] Implement Wi-Fi AP mode in firmware (`src/hal/wifi/`)
- [ ] HTTP server on ESP32 for config GET/PUT
- [ ] Secure the API (basic auth or session token)
- [ ] Test on bench, confirm config round-trip

### Phase 3B — iPhone App (canshift-mobile)
- [ ] Scaffold React Native project
- [ ] Install `canshift-core` dependency
- [ ] Implement Wi-Fi connection to ESP32 AP
- [ ] Implement config push/pull
- [ ] Profile selection screen
- [ ] Quick settings (theme, brightness, page jump)

### Phase 3C — BLE Support
- [ ] Implement BLE GATT service in firmware
- [ ] Implement BLE transport in iPhone app
- [ ] Use BLE for quick commands, Wi-Fi for full config transfer

---

## Phase 4 — Long-term

- OTA firmware updates from desktop or phone
- Multiple saved config profiles, switchable from dash or phone
- Data logging (SPIFFS or SD card)
- Lap timer with GPS integration
- Shift light LEDs (external GPIO)
- Predictive shift indicator
- Engine knock detection display (if MaxxECU exposes it via CAN)
