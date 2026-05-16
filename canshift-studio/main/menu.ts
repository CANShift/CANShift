// menu.ts — Native Electron application menu.
// File operations dispatch IPC events that the renderer listens for.

import { Menu, BrowserWindow, app, dialog } from 'electron'
import { basename } from 'node:path'
import { IpcChannels } from '../shared/ipc-channels'
import { sessionService } from './services/session.service'

export function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  const recentFiles = sessionService.getRecentFiles()

  const recentSubmenu: Electron.MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? [
          ...recentFiles.map((filePath) => ({
            label: basename(filePath),
            click: () => {
              win.webContents.send(IpcChannels.CONFIG_OPEN_PATH, filePath)
            },
          })),
          { type: 'separator' as const },
          {
            label: 'Clear Recent Files',
            click: () => {
              sessionService.clearRecentFiles()
              buildMenu(win)
            },
          },
        ]
      : [{ label: 'No recent files', enabled: false }]

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Config…',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            win.webContents.send(IpcChannels.CONFIG_OPEN)
          },
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            win.webContents.send(IpcChannels.CONFIG_SAVE)
          },
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            win.webContents.send(IpcChannels.CONFIG_SAVE_AS)
          },
        },
        { type: 'separator' },
        {
          label: 'Import Dashboard…',
          click: () => {
            win.webContents.send(IpcChannels.CONFIG_IMPORT)
          },
        },
        {
          label: 'Export Dashboard…',
          click: () => {
            win.webContents.send(IpcChannels.CONFIG_EXPORT)
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            win.webContents.send(IpcChannels.HISTORY_UNDO)
          },
        },
        {
          label: 'Redo',
          accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y',
          click: () => {
            win.webContents.send(IpcChannels.HISTORY_REDO)
          },
        },
        { type: 'separator' },
        {
          label: 'Duplicate',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            win.webContents.send(IpcChannels.EDIT_DUPLICATE)
          },
        },
        { type: 'separator' },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Reset First-Run Onboarding',
          click: () => {
            sessionService.resetFirstRun()
            void dialog.showMessageBox(win, {
              type: 'info',
              message: 'First-run onboarding has been reset.',
              detail: 'Restart CANShift Studio to see the welcome flow again.',
              buttons: ['OK'],
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
