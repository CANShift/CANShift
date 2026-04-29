// defaultSimConfig.ts — Base dashboard config loaded in simulation mode

import type { DashboardConfig } from '@tmbk/canshift-core'

export const DEFAULT_SIM_CONFIG: DashboardConfig = {
  version: '1.0.0',
  name: 'VR6 Main Dash',
  description: 'Default dashboard configuration for VW VR6 2.9 with MaxxECU Street',
  defaultPageId: 'main',
  revLimitRpm: 7200,
  topBar: {
    height: 24,
    showMapName: true,
    showMapProfile: false,
    bgColor: '#0D0D0D',
    textColor: '#AAAAAA',
  },
  pages: [
    {
      id: 'main',
      name: 'Main',
      backgroundImage: null,
      backgroundColor: '#111111',
      showTopBar: true,
      widgets: [
        {
          id: 'rpm_gauge',
          type: 'gauge',
          signal: 'rpm',
          layout: { x: 2, y: 0, w: 156, h: 140, zOrder: 0 },
          style: {
            primaryColor: '#FF4444',
            secondaryColor: '#2A2A2A',
            warningColor: '#FF8800',
            criticalColor: '#FF0000',
            textColor: '#FFFFFF',
            fontSize: 32,
          },
          config: {
            type: 'gauge',
            minValue: 0,
            maxValue: 8000,
            warningLevel: 6500,
            dangerLevel: 7200,
            showNeedle: false,
            showArc: true,
          },
        },
        {
          id: 'speed_label',
          type: 'label',
          signal: 'speed_kph',
          layout: { x: 160, y: 0, w: 158, h: 80, zOrder: 0 },
          style: {
            textColor: '#FFFFFF',
            primaryColor: '#FFFFFF',
            secondaryColor: '#333333',
            warningColor: '#FF8800',
            criticalColor: '#FF0000',
            fontSize: 48,
          },
          config: { type: 'label', decimalPlaces: 0, prefix: '', suffix: '', hideWhenInvalid: false },
        },
        {
          id: 'coolant_temp',
          type: 'label',
          signal: 'coolant_temp_c',
          layout: { x: 0, y: 144, w: 80, h: 48, zOrder: 0 },
          style: {
            textColor: '#44AAFF',
            primaryColor: '#44AAFF',
            secondaryColor: '#333333',
            warningColor: '#FF8800',
            criticalColor: '#FF0000',
            fontSize: 20,
          },
          config: { type: 'label', decimalPlaces: 0, prefix: '', suffix: '°C', hideWhenInvalid: false },
        },
        {
          id: 'oil_temp',
          type: 'label',
          signal: 'oil_temp_c',
          layout: { x: 80, y: 144, w: 80, h: 48, zOrder: 0 },
          style: {
            textColor: '#FF8800',
            primaryColor: '#FF8800',
            secondaryColor: '#333333',
            warningColor: '#FF8800',
            criticalColor: '#FF0000',
            fontSize: 20,
          },
          config: { type: 'label', decimalPlaces: 0, prefix: '', suffix: '°', hideWhenInvalid: false },
        },
      ],
    },
  ],
}
