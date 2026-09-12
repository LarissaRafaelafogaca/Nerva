import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const ThemeContext = createContext();

const STORAGE_KEY = 'nerva_theme';

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  });
  const loadedFromUser = useRef(false);

  // Load theme from user entity when user becomes available
  useEffect(() => {
    if (user && !loadedFromUser.current) {
      loadedFromUser.current = true;
      if (user.theme === 'light' || user.theme === 'dark') {
        setTheme(user.theme);
        localStorage.setItem(STORAGE_KEY, user.theme);
      } else {
        // Sync current localStorage value to DB
        base44.auth.updateMe({ theme }).catch(() => {});
      }
    }
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem(STORAGE_KEY, theme);
    // Sync to DB if user is loaded and value changed after initial load
    if (user && loadedFromUser.current) {
      base44.auth.updateMe({ theme }).catch(() => {});
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setThemeValue = useCallback((val) => {
    if (val === 'light' || val === 'dark') setTheme(val);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeValue }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};