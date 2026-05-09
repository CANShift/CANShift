# Orbitron — Studio webfont assets

Self-hosted Orbitron woff2 instances used by the editor canvas / preview / demo
so the studio renders pixel-identical to the firmware (no CDN at runtime).

## Provenance

- Upstream: https://github.com/google/fonts/tree/main/ofl/orbitron
- Pinned commit: `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` (2026-03-12)
- Variable source: `Orbitron[wght].ttf` (weight axis 400–900)
- Static instances at wght=500 / 700 / 900 produced via
  `fonttools varLib.instancer Orbitron[wght].ttf wght=<W>` then compressed to
  woff2 with `fonttools ttLib.woff2 compress`.

## Files

| File                  | Weight | Use                                                  |
| --------------------- | ------ | ---------------------------------------------------- |
| `Orbitron-Medium.woff2` | 500    | Small labels / topbar / warnings (12, 14, 16 px)     |
| `Orbitron-Bold.woff2`   | 700    | Secondary values (boost, oil temp, voltage — 20–28)  |
| `Orbitron-Black.woff2`  | 900    | Primary values (RPM, speed, gear, lap time — 32, 48) |

## License

Orbitron is licensed under the SIL Open Font License 1.1 — see `OFL.txt` next
to the firmware fonts (`canshift-firmware/data/fonts/OFL.txt`). The license is
shipped alongside the firmware bins and applies equally to these woff2 derivatives.
