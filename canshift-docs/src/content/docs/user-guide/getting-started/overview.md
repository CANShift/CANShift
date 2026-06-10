---
title: "What is CANShift?"
description: "Quick overview of the system before you dive into installation."
sidebar:
  order: 1
---

CANShift is an **open-source CAN bus dashboard** for sport and track cars. It
runs on an ESP32 touch screen and displays ECU signals in real time — RPM,
temperatures, pressures, lambda, gear, and so on.

## What you need

- **Hardware**: an Elecrow CrowPanel 2.8" ESP32 screen + a CAN transceiver
  (TJA1051T/3) + wiring between the two and to your ECU.
- **Software**: a Chromium-based browser for flashing (Web Serial) and a USB
  cable.

## Ecosystem at a glance

```
        ┌─────────────────────────┐          ┌─────────────────┐
        │     canshift-tuner      │          │ canshift-mobile │
        │  (web — Vercel)         │          │ (Expo iOS/      │
        │  /firmware → flasher    │          │  Android)       │
        │  /dashboard → live edit │          │                 │
        └────────────┬────────────┘          └────────┬────────┘
                     │ USB                            │ BLE
                     ▼                                ▼
                  [ Dash ] (ESP32 firmware)
                     ▲
                     │
                  CAN bus
                     │
                ┌────┴────┐
                │   ECU   │
                └─────────┘
```

- **dash** (firmware) — the device itself: renders, parses CAN, runs cruise/UI.
- **tuner** — edits the dashboard live from a browser over USB Web Serial.
  Also hosts the firmware flasher at `/firmware`.
- **mobile** — telemetry and secondary config over BLE.

## Next

Read [First flash](/user-guide/install/first-flash/) to go from box to a
dashboard that boots.
