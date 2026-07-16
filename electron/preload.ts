import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  getStoreValue: (key: string) => Promise<unknown>
  setStoreValue: (key: string, value: unknown) => Promise<void>
  deleteStoreValue: (key: string) => Promise<void>
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  openExternal: (url: string) => Promise<void>
  quit: () => Promise<void>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  checkForUpdate: () => Promise<void>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => Promise<void>
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => void
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; speed: number }) => void) => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void
  onUpdateError: (callback: (err: { message: string }) => void) => void
}

const electronAPI: ElectronAPI = {
  getStoreValue: (key: string) => ipcRenderer.invoke('app:getStoreValue', key),
  setStoreValue: (key: string, value: unknown) => ipcRenderer.invoke('app:setStoreValue', key, value),
  deleteStoreValue: (key: string) => ipcRenderer.invoke('app:deleteStoreValue', key),
  showWindow: () => ipcRenderer.invoke('app:showWindow'),
  hideWindow: () => ipcRenderer.invoke('app:hideWindow'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  quit: () => ipcRenderer.invoke('app:quit'),
  minimizeWindow: () => ipcRenderer.invoke('app:minimizeWindow'),
  maximizeWindow: () => ipcRenderer.invoke('app:maximizeWindow'),
  closeWindow: () => ipcRenderer.invoke('app:closeWindow'),
  checkForUpdate: () => ipcRenderer.invoke('app:checkForUpdate'),
  downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
  quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, err) => callback(err)),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
