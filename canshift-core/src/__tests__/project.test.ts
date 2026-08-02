import { ProjectSchema, PROJECT_FILE_VERSION } from '../index.js'

const minimalDashboard = {
  version: '1.26.0',
  name: 'Test',
  defaultPageId: 'p1',
  revLimitRpm: 7000,
  topBar: { height: 16, bgColor: '#000000', textColor: '#FFFFFF' },
  pages: [
    {
      id: 'p1',
      backgroundImage: null,
      backgroundColor: '#000000',
      showTopBar: true,
      visible: true,
      widgets: [],
    },
  ],
}

const validProject = {
  projectVersion: PROJECT_FILE_VERSION,
  id: 'proj_1',
  name: 'My car',
  createdAt: '2026-08-02T12:00:00.000Z',
  updatedAt: '2026-08-02T12:00:00.000Z',
  dashboard: minimalDashboard,
  ecuProfileKey: 'builtin:maxxecu-street',
  signals: [],
}

describe('ProjectSchema', () => {
  it('accepts a project composing dashboard + profile + signals', () => {
    expect(ProjectSchema.safeParse(validProject).success).toBe(true)
  })

  it('rejects unknown keys (strict)', () => {
    expect(ProjectSchema.safeParse({ ...validProject, extra: 1 }).success).toBe(false)
  })

  it('rejects an empty name and a bad timestamp', () => {
    expect(ProjectSchema.safeParse({ ...validProject, name: '' }).success).toBe(false)
    expect(ProjectSchema.safeParse({ ...validProject, createdAt: 'yesterday' }).success).toBe(false)
  })
})
