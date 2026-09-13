import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePreferences } from '@/lib/PreferencesContext';
import { useAuth } from '@/lib/AuthContext';

const LockContext = createContext();

// Tempo mínimo em segundo plano (ms) para re-bloquear ao voltar. Evita bloquear
// a cada pequena troca de foco; bloqueia quando o app ficou "guardado" um tempo.
const RELOCK_AFTER_MS = 15000;

export const LockProvider = ({ children }) => {
  const { prefs, prefsLoaded } = usePreferences();
  const { isAuthenticated, user } = useAuth();

  // Lock só é ativo se:
  // 1. as preferências do servidor já foram carregadas (prefsLoaded)
  // 2. o pinLock está explicitamente ativo na conta
  // 3. existe um PIN hash definido (pin === '__set__') — garante que o usuário
  //    realmente configurou o PIN; evita bloquear por dados inconsistentes.
  const pinActive = prefsLoaded &&
    prefs?.security?.pinLock === true &&
    prefs?.security?.pin === '__set__';
  const bioActive = prefsLoaded &&
    prefs?.security?.biometrics === true;
  const lockEnabled = pinActive || bioActive;

  const [locked, setLocked] = useState(false);
  const hiddenSince = useRef(null);
  const initializedFor = useRef(null);

  // Ao carregar a conta com lock ativo, bloqueia na entrada (uma vez por usuário).
  useEffect(() => {
    if (!isAuthenticated) {
      initializedFor.current = null;
      setLocked(false);
      return;
    }
    if (prefsLoaded && lockEnabled && initializedFor.current !== user?.id) {
      initializedFor.current = user?.id;
      setLocked(true);
    }
    if (prefsLoaded && !lockEnabled) {
      // Conta sem PIN/biometria: garante que não fica bloqueada.
      initializedFor.current = user?.id;
      setLocked(false);
    }
  }, [isAuthenticated, prefsLoaded, lockEnabled, user]);

  // Re-bloqueia ao voltar de segundo plano (se ficou guardado tempo suficiente).
  useEffect(() => {
    if (!lockEnabled) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') hiddenSince.current = Date.now();
    };
    const onShow = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        const away = hiddenSince.current ? Date.now() - hiddenSince.current : 0;
        if (away >= RELOCK_AFTER_MS) setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [lockEnabled, isAuthenticated]);

  const unlock = useCallback(() => setLocked(false), []);
  const lockNow = useCallback(() => setLocked(true), []);

  return (
    <LockContext.Provider value={{ locked: locked && lockEnabled && isAuthenticated, lockEnabled, unlock, lockNow }}>
      {children}
    </LockContext.Provider>
  );
};

export const useLock = () => {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
};
