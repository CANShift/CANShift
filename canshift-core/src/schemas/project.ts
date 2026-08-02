import { z } from 'zod'

import { DashboardConfigSchema } from './dashboard.js'
import { SignalDefSchema } from './signal.js'
import { SemVerSchema } from './common.js'

export const PROJECT_FILE_VERSION = SemVerSchema.parse('1.0.0')
export const PROJECT_NAME_MAX = 80

const IsoDateTimeSchema = z.string().datetime({ offset: true })

export const ProjectMetaSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(PROJECT_NAME_MAX),
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const ProjectSchema = z
  .object({
    projectVersion: SemVerSchema,
    id: z.string().min(1),
    name: z.string().min(1).max(PROJECT_NAME_MAX),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    dashboard: DashboardConfigSchema,
    ecuProfileKey: z.string().min(1),
    signals: z.array(SignalDefSchema),
  })
  .strict()

export type ProjectMeta = z.infer<typeof ProjectMetaSchema>
export type Project = z.infer<typeof ProjectSchema>
