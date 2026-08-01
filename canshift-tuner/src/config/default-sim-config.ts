import type { DashboardConfig } from '@tmbk/canshift-core'
import {
  DEFAULT_PAGE_PALETTE,
  CURRENT_SCHEMA_VERSION,
  DashboardConfigSchema,
} from '@tmbk/canshift-core'

const DEMO_STYLE_NEUTRAL = {
  primaryColor: '#FFFFFF',
  secondaryColor: '#2A2A2A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 28,
}

const DEMO_STYLE_RED = {
  primaryColor: '#FF4444',
  secondaryColor: '#2A2A2A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 28,
}

const DEMO_STYLE_BLUE = {
  primaryColor: '#44AAFF',
  secondaryColor: '#2A2A2A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 22,
}

const DEMO_STYLE_ORANGE = {
  primaryColor: '#FF8800',
  secondaryColor: '#2A2A2A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 22,
}

const DEMO_STYLE_GREEN = {
  primaryColor: '#44CC88',
  secondaryColor: '#2A2A2A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 22,
}

const DEMO_STYLE_YELLOW = {
  primaryColor: '#FBC02D',
  secondaryColor: '#2A2A2A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 22,
}

const DEMO_STYLE_BUTTON = {
  primaryColor: '#FF4444',
  secondaryColor: '#1A1A1A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 16,
}

const DEMO_BUTTON_COLORS_MAP = {
  normal: '#3A1212',
  active: '#FF4444',
}

const DEMO_BUTTON_COLORS_LAUNCH = {
  normal: '#1F1F1F',
  active: '#43A047',
}

const DEMO_BUTTON_COLORS_ANTILAG = {
  normal: '#1F1F1F',
  active: '#FF6F00',
}

const PARSED_SIM_CONFIG = DashboardConfigSchema.parse({
  version: CURRENT_SCHEMA_VERSION,
  name: 'CANShift Demo',
  description: 'Coherent 4-page demo — overview, engine, fluids, controls',
  defaultPageId: 'overview',
  revLimitRpm: 7200,
  topBar: {
    height: 16,
    bgColor: '#0D0D0D',
    textColor: '#AAAAAA',
  },
  pages: [
    {
      id: 'overview',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      palette: { ...DEFAULT_PAGE_PALETTE },
      widgets: [
        {
          id: 'speed_arc',
          type: 'gauge',
          signal: 'speed_kph',
          layout: { col: 0, colSpan: 6, row: 0, rowSpan: 6, zOrder: 0 },
          style: { ...DEMO_STYLE_NEUTRAL, fontSize: 36 },
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            iconName: 'speed',
            minValue: 0,
            maxValue: 300,
            dangerLevel: 280,
            decimalPlaces: 0,
          },
        },
        {
          id: 'rpm_arc',
          type: 'gauge',
          signal: 'rpm',
          layout: { col: 6, colSpan: 6, row: 0, rowSpan: 6, zOrder: 0 },
          style: DEMO_STYLE_RED,
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            iconName: 'rpm',
            minValue: 0,
            maxValue: 8000,
            dangerLevel: 7000,
            decimalPlaces: 0,
          },
        },
        {
          id: 'coolant_l',
          type: 'gauge',
          signal: 'coolant_temp_c',
          layout: { col: 0, colSpan: 6, row: 6, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_BLUE,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'coolant',
            minValue: 0,
            maxValue: 120,
            dangerLevel: 110,
            decimalPlaces: 0,
          },
        },
        {
          id: 'battery_l',
          type: 'gauge',
          signal: 'battery_volts',
          layout: { col: 6, colSpan: 6, row: 6, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_YELLOW,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'battery',
            minValue: 10,
            maxValue: 15,
            dangerLevel: 10.5,
            decimalPlaces: 1,
          },
        },
        {
          id: 'oil_press_l',
          type: 'gauge',
          signal: 'oil_press_bar',
          layout: { col: 0, colSpan: 6, row: 9, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_ORANGE,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'oil_pressure',
            minValue: 0,
            maxValue: 6,
            dangerLevel: 0.5,
            decimalPlaces: 1,
          },
        },
        {
          id: 'gear_l',
          type: 'gear',
          signal: 'gear',
          layout: { col: 6, colSpan: 6, row: 9, rowSpan: 3, zOrder: 0 },
          style: { ...DEMO_STYLE_RED, fontSize: 32 },
          config: { type: 'gear', decimalPlaces: 0 },
        },
      ],
    },

    {
      id: 'engine',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      palette: { ...DEFAULT_PAGE_PALETTE },
      widgets: [
        {
          id: 'boost_arc',
          type: 'gauge',
          signal: 'map_kpa',
          layout: { col: 0, colSpan: 6, row: 0, rowSpan: 6, zOrder: 0 },
          style: DEMO_STYLE_ORANGE,
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            iconName: 'boost',
            minValue: 0,
            maxValue: 300,
            dangerLevel: 270,
            decimalPlaces: 0,
          },
        },
        {
          id: 'gear_xl',
          type: 'gear',
          signal: 'gear',
          layout: { col: 6, colSpan: 6, row: 0, rowSpan: 6, zOrder: 0 },
          style: { ...DEMO_STYLE_RED, fontSize: 48 },
          config: { type: 'gear', decimalPlaces: 0 },
        },
        {
          id: 'rpm_l',
          type: 'gauge',
          signal: 'rpm',
          layout: { col: 0, colSpan: 6, row: 6, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_RED,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'rpm',
            minValue: 0,
            maxValue: 8000,
            dangerLevel: 7000,
            decimalPlaces: 0,
          },
        },
        {
          id: 'tps_l',
          type: 'gauge',
          signal: 'throttle_pos',
          layout: { col: 6, colSpan: 6, row: 6, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_ORANGE,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'throttle',
            minValue: 0,
            maxValue: 100,
            dangerLevel: 95,
            decimalPlaces: 0,
          },
        },
        {
          id: 'lambda_l',
          type: 'gauge',
          signal: 'lambda_1',
          layout: { col: 0, colSpan: 6, row: 9, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_GREEN,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'afr',
            minValue: 0.7,
            maxValue: 1.3,
            dangerLevel: 1.2,
            decimalPlaces: 2,
          },
        },
        {
          id: 'iat_l',
          type: 'gauge',
          signal: 'iat_c',
          layout: { col: 6, colSpan: 6, row: 9, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_BLUE,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'iat',
            minValue: -20,
            maxValue: 80,
            dangerLevel: 60,
            decimalPlaces: 0,
          },
        },
      ],
    },

    {
      id: 'fluids',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      palette: { ...DEFAULT_PAGE_PALETTE },
      widgets: [
        {
          id: 'coolant_arc',
          type: 'gauge',
          signal: 'coolant_temp_c',
          layout: { col: 0, colSpan: 6, row: 0, rowSpan: 6, zOrder: 0 },
          style: DEMO_STYLE_BLUE,
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            iconName: 'coolant',
            minValue: 0,
            maxValue: 120,
            dangerLevel: 110,
            decimalPlaces: 0,
          },
        },
        {
          id: 'oil_press_arc',
          type: 'gauge',
          signal: 'oil_press_bar',
          layout: { col: 6, colSpan: 6, row: 0, rowSpan: 6, zOrder: 0 },
          style: DEMO_STYLE_ORANGE,
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            iconName: 'oil_pressure',
            minValue: 0,
            maxValue: 6,
            dangerLevel: 0.5,
            decimalPlaces: 1,
          },
        },
        {
          id: 'oil_temp_l',
          type: 'gauge',
          signal: 'oil_temp_c',
          layout: { col: 0, colSpan: 6, row: 6, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_ORANGE,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'oil_temp',
            minValue: 0,
            maxValue: 150,
            dangerLevel: 140,
            decimalPlaces: 0,
          },
        },
        {
          id: 'fuel_press_l',
          type: 'gauge',
          signal: 'fuel_press_bar',
          layout: { col: 6, colSpan: 6, row: 6, rowSpan: 3, zOrder: 0 },
          style: DEMO_STYLE_ORANGE,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'fuel',
            minValue: 0,
            maxValue: 6,
            dangerLevel: 5.5,
            decimalPlaces: 1,
          },
        },
      ],
    },

    {
      id: 'controls',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      palette: { ...DEFAULT_PAGE_PALETTE },
      widgets: [
        {
          id: 'btn_map_cycle',
          type: 'button',
          signal: '',
          layout: { col: 0, colSpan: 12, row: 0, rowSpan: 6, zOrder: 0 },
          style: DEMO_STYLE_BUTTON,
          config: {
            type: 'button',
            mode: 'cycle' as const,
            label: 'MAP',
            iconName: 'map_icon',
            showLabel: true,
            showIcon: true,
            colors: DEMO_BUTTON_COLORS_MAP,
            initialActiveIndex: 0,
            states: [
              { label: 'MAP 1', action: { category: 'ecu', type: 'map_switch', mapIndex: 1 } },
              { label: 'MAP 2', action: { category: 'ecu', type: 'map_switch', mapIndex: 2 } },
              { label: 'MAP 3', action: { category: 'ecu', type: 'map_switch', mapIndex: 3 } },
            ],
          },
        },
        {
          id: 'btn_launch',
          type: 'button',
          signal: 'flag_launch_ctrl',
          layout: { col: 0, colSpan: 6, row: 6, rowSpan: 6, zOrder: 0 },
          style: DEMO_STYLE_BUTTON,
          config: {
            type: 'button',
            mode: 'single' as const,
            label: 'Launch',
            iconName: 'launch',
            showLabel: true,
            showIcon: true,
            isToggle: true,
            colors: DEMO_BUTTON_COLORS_LAUNCH,
            actions: [
              { category: 'ecu', type: 'can_raw', frameId: 0x520, data: '01', dataOff: '00' },
            ],
          },
        },
        {
          id: 'btn_antilag',
          type: 'button',
          signal: 'flag_anti_lag',
          layout: { col: 6, colSpan: 6, row: 6, rowSpan: 6, zOrder: 0 },
          style: DEMO_STYLE_BUTTON,
          config: {
            type: 'button',
            mode: 'single' as const,
            label: 'Anti-lag',
            iconName: 'flame',
            showLabel: true,
            showIcon: true,
            isToggle: true,
            colors: DEMO_BUTTON_COLORS_ANTILAG,
            actions: [
              { category: 'ecu', type: 'can_raw', frameId: 0x521, data: '01', dataOff: '00' },
            ],
          },
        },
      ],
    },
  ],
})

export const DEFAULT_SIM_CONFIG: DashboardConfig = PARSED_SIM_CONFIG as DashboardConfig
