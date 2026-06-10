export const HARDWARE_PROFILES = {
  crowpanel_28: {
    label: 'Elecrow CrowPanel 2.8" ESP32',
    reservedPins: new Set<number>([13, 12, 14, 15, 2, 27, 33]),
    expansionPins: new Set<number>([25, 32, 21, 22, 16, 17]),
  },
} as const

export type HardwareProfileId = keyof typeof HARDWARE_PROFILES
export type HardwareProfile = (typeof HARDWARE_PROFILES)[HardwareProfileId]

export const isPinAvailableForBoard = (boardId: HardwareProfileId, pin: number): boolean =>
  !HARDWARE_PROFILES[boardId].reservedPins.has(pin)
