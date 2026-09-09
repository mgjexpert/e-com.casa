'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Lang } from '@/lib/i18n';

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

/**
 * UI language preference. Persisted to localStorage under 'ecom-language'.
 * `skipHydration` keeps the first client render identical to SSR ('en') —
 * the persisted value is rehydrated after mount by <LanguageBoot/>, which
 * also mirrors the setting onto <html lang> for accessibility.
 */
export const useLanguage = create<LanguageState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      setLang: (lang) => {
        set({ lang });
        if (typeof document !== 'undefined') {
          document.documentElement.lang = lang === 'pt' ? 'pt' : 'en';
        }
      },
      toggle: () => get().setLang(get().lang === 'en' ? 'pt' : 'en'),
    }),
    {
      name: 'ecom-language',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
