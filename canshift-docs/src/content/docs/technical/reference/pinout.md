---
title: "Pinout — CrowPanel 2.8\""
description: "GPIO reference for the ESP32 board + ILI9341 display + XPT2046 touch."
sidebar:
  order: 1
---

| Function | GPIO | Note |
|---|---:|---|
| TFT MOSI | 13 | HSPI |
| TFT MISO | 12 | unused in practice (panel write-only) |
| TFT SCLK | 14 | HSPI |
| TFT CS | 15 | |
| TFT DC | 2 | Data/Command (RS) |
| TFT RST | — | not wired (held high internally) |
| TFT BL | 27 | PWM backlight, 0–255 |
| Touch CS | 33 | XPT2046, shares the SPI bus with the TFT |
| Touch IRQ | — | polling via `getTouch()` — no IRQ |
| TWAI TX | 25 | CAN — expansion header |
| TWAI RX | 32 | CAN — expansion header |

## SPI clocks

- **TFT**: 27 MHz by default (official spec), 40 MHz opt-in via
  `-DHW_TFT_FAST_SPI=1` after hardware validation.
- **Touch**: 2.5 MHz (XPT2046 max).

## Free pins

GPIO 21/22 (I²C header) and GPIO 16/17 (UART2) are intentionally left free for
expansion.

## Avoid

GPIO 6–11 are reserved for the internal flash SPI — **never** wire anything to
them. GPIO 34–39 are input-only and cannot host TWAI TX (which must be
bidirectional).

Source: `canshift-firmware/include/board_config.h`.
