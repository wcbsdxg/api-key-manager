import React, { useState } from 'react';

const envColors = {
  development: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  staging: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  production: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
};

const envLabels = {
  development: '开发',
  staging: '测试',
  production: '生产'
};

export default function ApiKeyList({ apiKeys, onEdit, onDelete, onCopy, onTest, onCheckQuota }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [checkingQuotaId, setCheckingQuotaId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [quotaResults, setQuotaResults] = useState({});

  const handleDelete = (id) => {
    if (confirmDelete === id) {
      onDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    const result = await onTest(id);
    setTestingId(null);
    if (result) {
      setTestResults(prev => ({ ...prev, [id]: result }));
      setTimeout(() => {
        setTestResults(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 10000);
    }
  };

  const handleCheckQuota = async (id) => {
    setCheckingQuotaId(id);
    const result = await onCheckQuota(id);
    setCheckingQuotaId(null);
    if (result) {
      setQuotaResults(prev => ({ ...prev, [id]: result }));
    }
  };

  if (apiKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <p className="text-lg font-medium">暂无 API Keys</p>
        <p className="text-sm mt-1">点击右上角的"新建"按钮添加</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {apiKeys.map(key => (
        <div
          key={key.id}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition duration-200"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white truncate">
                  {key.name}
                </h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${envColors[key.environment]}`}>
                  {envLabels[key.environment]}
                </span>
                {key.categoryName && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {key.categoryName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-mono bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">
                  ••••••••••••••••
                </span>
              </div>

              {key.url && (
                <a
                  href={key.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-600 mt-2 inline-block"
                >
                  {key.url}
                </a>
              )}

              {key.notes && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                  {key.notes}
                </p>
              )}

              {testResults[key.id] && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  testResults[key.id].success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  <div className="flex items-center gap-2">
                    {testResults[key.id].success ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span>
                      {testResults[key.id].success ? '连接成功' : '连接失败'}
                      {testResults[key.id].statusCode > 0 && ` (${testResults[key.id].statusCode})`}
                    </span>
                    <span className="text-xs opacity-75">{testResults[key.id].responseTime}ms</span>
                  </div>
                  {testResults[key.id].error && (
                    <p className="mt-1 text-xs">{testResults[key.id].error}</p>
                  )}
                </div>
              )}

              {quotaResults[key.id] && (
                <div className={`mt-2 p-3 rounded-lg text-sm ${
                  quotaResults[key.id].success
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  {quotaResults[key.id].success ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="font-medium">余量信息</span>
                      </div>
                      {quotaResults[key.id].quotaInfo !== undefined && (
                        <p className="mt-1 font-mono text-xs">
                          {typeof quotaResults[key.id].quotaInfo === 'object'
                            ? JSON.stringify(quotaResults[key.id].quotaInfo, null, 2)
                            : String(quotaResults[key.id].quotaInfo)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{quotaResults[key.id].error || '查询失败'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 ml-4">
              {key.testEndpoint && (
                <button
                  onClick={() => handleTest(key.id)}
                  disabled={testingId === key.id}
                  className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition duration-200 disabled:opacity-50"
                  title="测试连通性"
                >
                  {testingId === key.id ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              )}

              {key.quotaEndpoint && (
                <button
                  onClick={() => handleCheckQuota(key.id)}
                  disabled={checkingQuotaId === key.id}
                  className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition duration-200 disabled:opacity-50"
                  title="查询余量"
                >
                  {checkingQuotaId === key.id ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )}
                </button>
              )}

              <button
                onClick={() => onCopy(key.id)}
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition duration-200"
                title="复制到剪贴板"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => onEdit(key)}
                className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition duration-200"
                title="编辑"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(key.id)}
                className={`p-2 rounded-lg transition duration-200 ${
                  confirmDelete === key.id
                    ? 'text-white bg-red-500 hover:bg-red-600'
                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                }`}
                title={confirmDelete === key.id ? '确认删除' : '删除'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>更新于 {new Date(key.updatedAt).toLocaleString('zh-CN')}</span>
            {key.testEndpoint && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                已配置测试
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
