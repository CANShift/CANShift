// defaultSimConfig.ts — Default dashboard loaded in simulation mode.
// 4-page demo dashboard built on the L (160×56) and XL (160×112) size scale
// only — no XS/S/M (issue #131). Vertical bar gauges keep their narrow tokens
// (V-M = 40×112). Mirrors canshift-firmware/data/config/dashboard.json so the
// studio preview and the device default ship identical content.

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

const DEMO_STYLE_BUTTON = {
  primaryColor: '#FF4444',
  secondaryColor: '#1A1A1A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 16,
}

// Strong contrast between resting and active states so the user can tell at
// a glance whether a button is engaged. Mirrors the firmware demo dashboard
// (canshift-firmware/data/config/dashboard.json) after #966.
const DEMO_BUTTON_COLORS_MAP = {
  normal: '#3A1212', // deep dark red — resting
  active: '#FF4444', // bright red — pressed flash
}

const DEMO_BUTTON_COLORS_LAUNCH = {
  normal: '#1F1F1F', // near-black resting
  active: '#43A047', // palette launch green when engaged
}

const DEMO_BUTTON_COLORS_ANTILAG = {
  normal: '#1F1F1F', // near-black resting
  active: '#FF6F00', // palette flame amber when engaged
}

// The branded `HexColor` and `SemVer` types are nominal — literal strings in
// this fixture don't carry the brand statically. Validating the whole demo
// dashboard through `DashboardConfigSchema.parse` once at module load both
// acquires the brand and traps any drift against the schema before the
// simulator renders a single widget (#1207 brand follow-up to #1316).
// Cast to DashboardConfig — `parse()` returns a structurally-equivalent type
// but tsconfig's `exactOptionalPropertyTypes` distinguishes `prop?: T` from
// `prop?: T | undefined`, so we re-narrow to the canonical alias.
const PARSED_SIM_CONFIG = DashboardConfigSchema.parse({
  version: CURRENT_SCHEMA_VERSION,
  name: 'CANShift Demo',
  description: 'Coherent 4-page demo dashboard — overview, engine, fluids, controls',
  defaultPageId: 'overview',
  revLimitRpm: 7200,
  topBar: {
    height: 16,
    bgColor: '#0D0D0D',
    textColor: '#AAAAAA',
  },
  pages: [
    // -----------------------------------------------------------------------
    // Page 1 — Overview
    // -----------------------------------------------------------------------
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
          layout: { x: 0, y: 0, w: 160, h: 112, zOrder: 0 },
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
          id: 'coolant_arc',
          type: 'gauge',
          signal: 'coolant_temp_c',
          layout: { x: 160, y: 0, w: 160, h: 112, zOrder: 0 },
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
          id: 'iat_overview_l',
          type: 'gauge',
          signal: 'iat_c',
          layout: { x: 0, y: 112, w: 160, h: 56, zOrder: 0 },
          style: DEMO_STYLE_NEUTRAL,
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
        {
          id: 'oil_press_l',
          type: 'gauge',
          signal: 'oil_press_bar',
          layout: { x: 160, y: 112, w: 160, h: 56, zOrder: 0 },
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
          id: 'battery_l',
          type: 'gauge',
          signal: 'battery_volts',
          layout: { x: 0, y: 168, w: 160, h: 56, zOrder: 0 },
          style: DEMO_STYLE_NEUTRAL,
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
          id: 'lambda_overview_l',
          type: 'gauge',
          signal: 'lambda_1',
          layout: { x: 160, y: 168, w: 160, h: 56, zOrder: 0 },
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
      ],
    },

    // -----------------------------------------------------------------------
    // Page 2 — Engine
    // -----------------------------------------------------------------------
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
          layout: { x: 0, y: 0, w: 160, h: 112, zOrder: 0 },
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
          layout: { x: 160, y: 0, w: 160, h: 112, zOrder: 0 },
          style: { ...DEMO_STYLE_RED, fontSize: 48 },
          config: { type: 'gear', decimalPlaces: 0 },
        },
        {
          id: 'lambda_l',
          type: 'gauge',
          signal: 'lambda_1',
          layout: { x: 0, y: 112, w: 160, h: 56, zOrder: 0 },
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
          id: 'rpm_l',
          type: 'gauge',
          signal: 'rpm',
          layout: { x: 160, y: 112, w: 160, h: 56, zOrder: 0 },
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
          layout: { x: 0, y: 168, w: 160, h: 56, zOrder: 0 },
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
          id: 'battery_engine_l',
          type: 'gauge',
          signal: 'battery_volts',
          layout: { x: 160, y: 168, w: 160, h: 56, zOrder: 0 },
          style: DEMO_STYLE_NEUTRAL,
          config: {
            type: 'gauge',
            displayStyle: 'numeric',
            iconName: 'battery',
            minValue: 10,
            maxValue: 15,
            dangerLevel: 11,
            decimalPlaces: 1,
          },
        },
      ],
    },

    // -----------------------------------------------------------------------
    // Page 3 — Fluids
    // -----------------------------------------------------------------------
    {
      id: 'fluids',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      palette: { ...DEFAULT_PAGE_PALETTE },
      widgets: [
        {
          id: 'fluids_coolant_arc',
          type: 'gauge',
          signal: 'coolant_temp_c',
          layout: { x: 0, y: 0, w: 160, h: 112, zOrder: 0 },
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
          id: 'fluids_oil_press_arc',
          type: 'gauge',
          signal: 'oil_press_bar',
          layout: { x: 160, y: 0, w: 160, h: 112, zOrder: 0 },
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
          id: 'fluids_oil_temp_l',
          type: 'gauge',
          signal: 'oil_temp_c',
          layout: { x: 0, y: 112, w: 160, h: 56, zOrder: 0 },
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
          id: 'fluids_fuel_press_l',
          type: 'gauge',
          signal: 'fuel_press_bar',
          layout: { x: 160, y: 112, w: 160, h: 56, zOrder: 0 },
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
        {
          id: 'fluids_battery_l',
          type: 'gauge',
          signal: 'battery_volts',
          layout: { x: 0, y: 168, w: 160, h: 56, zOrder: 0 },
          style: DEMO_STYLE_NEUTRAL,
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
          id: 'fluids_iat_l',
          type: 'gauge',
          signal: 'iat_c',
          layout: { x: 160, y: 168, w: 160, h: 56, zOrder: 0 },
          style: DEMO_STYLE_NEUTRAL,
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

    // -----------------------------------------------------------------------
    // Page 4 — Controls (buttons)
    // -----------------------------------------------------------------------
    {
      id: 'controls',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      palette: { ...DEFAULT_PAGE_PALETTE },
      widgets: [
        {
          id: 'btn_map1',
          type: 'button',
          signal: '',
          layout: { x: 0, y: 0, w: 160, h: 112, zOrder: 0 },
          style: DEMO_STYLE_BUTTON,
          config: {
            type: 'button',
            label: 'MAP 1',
            iconName: 'map_icon',
            showLabel: true,
            showIcon: true,
            isToggle: false,
            colors: DEMO_BUTTON_COLORS_MAP,
            actions: [{ category: 'ecu', type: 'map_switch', mapIndex: 1 }],
          },
        },
        {
          id: 'btn_map2',
          type: 'button',
          signal: '',
          layout: { x: 160, y: 0, w: 160, h: 112, zOrder: 0 },
          style: DEMO_STYLE_BUTTON,
          config: {
            type: 'button',
            label: 'MAP 2',
            iconName: 'map_icon',
            showLabel: true,
            showIcon: true,
            isToggle: false,
            colors: DEMO_BUTTON_COLORS_MAP,
            actions: [{ category: 'ecu', type: 'map_switch', mapIndex: 2 }],
          },
        },
        {
          id: 'btn_launch',
          type: 'button',
          signal: 'flag_launch_ctrl',
          layout: { x: 0, y: 112, w: 160, h: 112, zOrder: 0 },
          style: DEMO_STYLE_BUTTON,
          config: {
            type: 'button',
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
          layout: { x: 160, y: 112, w: 160, h: 112, zOrder: 0 },
          style: DEMO_STYLE_BUTTON,
          config: {
            type: 'button',
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
