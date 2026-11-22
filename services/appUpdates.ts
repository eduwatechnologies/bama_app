import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { ApiAppVersion, fetchAppVersion } from './api';

/** Fallback Play Store listing, used when the server omits a store URL. */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.sodiqabdulazeez.hausabridge';

/** Compares two dotted numeric versions. Returns -1, 0 or 1 (a vs b). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => parseInt(part, 10) || 0);
  const pb = b.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export type UpdateDecision = 'force' | 'optional';

/** Decides whether the running version is behind the server's update policy. */
export function decideUpdate(currentVersion: string, policy: ApiAppVersion): UpdateDecision | null {
  if (!policy.enabled) return null;
  if (compareVersions(currentVersion, policy.minVersion) < 0) return 'force';
  if (compareVersions(currentVersion, policy.latestVersion) < 0) return 'optional';
  return null;
}

/** Fetches the update policy. Rejects on network/parse failure. */
export async function fetchUpdatePolicy(): Promise<ApiAppVersion> {
  return fetchAppVersion();
}

/**
 * Checks EAS for an OTA (JS-only) update and downloads it when available.
 * Returns true when an update is ready to apply on the next reload. Skipped on
 * web and whenever expo-updates is disabled (e.g. Expo Go / dev builds).
 */
export async function checkForOtaUpdate(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    return true;
  } catch {
    return false;
  }
}

/** Applies a downloaded OTA update by relaunching the app. */
export async function applyOtaUpdate(): Promise<void> {
  await Updates.reloadAsync();
}
