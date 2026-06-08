# Manual flash (recovery)

Use the in-browser flasher first — it covers 95% of cases. **This page is
the fallback** for when the in-browser path can't recover the device
(corrupted flash, brownout damage, mid-write power glitch, etc.).

The procedure runs `esptool.py` directly against the CH340 UART. Tested on
CrowPanel-28 (ESP32-D0WDQ6 rev 1.1 + W25Q32 flash).

## Symptoms that send you here

Serial monitor shows the chip stuck in a reset loop:

```
rst:0x10 (RTCWDT_RTC_RESET),boot:0x33 (SPI_FAST_FLASH_BOOT)
flash read err, 1000
ets_main.c 371
ets Jun  8 2016 00:22:57
```

`flash read err, 1000` at the second-stage bootloader = the chip can't
read the bootloader image at `0x1000`. Cause is typically a power glitch
during a write, or two concurrent `esptool` processes hitting the same
port at once (don't do this).

## Recovery procedure

### Step 0 — physical reset

The flash chip's SPI bus can be in a marginal state after a partial
write. Recovery starts physical:

1. Unplug the dash for **60 seconds**. Lets the flash's internal
   capacitors drain.
2. Switch to a **known-good USB-C cable** — preferably the one that
   shipped with the board.
3. Plug **directly into the laptop USB-A or USB-C port** — no hub, no
   passive dongle. Power dips during the write are the #1 cause of
   half-state flash content.

### Step 1 — full chip erase at the slow baud

The default `pio run -t erase` uses 460800 baud and re-negotiates higher
speeds for actual transfer. On a half-state flash, that re-negotiation
trips. Run esptool **directly at 115200**:

```bash
python3 ~/.platformio/packages/tool-esptoolpy/esptool.py \
  --chip esp32 \
  --port /dev/cu.usbserial-XXXX \
  --baud 115200 \
  erase_flash
```

(Replace `/dev/cu.usbserial-XXXX` with whatever `ls /dev/cu.* | grep -v
Bluetooth` shows on macOS, or the equivalent COM port on Windows.)

Expected output ends with:

```
Erasing flash (this may take a while)...
Chip erase completed successfully in 0.4s
Hard resetting via RTS pin...
```

If it fails with `WARNING: Failed to communicate with the flash chip` →
try the BOOT-button approach:

1. **Hold BOOT** on the dash.
2. **Tap EN / RST** while still holding BOOT.
3. **Release BOOT**.
4. Run the `erase_flash` command immediately.

### Step 2 — write the bootloader + partition table + firmware

After a clean erase, write the full image set. From the repo root:

```bash
python3 ~/.platformio/packages/tool-esptoolpy/esptool.py \
  --chip esp32 \
  --port /dev/cu.usbserial-XXXX \
  --baud 115200 \
  --before default_reset --after hard_reset \
  write_flash -z --flash_mode dio --flash_freq 40m --flash_size 4MB \
  0x1000  canshift-firmware/.pio/build/crowpanel_28/bootloader.bin \
  0x8000  canshift-firmware/.pio/build/crowpanel_28/partitions.bin \
  0xe000  ~/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin \
  0x10000 canshift-firmware/.pio/build/crowpanel_28/firmware.bin
```

If you don't have the build outputs locally, build them first:

```bash
cd canshift-firmware
pio run -e crowpanel_28
```

### Step 3 — write the SPIFFS image

For fonts + config defaults:

```bash
python3 ~/.platformio/packages/tool-esptoolpy/esptool.py \
  --chip esp32 \
  --port /dev/cu.usbserial-XXXX \
  --baud 115200 \
  write_flash -z --flash_mode dio --flash_freq 40m --flash_size 4MB \
  0x370000 canshift-firmware/.pio/build/crowpanel_28/spiffs.bin
```

The `0x370000` offset comes from `canshift-firmware/ota_4mb_wifi.csv`.
The bootloader-pinned hash on `firmware.bin` makes esptool reject
`--flash_freq` overrides on the firmware step — that's by design;
leave `40m`.

### Step 4 — verify boot

Open the serial monitor at 115200 baud, set DTR/RTS to 0 to avoid
re-triggering the auto-reset:

```bash
cd canshift-firmware
pio device monitor -e crowpanel_28
# or:
python3 -c "import serial,time; s=serial.Serial(); s.port='/dev/cu.usbserial-XXXX'; s.baudrate=115200; s.dtr=False; s.rts=False; s.open(); [print(s.readline().decode('utf-8',errors='replace'),end='') or time.sleep(0.01) for _ in range(2000)]"
```

You should see the second-stage bootloader transition cleanly:

```
rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
configsip: 0, SPIWP:0xee
clk_drv:0x00,q_drv:0x00,...
load:0x3fff0030,len:1184
load:0x40078000,len:13104
load:0x40080400,len:3036
entry 0x400805e4
```

Followed by app-level logs.

## What you lose by doing this

- **NVS (Preferences)** is wiped — touch calibration, BLE pairing keys,
  WiFi AP password, OTA HMAC, persisted brightness. First boot after
  recovery will prompt for touch calibration; pair BLE again from the
  mobile app.
- **Persisted dashboard config** is wiped. Push the config from Studio /
  Tuner on next connect.

The ROM bootloader (factory-burned, separate from `bootloader.bin`) is
never touched by this procedure — the chip is physically un-brickable
through USB this way.
