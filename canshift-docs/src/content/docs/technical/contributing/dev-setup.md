---
title: "Setup dev"
description: "Cloner le monorepo, builder firmware et tuner en local."
sidebar:
  order: 1
---

## Pré-requis

- Node ≥ 20 (pour tuner, mobile, docs)
- PlatformIO Core (pour firmware) — `pip install platformio`
- Rust toolchain xtensa (optionnel — uniquement si tu touches aux ports Rust du firmware)

## Cloner

```bash
git clone https://github.com/tburkhalterr/CANShift
cd CANShift
```

Les 4 packages :

| Package | Stack | Commande |
|---|---|---|
| `canshift-core` | TypeScript | `cd canshift-core && npm install && npm run build` |
| `canshift-firmware` | C++17 / PlatformIO | `cd canshift-firmware && pio run` |
| `canshift-tuner` | Vite + React | `cd canshift-tuner && npm install && npm run dev` |
| `canshift-docs` | Astro Starlight | `cd canshift-docs && npm install && npm run dev` |

`canshift-mobile` (Expo) est inactif sauf cas spécifique — voir `.claude/` mémoire.

## Workflow PR

Toujours via `gh pr create` — jamais de merge direct sur main.
Branche : `type/package/short-description` (ex. `feat/firmware/cruise-l-shape`).

Commit conventional (subject only — pas de body) :

```
feat(firmware): cruise L-shape buttons
fix(tuner): typo overflow on long signal names
chore(firmware): strip verbose comments — phase 11
```
