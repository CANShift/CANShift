export const ROUTE_PATHS = [
  '/',
  '/dashboard',
  '/can',
  '/ecu',
  '/obd2',
  '/themes',
  '/live',
  '/logs',
  '/cli',
  '/firmware',
  '/about',
] as const

export type RoutePath = (typeof ROUTE_PATHS)[number]

export const isRoutePath = (pathname: string): pathname is RoutePath =>
  (ROUTE_PATHS as readonly string[]).includes(pathname)
