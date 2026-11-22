import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phrase, getAudioUrl as getPhraseAudioUrl } from '@/types/phrase';

/**
 * Local-first progress for the daily learning path.
 *
 * Everything here is computed from the already-synced content and persisted in
 * AsyncStorage, so the feature works with no network connection.
 */
const PROGRESS_KEY = '@hausabridge/learning-progress';

export interface LearningProgress {
  /** Word ids the user has marked as learned, in the order they were learned. */
  learnedWordIds: string[];
  currentStreak: number;
  longestStreak: number;
  /** 'YYYY-MM-DD' (device local) of the last day the daily word was learned. */
  lastLearnedDate: string | null;
  dailyGoal: number;
}

export const DEFAULT_PROGRESS: LearningProgress = {
  learnedWordIds: [],
  currentStreak: 0,
  longestStreak: 0,
  lastLearnedDate: null,
  dailyGoal: 1,
};

/** Device-local calendar day key, e.g. '2026-11-19'. */
export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

/** Whole-day difference between two date keys (b - a). */
export function daysBetween(aKey: string, bKey: string): number {
  const a = parseDateKey(aKey).getTime();
  const b = parseDateKey(bKey).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Stable day number since the Unix epoch, used to seed daily selection. */
function dayNumber(dateKey: string): number {
  const time = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isFinite(time) ? Math.floor(time / 86_400_000) : 0;
}

// ---------------------------------------------------------------------------
// Deterministic selection helpers
// ---------------------------------------------------------------------------

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seedText: string): T[] {
  const random = mulberry32(hashString(seedText));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Restrict the pool to words the user can actually learn: single words (not
 * phrases) that have a translation in the target language. Words with audio are
 * preferred, but we fall back to all translatable words if none carry audio so
 * the path never runs dry.
 */
export function getLearnableWords(
  phrases: Phrase[],
  targetLanguage: string,
  baseLanguage: string,
): Phrase[] {
  const words = phrases.filter((phrase) => phrase.contentType === 'word');
  // Require an actual translation in the target language — checking the raw map
  // directly, since getTranslation() falls back to the base language and would
  // otherwise let untranslated words through.
  const translatable = words.filter(
    (phrase) => (phrase.translations[targetLanguage] ?? '').trim().length > 0,
  );
  if (translatable.length === 0) return [];
  const withAudio = translatable.filter(
    (phrase) => getPhraseAudioUrl(phrase, targetLanguage, baseLanguage) != null,
  );
  return withAudio.length > 0 ? withAudio : translatable;
}

/**
 * One word for the calendar day, stable across restarts and offline.
 *
 * The pool is deterministically shuffled per install per cycle, and the day's
 * position advances one slot per day, so no word repeats until the whole set has
 * been cycled through.
 */
export function selectDailyWord(
  phrases: Phrase[],
  options: {
    targetLanguage: string;
    baseLanguage: string;
    installationId: string | null;
    dateKey: string;
  },
): Phrase | null {
  const { targetLanguage, baseLanguage, installationId, dateKey } = options;
  const pool = getLearnableWords(phrases, targetLanguage, baseLanguage);
  if (pool.length === 0) return null;

  const number = dayNumber(dateKey);
  const cycleLength = pool.length;
  const cycleIndex = Math.floor(number / cycleLength);
  const seeded = seededShuffle(pool, `${installationId ?? 'anon'}:${targetLanguage}:${cycleIndex}`);
  const position = ((number % cycleLength) + cycleLength) % cycleLength;
  return seeded[position] ?? null;
}

// ---------------------------------------------------------------------------
// Persistence + streak bookkeeping
// ---------------------------------------------------------------------------

/** Resets the streak if a day was missed since the last learned day. */
export function normalizeProgress(progress: LearningProgress, todayKey: string): LearningProgress {
  if (!progress.lastLearnedDate) {
    return progress.currentStreak === 0 ? progress : { ...progress, currentStreak: 0 };
  }
  const gap = daysBetween(progress.lastLearnedDate, todayKey);
  // gap 0 = learned today, 1 = learned yesterday (streak still alive).
  if (gap <= 1) return progress;
  return progress.currentStreak === 0 ? progress : { ...progress, currentStreak: 0 };
}

export async function loadProgress(todayKey: string): Promise<LearningProgress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    const merged: LearningProgress = {
      ...DEFAULT_PROGRESS,
      ...parsed,
      learnedWordIds: Array.isArray(parsed.learnedWordIds) ? parsed.learnedWordIds : [],
    };
    return normalizeProgress(merged, todayKey);
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export async function saveProgress(progress: LearningProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Local persistence is best-effort; the in-memory state still updates.
  }
}

export function isLearnedToday(progress: LearningProgress, todayKey: string): boolean {
  return progress.lastLearnedDate === todayKey;
}

export interface MarkLearnedResult {
  progress: LearningProgress;
  /** True when the streak advanced (first learn of the day). */
  changed: boolean;
}

/** Marks the day's word learned and advances the streak (once per day). */
export function markWordLearned(
  progress: LearningProgress,
  wordId: string,
  todayKey: string,
): MarkLearnedResult {
  const learnedWordIds = progress.learnedWordIds.includes(wordId)
    ? progress.learnedWordIds
    : [...progress.learnedWordIds, wordId];

  if (progress.lastLearnedDate === todayKey) {
    return { progress: { ...progress, learnedWordIds }, changed: false };
  }

  const continuesStreak =
    !!progress.lastLearnedDate && daysBetween(progress.lastLearnedDate, todayKey) === 1;
  const currentStreak = continuesStreak ? progress.currentStreak + 1 : 1;

  return {
    progress: {
      ...progress,
      learnedWordIds,
      currentStreak,
      longestStreak: Math.max(progress.longestStreak, currentStreak),
      lastLearnedDate: todayKey,
    },
    changed: true,
  };
}

/** Most recently learned words first, resolved against the current content. */
export function getRecentLearnedWords(
  phrases: Phrase[],
  learnedWordIds: string[],
  limit = 6,
): Phrase[] {
  if (learnedWordIds.length === 0) return [];
  const byId = new Map(phrases.map((phrase) => [phrase.id, phrase]));
  const result: Phrase[] = [];
  for (let i = learnedWordIds.length - 1; i >= 0 && result.length < limit; i--) {
    const phrase = byId.get(learnedWordIds[i]);
    if (phrase) result.push(phrase);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Optional server backup (merge-only)
// ---------------------------------------------------------------------------

/**
 * Merges a server-side backup into the local snapshot without ever losing
 * progress: learned ids are unioned (server-only ids, learned earlier, are
 * placed first), streak counters only move up, and the later learned date wins.
 *
 * Returns the same `local` reference when nothing changes, so callers can skip
 * a redundant persist/push.
 */
export function mergeProgress(
  local: LearningProgress,
  remote: Partial<LearningProgress> | null | undefined,
): LearningProgress {
  if (!remote) return local;

  const localIds = new Set(local.learnedWordIds);
  const remoteOnly = (remote.learnedWordIds ?? []).filter((id) => !localIds.has(id));
  const learnedWordIds =
    remoteOnly.length > 0 ? [...remoteOnly, ...local.learnedWordIds] : local.learnedWordIds;

  const currentStreak = Math.max(local.currentStreak, remote.currentStreak ?? 0);
  const longestStreak = Math.max(local.longestStreak, remote.longestStreak ?? 0, currentStreak);
  const remoteDate = remote.lastLearnedDate ?? null;
  const lastLearnedDate =
    remoteDate && (!local.lastLearnedDate || remoteDate > local.lastLearnedDate)
      ? remoteDate
      : local.lastLearnedDate;
  const dailyGoal = local.dailyGoal || remote.dailyGoal || 1;

  const changed =
    learnedWordIds !== local.learnedWordIds ||
    currentStreak !== local.currentStreak ||
    longestStreak !== local.longestStreak ||
    lastLearnedDate !== local.lastLearnedDate ||
    dailyGoal !== local.dailyGoal;

  if (!changed) return local;
  return { learnedWordIds, currentStreak, longestStreak, lastLearnedDate, dailyGoal };
}
