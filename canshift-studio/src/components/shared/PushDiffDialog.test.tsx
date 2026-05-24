// PushDiffDialog.test.tsx — Behaviour coverage for the Radix Dialog migration
// (umbrella #1015 / S-H-4).
//
// PushDiffDialog uses the shared Radix-backed `Dialog` wrapper, so its
// accessibility wins are inherited (role="dialog", focus trap, Escape-to-close,
// labelled close button). These tests pin the contract so a future regression
// to a hand-rolled overlay would fail loudly.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DashboardConfig } from '@tmbk/canshift-core'
import PushDiffDialog from './PushDiffDialog'
import { usePushDiffStore } from '../../stores/pushDiff.store'

const EMPTY_CONFIG: DashboardConfig = {
  version: '1.3.0',
  pages: [],
  palette: { background: '#000000', primary: '#FFFFFF' },
} as unknown as DashboardConfig

let container: HTMLDivElement | null = null
let root: Root | null = null

async function mount(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<PushDiffDialog />)
    await Promise.resolve()
  })
  // Radix Portal mounts content after a microtask flush.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

function dialogEl(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]')
}

beforeEach(() => {
  usePushDiffStore.setState({
    visible: false,
    currentConfig: null,
    lastPushedConfig: null,
    onConfirm: null,
  })
})

afterEach(() => {
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  if (container !== null) {
    container.remove()
    container = null
  }
  // Clean up any Radix portals left in document.body between tests.
  document.body.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach((node) => {
    node.remove()
  })
  usePushDiffStore.setState({
    visible: false,
    currentConfig: null,
    lastPushedConfig: null,
    onConfirm: null,
  })
})

describe('PushDiffDialog', () => {
  it('renders an element with role="dialog" when visible', async () => {
    await mount()

    await act(async () => {
      usePushDiffStore.getState().show(EMPTY_CONFIG, null, () => undefined)
      await Promise.resolve()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(dialogEl()).not.toBeNull()
  })

  it('dismisses the store (clears visible) when Radix fires onOpenChange(false) via Escape', async () => {
    await mount()

    await act(async () => {
      usePushDiffStore.getState().show(EMPTY_CONFIG, null, () => undefined)
      await Promise.resolve()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(usePushDiffStore.getState().visible).toBe(true)

    // Radix Dialog wires Escape to onOpenChange(false). Dispatch the key on
    // the dialog node so the primitive's listener picks it up.
    const dialog = dialogEl()
    expect(dialog).not.toBeNull()

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
      await Promise.resolve()
    })

    expect(usePushDiffStore.getState().visible).toBe(false)
  })

  it('clicking the built-in Close button dismisses the dialog', async () => {
    await mount()

    await act(async () => {
      usePushDiffStore.getState().show(EMPTY_CONFIG, null, () => undefined)
      await Promise.resolve()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const closeButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    expect(closeButton).not.toBeNull()

    await act(async () => {
      closeButton?.click()
      await Promise.resolve()
    })

    expect(usePushDiffStore.getState().visible).toBe(false)
  })

  it('clicking Cancel dismisses without running onConfirm', async () => {
    await mount()

    let confirmed = false
    await act(async () => {
      usePushDiffStore.getState().show(EMPTY_CONFIG, null, () => {
        confirmed = true
      })
      await Promise.resolve()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const cancel = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Cancel'
    )
    expect(cancel).toBeDefined()

    await act(async () => {
      cancel?.click()
      await Promise.resolve()
    })

    expect(confirmed).toBe(false)
    expect(usePushDiffStore.getState().visible).toBe(false)
  })

  it('clicking Push dismisses and invokes onConfirm exactly once', async () => {
    await mount()

    let calls = 0
    await act(async () => {
      usePushDiffStore.getState().show(EMPTY_CONFIG, null, () => {
        calls += 1
      })
      await Promise.resolve()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const push = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Push'
    )
    expect(push).toBeDefined()

    await act(async () => {
      push?.click()
      await Promise.resolve()
    })

    expect(calls).toBe(1)
    expect(usePushDiffStore.getState().visible).toBe(false)
  })
})
