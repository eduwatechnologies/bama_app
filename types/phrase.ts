/**
 * Category names come from the server and are admin-managed, so this stays an
 * open string rather than a closed union. Seeding a new category in the
 * dashboard must not require a client release.
 */
export type PhraseCategory = string;

import { Language } from './language';

/**
 * Translations for a phrase/word, keyed by language code.
 * The base language (English) is always present.
 */
export type Translations = Record<string, string>;

/**
 * Audio URLs for a phrase/word, keyed by language code.
 */
export type AudioMap = Record<string, string | null>;

export interface Phrase {
  id: string;
  category: PhraseCategory;
  /** Translations keyed by language code (e.g., { en: 'Hello', ha: 'Sannu' }) */
  translations: Translations;
  /** Pronunciation guide for the target language */
  pronunciation: string;
  /** Audio URLs keyed by language code */
  audio: AudioMap;
  isFavorite: boolean;
  /**
   * Which server collection this row came from. Words and phrases are shown in
   * one flat list, but contributions must reference the correct collection or
   * the server rejects the contentId.
   */
  contentType: ContentType;
}

export type ContentType = 'word' | 'phrase';

export interface CategoryMeta {
  name: PhraseCategory;
  description: string;
  icon: string;
  /** Resolved hex color, assigned deterministically from the slug. */
  color: string;
}

/** Helper to get translation for a specific language, falling back to base language */
export function getTranslation(phrase: Phrase, languageCode: string, baseLanguageCode = 'en'): string {
  return phrase.translations[languageCode] ?? phrase.translations[baseLanguageCode] ?? '';
}

/** Helper to get audio URL for a specific language, falling back to base language */
export function getAudioUrl(phrase: Phrase, languageCode: string, baseLanguageCode = 'en'): string | null {
  return phrase.audio[languageCode] ?? phrase.audio[baseLanguageCode] ?? null;
}