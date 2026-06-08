# CANShift Tuner — Documentation

Two tracks: a **user guide** for people running the Tuner against their dash,
and a **technical reference** for the protocol, hardware quirks, and recovery
procedures.

## User guide — `docs/user/`

| Page | What's inside |
|---|---|
| [getting-started.md](user/getting-started.md) | First connect, simulation mode, navigation map |
| [troubleshooting.md](user/troubleshooting.md) | Common WebSerial failures, browser support, recovery steps |

Coming in follow-up PRs: `dashboard-editor.md` (page/widget editing walkthrough),
`can-bus.md` (signal binding), `obd2.md` (PID polling), `firmware-flasher.md`
(in-Tuner flashing once it lands).

## Technical reference — `docs/technical/`

| Page | What's inside |
|---|---|
| [architecture.md](technical/architecture.md) | High-level surface — Tuner ↔ firmware separation, WebSerial, where data lives |
| [webserial-protocol.md](technical/webserial-protocol.md) | Wire format, opcode table, ack/subscribe semantics |
| [manual-flash.md](technical/manual-flash.md) | Recovery procedure when the in-browser flasher can't help (esptool slow-baud, full erase) |

Coming in follow-up PRs: `partition-layout.md`, `firmware-debug.md` (UART boot logs,
WDT reset reasons), `release-process.md`.

---

Doc style: **task-oriented**, English, problem-first. Mirror the structure
[canshift-flasher's docs](https://github.com/tburkhalterr/canshift-flasher/tree/main/docs)
established (clear titles, minimal jargon, concrete recovery steps).

VitePress will be set up in a follow-up PR (#1351 umbrella) when the doc
inventory is large enough to warrant the build step. Until then, GitHub's
native markdown rendering is fine.
