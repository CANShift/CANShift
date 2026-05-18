// wifi-ap-password.test.ts — Coverage for the SecureStore-backed
// password helper from #890.

import * as SecureStore from 'expo-secure-store'
import { clearWifiApPassword, getWifiApPassword, setWifiApPassword } from './wifi-ap-password'

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const mocked = SecureStore as jest.Mocked<typeof SecureStore>

const KEY = 'canshift.wifiApPassword'

describe('wifi-ap-password service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('setWifiApPassword', () => {
    it('writes the password under the SecureStore key', async () => {
      mocked.setItemAsync.mockResolvedValueOnce(undefined)
      await setWifiApPassword('abcDEF12')
      expect(mocked.setItemAsync).toHaveBeenCalledWith(KEY, 'abcDEF12')
    })

    it('deletes the entry when called with null', async () => {
      mocked.deleteItemAsync.mockResolvedValueOnce(undefined)
      await setWifiApPassword(null)
      expect(mocked.deleteItemAsync).toHaveBeenCalledWith(KEY)
      expect(mocked.setItemAsync).not.toHaveBeenCalled()
    })

    it('swallows SecureStore failures without throwing', async () => {
      mocked.setItemAsync.mockRejectedValueOnce(new Error('keychain locked'))
      await expect(setWifiApPassword('abc')).resolves.toBeUndefined()
    })
  })

  describe('getWifiApPassword', () => {
    it('returns the stored value', async () => {
      mocked.getItemAsync.mockResolvedValueOnce('abcDEF12')
      await expect(getWifiApPassword()).resolves.toBe('abcDEF12')
      expect(mocked.getItemAsync).toHaveBeenCalledWith(KEY)
    })

    it('returns null when nothing is stored', async () => {
      mocked.getItemAsync.mockResolvedValueOnce(null)
      await expect(getWifiApPassword()).resolves.toBeNull()
    })

    it('returns null when SecureStore throws', async () => {
      mocked.getItemAsync.mockRejectedValueOnce(new Error('boom'))
      await expect(getWifiApPassword()).resolves.toBeNull()
    })
  })

  describe('clearWifiApPassword', () => {
    it('deletes the entry', async () => {
      mocked.deleteItemAsync.mockResolvedValueOnce(undefined)
      await clearWifiApPassword()
      expect(mocked.deleteItemAsync).toHaveBeenCalledWith(KEY)
    })

    it('swallows SecureStore failures', async () => {
      mocked.deleteItemAsync.mockRejectedValueOnce(new Error('boom'))
      await expect(clearWifiApPassword()).resolves.toBeUndefined()
    })
  })
})
