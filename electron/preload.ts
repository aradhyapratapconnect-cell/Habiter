// Preload script: the only bridge between the renderer and the main process.
//
// Exposes a typed, read-only API on window.habiterAPI via contextBridge. The
// renderer has no direct Node.js access (contextIsolation is on, nodeIntegration
// off in electron/main.ts) — every method here proxies to the matching
// ipcMain.handle channel in electron/ipc/handlers.ts, and only the channels
// declared on HabiterAPI are reachable.

import { contextBridge, ipcRenderer } from 'electron';
import type { HabiterAPI } from '../src/types/index.js';

const api: HabiterAPI = {
  habits: {
    create: (input) => ipcRenderer.invoke('habits:create', input),
    list: (options) => ipcRenderer.invoke('habits:list', options),
    get: (id) => ipcRenderer.invoke('habits:get', id),
    update: (id, changes) => ipcRenderer.invoke('habits:update', id, changes),
    delete: (id) => ipcRenderer.invoke('habits:delete', id),
  },
  categories: {
    create: (input) => ipcRenderer.invoke('categories:create', input),
    list: () => ipcRenderer.invoke('categories:list'),
    update: (id, changes) => ipcRenderer.invoke('categories:update', id, changes),
    delete: (id) => ipcRenderer.invoke('categories:delete', id),
  },
  checkins: {
    set: (habitId, date, status) => ipcRenderer.invoke('checkins:set', habitId, date, status),
    get: (habitId, date) => ipcRenderer.invoke('checkins:get', habitId, date),
    list: (filter) => ipcRenderer.invoke('checkins:list', filter),
    delete: (habitId, date) => ipcRenderer.invoke('checkins:delete', habitId, date),
  },
  dailyLogs: {
    get: (date) => ipcRenderer.invoke('dailyLogs:get', date),
    set: (date, input) => ipcRenderer.invoke('dailyLogs:set', date, input),
    list: () => ipcRenderer.invoke('dailyLogs:list'),
    delete: (date) => ipcRenderer.invoke('dailyLogs:delete', date),
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    delete: (key) => ipcRenderer.invoke('settings:delete', key),
  },
  export: {
    json: () => ipcRenderer.invoke('export:json'),
    csv: () => ipcRenderer.invoke('export:csv'),
  },
  import: {
    json: () => ipcRenderer.invoke('import:json'),
  },
};

contextBridge.exposeInMainWorld('habiterAPI', api);
