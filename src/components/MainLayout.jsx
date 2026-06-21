import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ApiKeyList from './ApiKeyList';
import ApiKeyForm from './ApiKeyForm';
import SettingsModal from './SettingsModal';

export default function MainLayout() {
  const [apiKeys, setApiKeys] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedEnvironment, searchQuery]);

  const loadData = async () => {
    const [keysResult, catsResult] = await Promise.all([
      window.api.apiKeys.getAll({
        search: searchQuery,
        category: selectedCategory,
        environment: selectedEnvironment
      }),
      window.api.categories.getAll()
    ]);

    if (keysResult.success) setApiKeys(keysResult.data);
    if (catsResult.success) setCategories(catsResult.data);
  };

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreate = async (data) => {
    const result = await window.api.apiKeys.create(data);
    if (result.success) {
      setShowForm(false);
      loadData();
      notify('API Key 已创建');
    }
  };

  const handleUpdate = async (id, data) => {
    const result = await window.api.apiKeys.update(id, data);
    if (result.success) {
      setShowForm(false);
      setEditingKey(null);
      loadData();
      notify('API Key 已更新');
    }
  };

  const handleDelete = async (id) => {
    const result = await window.api.apiKeys.delete(id);
    if (result.success) {
      loadData();
      notify('API Key 已删除');
    }
  };

  const handleCopy = async (id) => {
    const result = await window.api.apiKeys.reveal(id);
    if (result.success) {
      await window.api.clipboard.copy(result.data);
      notify('已复制到剪贴板');
    }
  };

  const handleExport = async () => {
    const result = await window.api.exportData();
    if (result.success) {
      notify('导出成功');
    }
  };

  const handleImport = async () => {
    const result = await window.api.importData();
    if (result.success) {
      loadData();
      notify(`成功导入 ${result.data.count} 个 API Key`);
    }
  };

  const handleAddCategory = async (name) => {
    const result = await window.api.categories.create(name);
    if (result.success) {
      loadData();
    }
  };

  const handleTest = async (id) => {
    const result = await window.api.apiKeys.test(id);
    if (result.success) {
      return result.data;
    } else {
      notify(result.error || '测试失败', 'error');
      return null;
    }
  };

  const handleCheckQuota = async (id) => {
    const result = await window.api.apiKeys.checkQuota(id);
    if (result.success) {
      return result.data;
    } else {
      notify(result.error || '查询失败', 'error');
      return null;
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar
        categories={categories}
        selectedCategory={selectedCategory}
        selectedEnvironment={selectedEnvironment}
        onSelectCategory={setSelectedCategory}
        onSelectEnvironment={setSelectedEnvironment}
        onAddCategory={handleAddCategory}
        onExport={handleExport}
        onImport={handleImport}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="搜索 API Keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <button
              onClick={() => { setEditingKey(null); setShowForm(true); }}
              className="ml-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition duration-200"
            >
              + 新建
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <ApiKeyList
            apiKeys={apiKeys}
            onEdit={(key) => { setEditingKey(key); setShowForm(true); }}
            onDelete={handleDelete}
            onCopy={handleCopy}
            onTest={handleTest}
            onCheckQuota={handleCheckQuota}
          />
        </div>
      </main>

      {showForm && (
        <ApiKeyForm
          apiKey={editingKey}
          categories={categories}
          onSubmit={editingKey ? (data) => handleUpdate(editingKey.id, data) : handleCreate}
          onClose={() => { setShowForm(false); setEditingKey(null); }}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onNotify={notify}
        />
      )}

      {notification && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
