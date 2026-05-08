// clsx is flagged "Unmaintained" by React Native Directory (false positive — last
// release April 2024, stable API, ~200 LOC, no native code, no network surface).
// Excluded from expo-doctor in package.json. See SECURITY.md.
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
