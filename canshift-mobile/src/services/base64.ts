import { Buffer } from 'buffer'

export const decodeBase64 = (value: string): string => {
  return Buffer.from(value, 'base64').toString('utf8')
}

export const encodeBase64 = (value: string): string => {
  return Buffer.from(value, 'utf8').toString('base64')
}
