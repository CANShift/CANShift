import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SIM_CONFIG } from '../../config/default-sim-config'
import { useDashboardStore } from '../dashboard.store'
import { useSignalStore } from '../signal.store'
import { bootstrapProjects, useProjectStore } from './project.store'
import { readProject, readProjectIndex } from './storage'

const memoryStorage = (): Storage => {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => {
      map.clear()
    },
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k)
    },
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  }
}

const freshConfig = () => structuredClone(DEFAULT_SIM_CONFIG)

describe('project store', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage()
    useProjectStore.setState({ projects: [], activeProjectId: null })
    useDashboardStore.getState().setConfig(freshConfig())
  })

  it('bootstrap adopts the current editor state as the first project', () => {
    bootstrapProjects()

    const { projects, activeProjectId } = useProjectStore.getState()
    expect(projects).toHaveLength(1)
    expect(activeProjectId).toBe(projects[0]?.id)

    const stored = readProject(activeProjectId ?? '')
    expect(stored?.dashboard.defaultPageId).toBe(DEFAULT_SIM_CONFIG.defaultPageId)
    expect(readProjectIndex()?.activeId).toBe(activeProjectId)
  })

  it('switching projects swaps the full editor state and both persist', () => {
    bootstrapProjects()
    const firstId = useProjectStore.getState().activeProjectId ?? ''

    useDashboardStore.getState().updatePage(DEFAULT_SIM_CONFIG.defaultPageId, { visible: false })

    const second = freshConfig()
    second.name = 'Second car'
    const secondId = useProjectStore.getState().createProject('Second car', second)

    expect(useProjectStore.getState().activeProjectId).toBe(secondId)
    expect(useDashboardStore.getState().config?.name).toBe('Second car')

    const firstStored = readProject(firstId)
    expect(
      firstStored?.dashboard.pages.find((p) => p.id === DEFAULT_SIM_CONFIG.defaultPageId)?.visible
    ).toBe(false)

    expect(useProjectStore.getState().switchProject(firstId)).toBe(true)
    expect(useDashboardStore.getState().config?.name).toBe(DEFAULT_SIM_CONFIG.name)
    expect(useProjectStore.getState().projects).toHaveLength(2)
  })

  it('switching saves the outgoing project signals too', () => {
    bootstrapProjects()
    const firstId = useProjectStore.getState().activeProjectId ?? ''
    const firstSignalCount = useSignalStore.getState().signals.length

    useProjectStore.getState().createProject('Other', freshConfig())

    expect(readProject(firstId)?.signals).toHaveLength(firstSignalCount)
  })

  it('refuses to delete the last project', () => {
    bootstrapProjects()
    const id = useProjectStore.getState().activeProjectId ?? ''
    expect(useProjectStore.getState().deleteProject(id)).toBe(false)
    expect(useProjectStore.getState().projects).toHaveLength(1)
  })

  it('deleting the active project switches to the survivor first', () => {
    bootstrapProjects()
    const firstId = useProjectStore.getState().activeProjectId ?? ''
    const secondId = useProjectStore.getState().createProject('Second', freshConfig())

    expect(useProjectStore.getState().deleteProject(secondId)).toBe(true)
    expect(useProjectStore.getState().activeProjectId).toBe(firstId)
    expect(readProject(secondId)).toBeNull()
    expect(useProjectStore.getState().projects).toHaveLength(1)
  })
})
