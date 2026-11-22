import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const MANIFEST_KEY = '@hausabridge/audio-cache';
const MAX_CACHE_BYTES = 200 * 1024 * 1024;

export interface AudioCacheEntry {
  contentId: string;
  language: string;
  sourceFingerprint: string;
  localUri: string;
  size: number;
  downloadedAt: number;
  lastAccess: number;
}

export interface PackItem {
  contentId: string;
  language: string;
  url: string;
  size?: number;
}

export const isWeb = Platform.OS === 'web';

let manifestCache: Record<string, AudioCacheEntry> | null = null;
let manifestPromise: Promise<Record<string, AudioCacheEntry>> | null = null;

async function loadManifest(): Promise<Record<string, AudioCacheEntry>> {
  if (manifestCache) return manifestCache;
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(MANIFEST_KEY);
      manifestCache = raw ? (JSON.parse(raw) as Record<string, AudioCacheEntry>) : {};
    } catch {
      manifestCache = {};
    }
    manifestPromise = null;
    return manifestCache;
  })();
  return manifestPromise;
}

async function saveManifest(map: Record<string, AudioCacheEntry>): Promise<void> {
  manifestCache = map;
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(map));
}

function cacheKey(contentId: string, language: string): string {
  return `${contentId}:${language}`;
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    return Boolean(new File(uri).exists);
  } catch {
    return false;
  }
}

async function deleteFile(uri: string): Promise<void> {
  try {
    await new File(uri).delete();
  } catch {}
}

async function downloadToFile(url: string, dest: File): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = res.body;
  if (!body) throw new Error('No response body');
  const reader = body.getReader();
  const writer = dest.writableStream().getWriter();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
  } finally {
    reader.releaseLock();
    await writer.close();
  }
}

async function getEntry(contentId: string, language: string): Promise<AudioCacheEntry | null> {
  const map = await loadManifest();
  return map[cacheKey(contentId, language)] ?? null;
}

async function touchLastAccess(contentId: string, language: string): Promise<void> {
  const map = await loadManifest();
  const key = cacheKey(contentId, language);
  const entry = map[key];
  if (entry) {
    entry.lastAccess = Date.now();
    await saveManifest(map);
  }
}

export async function resolveAudioUri(contentId: string, language: string, url: string | null): Promise<{ uri: string; isCached: boolean }> {
  if (!url) return { uri: '', isCached: false };
  if (isWeb) return { uri: url, isCached: false };
  const entry = await getEntry(contentId, language);
  if (entry && entry.sourceFingerprint === url && await fileExists(entry.localUri)) {
    await touchLastAccess(contentId, language);
    return { uri: entry.localUri, isCached: true };
  }
  return { uri: url, isCached: false };
}

export async function cacheAudio(contentId: string, language: string, url: string, size?: number): Promise<string> {
  if (isWeb) return url;
  const file = new File(Paths.cache, `${contentId}-${language}.mp3`);
  await downloadToFile(url, file);
  const map = await loadManifest();
  map[cacheKey(contentId, language)] = {
    contentId,
    language,
    sourceFingerprint: url,
    localUri: file.uri,
    size: size ?? 0,
    downloadedAt: Date.now(),
    lastAccess: Date.now(),
  };
  await saveManifest(map);
  await trimCache(map);
  return file.uri;
}

async function trimCache(map: Record<string, AudioCacheEntry>): Promise<void> {
  let total = 0;
  for (const entry of Object.values(map)) total += entry.size || 0;
  if (total <= MAX_CACHE_BYTES) return;
  const entries = Object.entries(map).sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  const next: Record<string, AudioCacheEntry> = {};
  let kept = 0;
  for (const [key, entry] of entries) {
    if (total <= MAX_CACHE_BYTES) {
      next[key] = entry;
      kept++;
      continue;
    }
    await deleteFile(entry.localUri);
    total -= entry.size || 0;
  }
  await saveManifest(next);
}

export async function downloadLanguagePack(language: string, items: PackItem[], onProgress?: (completed: number, total: number) => void | Promise<void>): Promise<void> {
  if (isWeb) {
    if (onProgress) await onProgress(items.length, items.length);
    return;
  }
  const map = await loadManifest();
  let completed = 0;
  for (const item of items) {
    const key = cacheKey(item.contentId, language);
    const existing = map[key];
    if (existing && existing.sourceFingerprint === item.url && await fileExists(existing.localUri)) {
      completed++;
      if (onProgress) await onProgress(completed, items.length);
      continue;
    }
    try {
      const file = new File(Paths.cache, `${item.contentId}-${language}.mp3`);
      await downloadToFile(item.url, file);
      map[key] = {
        contentId: item.contentId,
        language,
        sourceFingerprint: item.url,
        localUri: file.uri,
        size: item.size ?? 0,
        downloadedAt: Date.now(),
        lastAccess: Date.now(),
      };
    } catch {}
    completed++;
    await saveManifest(map);
    if (onProgress) await onProgress(completed, items.length);
  }
}

export async function removeLanguagePack(language: string): Promise<number> {
  if (isWeb) return 0;
  const map = await loadManifest();
  let removed = 0;
  const next: Record<string, AudioCacheEntry> = {};
  for (const [key, entry] of Object.entries(map)) {
    if (entry.language === language) {
      await deleteFile(entry.localUri);
      removed++;
      continue;
    }
    next[key] = entry;
  }
  await saveManifest(next);
  return removed;
}

export async function getCachedEntry(contentId: string, language: string): Promise<AudioCacheEntry | null> {
  return getEntry(contentId, language);
}
