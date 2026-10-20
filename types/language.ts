/**
 * Language configuration for multi-language support.
 * Add new languages here to make them available throughout the app.
 */
export interface Language {
  /** ISO 639-1 or ISO 639-3 code (e.g., 'en', 'ha', 'yo', 'ig') */
  code: string;
  /** English name of the language */
  name: string;
  /** Native name of the language */
  nativeName: string;
  /** Whether the language is right-to-left */
  isRTL: boolean;
  /** Emoji flag or icon for UI display */
  flag: string;
  /** Whether this language is available for learning (has content) */
  isActive: boolean;
  /** Whether this is the base/source language */
  isBase?: boolean;
  /** Display order in language selectors */
  order: number;
}

/**
 * Supported languages in the app.
 * English is the base language (source of truth for all translations).
 */
export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    isRTL: false,
    flag: '🇺🇸',
    isBase: true,
    isActive: true,
    order: 0,
  },
  {
    code: 'ha',
    name: 'Hausa',
    nativeName: 'Hausa',
    isRTL: false,
    flag: '🇳🇬',
    isActive: true,
    order: 1,
  },
  // Add new languages here as they become available:
  // {
  //   code: 'yo',
  //   name: 'Yoruba',
  //   nativeName: 'Yorùbá',
  //   isRTL: false,
  //   flag: '🇳🇬',
  //   isActive: false,
  //   order: 2,
  // },
  // {
  //   code: 'ig',
  //   name: 'Igbo',
  //   nativeName: 'Asụsụ Igbo',
  //   isRTL: false,
  //   flag: '🇳🇬',
  //   isActive: false,
  //   order: 3,
  // },
];

/** Default base language (source of truth for all content) */
export const BASE_LANGUAGE_CODE = 'en';

/** Get a language by its code */
export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/** Get all active languages (available for learning) */
export function getActiveLanguages(): Language[] {
  return SUPPORTED_LANGUAGES.filter((lang) => lang.isActive).sort((a, b) => a.order - b.order);
}

/** Get all language codes */
export function getLanguageCodes(): string[] {
  return SUPPORTED_LANGUAGES.map((lang) => lang.code);
}

/** Check if a language code is supported */
export function isLanguageSupported(code: string): boolean {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}

/** Get the default target language (first active non-base language) */
export function getDefaultTargetLanguage(): Language {
  const activeNonBase = getActiveLanguages().find((lang) => lang.code !== BASE_LANGUAGE_CODE);
  return activeNonBase ?? SUPPORTED_LANGUAGES[1]; // fallback to Hausa
}