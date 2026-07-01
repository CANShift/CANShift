import { CURRENT_SCHEMA_VERSION, DashboardConfigSchema } from '../index.js'
import { migrateConfig } from '../migrations/migration-runner.js'

const fullStyle = {
  primaryColor: '#FF4444',
  secondaryColor: '#333333',
  warningColor: '#FF8800',
  criticalColor: '#FF0000',
  textColor: '#FFFFFF',
  fontSize: 14,
}

const fullPalette = {
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
}

const legacyDashboard100: Record<string, unknown> = {
  version: '1.0.0',
  name: 'Legacy Dash',
  defaultPageId: 'p1',
  revLimitRpm: 7000,
  topBar: {
    height: 24,
    bgColor: '#0D0D0D',
    textColor: '#AAAAAA',
    showMapName: true,
    showMapProfile: false,
  },
  pages: [
    {
      id: 'p1',
      name: 'Main',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      widgets: [
        {
          id: 'btn_nav',
          type: 'button',
          signal: '',
          layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: { type: 'button', label: 'Engine', targetPageId: 'p2' },
        },
        {
          id: 'btn_dead',
          type: 'button',
          signal: '',
          layout: { x: 160, y: 0, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: { type: 'button', label: 'Aux' },
        },
        {
          id: 'lbl_rpm',
          type: 'label',
          signal: 'rpm',
          layout: { x: 0, y: 56, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: { decimalPlaces: 0, suffix: ' rpm' },
        },
        {
          id: 'gear1',
          type: 'gear',
          signal: 'gear',
          layout: { x: 160, y: 56, w: 80, h: 112, zOrder: 1 },
          style: fullStyle,
          config: { type: 'gear', decimalPlaces: 0 },
        },
        {
          id: 'coolant_arc',
          type: 'gauge',
          signal: 'coolant',
          layout: { x: 0, y: 112, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: {
            type: 'gauge',
            minValue: 0,
            maxValue: 120,
            warningLevel: 100,
            dangerLevel: 110,
            decimalPlaces: 0,
          },
        },
        {
          id: 'tps_bar',
          type: 'gauge',
          signal: 'tps',
          layout: { x: 0, y: 196, w: 320, h: 28, zOrder: 0 },
          style: fullStyle,
          config: {
            type: 'gauge',
            displayStyle: 'bar',
            barOrientation: 'horizontal',
            minValue: 0,
            maxValue: 100,
            warningLevel: 70,
            dangerLevel: 90,
            decimalPlaces: 0,
          },
        },
      ],
    },
    {
      id: 'p2',
      name: 'Aux',
      backgroundImage: null,
      backgroundColor: '#111111',
      showTopBar: false,
      widgets: [
        {
          id: 'warn_oil',
          type: 'warning',
          signal: 'oil_pressure',
          layout: { x: 240, y: 0, w: 80, h: 56, zOrder: 0 },
          style: fullStyle,
          config: { type: 'warning', threshold: 1 },
        },
      ],
    },
  ],
}

const midDashboard1160: Record<string, unknown> = {
  version: '1.16.0',
  name: 'Mid Dash',
  defaultPageId: 'p1',
  revLimitRpm: 7200,
  topBar: { height: 30, bgColor: '#0D0D0D', textColor: '#AAAAAA' },
  pages: [
    {
      id: 'p1',
      backgroundImage: null,
      backgroundColor: '#000000',
      palette: fullPalette,
      showTopBar: true,
      widgets: [
        {
          id: 'btn_dead',
          type: 'button',
          signal: '',
          layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: {
            type: 'button',
            label: 'Dead',
            colors: { normal: '#FF4444', active: '#FF7777' },
            actions: [],
          },
        },
        {
          id: 'btn_map',
          type: 'button',
          signal: '',
          layout: { x: 160, y: 0, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: {
            type: 'button',
            label: 'Map 2',
            colors: { normal: '#FF4444', active: '#FF7777' },
            actions: [{ category: 'ecu', type: 'map_switch', mapIndex: 1 }],
          },
        },
        {
          id: 'boost_bar',
          type: 'bar',
          signal: 'boost',
          layout: { x: 0, y: 56, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: { type: 'bar', minValue: 0, maxValue: 2, decimalPlaces: 1 },
        },
        {
          id: 'rpm_arc',
          type: 'gauge',
          signal: 'rpm',
          layout: { x: 0, y: 112, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            minValue: 0,
            maxValue: 8000,
            warningLevel: 6500,
            dangerLevel: 7000,
            decimalPlaces: 0,
            hideWhenInvalid: true,
            label: 'RPM',
            labelPosition: 'bottom',
          },
        },
      ],
    },
  ],
}

const lateDashboard1110: Record<string, unknown> = {
  version: '1.11.0',
  name: 'Late Dash',
  defaultPageId: 'p1',
  revLimitRpm: 8000,
  topBar: { height: 24, bgColor: '#0D0D0D', textColor: '#AAAAAA' },
  pages: [
    {
      id: 'p1',
      backgroundImage: null,
      backgroundColor: '#000000',
      palette: fullPalette,
      showTopBar: true,
      widgets: [
        {
          id: 'btn_nav',
          type: 'button',
          signal: '',
          layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: {
            type: 'button',
            label: 'Home',
            colors: { normal: '#FF4444', active: '#FF7777' },
            actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p1' }],
          },
        },
        {
          id: 'coolant_arc',
          type: 'gauge',
          signal: 'coolant',
          layout: { x: 160, y: 0, w: 160, h: 56, zOrder: 0 },
          style: fullStyle,
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            minValue: 0,
            maxValue: 120,
            dangerLevel: 110,
            decimalPlaces: 0,
          },
        },
      ],
    },
  ],
}

const migrateToCurrent = (fixture: Record<string, unknown>): Record<string, unknown> => {
  const { config: migrated } = migrateConfig(fixture, CURRENT_SCHEMA_VERSION)
  return migrated
}

const expectValid = (migrated: Record<string, unknown>): void => {
  const result = DashboardConfigSchema.safeParse(migrated)
  expect(result.success ? [] : result.error.issues).toEqual([])
  expect(result.success).toBe(true)
}

const widgetIds = (migrated: Record<string, unknown>, pageIndex: number): string[] => {
  const pages = migrated.pages as { widgets: { id: string }[] }[]
  return pages[pageIndex]!.widgets.map((w) => w.id)
}

describe('migration round-trip — old fixtures validate against the current schema (#1709)', () => {
  it('migrates a representative 1.0.0 config into a valid current config', () => {
    const migrated = migrateToCurrent(legacyDashboard100)
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION)
    expectValid(migrated)
  })

  it('drops the action-less 1.0.0 button instead of emitting actions: []', () => {
    const migrated = migrateToCurrent(legacyDashboard100)
    expect(widgetIds(migrated, 0)).toEqual([
      'btn_nav',
      'lbl_rpm',
      'gear1',
      'coolant_arc',
      'tps_bar',
    ])
  })

  it('migrates a representative 1.16.0 config into a valid current config', () => {
    const migrated = migrateToCurrent(midDashboard1160)
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION)
    expectValid(migrated)
  })

  it('drops the empty-actions 1.16.0 button and the deprecated bar widget', () => {
    const migrated = migrateToCurrent(midDashboard1160)
    expect(widgetIds(migrated, 0)).toEqual(['btn_map', 'rpm_arc'])
  })

  it('migrates a representative 1.11.0 config into a valid current config', () => {
    const migrated = migrateToCurrent(lateDashboard1110)
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION)
    expectValid(migrated)
  })

  it('a config already at the current version passes validation unchanged', () => {
    const migrated = migrateToCurrent(lateDashboard1110)
    const again = migrateToCurrent(migrated)
    expect(again).toEqual(migrated)
    expectValid(again)
  })
})
