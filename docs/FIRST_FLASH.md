# CANShift — First Flash

Complete procedure from hardware setup to a live dashboard.

---

## Required hardware

- Elecrow CrowPanel 2.8" ESP32 HMI (SKU DIS05028H)
- USB-C cable (data, not charge-only)
- Adafruit CAN Pal (TJA1051T/3) + CAN wiring (CANH/CANL to your ECU)
- Mac or PC with PlatformIO and CANShift Studio installed

---

## Step 1 — Flash the firmware

### 1a. Connect the display

Plug the CrowPanel in via USB. Verify the port appears:

```bash
# macOS
ls /dev/cu.usbserial-* /dev/cu.SLAB_* /dev/cu.wchusbserial*

# Linux
ls /dev/ttyUSB*

# Windows
# Check Device Manager → Ports (COM & LPT)
```

If nothing appears: install the CP210x (Silicon Labs) or CH340 driver depending on the USB chip on your board.

### 1b. Flash the firmware

```bash
cd canshift-firmware
pio run -e crowpanel_28 --target upload
```

The display stays black during the flash (normal — the ESP32 bootloader is active).

After the flash, the ESP32 reboots automatically. The display shows:
- **CANShift splash** (red, progress bar)
- **Setup screen** — "Ready to configure" with a pulsing red dot

This is expected: no config is on the device yet.

### 1c. Upload config files (SPIFFS)

```bash
pio run -e crowpanel_28 --target uploadfs
```

This writes `dashboard.json`, `signals.json`, and other assets to SPIFFS.

After the upload, power cycle (unplug / replug). The dashboard should appear.

---

## Step 2 — Connect from Studio

Open CANShift Studio. In the **Device** tab:

1. Click **Refresh** to list USB ports
2. Select the CrowPanel port
3. Click **Connect**

Studio sends `GET_STATUS` — if the firmware responds, the connection is established and the firmware version is shown.

**If the firmware is not yet flashed:** Studio detects the missing response and automatically opens the flash dialog. Select a release and click Flash — Studio handles everything via Web Serial (no PlatformIO required).

---

## Step 3 — Touch calibration

The default calibration is an estimate. For accuracy:

1. Swipe **down** from the top of the screen → Settings opens
2. Tap **Calibrate Touch**
3. Follow the 5 calibration points shown on screen
4. The calibration is saved in NVS — no need to redo after reboot

If touch is offset or axes are swapped, edit `board_config.h`:
```cpp
#define TOUCH_SWAP_XY  1   // swap X and Y axes
#define TOUCH_INVERT_X 1   // mirror X axis
#define TOUCH_INVERT_Y 1   // mirror Y axis
```
then re-flash: `pio run -e crowpanel_28 --target upload`.

---

## Step 4 — CAN verification

### 4a. CAN Pal wiring

```
CAN Pal CTX  → ESP32 GPIO 22 (TWAI TX)
CAN Pal CRX  → ESP32 GPIO 21 (TWAI RX)
CAN Pal VCC  → 5V
CAN Pal GND  → GND
CAN Pal CANH → ECU CAN H
CAN Pal CANL → ECU CAN L
```

### 4b. Verify frame IDs

The IDs in `signals.json` are **examples**. Before using them:

1. Open your ECU's configuration software or consult its CAN documentation
2. Check which frames are enabled and their actual IDs
3. If IDs differ → update `signals.json` and push from Studio

### 4c. Use the CAN scanner for debugging

In Studio, **CAN Scanner** tab:
- Connect the display via USB while the ECU is running
- Raw CAN frames appear in real time (ID + hex data)
- Compare received IDs against those in `signals.json`

### 4d. Confirm the baud rate

`signals.json` defaults to **500 kbps**. Verify your ECU uses the same baud rate.
To change it: update `canSpeedKbps` in `signals.json` and `CAN_SPEED_KBPS` in `board_config.h`.

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Black screen after flash | Bad SPI wiring or RST pin | Check wiring, test with `pio run -e sim` |
| Touch unresponsive | Incorrect calibration | Run calibration (Step 3) |
| Touch axes swapped | SWAP_XY or INVERT flags | Edit `board_config.h` |
| No CAN signals | Wrong frame IDs or baud rate | CAN scanner + verify ECU config |
| RPM shows but not temp | Signal timeout | Check `timeoutMs` in `signals.json` |
| Red bar at bottom of screen | Active firmware error | Tap the bar to see details |

---

## Config file structure

Config files live in `canshift-firmware/data/config/` and are uploaded to SPIFFS.

```
data/config/
├── dashboard.json   ← Page layout and widget definitions
└── signals.json     ← CAN signal mapping (edit to match your ECU)
```

To update the dashboard:
1. Edit in Studio or directly in JSON
2. Either **Push Config** from Studio (live, no reflash)
3. Or edit the file and re-run `pio run --target uploadfs`

---

## Useful commands

```bash
# Build firmware
pio run -e crowpanel_28

# Flash firmware
pio run -e crowpanel_28 --target upload

# Upload SPIFFS (config + assets)
pio run -e crowpanel_28 --target uploadfs

# Build and flash in one command
pio run -e crowpanel_28 --target upload --target uploadfs

# Simulation mode (no hardware required)
pio run -e sim

# Serial monitor (firmware logs)
pio device monitor --baud 115200
```
