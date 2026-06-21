import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import MainLayout from './components/MainLayout';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkInit();
  }, []);

  const checkInit = async () => {
    const result = await window.api.db.isInitialized();
    setIsInitialized(result);
    setLoading(false);
  };

  const handleLogin = async (password) => {
    if (!isInitialized) {
      const result = await window.api.db.init(password);
      if (result.success) {
        setIsAuthenticated(true);
        setIsInitialized(true);
      }
      return result;
    } else {
      const result = await window.api.db.verify(password);
      if (result.success) {
        setIsAuthenticated(true);
      }
      return result;
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} isFirstTime={!isInitialized} />;
  }

  return <MainLayout />;
}
