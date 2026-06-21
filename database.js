const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

class Database {
  constructor() {
    this.data = null;
    this.masterKey = null;
    this._dbPath = null;
  }

  getDbPath() {
    if (!this._dbPath) {
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      this._dbPath = path.join(userDataPath, 'api-keys.json');
    }
    return this._dbPath;
  }

  load() {
    const dbPath = this.getDbPath();
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      this.data = JSON.parse(raw);
    } else {
      this.data = {
        masterConfig: null,
        categories: [],
        apiKeys: [],
        testLogs: [],
        nextId: { category: 1, apiKey: 1, testLog: 1 }
      };
    }
  }

  save() {
    fs.writeFileSync(this.getDbPath(), JSON.stringify(this.data, null, 2));
  }

  async initialize(masterPassword) {
    this.load();

    const salt = crypto.randomBytes(32).toString('hex');
    const hash = this.hashPassword(masterPassword, salt);

    this.data.masterConfig = { passwordHash: hash, salt };
    this.masterKey = this.deriveKey(masterPassword);

    this.save();
  }

  isInitialized() {
    const dbPath = this.getDbPath();
    if (!fs.existsSync(dbPath)) return false;
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const data = JSON.parse(raw);
      return data.masterConfig !== null;
    } catch {
      return false;
    }
  }

  async verifyPassword(masterPassword) {
    this.load();

    if (!this.data.masterConfig) return false;

    const { passwordHash, salt } = this.data.masterConfig;
    const hash = this.hashPassword(masterPassword, salt);

    if (hash === passwordHash) {
      this.masterKey = this.deriveKey(masterPassword);
      return true;
    }
    return false;
  }

  deriveKey(password) {
    const salt = 'api-key-manager-salt-v1';
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha512');
  }

  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  }

  encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encrypted, iv, tag) {
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  getApiKeys({ search, category, environment } = {}) {
    let keys = [...this.data.apiKeys];

    if (search) {
      const term = search.toLowerCase();
      keys = keys.filter(k =>
        k.name.toLowerCase().includes(term) ||
        (k.url && k.url.toLowerCase().includes(term)) ||
        (k.notes && k.notes.toLowerCase().includes(term))
      );
    }

    if (category) {
      keys = keys.filter(k => k.categoryId === category);
    }

    if (environment) {
      keys = keys.filter(k => k.environment === environment);
    }

    keys.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return keys.map(k => ({
      id: k.id,
      name: k.name,
      environment: k.environment,
      url: k.url,
      notes: k.notes,
      testEndpoint: k.testEndpoint,
      testMethod: k.testMethod,
      testHeaders: k.testHeaders,
      quotaEndpoint: k.quotaEndpoint,
      quotaJsonPath: k.quotaJsonPath,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
      categoryName: this.data.categories.find(c => c.id === k.categoryId)?.name || null,
      categoryId: k.categoryId,
      masked: true
    }));
  }

  createApiKey({ name, key, categoryId, environment, url, notes, testEndpoint, testMethod, testHeaders, quotaEndpoint, quotaJsonPath }) {
    const { encrypted, iv, tag } = this.encrypt(key);
    const id = this.data.nextId.apiKey++;
    const now = new Date().toISOString();

    this.data.apiKeys.push({
      id,
      name,
      encryptedKey: encrypted,
      iv,
      tag,
      categoryId: categoryId || null,
      environment: environment || 'development',
      url: url || null,
      notes: notes || null,
      testEndpoint: testEndpoint || null,
      testMethod: testMethod || 'GET',
      testHeaders: testHeaders || null,
      quotaEndpoint: quotaEndpoint || null,
      quotaJsonPath: quotaJsonPath || null,
      createdAt: now,
      updatedAt: now
    });

    this.save();
    return id;
  }

  updateApiKey(id, { name, key, categoryId, environment, url, notes, testEndpoint, testMethod, testHeaders, quotaEndpoint, quotaJsonPath }) {
    const idx = this.data.apiKeys.findIndex(k => k.id === id);
    if (idx === -1) throw new Error('API key not found');

    const existing = this.data.apiKeys[idx];

    if (key) {
      const { encrypted, iv, tag } = this.encrypt(key);
      existing.encryptedKey = encrypted;
      existing.iv = iv;
      existing.tag = tag;
    }

    existing.name = name;
    existing.categoryId = categoryId || null;
    existing.environment = environment;
    existing.url = url || null;
    existing.notes = notes || null;
    existing.testEndpoint = testEndpoint || null;
    existing.testMethod = testMethod || 'GET';
    existing.testHeaders = testHeaders || null;
    existing.quotaEndpoint = quotaEndpoint || null;
    existing.quotaJsonPath = quotaJsonPath || null;
    existing.updatedAt = new Date().toISOString();

    this.save();
  }

  deleteApiKey(id) {
    this.data.apiKeys = this.data.apiKeys.filter(k => k.id !== id);
    this.data.testLogs = this.data.testLogs.filter(l => l.apiKeyId !== id);
    this.save();
  }

  revealApiKey(id) {
    const key = this.data.apiKeys.find(k => k.id === id);
    if (!key) throw new Error('API key not found');
    return this.decrypt(key.encryptedKey, key.iv, key.tag);
  }

  getCategories() {
    return this.data.categories.map(c => ({ id: c.id, name: c.name }));
  }

  createCategory(name) {
    const id = this.data.nextId.category++;
    this.data.categories.push({ id, name, createdAt: new Date().toISOString() });
    this.save();
    return id;
  }

  getApiKeyDetail(id) {
    const key = this.data.apiKeys.find(k => k.id === id);
    if (!key) throw new Error('API key not found');

    return {
      id: key.id,
      name: key.name,
      key: this.decrypt(key.encryptedKey, key.iv, key.tag),
      environment: key.environment,
      url: key.url,
      notes: key.notes,
      testEndpoint: key.testEndpoint,
      testMethod: key.testMethod,
      testHeaders: key.testHeaders,
      quotaEndpoint: key.quotaEndpoint,
      quotaJsonPath: key.quotaJsonPath,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
      categoryName: this.data.categories.find(c => c.id === key.categoryId)?.name || null,
      categoryId: key.categoryId
    };
  }

  addTestLog(apiKeyId, testType, statusCode, responseTime, success, errorMessage, responsePreview) {
    this.data.testLogs.push({
      id: this.data.nextId.testLog++,
      apiKeyId,
      testType,
      statusCode,
      responseTime,
      success,
      errorMessage: errorMessage || null,
      responsePreview: responsePreview || null,
      testedAt: new Date().toISOString()
    });
    this.save();
  }

  getTestLogs(apiKeyId, limit = 10) {
    return this.data.testLogs
      .filter(l => l.apiKeyId === apiKeyId)
      .sort((a, b) => new Date(b.testedAt) - new Date(a.testedAt))
      .slice(0, limit)
      .map(l => ({
        id: l.id,
        testType: l.testType,
        statusCode: l.statusCode,
        responseTime: l.responseTime,
        success: l.success,
        errorMessage: l.errorMessage,
        responsePreview: l.responsePreview,
        testedAt: l.testedAt
      }));
  }

  exportData() {
    const exportedKeys = this.data.apiKeys.map(k => ({
      name: k.name,
      key: this.decrypt(k.encryptedKey, k.iv, k.tag),
      environment: k.environment,
      url: k.url,
      notes: k.notes,
      category: this.data.categories.find(c => c.id === k.categoryId)?.name || null,
      testEndpoint: k.testEndpoint,
      testMethod: k.testMethod,
      testHeaders: k.testHeaders,
      quotaEndpoint: k.quotaEndpoint,
      quotaJsonPath: k.quotaJsonPath
    }));

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      categories: this.data.categories.map(c => c.name),
      apiKeys: exportedKeys
    };
  }

  importData(data) {
    let count = 0;

    if (data.categories) {
      for (const name of data.categories) {
        if (!this.data.categories.find(c => c.name === name)) {
          this.data.categories.push({
            id: this.data.nextId.category++,
            name,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    if (data.apiKeys) {
      for (const key of data.apiKeys) {
        const category = this.data.categories.find(c => c.name === key.category);
        const { encrypted, iv, tag } = this.encrypt(key.key);
        const now = new Date().toISOString();

        this.data.apiKeys.push({
          id: this.data.nextId.apiKey++,
          name: key.name,
          encryptedKey: encrypted,
          iv,
          tag,
          categoryId: category?.id || null,
          environment: key.environment || 'development',
          url: key.url || null,
          notes: key.notes || null,
          testEndpoint: key.testEndpoint || null,
          testMethod: key.testMethod || 'GET',
          testHeaders: key.testHeaders || null,
          quotaEndpoint: key.quotaEndpoint || null,
          quotaJsonPath: key.quotaJsonPath || null,
          createdAt: now,
          updatedAt: now
        });
        count++;
      }
    }

    this.save();
    return count;
  }

  changeMasterPassword(oldPassword, newPassword) {
    const { passwordHash, salt } = this.data.masterConfig;
    const oldHash = this.hashPassword(oldPassword, salt);

    if (oldHash !== passwordHash) {
      throw new Error('Invalid old password');
    }

    const newKey = this.deriveKey(newPassword);

    for (const key of this.data.apiKeys) {
      const decrypted = this.decrypt(key.encryptedKey, key.iv, key.tag);
      this.masterKey = newKey;
      const { encrypted, iv, tag } = this.encrypt(decrypted);
      key.encryptedKey = encrypted;
      key.iv = iv;
      key.tag = tag;
    }

    const newSalt = crypto.randomBytes(32).toString('hex');
    const newHash = this.hashPassword(newPassword, newSalt);
    this.data.masterConfig = { passwordHash: newHash, salt: newSalt };

    this.masterKey = newKey;
    this.save();
  }

  close() {
    if (this.data) {
      this.save();
    }
  }
}

module.exports = Database;
