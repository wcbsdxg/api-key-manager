const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  db: {
    init: (masterPassword) => ipcRenderer.invoke('db:init', masterPassword),
    verify: (masterPassword) => ipcRenderer.invoke('db:verify', masterPassword),
    isInitialized: () => ipcRenderer.invoke('db:isInitialized'),
  },
  apiKeys: {
    getAll: (filters) => ipcRenderer.invoke('api-keys:getAll', filters),
    create: (data) => ipcRenderer.invoke('api-keys:create', data),
    update: (id, data) => ipcRenderer.invoke('api-keys:update', { id, ...data }),
    delete: (id) => ipcRenderer.invoke('api-keys:delete', id),
    reveal: (id) => ipcRenderer.invoke('api-keys:reveal', id),
    test: (id) => ipcRenderer.invoke('api-keys:test', id),
    checkQuota: (id) => ipcRenderer.invoke('api-keys:checkQuota', id),
    getTestLogs: (id) => ipcRenderer.invoke('api-keys:getTestLogs', id),
  },
  clipboard: {
    copy: (text) => ipcRenderer.invoke('clipboard:copy', text),
  },
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    create: (name) => ipcRenderer.invoke('categories:create', name),
  },
  exportData: () => ipcRenderer.invoke('export:json'),
  importData: () => ipcRenderer.invoke('import:json'),
  master: {
    change: (oldPassword, newPassword) => ipcRenderer.invoke('master:change', { oldPassword, newPassword }),
  }
});
