import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Phrase, PhraseCategory, ContentType, getTranslation as getPhraseTranslation, getAudioUrl as getPhraseAudioUrl } from '@/types/phrase';
import {
  ApiCategory,
  ApiPhrase,
  ApiWord,
  AudioMeta,
  Language,
  createContribution,
  fetchCategories,
  fetchLanguages,
  generateInstallationId,
  getLastPersistedContentVersion,
  loadCategories,
  loadLanguages,
  loadPhrases,
  loadWords,
  persistCategories,
  persistContentVersion,
  persistLanguages,
  persistPhrases,
  persistWords,
  registerInstallation,
  syncContent,
  uploadContributionAudio,
  Contribution as ApiContribution,
} from '@/services/api';
import { invalidateUserRecordingCache, primeUserRecordingCache } from '@/services/audio';
import { BASE_LANGUAGE_CODE, getDefaultTargetLanguage } from '@/types/language';

const FAVORITES_KEY = '@hausabridge/favorites';
const DIRECTION_KEY = '@hausabridge/direction';
const ONBOARDING_KEY = '@hausabridge/onboarding-complete';
const RECORDINGS_KEY = '@hausabridge/user-recordings';
const SELECTED_LANGUAGE_KEY = '@hausabridge/selected-language';

/** Preferred learning language when the user hasn't picked one yet. */
const DEFAULT_TARGET_LANGUAGE = 'ha';

/** Base language code (source of truth for all content) */
export const BASE_LANGUAGE = BASE_LANGUAGE_CODE;

/** Target language code (the language user is learning) */
export type TargetLanguage = string;

export interface UserRecording {
  phraseId: string;
  uri: string;
  durationMs: number;
  createdAt: number;
  sizeBytes?: number;
  contributionId?: string;
}

interface AppContextValue {
  installationId: string | null;
  categories: ApiCategory[];
  rawWords: ApiWord[];
  rawPhrases: ApiPhrase[];
  phrases: Phrase[];
  languages: Language[];
  contentVersion: number;
  isReady: boolean;
  isSyncing: boolean;
  lastSyncError: string | null;
  favoriteIds: string[];
  /** The target language the user is learning (e.g., 'ha', 'yo') */
  targetLanguage: TargetLanguage;
  /** The base language (always 'en') */
  baseLanguage: string;
  hasCompletedOnboarding: boolean;
  userRecordings: Record<string, UserRecording>;
  sync: () => Promise<void>;
  submitAudioContribution: (
    phraseId: string,
    contentType: 'word' | 'phrase',
    recording: UserRecording,
    mimeType: string,
    fileName: string,
    language: string,
  ) => Promise<ApiContribution>;
  toggleFavorite: (phraseId: string) => void;
  isFavorite: (phraseId: string) => boolean;
  setTargetLanguage: (languageCode: TargetLanguage) => void;
  completeOnboarding: () => void;
  saveUserRecording: (rec: UserRecording) => Promise<UserRecording>;
  deleteUserRecording: (phraseId: string) => Promise<void>;
  getUserRecording: (phraseId: string) => UserRecording | undefined;
  getPhraseById: (id: string) => Phrase | undefined;
  getCategoryBySlug: (slug: string) => ApiCategory | undefined;
  /** Get translation for a phrase in the current target language */
  getTranslation: (phrase: Phrase) => string;
  /** Get audio URL for a phrase in the current target language */
  getAudioUrl: (phrase: Phrase) => string | null;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function normalizeToFrontend(
  items: (ApiWord | ApiPhrase)[] | undefined | null,
  categoriesById: Record<string, ApiCategory>,
  contentType: ContentType,
  targetLanguage: TargetLanguage,
  baseLanguage: string,
): Phrase[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const categoryRef = item.categoryId;
    let category = '';
    if (typeof categoryRef === 'string') {
      category = categoriesById[categoryRef]?.name ?? '';
    } else if (categoryRef && typeof categoryRef === 'object') {
      category = (categoryRef as ApiCategory).name;
    }

    // Get audio for target language, fallback to base language
    const audioMap = (item.audio ?? {}) as Record<string, string | AudioMeta | null | undefined>;
    const targetAudio = audioMap[targetLanguage];
    const baseAudio = audioMap[baseLanguage];
    const audioUrl = (typeof targetAudio === 'object' && targetAudio?.url) ? targetAudio.url :
      (typeof baseAudio === 'object' && baseAudio?.url) ? baseAudio.url :
      (typeof targetAudio === 'string') ? targetAudio :
      (typeof baseAudio === 'string') ? baseAudio :
      null;

    // Get pronunciation from example sentence (words only) or translation
    const exampleSentence = 'exampleSentence' in item ? (item.exampleSentence ?? {}) : {};
    const pronunciation = exampleSentence[targetLanguage] ?? item.translations[targetLanguage] ?? item.translations[baseLanguage] ?? '';

    return {
      id: item._id,
      category,
      translations: item.translations,
      pronunciation,
      audio: audioMap as Record<string, string | null>,
      isFavorite: false,
      contentType,
    };
  });
}

export function AppProvider({ children }: PropsWithChildren) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [userRecordings, setUserRecordings] = useState<Record<string, UserRecording>>({});

  const [installationId, setInstallationId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [rawWords, setRawWords] = useState<ApiWord[]>([]);
  const [rawPhrases, setRawPhrases] = useState<ApiPhrase[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [contentVersion, setContentVersion] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Language state
  const [targetLanguage, setTargetLanguageState] = useState<TargetLanguage>(() => {
    // Default to Hausa; validated against the backend language list once it loads.
    return DEFAULT_TARGET_LANGUAGE;
  });
  const [baseLanguage] = useState<string>(BASE_LANGUAGE);

  const categoriesById = useMemo(() => {
    const map: Record<string, ApiCategory> = {};
    for (const c of categories) map[c._id] = c;
    return map;
  }, [categories]);

  const phrases = useMemo<Phrase[]>(
    () => [
      ...normalizeToFrontend(rawWords, categoriesById, 'word', targetLanguage, baseLanguage),
      ...normalizeToFrontend(rawPhrases, categoriesById, 'phrase', targetLanguage, baseLanguage),
    ],
    [categoriesById, rawPhrases, rawWords, targetLanguage, baseLanguage],
  );

  const getPhraseById = useCallback(
    (id: string): Phrase | undefined => phrases.find((p) => p.id === id),
    [phrases],
  );

  const getCategoryBySlug = useCallback(
    (slug: string): ApiCategory | undefined => categories.find((c) => c.slug === slug),
    [categories],
  );

  const applyChanges = useCallback(
    (
      changes: { type: 'CREATE' | 'UPDATE' | 'DELETE'; entity: 'word' | 'phrase'; id: string; data?: unknown }[],
      nextWords: ApiWord[],
      nextPhrases: ApiPhrase[],
    ): { words: ApiWord[]; phrases: ApiPhrase[] } => {
      let words = [...nextWords];
      let phrasesList = [...nextPhrases];
      for (const change of changes) {
        if (change.type === 'DELETE') {
          if (change.entity === 'word') words = words.filter((w) => w._id !== change.id);
          else phrasesList = phrasesList.filter((p) => p._id !== change.id);
        } else if (change.entity === 'word' && change.data) {
          const w = change.data as ApiWord;
          const idx = words.findIndex((x) => x._id === w._id);
          if (idx >= 0) words[idx] = w;
          else words.push(w);
        } else if (change.entity === 'phrase' && change.data) {
          const p = change.data as ApiPhrase;
          const idx = phrasesList.findIndex((x) => x._id === p._id);
          if (idx >= 0) phrasesList[idx] = p;
          else phrasesList.push(p);
        }
      }
      return { words, phrases: phrasesList };
    },
    [],
  );

  const sync = useCallback(async () => {
    setIsSyncing(true);
    setLastSyncError(null);
    try {
      let id = installationId;
      if (!id) {
        id = await generateInstallationId();
        setInstallationId(id);
        try {
          await registerInstallation(id);
        } catch {
          // registration failure is non-fatal — sync still works without it
        }
      }
      const savedVersion = await getLastPersistedContentVersion();
      const base = Math.max(savedVersion, contentVersion);
      const response = await syncContent(id, base);
      // Categories and languages are admin-managed and are NOT part of the
      // versioned content change feed, so they can change without serverVersion
      // moving. Always refetch them.
      let latestCategories = categories;
      try {
        latestCategories = await fetchCategories();
        setCategories(latestCategories);
        await persistCategories(latestCategories);
      } catch {
        // fall back to cached categories
      }
      try {
        const langs = await fetchLanguages();
        setLanguages(langs);
        await persistLanguages(langs);
      } catch {
        // keep existing languages
      }
      let words: ApiWord[] = rawWords;
      let phrasesList: ApiPhrase[] = rawPhrases;
      if (response.requiresFullSync) {
        const result = applyChanges(response.changes, [], []);
        words = result.words;
        phrasesList = result.phrases;
      } else {
        const result = applyChanges(response.changes, rawWords, rawPhrases);
        words = result.words;
        phrasesList = result.phrases;
      }
      setRawWords(words);
      setRawPhrases(phrasesList);
      setContentVersion(response.serverVersion);
      await persistWords(words);
      await persistPhrases(phrasesList);
      await persistContentVersion(response.serverVersion);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setLastSyncError(msg);
    } finally {
      setIsSyncing(false);
    }
  }, [applyChanges, categories, contentVersion, installationId, rawPhrases, rawWords]);

  const submitAudioContribution = useCallback(
    async (
      phraseId: string,
      contentType: 'word' | 'phrase',
      recording: UserRecording,
      mimeType: string,
      fileName: string,
      language: string,
    ): Promise<ApiContribution> => {
      if (!installationId) throw new Error('App is not registered yet');
      const contribution = await createContribution({
        type: 'AUDIO',
        contentType,
        contentId: phraseId,
        notes: 'Pronunciation recording submitted from mobile app',
        // Tell the server which language this recording pronounces so it can
        // merge it into the per-language audio map without clobbering other
        // languages' recordings.
        language,
        installationId,
      });
      const durationSeconds = Math.max(0, Math.floor(recording.durationMs / 1000));
      const updated = await uploadContributionAudio(
        contribution._id,
        recording.uri,
        fileName,
        mimeType,
        durationSeconds,
      );
      setUserRecordings((prev) => ({
        ...prev,
        [phraseId]: { ...(prev[phraseId] ?? recording), contributionId: updated._id },
      }));
      invalidateUserRecordingCache();
      return updated;
    },
    [installationId, invalidateUserRecordingCache],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [
          storedFavorites,
          storedTargetLanguage,
          storedOnboarding,
          storedRecordings,
          storedCategories,
          storedLanguages,
          storedWords,
          storedPhrases,
          storedVersion,
          instId,
        ] = await Promise.all([
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(SELECTED_LANGUAGE_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(RECORDINGS_KEY),
          loadCategories(),
          loadLanguages(),
          loadWords(),
          loadPhrases(),
          getLastPersistedContentVersion(),
          generateInstallationId(),
        ]);
        if (!active) return;
        if (storedFavorites) setFavoriteIds(JSON.parse(storedFavorites) as string[]);
        if (storedTargetLanguage) setTargetLanguageState(storedTargetLanguage);
        if (storedOnboarding === 'true') setHasCompletedOnboarding(true);
        if (storedRecordings) {
          try {
            const parsed = JSON.parse(storedRecordings) as Record<string, UserRecording>;
            setUserRecordings(parsed);
            primeUserRecordingCache(parsed);
          } catch {
            setUserRecordings({});
          }
        }
        if (storedCategories.length > 0) setCategories(storedCategories);
        if (storedLanguages.length > 0) setLanguages(storedLanguages);
        if (storedWords.length > 0) setRawWords(storedWords);
        if (storedPhrases.length > 0) setRawPhrases(storedPhrases);
        if (storedVersion > 0) setContentVersion(storedVersion);
        setInstallationId(instId);
      } catch {
        // App remains useful with empty state
      } finally {
        if (active) setIsReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isReady) void AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds, isReady]);

  // Keep the selected target language in sync with the backend language list:
  // once the languages are known, fall back to Hausa (or the first available
  // non-base language) if the stored choice is no longer learnable.
  useEffect(() => {
    if (languages.length === 0) return;
    const learnable = languages.filter((lang) => lang.isActive && lang.code !== baseLanguage);
    if (learnable.length === 0) return;
    if (learnable.some((lang) => lang.code === targetLanguage)) return;
    const next = learnable.find((lang) => lang.code === DEFAULT_TARGET_LANGUAGE) ?? learnable[0];
    setTargetLanguageState(next.code);
  }, [languages, baseLanguage, targetLanguage]);

  useEffect(() => {
    if (isReady) void AsyncStorage.setItem(SELECTED_LANGUAGE_KEY, targetLanguage);
  }, [targetLanguage, isReady]);

  useEffect(() => {
    if (isReady) void AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(userRecordings));
  }, [userRecordings, isReady]);

  useEffect(() => {
    if (!isReady) return;
    void sync();
  }, [isReady]);

  const saveUserRecording = useCallback(
    async (rec: UserRecording): Promise<UserRecording> => {
      // Always persist locally first so the user can play back immediately
      // even if the upload fails (we keep the local file as a fallback).
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUserRecordings((prev) => ({ ...prev, [rec.phraseId]: { ...rec } }));

      // Find the server-side content doc for this id. The list is flat (words
      // and phrases together), so decide the collection by which lookup hit,
      // never by object identity.
      const asPhrase = rawPhrases.find((p) => p._id === rec.phraseId);
      const asWord = rawWords.find((w) => w._id === rec.phraseId);
      const phraseOnServer = asPhrase ?? asWord;

      if (!phraseOnServer || !installationId) {
        // The content hasn't been synced yet (or the install id isn't ready) —
        // keep the local file. The next record attempt, after a successful
        // sync, will retry the upload.
        return rec;
      }

      const contentType: ContentType = asPhrase ? 'phrase' : 'word';

      try {
        // The recorder writes m4a on iOS/Android but WebM/Opus in the browser,
        // and the storage backend picks its codec from the declared mime type.
        const isWeb = Platform.OS === 'web';
        const mimeType = isWeb ? 'audio/webm' : 'audio/m4a';
        const extension = isWeb ? 'webm' : 'm4a';
        const updated = await submitAudioContribution(
          phraseOnServer._id,
          contentType,
          rec,
          mimeType,
          `phrase-${phraseOnServer._id}-${rec.createdAt}.${extension}`,
          targetLanguage,
        );

        const next: UserRecording = {
          ...rec,
          contributionId: updated._id,
          // Prefer the server-issued Cloudinary URL once the upload finishes.
          uri: updated.audio?.url ?? rec.uri,
        };
setUserRecordings((prev) => ({ ...prev, [rec.phraseId]: next }));
      invalidateUserRecordingCache();
      return next;
      } catch (err) {
        if (__DEV__) {
          console.warn('[bama] pronunciation upload failed:', err);
        }
        return rec;
      }
    },
    [installationId, rawPhrases, rawWords, submitAudioContribution, targetLanguage],
  );

  const deleteUserRecording = useCallback(async (phraseId: string) => {
    setUserRecordings((prev) => {
      const rec = prev[phraseId];
      if (rec && Paths.document && rec.uri.startsWith('file:')) {
        try {
          const file = new File(rec.uri);
          if (file.exists) {
            file.delete();
          }
        } catch {
          // no-op
        }
      }
      void Haptics.selectionAsync();
      const { [phraseId]: _removed, ...rest } = prev;
      return rest;
    });
    invalidateUserRecordingCache();
  }, [invalidateUserRecordingCache]);

  const getUserRecording = useCallback(
    (phraseId: string) => userRecordings[phraseId],
    [userRecordings],
  );

  const setTargetLanguage = useCallback((languageCode: TargetLanguage) => {
    void Haptics.selectionAsync();
    setTargetLanguageState(languageCode);
  }, []);

  const getTranslation = useCallback((phrase: Phrase): string => getPhraseTranslation(phrase, targetLanguage, baseLanguage), [targetLanguage, baseLanguage]);
  const getAudioUrl = useCallback((phrase: Phrase): string | null => getPhraseAudioUrl(phrase, targetLanguage, baseLanguage), [targetLanguage, baseLanguage]);

  const value = useMemo<AppContextValue>(
    () => ({
      installationId,
      categories,
      rawWords,
      rawPhrases,
      phrases,
      languages,
      contentVersion,
      isReady,
      isSyncing,
      lastSyncError,
      favoriteIds,
      targetLanguage,
      baseLanguage,
      hasCompletedOnboarding,
      userRecordings,
      sync,
      submitAudioContribution,
      toggleFavorite: (phraseId) => {
        void Haptics.selectionAsync();
        setFavoriteIds((current) =>
          current.includes(phraseId)
            ? current.filter((id) => id !== phraseId)
            : [...current, phraseId],
        );
      },
      isFavorite: (phraseId) => favoriteIds.includes(phraseId),
      setTargetLanguage,
      completeOnboarding: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setHasCompletedOnboarding(true);
        void AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      },
      saveUserRecording,
      deleteUserRecording,
      getUserRecording,
      getPhraseById,
      getCategoryBySlug,
      getTranslation,
      getAudioUrl,
    }),
    [
      categories,
      contentVersion,
      deleteUserRecording,
      favoriteIds,
      getCategoryBySlug,
      getPhraseById,
      getUserRecording,
      hasCompletedOnboarding,
      installationId,
      isReady,
      isSyncing,
      lastSyncError,
      phrases,
      rawPhrases,
      rawWords,
      saveUserRecording,
      submitAudioContribution,
      sync,
      userRecordings,
      targetLanguage,
      baseLanguage,
      setTargetLanguage,
      getTranslation,
      getAudioUrl,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
