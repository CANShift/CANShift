# CAN Bus Integration Notes

## Hardware Overview

```
MaxxECU Street
    │ CANH / CANL
    ▼
Adafruit CAN Pal (TJA1051T/3)
    │ CTX → ESP32 GPIO 22 (TWAI TX)
    │ CRX → ESP32 GPIO 21 (TWAI RX)
    │ VCC → 5V
    │ GND → GND
    ▼
ESP32 TWAI controller
```

### CAN Pal (TJA1051T/3) Notes
- 5V supply rail (connect to board 5V)
- 3.3V logic compatible on TX/RX — ESP32 GPIO is directly compatible
- Supports up to 1 Mbps
- Integrated wake-up filter
- TXD dominant timeout protection (important — prevents bus lock if ESP32 hangs)

### Termination
- MaxxECU Street has a built-in 120Ω termination resistor
- The CAN Pal does NOT include termination
- If you are adding the CAN Pal as a tap on an existing CAN network:
  - 2 nodes = correct (MaxxECU terminates one end, add 120Ω on the CAN Pal end)
  - Short stub (<30cm) = typically fine without extra termination
  - Long stub = add 120Ω on the CAN Pal CANH-CANL pins
- TODO: Test actual wiring to determine if extra termination is needed

---

## MaxxECU CAN Protocol

### Important
The exact frame IDs and byte positions in `signals.json` are **estimates**.
You MUST verify them in MaxxECU PC software before deployment.

**How to verify in MaxxECU PC software:**
1. Open MaxxECU software → Connect to ECU
2. Navigate to: CAN → CAN Output (or Data stream → CAN)
3. Check which frames are enabled and their IDs
4. For each frame, check the byte layout (position, scale, offset)

### Default Protocol
MaxxECU Street supports multiple CAN output protocols.
The default for user-configurable output is typically "User CAN" or "Generic CAN output".
The protocol version (1.2, 1.3) changes frame IDs and byte positions.

### Assumed Frame Layout (verify!)

| Frame ID | Content |
|----------|---------|
| 0x370 | RPM, TPS, MAP, IAT, Speed |
| 0x371 | Lambda, Gear, Fuel pressure |
| 0x372 | Coolant temp, Oil temp, Oil pressure |
| 0x373 | Battery voltage |
| 0x374 | Status flags (MIL, launch, flat shift, etc.) |
| 0x375 | Map number / profile |

### CAN Speed
MaxxECU default CAN speed: **500 kbps** (confirm in MaxxECU software)
Alternative: 1 Mbps for faster update rates

---

## Update Rates

Different signals update at different rates in MaxxECU:

| Signal category | Typical update rate |
|----------------|---------------------|
| RPM, TPS, MAP  | 10 ms (100 Hz)      |
| Speed, Lambda  | 20 ms (50 Hz)       |
| Temperatures   | 100 ms (10 Hz)      |
| Oil pressure   | 50 ms (20 Hz)       |
| Flags / status | 100 ms (10 Hz)      |

The SignalStore timeout values in `signals.json` should be set to at least
3× the expected update period to prevent false "signal lost" warnings.

---

## Signal Smoothing Strategy

Gauges (RPM, boost, oil pressure) use EMA (Exponential Moving Average) smoothing
to prevent LVGL widget jitter from high-frequency signal noise:

```
smoothed = α × raw + (1 - α) × smoothed
```

Where `α = SIGNAL_EMA_ALPHA = 0.2` (from `app_config.h`).

- Lower α = more smoothing (slower response to sudden changes)
- Higher α = less smoothing (faster response, more jitter)

Labels showing temperature, voltage, gear use raw values (no smoothing needed).

---

## Diagnostics

CAN health can be monitored via the USB serial console:

```
[I][CAN] TWAI driver started successfully
[I][CAN] Frame count: 1234
[W][CAN] TWAI receive error: ESP_ERR_TIMEOUT
[E][CAN] TWAI bus-off — attempting recovery
```

If you see constant timeout errors:
1. Check CAN speed matches MaxxECU setting
2. Check CANH/CANL wiring (not swapped)
3. Check termination
4. Confirm MaxxECU CAN output is enabled

If you see bus-off errors:
1. Check for wiring short
2. Check for ground loop between ECU and display power

---

## Known Risks

1. **Frame IDs unverified** — signals.json contains assumed frame IDs.
   If wrong, all CAN data will be silently ignored. Always verify in MaxxECU software.

2. **TWAI pin conflict** — GPIO 22 and 21 must not be used by SPI or other peripherals.
   Verify against board_config.h and CrowPanel 2.8" schematic.

3. **CAN ground** — ensure a common ground between MaxxECU, CAN Pal, and ESP32.
   Poor grounding causes signal integrity issues and CRC errors.

4. **Noise** — in a car environment, CAN bus noise is possible.
   Twisted pair for CANH/CANL wiring is recommended.
   Keep CAN cable away from ignition wiring.
