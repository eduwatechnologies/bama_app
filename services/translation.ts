import { Phrase } from '@/types/phrase';

/** Source and target language codes (e.g., 'en', 'ha', 'yo') */
export type LanguageCode = string;

export type MatchKind = 'exact' | 'approximate';

export interface TranslationResult {
  kind: 'match' | 'unavailable';
  matchKind: MatchKind;
  source: string;
  translation: string | null;
  phrase: Phrase | null;
  alternatives: Phrase[];
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

const PUNCTUATION = /[?!.。,;:'"“”‘’()[\]{}\u060C]/g;
const DASHES = /[-‐-―]/g;

export const normalize = (value: string): string =>
  value
    .toLocaleLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(DASHES, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const MIN_TOKEN_LENGTH = 2;
const STEM_MIN_LENGTH = 4;

const stem = (token: string): string =>
  token.length > STEM_MIN_LENGTH ? token.replace(/(ings|ing|ed|es|s)$/, '') : token;

const tokenize = (value: string): string[] => normalize(value).split(' ').filter(Boolean);

const stemSet = (tokens: string[]): Set<string> => new Set(tokens.map(stem));

const startsWithToken = (haystack: string[], needle: string): boolean =>
  needle.length >= MIN_TOKEN_LENGTH && haystack.some((token) => stem(token).startsWith(needle));

const containsToken = (haystack: string[], needle: string): boolean =>
  needle.length >= MIN_TOKEN_LENGTH && haystack.some((token) => stem(token) === needle || stem(token).startsWith(needle));

/**
 * Scores how well `input` matches `value` in the active source language.
 * Higher is better, 0 means no match at all.
 */
export function scoreTranslationMatch(input: string, value: string): number {
  const a = normalize(input);
  const b = normalize(value);
  if (!a || !b) return 0;
  if (a === b) return 1000;

  const inputTokens = tokenize(a);
  const valueTokens = tokenize(b);
  const inputStems = stemSet(inputTokens);
  const valueStems = stemSet(valueTokens);

  // The user is still typing a phrase that exists.
  if (b.startsWith(`${a} `)) return 800 - Math.min(200, b.length - a.length);

  // Every typed word is present in the phrase, in any order.
  if ([...inputStems].every((stemmed) => valueStems.has(stemmed))) {
    return 600 - Math.min(150, Math.abs(valueTokens.length - inputTokens.length));
  }

  // A single word query ("morning") resolving inside a phrase.
  if (inputTokens.length === 1) {
    const needle = inputTokens[0];
    if (startsWithToken(valueTokens, needle)) return valueTokens.length === 1 ? 550 : 480;
    if (containsToken(valueTokens, needle)) return 400;
  }

  // Partial typing of a word ("morn" -> "morning").
  if (inputTokens.every((token) => startsWithToken(valueTokens, token))) {
    return 300 - Math.min(150, Math.abs(valueTokens.length - inputTokens.length));
  }

  if (b.includes(a)) return 200;

  return 0;
}

export function findOfflineTranslation(
  input: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  phrasebook: Phrase[],
): TranslationResult {
  const source = input.trim();
  const unavailable = (): TranslationResult => ({
    kind: 'unavailable',
    matchKind: 'approximate',
    source,
    translation: null,
    phrase: null,
    alternatives: [],
    sourceLanguage,
    targetLanguage,
  });

  if (!source) return unavailable();

  const sourceField = (item: Phrase): string => item.translations[sourceLanguage] ?? '';
  const targetField = (item: Phrase): string => item.translations[targetLanguage] ?? '';

  const ranked = phrasebook
    .map((item) => ({ item, score: scoreTranslationMatch(source, sourceField(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || sourceField(a.item).length - sourceField(b.item).length);

  const best = ranked[0];
  if (!best) return unavailable();

  return {
    kind: 'match',
    matchKind: normalize(sourceField(best.item)) === normalize(source) ? 'exact' : 'approximate',
    source,
    translation: targetField(best.item),
    phrase: best.item,
    alternatives: ranked.slice(1, 5).map((entry) => entry.item),
    sourceLanguage,
    targetLanguage,
  };
}

// Future online translation can implement the same contract behind this boundary.
export async function translateOnlineLater(): Promise<never> {
  throw new Error('Online translation is not enabled in the offline MVP.');
}
