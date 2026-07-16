import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { autoUpdater } from 'electron-updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

const appStore: Record<string, unknown> = {}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'PrivaHub',
    icon: path.join(__dirname, '../build/icon.png'),
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    },
    backgroundColor: '#F7F7F8'
  })

  mainWindow.webContents.session.clearCache()

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const distPath = path.join(__dirname, '../dist/index.html')
  if (fs.existsSync(distPath) && app.isPackaged) {
    mainWindow.loadFile(distPath)
  } else {
    mainWindow.loadURL(devServerUrl)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, '../build/icon.png'))
  tray = new Tray(trayIcon)
  tray.setToolTip('PrivaHub')
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开工作台', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } else { createWindow() } } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit() } }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } else { createWindow() } })
}

function setupAutoUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', { version: info.version, releaseNotes: info.releaseNotes })
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('download-progress', { percent: Math.round(progress.percent), transferred: progress.transferred, total: progress.total, speed: progress.bytesPerSecond })
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', { version: info.version })
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', { message: err.message })
  })
  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}) }, 3000)
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  createTray()
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { createWindow() } else if (mainWindow) { mainWindow.show() }
  })
})

app.on('window-all-closed', () => {})
app.on('before-quit', () => { mainWindow?.destroy() })

// IPC
ipcMain.handle('app:getStoreValue', (_event, key: string) => appStore[key])
ipcMain.handle('app:setStoreValue', (_event, key: string, value: unknown) => { appStore[key] = value })
ipcMain.handle('app:deleteStoreValue', (_event, key: string) => { delete appStore[key] })
ipcMain.handle('app:showWindow', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
ipcMain.handle('app:hideWindow', () => { mainWindow?.hide() })
ipcMain.handle('app:openExternal', (_event, url: string) => { shell.openExternal(url) })
ipcMain.handle('app:quit', () => { app.quit() })
ipcMain.handle('app:minimizeWindow', () => { mainWindow?.minimize() })
ipcMain.handle('app:maximizeWindow', () => { if (mainWindow?.isMaximized()) { mainWindow.unmaximize() } else { mainWindow?.maximize() } })
ipcMain.handle('app:closeWindow', () => { mainWindow?.close() })
ipcMain.handle('app:checkForUpdate', () => autoUpdater.checkForUpdates())
ipcMain.handle('app:downloadUpdate', () => autoUpdater.downloadUpdate())
ipcMain.handle('app:quitAndInstall', () => autoUpdater.quitAndInstall())
