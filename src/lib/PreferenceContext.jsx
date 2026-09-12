import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const PreferencesContext = createContext();

const STORAGE_KEY = 'nerva_preferences';

const DEFAULT_PREFS = {
  notifications: { enabled: true, sound: true, vibration: false },
  security: { pinLock: false, pin: null, biometrics: false },
  privacy: { dataCollection: true, dataSharing: false },
};

export const PreferencesProvider = ({ children }) => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_PREFS;
  });
  const loadedFromUser = useRef(false);
  const syncTimer = useRef(null);

  // Load preferences from user entity when user becomes available
  useEffect(() => {
    if (user && !loadedFromUser.current) {
      loadedFromUser.current = true;
      if (user.preferences) {
        const merged = {
          notifications: { ...DEFAULT_PREFS.notifications, ...user.preferences.notifications },
          security: { ...DEFAULT_PREFS.security, ...user.preferences.security },
          privacy: { ...DEFAULT_PREFS.privacy, ...user.preferences.privacy },
        };
        setPrefs(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } else {
        // Sync current localStorage value to DB
        base44.auth.updateMe({ preferences: prefs }).catch(() => {});
      }
    }
  }, [user]);

  // Persist to localStorage immediately and sync to DB (debounced)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    if (user && loadedFromUser.current) {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        base44.auth.updateMe({ preferences: prefs }).catch(() => {});
      }, 800);
    }
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [prefs]);

  const updateNotifications = useCallback((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, notifications: { ...prev.notifications, [key]: value } };
      if (key === 'enabled' && !value) {
        next.notifications.sound = false;
        next.notifications.vibration = false;
      }
      return next;
    });
  }, []);

  const updateSecurity = useCallback((key, value) => {
    setPrefs((prev) => ({ ...prev, security: { ...prev.security, [key]: value } }));
  }, []);

  const updatePrivacy = useCallback((key, value) => {
    setPrefs((prev) => ({ ...prev, privacy: { ...prev.privacy, [key]: value } }));
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, updateNotifications, updateSecurity, updatePrivacy }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
};