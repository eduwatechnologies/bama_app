import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// export const API_BASE_URL = 'https://bama-server-9d2g.onrender.com/api/v1';
export const API_BASE_URL = 'http://192.168.1.118:4000/api/v1';



const INSTALLATION_ID_KEY = '@hausabridge/installationId';
const CONTENT_VERSION_KEY = '@hausabridge/contentVersion';
const CATEGORIES_KEY = '@hausabridge/categories';
const WORDS_KEY = '@hausabridge/words';
const PHRASES_KEY = '@hausabridge/phrases';

export interface ApiCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  isRTL: boolean;
  flag: string;
  isActive: boolean;
  order: number;
}

export interface AudioMeta {
  url?: string;
  storageKey?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
}

/** Audio URLs keyed by language code (e.g., { en: null, ha: 'url', yo: 'url' }) */
export type AudioMap = Record<string, string | null | AudioMeta>;

/** Translations keyed by language code (e.g., { en: 'Hello', ha: 'Sannu', yo: 'Bawo' }) */
export type Translations = Record<string, string>;

/** Example sentences keyed by language code */
export type ExampleSentenceMap = Record<string, string>;

export interface ApiWord {
  _id: string;
  /** Translations keyed by language code */
  translations: Translations;
  description?: string;
  categoryId: string | ApiCategory;
  /** Example sentences keyed by language code */
  exampleSentence?: ExampleSentenceMap;
  /** Audio URLs keyed by language code */
  audio?: AudioMap;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiPhrase {
  _id: string;
  /** Translations keyed by language code */
  translations: Translations;
  categoryId: string | ApiCategory;
  /** Audio URLs keyed by language code */
  audio?: AudioMap;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ContributionType = 'WORD' | 'PHRASE' | 'TRANSLATION' | 'CORRECTION' | 'AUDIO';
export type ContributionStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';
export type ReportKind = 'PRONUNCIATION' | 'TRANSLATION' | 'ENGLISH' | 'PROBLEM';
export type IssueCategory =
  | 'DUPLICATE'
  | 'WRONG_CATEGORY'
  | 'OFFENSIVE'
  | 'INACCURATE'
  | 'BROKEN_AUDIO'
  | 'OTHER';

/** Translations keyed by language code for contributions */
export type ContributionTranslations = Record<string, string>;

export interface Contribution {
  _id: string;
  type: ContributionType;
  status: ContributionStatus;
  installationId?: string;
  /** Translations keyed by language code */
  translations?: ContributionTranslations;
  /** Suggested translations for corrections */
  suggestedTranslations?: ContributionTranslations;
  categoryId?: string;
  contentType?: 'word' | 'phrase';
  contentId?: string;
  reportKind?: ReportKind;
  issueCategory?: IssueCategory;
  actionable?: boolean;
  notes?: string;
  reason?: string;
  reviewNotes?: string;
  audio?: AudioMeta;
  createdAt: string;
  updatedAt: string;
}

export type AdType = 'GOOGLE' | 'PERSONAL';
export type AdStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type GoogleAdFormat = 'BANNER' | 'INTERSTITIAL' | 'REWARDED' | 'NATIVE';

export interface GoogleAdPayload {
  adUnitId: string;
  format: GoogleAdFormat;
  testMode: boolean;
}

export interface PersonalAdPayload {
  title: string;
  body: string;
  imageUrl?: string;
  imageUrls?: string[];
  targetUrl?: string;
  ctaText?: string;
}

export interface ApiAd {
  _id: string;
  name: string;
  type: AdType;
  placement: string;
  status: AdStatus;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  google?: GoogleAdPayload;
  personal?: PersonalAdPayload;
  createdAt: string;
  updatedAt: string;
}

interface SyncChange {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'word' | 'phrase';
  id: string;
  data?: ApiWord | ApiPhrase;
}

interface SyncResponse {
  serverVersion: number;
  clientVersion: number;
  requiresFullSync: boolean;
  changes: SyncChange[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: unknown };
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  // Every JSON caller pre-serializes with JSON.stringify, so the body arrives
  // here as a string and must still be labelled application/json — otherwise
  // express.json() skips it and the server validates an empty object.
  // FormData (multipart audio upload) and Blob must keep their own boundaries.
  const isBinaryBody =
    typeof Blob !== 'undefined' && (init.body instanceof Blob || init.body instanceof ArrayBuffer);
  if (init.body && !(init.body instanceof FormData) && !isBinaryBody) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...init, headers });
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // Some endpoints (e.g. 500) may not return JSON
  }
  if (!res.ok) {
    const failure = body as ApiErrorBody | null;
    const details = failure?.error?.details?.length
      ? ` (${failure.error.details.map((d) => `${d.field}: ${d.message}`).join('; ')})`
      : '';
    const msg = failure?.error?.message
      ? `${failure.error.message}${details}`
      : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  if (!body || body.success === false || body.data === undefined) {
    throw new Error(body?.error?.message ?? 'Invalid API response');
  }
  return body.data;
}

export async function generateInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const rand = Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join('');
  const id = `bama-${Platform.OS}-${rand}`;
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, id);
  return id;
}

export async function registerInstallation(installationId: string): Promise<unknown> {
  let appVersion: string | undefined;
  try {
    appVersion = Constants.expoConfig?.version;
  } catch {
    appVersion = undefined;
  }
  const platform = (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web')
    ? Platform.OS.toUpperCase()
    : 'UNKNOWN';
  return request<unknown>('/installations/register', {
    method: 'POST',
    body: JSON.stringify({
      installationId,
      appVersion,
      platform,
      deviceLanguage: Platform.OS === 'web' ? undefined : undefined,
    }),
  });
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  return request<ApiCategory[]>('/categories');
}

export async function fetchLanguages(): Promise<Language[]> {
  return request<Language[]>('/languages');
}

export async function fetchAds(params: {
  type?: AdType;
  placement?: string;
  limit?: number;
} = {}): Promise<ApiAd[]> {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  if (params.placement) qs.set('placement', params.placement);
  if (params.limit && params.limit > 0) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request<ApiAd[]>(`/ads${query ? `?${query}` : ''}`);
}

export async function syncContent(
  installationId: string | undefined,
  currentVersion: number,
): Promise<SyncResponse> {
  const qs = new URLSearchParams({ version: String(currentVersion) });
  if (installationId) qs.set('installationId', installationId);
  return request<SyncResponse>(`/sync?${qs.toString()}`);
}

export async function getLastPersistedContentVersion(): Promise<number> {
  const raw = await AsyncStorage.getItem(CONTENT_VERSION_KEY);
  if (!raw) return 0;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export async function persistContentVersion(v: number): Promise<void> {
  await AsyncStorage.setItem(CONTENT_VERSION_KEY, String(v));
}

export async function persistCategories(categories: ApiCategory[]): Promise<void> {
  await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export async function loadCategories(): Promise<ApiCategory[]> {
  const raw = await AsyncStorage.getItem(CATEGORIES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ApiCategory[];
  } catch {
    return [];
  }
}

export async function persistWords(words: ApiWord[]): Promise<void> {
  await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(words));
}

export async function loadWords(): Promise<ApiWord[]> {
  const raw = await AsyncStorage.getItem(WORDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ApiWord[];
  } catch {
    return [];
  }
}

export async function persistPhrases(phrases: ApiPhrase[]): Promise<void> {
  await AsyncStorage.setItem(PHRASES_KEY, JSON.stringify(phrases));
}

export async function loadPhrases(): Promise<ApiPhrase[]> {
  const raw = await AsyncStorage.getItem(PHRASES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ApiPhrase[];
  } catch {
    return [];
  }
}

export async function createContribution<
  T extends
    | { type: 'WORD' | 'PHRASE'; english: string; hausa: string; categoryId: string; notes?: string; installationId: string }
    | { type: 'TRANSLATION'; contentType: 'word' | 'phrase'; contentId: string; hausa: string; notes?: string; installationId: string }
    | {
        type: 'CORRECTION';
        contentType: 'word' | 'phrase';
        contentId: string;
        suggestedEnglish?: string;
        suggestedHausa?: string;
        reason: string;
        reportKind?: ReportKind;
        issueCategory?: IssueCategory;
        installationId: string;
      }
    | {
        type: 'AUDIO';
        contentType: 'word' | 'phrase';
        contentId: string;
        notes?: string;
        /** ISO language code the recording pronounces (e.g. 'ha'). Sent from the
         *  user's selected target language at record time so the server can merge
         *  it into the per-language audio map without clobbering other languages. */
        language?: string;
        installationId: string;
      },
>(body: T): Promise<Contribution> {
  return request<Contribution>('/contributions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Builds the multipart part for an uploaded recording.
 *
 * On iOS/Android React Native accepts the {uri,name,type} shorthand. The web
 * build has no such handling, so the object would be stringified into a plain
 * text field and the server would see no file at all — resolve the blob URL
 * into a real File instead.
 */
async function toFilePart(
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<Blob> {
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    return new File([blob], fileName, { type: mimeType });
  }
  return { uri: fileUri, name: fileName, type: mimeType } as unknown as Blob;
}

export async function uploadContributionAudio(
  contributionId: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  durationSeconds?: number,
): Promise<Contribution> {
  const part = await toFilePart(fileUri, fileName, mimeType);
  const formData = new FormData();
  formData.append('audio', part);
  const qs = durationSeconds !== undefined && durationSeconds >= 0
    ? `?duration=${durationSeconds}`
    : '';
  return request<Contribution>(`/contributions/${contributionId}/audio${qs}`, {
    method: 'POST',
    body: formData,
  });
}

export async function getContributionById(id: string): Promise<Contribution> {
  return request<Contribution>(`/contributions/${id}`);
}
