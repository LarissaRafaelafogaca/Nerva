import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { translations, LANGUAGES } from './translations';

const I18nContext = createContext();

const STORAGE_KEY = 'nerva_language';

export const I18nProvider = ({ children }) => {
  const { user } = useAuth();
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) return saved;
    return 'en';
  });
  const loadedFromUser = useRef(false);

  // Load language from user entity when user becomes available
  useEffect(() => {
    if (user && !loadedFromUser.current) {
      loadedFromUser.current = true;
      if (user.language && translations[user.language]) {
        setLang(user.language);
        localStorage.setItem(STORAGE_KEY, user.language);
      } else {
        // Sync current localStorage value to DB
        base44.auth.updateMe({ language: lang }).catch(() => {});
      }
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    // Sync to DB if user is loaded and value changed after initial load
    if (user && loadedFromUser.current) {
      base44.auth.updateMe({ language: lang }).catch(() => {});
    }
  }, [lang]);

  const changeLanguage = useCallback((code) => {
    if (translations[code]) setLang(code);
  }, []);

  const t = useCallback((key) => {
    const parts = key.split('.');
    let val = translations[lang];
    for (const p of parts) {
      if (val && typeof val === 'object') val = val[p];
      else { val = undefined; break; }
    }
    if (val === undefined) {
      // fallback to English
      let fb = translations.en;
      for (const p of parts) {
        if (fb && typeof fb === 'object') fb = fb[p];
        else { fb = undefined; break; }
      }
      return fb ?? key;
    }
    return val;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, changeLanguage, t, languages: LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};