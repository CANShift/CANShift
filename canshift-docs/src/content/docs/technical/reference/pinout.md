---
title: "Pinout — CrowPanel 2.8\""
description: "Référence des GPIO pour la carte ESP32 + écran ILI9341 + touch XPT2046."
sidebar:
  order: 1
---

| Fonction | GPIO | Note |
|---|---:|---|
| TFT MOSI | 13 | HSPI |
| TFT MISO | 12 | non utilisé en pratique (panel write-only) |
| TFT SCLK | 14 | HSPI |
| TFT CS | 15 | |
| TFT DC | 2 | Data/Command (RS) |
| TFT RST | — | non câblé (held high interne) |
| TFT BL | 27 | PWM backlight, 0–255 |
| Touch CS | 33 | XPT2046, bus SPI partagé avec le TFT |
| Touch IRQ | — | polling via `getTouch()` (pas d'IRQ) |
| TWAI TX | 25 | CAN — header d'extension |
| TWAI RX | 32 | CAN — header d'extension |

## Vitesses SPI

- **TFT** : 27 MHz par défaut (spec officielle), 40 MHz opt-in via
  `-DHW_TFT_FAST_SPI=1` après validation hardware.
- **Touch** : 2.5 MHz (max XPT2046).

## Free pins

GPIO 21/22 (I²C header), 16/17 (UART2) sont laissés libres exprès pour
extension future.

## Avoid

GPIO 6-11 sont réservés au flash SPI interne — ne **jamais** câbler quoi que ce
soit dessus. GPIO 34-39 sont input-only, pas utilisables pour TWAI TX qui doit
être bidirectionnel.

Source : `canshift-firmware/include/board_config.h`.
