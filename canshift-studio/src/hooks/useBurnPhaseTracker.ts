// useBurnPhaseTracker.ts — Drives the 'rebooting' → 'done' → 'idle' transitions
// of the burn cycle by watching the connection state.
//
// burnConfig() sets 'pushing' on click and 'rebooting' once the firmware
// acks the CMD_PUT_CONFIG. Everything that happens afterwards (cable drop,
// auto-reconnect, settle delay) is observed here so the state machine doesn't
// need to live inside the burn promise.

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'

// How long the modal lingers on the success state before returning to idle.
// Long enough that a glance catches it, short enough that it doesn't feel
// like the app is still working.
const DONE_LINGER_MS = 1_500

// How long we keep waiting for the device to come back after a burn before
// we surrender and return to idle. Boot sequence is ~3 s on a healthy board;
// 20 s leaves ample slack for the heartbeat poll + auto-connect cycle.
const RECONNECT_TIMEOUT_MS = 20_000

export function useBurnPhaseTracker(): void {
  const burnPhase = useDeviceStore((s) => s.burnPhase)
  const connected = useDeviceStore((s) => s.connected)
  const setBurnPhase = useDeviceStore((s) => s.setBurnPhase)

  // Track whether we've already seen the post-burn disconnect. Without this,
  // a burn that completes while connected (no observable disconnect — e.g.
  // device wedged or ack races) would never transition to 'done'.
  const sawDisconnectRef = useRef(false)

  useEffect(() => {
    if (burnPhase !== 'rebooting') {
      sawDisconnectRef.current = false
      return
    }

    // Mark the disconnect when it lands.
    if (!connected) {
      sawDisconnectRef.current = true
      return
    }

    // Connected during 'rebooting' — fresh post-reboot session.
    if (sawDisconnectRef.current) {
      setBurnPhase('done')
    }
  }, [burnPhase, connected, setBurnPhase])

  // 'done' state: linger briefly so the user reads the confirmation, then idle.
  useEffect(() => {
    if (burnPhase !== 'done') return
    const timer = setTimeout(() => {
      setBurnPhase('idle')
    }, DONE_LINGER_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [burnPhase, setBurnPhase])

  // Safety net: if we've been 'rebooting' for far longer than a healthy boot,
  // give up and return to idle so the modal doesn't stay stuck if the device
  // never comes back.
  useEffect(() => {
    if (burnPhase !== 'rebooting') return
    const timer = setTimeout(() => {
      setBurnPhase('idle')
    }, RECONNECT_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [burnPhase, setBurnPhase])
}
