import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const PreferencesContext = createContext();

// Prefixo por usuário — as preferências NÃO podem vazar entre contas no mesmo
// dispositivo (ex.: PIN da conta admin não pode valer para outra conta).
const STORAGE_PREFIX = 'nerva_preferences_';
const storageKeyFor = (userId) => `${STORAGE_PREFIX}${userId || 'anon'}`;

const DEFAULT_PREFS = {
  notifications: { enabled: true, sound: true, vibration: false },
  security: { pinLock: false, pin: null, biometrics: false },
  privacy: { dataCollection: true, dataSharing: false },
};

function mergePrefs(base, incoming) {
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  return {
    notifications: { ...base.notifications, ...(src.notifications || {}) },
    security: { ...base.security, ...(src.security || {}) },
    privacy: { ...base.privacy, ...(src.privacy || {}) },
  };
}

export const PreferencesProvider = ({ children }) => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const currentUserId = useRef(null);
  const loadedForUser = useRef(null);
  const syncTimer = useRef(null);

  // Remove a chave legada (sem prefixo de usuário) que pode conter dados errados.
  useEffect(() => {
    localStorage.removeItem('nerva_preferences');
  }, []);

  // Carrega as preferências do usuário autenticado. Ao trocar de usuário (ou
  // logout), reseta para os padrões antes de aplicar as do novo usuário.
  useEffect(() => {
    const uid = user?.id || null;

    // Trocou de usuário (inclui logout): limpa o estado para não vazar prefs.
    if (currentUserId.current !== uid) {
      currentUserId.current = uid;
      loadedForUser.current = null;
      setPrefs(DEFAULT_PREFS);
    }

    if (!user) return;
    if (loadedForUser.current === uid) return;
    loadedForUser.current = uid;

    // 1) preferências da conta (backend) têm prioridade;
    // 2) senão, tenta o cache local DAQUELE usuário;
    // 3) senão, padrões (e empurra para o backend).
    if (user.preferences) {
      const merged = mergePrefs(DEFAULT_PREFS, user.preferences);
      setPrefs(merged);
      localStorage.setItem(storageKeyFor(uid), JSON.stringify(merged));
    } else {
      let local = null;
      try {
        const saved = localStorage.getItem(storageKeyFor(uid));
        if (saved) local = JSON.parse(saved);
      } catch { /* ignore */ }
      const merged = mergePrefs(DEFAULT_PREFS, local || {});
      setPrefs(merged);
      base44.auth.updateMe({ preferences: merged }).catch(() => {});
    }
  }, [user]);

  // Persiste no cache do usuário e sincroniza com o backend (debounced).
  useEffect(() => {
    const uid = user?.id;
    if (!uid || loadedForUser.current !== uid) return; // só após carregar o usuário
    localStorage.setItem(storageKeyFor(uid), JSON.stringify(prefs));
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      base44.auth.updateMe({ preferences: prefs }).catch(() => {});
    }, 800);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [prefs, user]);

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

  // Indica se as prefs da conta já foram carregadas (evita bloquear cedo demais).
  const prefsLoaded = !!user && loadedForUser.current === user.id;

  return (
    <PreferencesContext.Provider value={{ prefs, prefsLoaded, updateNotifications, updateSecurity, updatePrivacy }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
};
