// ecu-profiles/index.ts — Built-in ECU signal profiles

import type { SignalDef } from '../types/signal'

export interface EcuProfile {
  id: string
  name: string
  description: string
  /** Value written to SignalConfig.protocol on export */
  protocol: string
  signals: SignalDef[]
}

export const ECU_PROFILES: EcuProfile[] = [
  {
    id: 'generic-blank',
    name: 'Generic (blank)',
    description: "Empty template — fill in from your ECU's CAN documentation",
    protocol: 'generic',
    signals: [],
  },
]

export const DEFAULT_PROFILE_ID = 'generic-blank' as const
