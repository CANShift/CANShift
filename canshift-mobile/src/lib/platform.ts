import { Platform } from 'react-native'

export type MobilePlatform = 'ios' | 'android'

export const currentPlatform = (): MobilePlatform => {
  return Platform.OS === 'android' ? 'android' : 'ios'
}
