import { _resetForTests, markAppLaunch, markFirstScreenReady } from './cold-start'
import { useLogStore } from '../stores/log.store'

describe('cold-start', () => {
  beforeEach(() => {
    _resetForTests()
    useLogStore.getState().clear()
  })

  it('logs an "ok" cold-start when first-screen fires within target', () => {
    const now = Date.now()
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 500)
    markAppLaunch()
    markFirstScreenReady()

    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.message).toMatch(/cold-start: 500ms/)
    expect(entries[0]?.message).toMatch(/ok/)
  })

  it('flags slow cold-start above the 2s target', () => {
    const now = Date.now()
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 2500)
    markAppLaunch()
    markFirstScreenReady()

    const entries = useLogStore.getState().entries
    expect(entries[0]?.message).toMatch(/slow/)
  })

  it('ignores subsequent markFirstScreenReady() calls', () => {
    const now = Date.now()
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 100)
      .mockReturnValueOnce(now + 200)
    markAppLaunch()
    markFirstScreenReady()
    markFirstScreenReady()

    expect(useLogStore.getState().entries).toHaveLength(1)
  })

  it('warns if first-screen fires before app-launch', () => {
    markFirstScreenReady()
    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.level).toBe('warn')
  })
})
