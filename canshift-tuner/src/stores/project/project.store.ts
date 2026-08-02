import { create } from 'zustand'
import { PROJECT_FILE_VERSION, PROJECT_NAME_MAX } from '@tmbk/canshift-core'
import type { DashboardConfig, Project, ProjectMeta } from '@tmbk/canshift-core'
import { createId } from '../../utils/id'
import { captureFlowEvent } from '../../lib/posthog'
import { useDashboardStore } from '../dashboard.store'
import { useSignalStore, DEFAULT_PROFILE_KEY } from '../signal.store'
import {
  readProject,
  readProjectIndex,
  removeProject,
  writeProject,
  writeProjectIndex,
} from './storage'

export const DEFAULT_PROJECT_NAME = 'My dashboard'

interface ProjectState {
  projects: ProjectMeta[]
  activeProjectId: string | null
  createProject: (name: string, dashboard: DashboardConfig) => string
  switchProject: (id: string) => boolean
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => boolean
  saveActiveProject: () => void
}

const nowIso = (): string => new Date().toISOString()

const assembleActiveProject = (meta: ProjectMeta | null): Project | null => {
  const dashboard = useDashboardStore.getState().config
  if (!dashboard || !meta) return null
  const signalState = useSignalStore.getState()
  return {
    projectVersion: PROJECT_FILE_VERSION,
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: nowIso(),
    dashboard,
    ecuProfileKey: signalState.selectedProfileKey || DEFAULT_PROFILE_KEY,
    signals: signalState.signals,
  }
}

const loadProjectIntoStores = (project: Project): void => {
  useDashboardStore.getState().setConfig(project.dashboard as DashboardConfig)
  useSignalStore.getState().applyProfile(project.ecuProfileKey, project.signals)
}

const persistIndex = (projects: ProjectMeta[], activeId: string | null): void => {
  writeProjectIndex({ activeId, projects })
}

const upsertMeta = (projects: ProjectMeta[], meta: ProjectMeta): ProjectMeta[] => {
  const rest = projects.filter((p) => p.id !== meta.id)
  return [...rest, meta].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  activeProjectId: null,

  saveActiveProject: () => {
    const { activeProjectId, projects } = get()
    if (activeProjectId === null) return
    const meta = projects.find((p) => p.id === activeProjectId)
    if (!meta) return
    const project = assembleActiveProject(meta)
    if (!project) return
    if (!writeProject(project)) return
    const nextProjects = upsertMeta(projects, { ...meta, updatedAt: project.updatedAt })
    set({ projects: nextProjects })
    persistIndex(nextProjects, activeProjectId)
  },

  createProject: (name, dashboard) => {
    get().saveActiveProject()
    const id = createId('proj')
    const createdAt = nowIso()
    const signalState = useSignalStore.getState()
    const project: Project = {
      projectVersion: PROJECT_FILE_VERSION,
      id,
      name: name.trim().slice(0, PROJECT_NAME_MAX) || DEFAULT_PROJECT_NAME,
      createdAt,
      updatedAt: createdAt,
      dashboard,
      ecuProfileKey: signalState.selectedProfileKey || DEFAULT_PROFILE_KEY,
      signals: signalState.signals,
    }
    if (!writeProject(project)) return get().activeProjectId ?? ''
    const nextProjects = upsertMeta(get().projects, {
      id,
      name: project.name,
      createdAt,
      updatedAt: createdAt,
    })
    set({ projects: nextProjects, activeProjectId: id })
    persistIndex(nextProjects, id)
    loadProjectIntoStores(project)
    captureFlowEvent('project_created')
    return id
  },

  switchProject: (id) => {
    const { activeProjectId } = get()
    if (id === activeProjectId) return true
    const target = readProject(id)
    if (!target) return false
    get().saveActiveProject()
    set({ activeProjectId: id })
    persistIndex(get().projects, id)
    loadProjectIntoStores(target)
    captureFlowEvent('project_switched')
    return true
  },

  renameProject: (id, name) => {
    const trimmed = name.trim().slice(0, PROJECT_NAME_MAX)
    if (trimmed.length === 0) return
    const project = readProject(id)
    if (project && !writeProject({ ...project, name: trimmed, updatedAt: nowIso() })) return
    const nextProjects = get().projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
    set({ projects: nextProjects })
    persistIndex(nextProjects, get().activeProjectId)
  },

  deleteProject: (id) => {
    const { projects, activeProjectId } = get()
    if (projects.length <= 1) return false
    if (id === activeProjectId) {
      const fallback = projects.find((p) => p.id !== id)
      if (!fallback || !get().switchProject(fallback.id)) return false
    }
    removeProject(id)
    const nextProjects = get().projects.filter((p) => p.id !== id)
    set({ projects: nextProjects })
    persistIndex(nextProjects, get().activeProjectId)
    return true
  },
}))

const restoreIndexedProjects = (
  projects: ProjectMeta[],
  requestedActiveId: string | null
): void => {
  const activeId =
    requestedActiveId !== null && projects.some((p) => p.id === requestedActiveId)
      ? requestedActiveId
      : (projects[0]?.id ?? null)
  useProjectStore.setState({ projects, activeProjectId: activeId })
  if (activeId === null) return
  const active = readProject(activeId)
  if (!active) return
  if (useDashboardStore.getState().config === null) loadProjectIntoStores(active)
}

export const bootstrapProjects = (): void => {
  const index = readProjectIndex()
  if (index !== null && index.projects.length > 0) {
    restoreIndexedProjects(index.projects, index.activeId)
    return
  }

  const dashboard = useDashboardStore.getState().config
  if (!dashboard) return
  const id = createId('proj')
  const createdAt = nowIso()
  const signalState = useSignalStore.getState()
  const project: Project = {
    projectVersion: PROJECT_FILE_VERSION,
    id,
    name: dashboard.name || DEFAULT_PROJECT_NAME,
    createdAt,
    updatedAt: createdAt,
    dashboard,
    ecuProfileKey: signalState.selectedProfileKey || DEFAULT_PROFILE_KEY,
    signals: signalState.signals,
  }
  if (!writeProject(project)) return
  const projects: ProjectMeta[] = [{ id, name: project.name, createdAt, updatedAt: createdAt }]
  useProjectStore.setState({ projects, activeProjectId: id })
  persistIndex(projects, id)
}
