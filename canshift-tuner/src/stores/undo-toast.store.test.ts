import { describe, expect, it, beforeEach } from 'vitest'
import { useDashboardStore } from './dashboard.store'
import { useUndoToastStore } from './undo-toast.store'

const resetStores = () => {
  useDashboardStore.setState({ past: [], future: [] })
  useUndoToastStore.setState({ toast: null })
}

describe('undo-toast store', () => {
  beforeEach(resetStores)

  it('shows a toast labelled after the last history entry', () => {
    useDashboardStore.setState({
      past: [{ config: { pages: [] } as never, label: 'Deleted page 02' }],
    })

    useUndoToastStore.getState().showForLastAction()

    expect(useUndoToastStore.getState().toast?.label).toBe('Deleted page 02')
  })

  it('does nothing when history is empty', () => {
    useUndoToastStore.getState().showForLastAction()

    expect(useUndoToastStore.getState().toast).toBeNull()
  })

  it('replaces the visible toast with a fresh id on a new action', () => {
    useDashboardStore.setState({
      past: [{ config: { pages: [] } as never, label: 'Deleted rpm' }],
    })
    useUndoToastStore.getState().showForLastAction()
    const firstId = useUndoToastStore.getState().toast?.id

    useDashboardStore.setState({
      past: [{ config: { pages: [] } as never, label: 'Deleted speed' }],
    })
    useUndoToastStore.getState().showForLastAction()
    const second = useUndoToastStore.getState().toast

    expect(second?.label).toBe('Deleted speed')
    expect(second?.id).not.toBe(firstId)
  })

  it('undoFromToast undoes the dashboard action and clears the toast', () => {
    useDashboardStore.setState({
      config: { pages: [] } as never,
      past: [{ config: { pages: [] } as never, label: 'Deleted page 02' }],
    })
    useUndoToastStore.getState().showForLastAction()

    useUndoToastStore.getState().undoFromToast()

    expect(useUndoToastStore.getState().toast).toBeNull()
    expect(useDashboardStore.getState().past).toHaveLength(0)
    expect(useDashboardStore.getState().future).toHaveLength(1)
  })

  it('dismiss only clears the matching toast id', () => {
    useDashboardStore.setState({
      past: [{ config: { pages: [] } as never, label: 'Deleted rpm' }],
    })
    useUndoToastStore.getState().showForLastAction()
    const staleId = useUndoToastStore.getState().toast?.id ?? 0

    useDashboardStore.setState({
      past: [{ config: { pages: [] } as never, label: 'Deleted speed' }],
    })
    useUndoToastStore.getState().showForLastAction()

    useUndoToastStore.getState().dismiss(staleId)
    expect(useUndoToastStore.getState().toast?.label).toBe('Deleted speed')

    const currentId = useUndoToastStore.getState().toast?.id ?? 0
    useUndoToastStore.getState().dismiss(currentId)
    expect(useUndoToastStore.getState().toast).toBeNull()
  })
})
