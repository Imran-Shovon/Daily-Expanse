'use client';

import * as React from 'react';
import {
  LANGUAGE_STORAGE_KEY,
  localizeDigits,
  translate,
  type Language,
  type TranslationValues,
} from './translate';

interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: TranslationValues) => string;
  number: (value: number | string) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);
let inMemoryLanguage: Language = 'en';
let storageUnavailable = false;

function readLanguage(): Language {
  if (storageUnavailable) return inMemoryLanguage;
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'bn' ? 'bn' : 'en';
  } catch {
    return inMemoryLanguage;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('daily-expense-language-change', onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('daily-expense-language-change', onChange);
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = React.useSyncExternalStore(subscribe, readLanguage, () => 'en' as const);
  const setLanguage = React.useCallback((next: Language) => {
    inMemoryLanguage = next;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      storageUnavailable = true;
      // The in-memory preference still works for this visit.
    }
    window.dispatchEvent(new Event('daily-expense-language-change'));
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'bn' ? 'দৈনিক খরচ' : 'Daily Expense';
  }, [language]);

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language,
      locale: language === 'bn' ? 'bn-BD' : 'en-US',
      setLanguage,
      t: (key, values) => translate(language, key, values),
      number: (value) => localizeDigits(String(value), language),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
