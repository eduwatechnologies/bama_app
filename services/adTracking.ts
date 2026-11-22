import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  generateInstallationId,
  recordAdEvents,
  type AdEventInput,
  type AdEventType,
} from './api';

const QUEUE_KEY = '@hausabridge/ad-events';
const MAX_BATCH = 20;

let queue: AdEventInput[] = [];
let loaded = false;
let flushing = false;

// Dedupe impressions per ad for the lifetime of the app session so a
// re-render (or re-mount) does not inflate counts. Clicks are always counted.
const seenImpressions = new Set<string>();

function devicePlatform(): string | undefined {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
    return Platform.OS.toUpperCase();
  }
  return undefined;
}

function appVersion(): string | undefined {
  try {
    return Constants.expoConfig?.version;
  } catch {
    return undefined;
  }
}

async function loadQueue(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) queue = JSON.parse(raw) as AdEventInput[];
  } catch {
    queue = [];
  }
}

async function persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort — a failed write only risks losing unsent events
  }
}

/**
 * Sends queued events in batches. Anything that fails stays in the queue so a
 * later call (next interaction, or app start) retries it. Never throws.
 */
export async function flushAdEvents(): Promise<void> {
  await loadQueue();
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const installationId = await generateInstallationId();
    while (queue.length > 0) {
      const batch = queue.slice(0, MAX_BATCH);
      await recordAdEvents({
        installationId,
        platform: devicePlatform(),
        appVersion: appVersion(),
        events: batch,
      });
      queue = queue.slice(batch.length);
      await persistQueue();
    }
  } catch {
    // Offline or server error: keep the remaining queue for the next attempt.
  } finally {
    flushing = false;
  }
}

function enqueue(type: AdEventType, adId: string, placement?: string, targetUrl?: string): void {
  void (async () => {
    await loadQueue();
    queue.push({ adId, type, placement, targetUrl, at: new Date().toISOString() });
    await persistQueue();
    void flushAdEvents();
  })();
}

export function trackAdImpression(adId: string, placement?: string): void {
  if (seenImpressions.has(adId)) return;
  seenImpressions.add(adId);
  enqueue('IMPRESSION', adId, placement);
}

export function trackAdClick(adId: string, placement?: string, targetUrl?: string): void {
  enqueue('CLICK', adId, placement, targetUrl);
}
