---
title: "C'est quoi CANShift ?"
description: "Aperçu rapide du système avant de plonger dans l'installation."
sidebar:
  order: 1
---

CANShift est un **dashboard CAN bus open-source** pour les voitures de sport et de
piste. Il tourne sur un écran tactile ESP32 et affiche en temps réel les signaux
de ton ECU (RPM, températures, pressions, lambda, gear, etc.).

## Ce dont tu as besoin

- **Hardware** : un écran Elecrow CrowPanel 2.8" ESP32 + un module CAN (TJA1051T/3)
  + le câblage entre les deux et vers ton ECU.
- **Côté logiciel** : un navigateur Chromium-based pour flasher (Web Serial) et un
  câble USB.

## L'écosystème en un schéma

```
                          ┌─────────────────────┐
                          │  canshift-flasher   │  ← flash le firmware
                          │   (web, Chromium)   │
                          └──────────┬──────────┘
                                     │ USB
        ┌─────────────────┐          │          ┌─────────────────┐
        │                 │          ▼          │                 │
        │  canshift-tuner ├──────► [ Dash ] ◄───┤ canshift-mobile │
        │  (web, Vercel)  │  USB    ESP32  BLE  │  (Expo, iOS/    │
        │                 │                     │   Android)      │
        └─────────────────┘          ▲          └─────────────────┘
                                     │
                                  CAN bus
                                     │
                                ┌────┴────┐
                                │   ECU   │
                                └─────────┘
```

- **flasher** — flashe le firmware sur l'ESP via Web Serial.
- **dash** (firmware) — le device lui-même : affiche, parse CAN, gère cruise/UI.
- **tuner** — édite live le dashboard depuis un navigateur (USB Web Serial).
- **mobile** — telemetry et config secondaire via BLE.

## Suite

Va lire [Premier flash](/user-guide/install/first-flash/) pour passer du carton
au dashboard qui clignote.
