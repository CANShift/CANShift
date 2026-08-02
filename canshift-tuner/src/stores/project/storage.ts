import {
  CURRENT_SCHEMA_VERSION,
  PROJECT_FILE_VERSION,
  ProjectSchema,
  migrateConfig,
} from '@tmbk/canshift-core'
import type { Project, ProjectMeta } from '@tmbk/canshift-core'

export const PROJECT_INDEX_KEY = 'canshift.tuner.projects'
const PROJECT_KEY_PREFIX = 'canshift.tuner.project.'

export interface ProjectIndex {
  activeId: string | null
  projects: ProjectMeta[]
}

export const projectStorageKey = (id: string): string => `${PROJECT_KEY_PREFIX}${id}`

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch {
    void 0
  }
}

export const readProjectIndex = (): ProjectIndex | null => {
  const raw = safeGet(PROJECT_INDEX_KEY)
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const candidate = parsed as { activeId?: unknown; projects?: unknown }
  if (!Array.isArray(candidate.projects)) return null
  const projects = candidate.projects.filter(
    (p): p is ProjectMeta =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as ProjectMeta).id === 'string' &&
      typeof (p as ProjectMeta).name === 'string' &&
      typeof (p as ProjectMeta).createdAt === 'string' &&
      typeof (p as ProjectMeta).updatedAt === 'string'
  )
  const activeId = typeof candidate.activeId === 'string' ? candidate.activeId : null
  return { activeId, projects }
}

export const writeProjectIndex = (index: ProjectIndex): void => {
  safeSet(PROJECT_INDEX_KEY, JSON.stringify(index))
}

export const readProject = (id: string): Project | null => {
  const raw = safeGet(projectStorageKey(id))
  if (raw === null) return null
  let outer: unknown
  try {
    outer = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof outer !== 'object' || outer === null) return null

  const candidate = outer as Record<string, unknown>
  try {
    candidate.dashboard = migrateConfig(
      candidate.dashboard as Record<string, unknown>,
      CURRENT_SCHEMA_VERSION
    ).config
  } catch {
    return null
  }
  const parsed = ProjectSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export const writeProject = (project: Project): boolean => {
  if (!ProjectSchema.safeParse(project).success) return false
  return safeSet(projectStorageKey(project.id), JSON.stringify(project))
}

export const removeProject = (id: string): void => {
  safeRemove(projectStorageKey(id))
}

export const PROJECT_VERSION = PROJECT_FILE_VERSION
