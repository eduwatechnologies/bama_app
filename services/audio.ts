import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Phrase } from '@/types/phrase';
import type { UserRecording } from '@/context/AppContext';
import type { AlertOptions } from '@/components/AlertDialog';

const RECORDINGS_KEY = '@hausabridge/user-recordings';

type AlertFn = (opts: AlertOptions) => void;

let customAlert: AlertFn | null = null;

export function setAudioAlert(fn: AlertFn | null) {
  customAlert = fn;
}

function alertNativeOrCustom(
  variant: Required<AlertOptions>['variant'],
  title: string,
  message: string,
) {
  if (customAlert) {
    customAlert({ title, message, variant });
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Caches the user recordings map in memory so the first press on a phrase does
 * not have to await an AsyncStorage disk read before playback can even begin.
 */
let userRecordingCache: Record<string, UserRecording> | null = null;
let userRecordingCachePromise: Promise<Record<string, UserRecording>> | null = null;

async function loadUserRecordingMap(): Promise<Record<string, UserRecording>> {
  if (userRecordingCache) return userRecordingCache;
  if (userRecordingCachePromise) return userRecordingCachePromise;
  userRecordingCachePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
      userRecordingCache = raw ? (JSON.parse(raw) as Record<string, UserRecording>) : {};
    } catch {
      userRecordingCache = {};
    }
    userRecordingCachePromise = null;
    return userRecordingCache;
  })();
  return userRecordingCachePromise;
}

export function primeUserRecordingCache(parsed?: Record<string, UserRecording>): void {
  if (parsed) {
    userRecordingCache = parsed;
    userRecordingCachePromise = null;
    return;
  }
  void loadUserRecordingMap();
}

export function invalidateUserRecordingCache(): void {
  userRecordingCache = null;
  userRecordingCachePromise = null;
}

function userRecordingUri(phraseId: string): string | undefined {
  return userRecordingCache?.[phraseId]?.uri;
}

// Web audio playback
async function playUriWeb(uri: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const audio = new globalThis.Audio(uri);
    audio.preload = 'auto';
    audio.load();
    audio.oncanplaythrough = () => {
      audio.play().then(() => resolve(true)).catch(reject);
    };
    audio.onerror = (e) => {
      reject(new Error(`Failed to load audio: ${e}`));
    };
  });
}

// Native audio playback using expo-av
async function playUriNative(uri: string): Promise<boolean> {
  try {
    // Configure audio mode
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });

    // Create sound object
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );

    // Wait for playback to finish
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve();
      }, 30_000);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (settled) return;
        if (status.isLoaded) {
          if (status.didJustFinish) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        } else if (status.error) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(status.error));
        }
      });
    });

    // Unload sound after playback
    await sound.unloadAsync();
    return true;
  } catch (error) {
    console.error('Native audio playback error:', error);
    throw error;
  }
}

// Universal play function
async function playUri(uri: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return playUriWeb(uri);
  }

  try {
    return await playUriNative(uri);
  } catch (nativeError) {
    console.warn('Native playback failed, trying web fallback:', nativeError);
    try {
      return await playUriWeb(uri);
    } catch (webError) {
      console.error('Web fallback also failed:', webError);
      throw webError;
    }
  }
}

/**
 * Plays a bare audio URL (e.g. a single dictionary word) with the same error
 * handling used for phrase playback.
 */
export async function playAudioUrl(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    return await playUri(uri);
  } catch (err) {
    console.error('🔊 URL playback failed:', err);
    alertNativeOrCustom(
      'error',
      'Playback failed',
      err instanceof Error && err.message.length < 160
        ? err.message
        : 'We could not play this audio right now. Please try again later.',
    );
    return false;
  }
}

export async function playPhraseAudio(phrase: Phrase): Promise<boolean> {
  // Try user recording first
  const userUri = userRecordingUri(phrase.id);
  if (userUri) {
    try {
      return await playUri(userUri);
    } catch (err) {
      console.log('⚠️ User recording failed, falling back to default:', err);
    }
  }

  // Check if phrase has audio URL
  if (!phrase.audioUrl) {
    alertNativeOrCustom(
      'info',
      'Native audio coming soon',
      'This phrase is ready for a recorded Hausa-speaking voice. Audio has not been attached yet.',
    );
    return false;
  }

  try {
    return await playUri(phrase.audioUrl);
  } catch (err) {
    console.error('❌ Playback failed:', err);
    alertNativeOrCustom(
      'error',
      'Playback failed',
      err instanceof Error && err.message.length < 160
        ? err.message
        : 'We could not play this audio right now. Please try again later.',
    );
    return false;
  }
}