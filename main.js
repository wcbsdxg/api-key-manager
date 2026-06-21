const { app, BrowserWindow, ipcMain, clipboard, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('./database');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  db = new Database();
  createWindow();
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC Handlers
ipcMain.handle('db:init', async (event, masterPassword) => {
  try {
    console.log('Initializing database...');
    await db.initialize(masterPassword);
    console.log('Database initialized successfully');
    return { success: true };
  } catch (err) {
    console.error('Database initialization error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:verify', async (event, masterPassword) => {
  try {
    const valid = await db.verifyPassword(masterPassword);
    return { success: valid };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:isInitialized', async () => {
  return db.isInitialized();
});

ipcMain.handle('api-keys:getAll', async (event, { search, category, environment }) => {
  try {
    const keys = db.getApiKeys({ search, category, environment });
    return { success: true, data: keys };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api-keys:create', async (event, keyData) => {
  try {
    const id = db.createApiKey(keyData);
    return { success: true, data: { id } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api-keys:update', async (event, { id, ...keyData }) => {
  try {
    db.updateApiKey(id, keyData);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api-keys:delete', async (event, id) => {
  try {
    db.deleteApiKey(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api-keys:reveal', async (event, id) => {
  try {
    const key = db.revealApiKey(id);
    return { success: true, data: key };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clipboard:copy', async (event, text) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('categories:getAll', async () => {
  try {
    const categories = db.getCategories();
    return { success: true, data: categories };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('categories:create', async (event, name) => {
  try {
    const id = db.createCategory(name);
    return { success: true, data: { id } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export:json', async () => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'api-keys-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (filePath) {
      const data = db.exportData();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { success: true };
    }
    return { success: false, cancelled: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import:json', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (filePaths.length > 0) {
      const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
      const count = db.importData(data);
      return { success: true, data: { count } };
    }
    return { success: false, cancelled: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('master:change', async (event, { oldPassword, newPassword }) => {
  try {
    db.changeMasterPassword(oldPassword, newPassword);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Test API connectivity
ipcMain.handle('api-keys:test', async (event, id) => {
  try {
    const apiKeyData = db.getApiKeyDetail(id);

    if (!apiKeyData.testEndpoint) {
      return { success: false, error: '未配置测试端点' };
    }

    const startTime = Date.now();

    const headers = {
      'Content-Type': 'application/json'
    };

    // Parse custom headers
    if (apiKeyData.testHeaders) {
      try {
        const customHeaders = JSON.parse(apiKeyData.testHeaders);
        Object.assign(headers, customHeaders);
      } catch (e) {
        // Ignore invalid JSON headers
      }
    }

    // Replace {API_KEY} placeholder in headers
    const headerStr = JSON.stringify(headers).replace(/\{API_KEY\}/g, apiKeyData.key);
    const finalHeaders = JSON.parse(headerStr);

    const url = apiKeyData.testEndpoint.replace(/\{API_KEY\}/g, apiKeyData.key);

    return new Promise((resolve) => {
      const request = net.request({
        method: apiKeyData.testMethod || 'GET',
        url: url,
        headers: finalHeaders
      });

      let responseBody = '';

      request.on('response', (response) => {
        const responseTime = Date.now() - startTime;

        response.on('data', (chunk) => {
          responseBody += chunk.toString();
        });

        response.on('end', () => {
          const success = response.statusCode >= 200 && response.statusCode < 300;
          const preview = responseBody.substring(0, 500);

          db.addTestLog(id, 'connectivity', response.statusCode, responseTime, success, null, preview);

          resolve({
            success: true,
            data: {
              statusCode: response.statusCode,
              responseTime,
              success,
              preview
            }
          });
        });
      });

      request.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        db.addTestLog(id, 'connectivity', 0, responseTime, false, error.message, null);

        resolve({
          success: true,
          data: {
            statusCode: 0,
            responseTime,
            success: false,
            error: error.message
          }
        });
      });

      request.end();
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Check API quota/usage
ipcMain.handle('api-keys:checkQuota', async (event, id) => {
  try {
    const apiKeyData = db.getApiKeyDetail(id);

    if (!apiKeyData.quotaEndpoint) {
      return { success: false, error: '未配置余量查询端点' };
    }

    const startTime = Date.now();

    const headers = {
      'Content-Type': 'application/json'
    };

    // Parse custom headers
    if (apiKeyData.testHeaders) {
      try {
        const customHeaders = JSON.parse(apiKeyData.testHeaders);
        Object.assign(headers, customHeaders);
      } catch (e) {
        // Ignore invalid JSON headers
      }
    }

    const headerStr = JSON.stringify(headers).replace(/\{API_KEY\}/g, apiKeyData.key);
    const finalHeaders = JSON.parse(headerStr);

    const url = apiKeyData.quotaEndpoint.replace(/\{API_KEY\}/g, apiKeyData.key);

    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: url,
        headers: finalHeaders
      });

      let responseBody = '';

      request.on('response', (response) => {
        const responseTime = Date.now() - startTime;

        response.on('data', (chunk) => {
          responseBody += chunk.toString();
        });

        response.on('end', () => {
          const success = response.statusCode >= 200 && response.statusCode < 300;
          let quotaInfo = null;

          if (success && apiKeyData.quotaJsonPath) {
            try {
              const json = JSON.parse(responseBody);
              const paths = apiKeyData.quotaJsonPath.split('.');
              let value = json;
              for (const p of paths) {
                if (p.includes('[')) {
                  const [key, index] = p.split('[');
                  value = value[key][parseInt(index)];
                } else {
                  value = value[p];
                }
              }
              quotaInfo = value;
            } catch (e) {
              quotaInfo = '解析失败: ' + e.message;
            }
          }

          const preview = responseBody.substring(0, 500);
          db.addTestLog(id, 'quota', response.statusCode, responseTime, success, null, preview);

          resolve({
            success: true,
            data: {
              statusCode: response.statusCode,
              responseTime,
              success,
              quotaInfo,
              preview
            }
          });
        });
      });

      request.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        db.addTestLog(id, 'quota', 0, responseTime, false, error.message, null);

        resolve({
          success: true,
          data: {
            statusCode: 0,
            responseTime,
            success: false,
            error: error.message
          }
        });
      });

      request.end();
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Get test logs
ipcMain.handle('api-keys:getTestLogs', async (event, id) => {
  try {
    const logs = db.getTestLogs(id);
    return { success: true, data: logs };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
