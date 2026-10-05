import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Phrase, PhraseCategory, ContentType } from '@/types/phrase';
import {
  ApiCategory,
  ApiPhrase,
  ApiWord,
  createContribution,
  fetchCategories,
  generateInstallationId,
  getLastPersistedContentVersion,
  loadCategories,
  loadPhrases,
  loadWords,
  persistCategories,
  persistContentVersion,
  persistPhrases,
  persistWords,
  registerInstallation,
  syncContent,
  uploadContributionAudio,
  Contribution as ApiContribution,
} from '@/services/api';
import { invalidateUserRecordingCache, primeUserRecordingCache } from '@/services/audio';

const FAVORITES_KEY = '@hausabridge/favorites';
const DIRECTION_KEY = '@hausabridge/direction';
const ONBOARDING_KEY = '@hausabridge/onboarding-complete';
const RECORDINGS_KEY = '@hausabridge/user-recordings';

export type AppDirection = 'english-to-hausa' | 'hausa-to-english';

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
  contentVersion: number;
  isReady: boolean;
  isSyncing: boolean;
  lastSyncError: string | null;
  favoriteIds: string[];
  direction: AppDirection;
  hasCompletedOnboarding: boolean;
  userRecordings: Record<string, UserRecording>;
  sync: () => Promise<void>;
  submitAudioContribution: (
    phraseId: string,
    contentType: 'word' | 'phrase',
    recording: UserRecording,
    mimeType: string,
    fileName: string,
  ) => Promise<ApiContribution>;
  toggleFavorite: (phraseId: string) => void;
  isFavorite: (phraseId: string) => boolean;
  setDirection: (direction: AppDirection) => void;
  completeOnboarding: () => void;
  saveUserRecording: (rec: UserRecording) => Promise<UserRecording>;
  deleteUserRecording: (phraseId: string) => Promise<void>;
  getUserRecording: (phraseId: string) => UserRecording | undefined;
  getPhraseById: (id: string) => Phrase | undefined;
  getCategoryBySlug: (slug: string) => ApiCategory | undefined;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function normalizeToFrontend(
  items: (ApiWord | ApiPhrase)[],
  categoriesById: Record<string, ApiCategory>,
  contentType: ContentType,
): Phrase[] {
  return items.map((item) => {
    const categoryRef = item.categoryId;
    let category = '';
    if (typeof categoryRef === 'string') {
      category = categoriesById[categoryRef]?.name ?? '';
    } else if (categoryRef && typeof categoryRef === 'object') {
      category = (categoryRef as ApiCategory).name;
    }
    const audioUrl = (item as ApiPhrase | ApiWord).audio?.url ?? null;
    const pronunciation = (item as ApiWord).exampleSentence?.hausa ?? (item as ApiPhrase | ApiWord).hausa;
    return {
      id: item._id,
      category,
      english: item.english,
      hausa: item.hausa,
      pronunciation,
      audioUrl,
      isFavorite: false,
      contentType,
    };
  });
}

export function AppProvider({ children }: PropsWithChildren) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [direction, setDirectionState] = useState<AppDirection>('english-to-hausa');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [userRecordings, setUserRecordings] = useState<Record<string, UserRecording>>({});

  const [installationId, setInstallationId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [rawWords, setRawWords] = useState<ApiWord[]>([]);
  const [rawPhrases, setRawPhrases] = useState<ApiPhrase[]>([]);
  const [contentVersion, setContentVersion] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const categoriesById = useMemo(() => {
    const map: Record<string, ApiCategory> = {};
    for (const c of categories) map[c._id] = c;
    return map;
  }, [categories]);

  const phrases = useMemo<Phrase[]>(
    () => [
      ...normalizeToFrontend(rawWords, categoriesById, 'word'),
      ...normalizeToFrontend(rawPhrases, categoriesById, 'phrase'),
    ],
    [categoriesById, rawPhrases, rawWords],
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
      // Categories are admin-managed and are NOT part of the versioned content
      // change feed, so they can change without serverVersion moving. Always
      // refetch them; otherwise a category added in the dashboard never reaches
      // the device until a full sync happens to trigger.
      let latestCategories = categories;
      try {
        latestCategories = await fetchCategories();
        setCategories(latestCategories);
        await persistCategories(latestCategories);
      } catch {
        // fall back to cached categories
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
    ): Promise<ApiContribution> => {
      if (!installationId) throw new Error('App is not registered yet');
      const contribution = await createContribution({
        type: 'AUDIO',
        contentType,
        contentId: phraseId,
        notes: 'Pronunciation recording submitted from mobile app',
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
          storedDirection,
          storedOnboarding,
          storedRecordings,
          storedCategories,
          storedWords,
          storedPhrases,
          storedVersion,
          instId,
        ] = await Promise.all([
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(DIRECTION_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(RECORDINGS_KEY),
          loadCategories(),
          loadWords(),
          loadPhrases(),
          getLastPersistedContentVersion(),
          generateInstallationId(),
        ]);
        if (!active) return;
        if (storedFavorites) setFavoriteIds(JSON.parse(storedFavorites) as string[]);
        if (storedDirection === 'hausa-to-english' || storedDirection === 'english-to-hausa') {
          setDirectionState(storedDirection);
        }
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

  useEffect(() => {
    if (isReady) void AsyncStorage.setItem(DIRECTION_KEY, direction);
  }, [direction, isReady]);

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
    [installationId, rawPhrases, rawWords, submitAudioContribution],
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

  const value = useMemo<AppContextValue>(
    () => ({
      installationId,
      categories,
      rawWords,
      rawPhrases,
      phrases,
      contentVersion,
      isReady,
      isSyncing,
      lastSyncError,
      favoriteIds,
      direction,
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
      setDirection: (nextDirection) => {
        void Haptics.selectionAsync();
        setDirectionState(nextDirection);
      },
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
    }),
    [
      categories,
      contentVersion,
      deleteUserRecording,
      direction,
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
