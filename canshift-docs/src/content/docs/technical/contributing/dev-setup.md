---
title: "Dev setup"
description: "Clone the monorepo, build firmware and tuner locally."
sidebar:
  order: 1
---

## Prerequisites

- Node ≥ 20 (for tuner, mobile, docs)
- PlatformIO Core (for firmware) — `pip install platformio`
- Rust toolchain (xtensa) — optional, only if you touch the firmware's Rust ports

## Clone

```bash
git clone https://github.com/tburkhalterr/CANShift
cd CANShift
```

The five packages:

| Package | Stack | Command |
|---|---|---|
| `canshift-core` | TypeScript | `cd canshift-core && npm install && npm run build` |
| `canshift-firmware` | C++17 / PlatformIO | `cd canshift-firmware && pio run` |
| `canshift-tuner` | Vite + React | `cd canshift-tuner && npm install && npm run dev` |
| `canshift-docs` | Astro Starlight | `cd canshift-docs && npm install && npm run dev` |
| `canshift-mobile` | Expo | inactive unless explicitly working on mobile |

## PR workflow

Always via `gh pr create` — never merge directly to main.
Branch name: `type/package/short-description` (e.g. `feat/firmware/cruise-l-shape`).

Conventional commits, subject line only (no body):

```
feat(firmware): cruise L-shape buttons
fix(tuner): typo overflow on long signal names
chore(firmware): strip verbose comments — phase 11
```
