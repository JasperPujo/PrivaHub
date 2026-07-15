import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { autoUpdater } from 'electron-updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 单实例锁定：防止打开多个窗口
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

// 简单的内存存储（替代 electron-store，数据库部分由用户自行实现）
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

  // 禁用缓存，确保开发模式下始终加载最新代码
  mainWindow.webContents.session.clearCache()

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const distPath = path.join(__dirname, '../dist/index.html')
  // 只有 dist/index.html 确实存在 且 是打包后的应用，才加载本地文件
  // 开发模式下 dist 目录通常不存在，一律加载 dev server
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
    {
      label: '打开工作台',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}

// ========== 自动更新 ==========
function setupAutoUpdater(): void {
  // 只在打包后生效
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('download-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      speed: progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', {
      version: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', {
      message: err.message
    })
  })

  // 应用启动后 3 秒自动检查一次
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 3000)
}

app.whenReady().then(() => {
  // 移除默认菜单栏
  Menu.setApplicationMenu(null)
  
  createWindow()
  createTray()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  // 保留托盘运行
})

app.on('before-quit', () => {
  mainWindow?.destroy()
})

// IPC 通信
ipcMain.handle('app:getStoreValue', (_event, key: string) => {
  return appStore[key]
})

ipcMain.handle('app:setStoreValue', (_event, key: string, value: unknown) => {
  appStore[key] = value
})

ipcMain.handle('app:deleteStoreValue', (_event, key: string) => {
  delete appStore[key]
})

ipcMain.handle('app:showWindow', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
})

ipcMain.handle('app:hideWindow', () => {
  mainWindow?.hide()
})

ipcMain.handle('app:openExternal', (_event, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('app:quit', () => {
  app.quit()
})

ipcMain.handle('app:minimizeWindow', () => {
  mainWindow?.minimize()
})

ipcMain.handle('app:maximizeWindow', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('app:closeWindow', () => {
  mainWindow?.close()
})

// 更新相关 IPC
ipcMain.handle('app:checkForUpdate', () => {
  return autoUpdater.checkForUpdates()
})

ipcMain.handle('app:quitAndInstall', () => {
  autoUpdater.quitAndInstall()
})