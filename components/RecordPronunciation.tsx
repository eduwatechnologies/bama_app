import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp, UserRecording } from '@/context/AppContext';
import { useAlert } from './AlertDialog';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';

type Status = 'idle' | 'requesting' | 'recording' | 'playing' | 'saving' | 'errored' | 'submitting' | 'submitted';

const MAX_RECORDING_MS = 15_000;
const MIN_RECORDING_MS = 350;

interface RecordPronunciationProps {
  phraseId: string;
  languageLabel?: string;
  /** Renders without the outer card chrome, for use inside a sheet or panel. */
  embedded?: boolean;
}

const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioQuality: 96,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 64000,
  },
};

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return mm > 0
    ? `${mm}:${ss.toString().padStart(2, '0')}.${tenths}`
    : `${ss}.${tenths}s`;
}

function isSharedObjectAlive(ref: { [key: string]: any }, methodName: string): boolean {
  if (!ref || typeof ref !== 'object') return false;
  const proto = Object.getPrototypeOf(ref);
  if (!proto) return typeof (ref as any)[methodName] === 'function';
  return typeof (proto as any)[methodName] === 'function' || typeof (ref as any)[methodName] === 'function';
}

export function RecordPronunciation({ phraseId, languageLabel, embedded = false }: RecordPronunciationProps) {
  const colors = useColors();
  const { show } = useAlert();
  const {
    saveUserRecording,
    deleteUserRecording,
    getUserRecording,
  } = useApp();
  const savedRecording = getUserRecording(phraseId);

  const [status, setStatus] = useState<Status>('idle');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'sent' | 'pending'>(
    savedRecording?.contributionId ? 'sent' : 'idle',
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 80);
  const player = useAudioPlayer(savedRecording?.uri ?? null, { updateInterval: 80 });

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSessionRef = useRef<{ startedAt: number; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const stopPlaybackTicker = useCallback(() => {
    if (playbackTickRef.current) {
      clearInterval(playbackTickRef.current);
      playbackTickRef.current = null;
    }
  }, []);

  const stopPulse = useCallback(() => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    void Animated.timing(pulse, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [pulse]);

  const startPulse = useCallback(() => {
    pulseLoop.current?.stop();
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 520, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    pulseLoop.current.start();
  }, [pulse]);

  useEffect(() => {
    return () => {
      pulseLoop.current?.stop();
      stopTicker();
      stopPlaybackTicker();
      const session = activeSessionRef.current;
      if (session) {
        clearTimeout(session.timeout);
        activeSessionRef.current = null;
      }
      try {
        if (isSharedObjectAlive(recorder, 'stop') && recorder.isRecording) {
          void recorder.stop();
        }
      } catch { /* noop */ }
      try {
        if (isSharedObjectAlive(player, 'pause') && player.playing) {
          player.pause();
        }
      } catch { /* noop */ }
    };
  }, [player, recorder, stopPlaybackTicker, stopTicker, pulse]);

  const requestMicrophone = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await requestRecordingPermissionsAsync();
      if (granted.granted) return true;
    } catch {
      // fall through
    }
    show({
      title: 'Microphone needed',
      message: 'Allow microphone access so you can record your pronunciation and compare it to the Hausa phrase.',
      variant: 'warning',
      buttons: [{ label: 'Got it', style: 'default' }],
    });
    return false;
  }, [show]);

  const finishRecording = useCallback(async (): Promise<void> => {
    stopTicker();
    stopPulse();
    const session = activeSessionRef.current;
    activeSessionRef.current = null;
    if (session) clearTimeout(session.timeout);
    if (!session) {
      setStatus('idle');
      return;
    }
    const durationMs = Math.max(MIN_RECORDING_MS, Date.now() - session.startedAt);
    if (durationMs < MIN_RECORDING_MS) {
      try {
        if (isSharedObjectAlive(recorder, 'stop')) {
          void recorder.stop();
        }
      } catch { /* noop */ }
      show({
        title: 'Too short',
        message: 'Record at least a moment longer so we can keep your pronunciation.',
        variant: 'info',
        buttons: [{ label: 'Try again' }],
      });
      setElapsedMs(0);
      setStatus('idle');
      return;
    }
    setStatus('saving');
    setUploadStatus('uploading');
    try {
      if (!isSharedObjectAlive(recorder, 'stop')) {
        throw new Error('Recorder is no longer available');
      }
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Recorder returned no URI');
      let sizeBytes: number | undefined;
      if (uri.startsWith('file:') && Platform.OS !== 'web') {
        try {
          const file = new File(uri);
          const size = file.size;
          if (file.exists && typeof size === 'number' && size > 0) {
            sizeBytes = size;
          }
        } catch {
          // ignore metadata read errors
        }
      }
      const payload: UserRecording = {
        phraseId,
        uri,
        durationMs,
        createdAt: Date.now(),
        sizeBytes,
      };
      const uploaded = await saveUserRecording(payload);
      setUploadStatus(uploaded.contributionId ? 'sent' : 'pending');
      setElapsedMs(0);
      setStatus('idle');
    } catch (err) {
      setStatus('errored');
      const message = err instanceof Error ? err.message : 'Unknown error';
      show({
        title: 'Could not save',
        message: message.length > 180 ? 'Your pronunciation was recorded but could not be saved. Try once more.' : message,
        variant: 'error',
      });
      setTimeout(() => setStatus((s) => (s === 'errored' ? 'idle' : s)), 900);
    }
  }, [phraseId, recorder, saveUserRecording, show, stopPulse, stopTicker]);

  const startRecording = useCallback(async () => {
    setStatus('requesting');
    const canRecord = await requestMicrophone();
    if (!canRecord) {
      setStatus('idle');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    } catch {
      // audio mode may not be supported on web; ignore
    }
    try {
      if (!isSharedObjectAlive(recorder, 'record') || !isSharedObjectAlive(recorder, 'prepareToRecordAsync')) {
        throw new Error('Recorder is no longer available');
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      const startedAt = Date.now();
      setElapsedMs(0);
      tickerRef.current = setInterval(() => {
        const delta = Date.now() - startedAt;
        setElapsedMs(delta);
        if (delta >= MAX_RECORDING_MS) {
          void finishRecording();
        }
      }, 80);
      startPulse();
      const timeout = setTimeout(() => void finishRecording(), MAX_RECORDING_MS + 40);
      activeSessionRef.current = { startedAt, timeout };
      setStatus('recording');
    } catch (err) {
      stopTicker();
      stopPulse();
      setStatus('errored');
      const message = err instanceof Error ? err.message : 'Unknown error';
      show({
        title: 'Recording failed',
        message: message.length > 180 ? 'The microphone could not start. Please try again after a moment.' : message,
        variant: 'error',
      });
      setTimeout(() => setStatus((s) => (s === 'errored' ? 'idle' : s)), 900);
    }
  }, [recorder, requestMicrophone, show, startPulse, stopPulse, stopTicker, finishRecording]);

  const cancelRecording = useCallback(async () => {
    stopTicker();
    stopPulse();
    const session = activeSessionRef.current;
    activeSessionRef.current = null;
    if (session) clearTimeout(session.timeout);
    try {
      if (isSharedObjectAlive(recorder, 'stop')) {
        await recorder.stop();
      }
    } catch { /* noop */ }
    const uri = isSharedObjectAlive(recorder, 'stop') ? recorder.uri : null;
    if (uri && uri.startsWith('file:') && Platform.OS !== 'web') {
      try {
        const file = new File(uri);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // ignore cleanup errors
      }
    }
    setElapsedMs(0);
    setStatus('idle');
  }, [recorder, stopPulse, stopTicker]);

  const playRecording = useCallback(async (rec: UserRecording) => {
    if (status === 'playing') return;
    if (!isSharedObjectAlive(player, 'seekTo') || !isSharedObjectAlive(player, 'play')) {
      show({
        title: 'Playback unavailable',
        message: 'The player is not ready. Please go back and open this phrase again.',
        variant: 'info',
      });
      return;
    }
    try {
      player.seekTo(0);
      setPlaybackMs(0);
      setPlaybackDuration(rec.durationMs);
      setStatus('playing');
      const startedAt = Date.now();
      const limit = rec.durationMs + 450;
      playbackTickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const ct = isSharedObjectAlive(player, 'play') && player.currentTime ? Math.floor(player.currentTime) : elapsed;
        setPlaybackMs(Math.min(rec.durationMs, ct));
        if (Date.now() - startedAt > limit) {
          stopPlaybackTicker();
          setPlaybackMs(rec.durationMs);
          setStatus((s) => (s === 'playing' ? (savedRecording?.contributionId ? 'submitted' : 'idle') : s));
        }
      }, 80);
      player.play();
    } catch (err) {
      stopPlaybackTicker();
      setStatus('errored');
      const message = err instanceof Error ? err.message : 'Unknown error';
      show({
        title: 'Playback failed',
        message: message.length > 180 ? 'We could not play your pronunciation. Try recording it again.' : message,
        variant: 'error',
      });
      setTimeout(() => setStatus((s) => (s === 'errored' ? (savedRecording?.contributionId ? 'submitted' : 'idle') : s)), 900);
    }
  }, [player, savedRecording?.contributionId, show, status, stopPlaybackTicker]);

  const confirmDelete = useCallback(() => {
    void Haptics.selectionAsync();
    show({
      title: 'Delete this recording?',
      message: savedRecording
        ? `Recorded ${formatDuration(savedRecording.durationMs)} · ${new Date(savedRecording.createdAt).toLocaleDateString()}`
        : 'This recording will be permanently removed from this device.',
      variant: 'confirm',
      dismissible: false,
      buttons: [
        { label: 'Keep', style: 'cancel' },
        {
          label: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteUserRecording(phraseId);
            setStatus('idle');
          },
        },
      ],
    });
  }, [deleteUserRecording, phraseId, savedRecording, show]);

  const recButtonPress = useCallback(() => {
    if (status === 'idle' || status === 'submitted') {
      void startRecording();
    } else if (status === 'recording') {
      void finishRecording();
    } else if (status === 'requesting' || status === 'saving') {
      // Ignore taps while async work is in flight
    }
  }, [finishRecording, startRecording, status]);

  const canPlaySaved = savedRecording && (status === 'idle' || status === 'submitted');
  const primaryLabel =
    status === 'recording' ? 'Stop' :
    status === 'requesting' ? 'Starting…' :
    status === 'saving' ? 'Saving…' :
    status === 'playing' ? 'Playing…' :
    status === 'submitting' ? 'Sending…' :
    status === 'errored' ? 'Retry' :
    savedRecording ? 'Re-record' : 'Record';

  // Touch recorderState so the linter doesn't drop the import.
  void recorderState;

  return (
    <View
      style={[
        styles.wrap,
        embedded
          ? styles.wrapEmbedded
          : { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {!embedded && (
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}16` }]}>
            <Feather name="mic" size={18} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>Contribute Pronunciation</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {/* {languageLabel
                ? `Record yourself saying the ${languageLabel} phrase. Tap to record, tap again to save.`
                : 'Record yourself saying the phrase. Tap to record, tap again to save.'} */}
                Record a natural Hausa voice
            </Text>
          </View>
        </View>
      )}

      {savedRecording && status !== 'playing' && status !== 'recording' && status !== 'saving' && (
        <View style={[styles.savedRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Pressable
            disabled={!canPlaySaved}
            onPress={() => playRecording(savedRecording)}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: colors.background, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Play your saved pronunciation"
          >
            <Feather name="play" size={14} color={colors.foreground} />
          </Pressable>
          <View style={styles.savedInfo}>
            <View style={[styles.progress, { backgroundColor: `${colors.primary}22` }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${elapsedMs > 0 ? Math.min(100, (playbackMs / Math.max(1, playbackDuration)) * 100) : 100}%` },
                ]}
              />
            </View>
            <View style={styles.savedMeta}>
              <View style={styles.savedMetaLeft}>
                <Text style={[styles.savedLabel, { color: colors.foreground }]}>
                  Saved · {formatDuration(savedRecording.durationMs)}
                </Text>
                {savedRecording.contributionId ? (
                  <Text style={[styles.submittedTag, { color: colors.secondary ?? colors.primary }]}>
                    ✓ Submitted for review
                  </Text>
                ) : uploadStatus === 'uploading' ? (
                  <Text style={[styles.submittedTag, { color: colors.mutedForeground }]}>
                    Uploading…
                  </Text>
                ) : uploadStatus === 'pending' ? (
                  <Text style={[styles.submittedTag, { color: colors.mutedForeground }]}>
                    Saved offline · will upload on next sync
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.savedStamp, { color: colors.mutedForeground }]}>
                {new Date(savedRecording.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: `${colors.destructive}16` },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete your saved pronunciation"
          >
            <Feather name="trash-2" size={15} color={colors.destructive} />
          </Pressable>
        </View>
      )}

      {status === 'playing' && savedRecording && (
        <View style={[styles.savedRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={[styles.playButton, { backgroundColor: `${colors.primary}16` }]}>
            <Feather name="play" size={14} color={colors.primary} />
          </View>
          <View style={styles.savedInfo}>
            <View style={[styles.progress, { backgroundColor: `${colors.primary}22` }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${playbackDuration > 0 ? Math.min(100, (playbackMs / playbackDuration) * 100) : 0}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.savedMeta}>
              <Text style={[styles.savedLabel, { color: colors.foreground }]}>
                Playing · {formatDuration(playbackMs)} / {formatDuration(savedRecording.durationMs)}
              </Text>
              <Text style={[styles.savedStamp, { color: colors.mutedForeground }]}>
                Your recording
              </Text>
            </View>
          </View>
        </View>
      )}

      {status === 'recording' && (
        <View style={[styles.recordingRow, { backgroundColor: `${colors.destructive}10` }]}>
          <Animated.View
            style={[
              styles.recDot,
              { backgroundColor: colors.destructive, transform: [{ scale: pulse }] },
            ]}
          />
          <View style={styles.recInfo}>
            <View style={[styles.progress, { backgroundColor: `${colors.destructive}22` }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.destructive, width: `${Math.min(100, (elapsedMs / MAX_RECORDING_MS) * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.savedMeta}>
              <Text style={[styles.savedLabel, { color: colors.foreground }]}>Recording…</Text>
              <Text style={[styles.savedStamp, { color: colors.mutedForeground }]}>
                {formatDuration(elapsedMs)} · max 15s
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => void cancelRecording()}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          onPress={recButtonPress}
          disabled={status === 'requesting' || status === 'saving' || status === 'playing' || status === 'submitting'}
          style={({ pressed }) => [
            styles.recordButton,
            {
              backgroundColor:
                status === 'recording' ? colors.destructive :
                status === 'errored' ? colors.accent :
                colors.primary,
            },
            pressed && styles.recordButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Feather
            name={status === 'recording' ? 'square' : 'mic'}
            size={17}
            color={
              status === 'recording' ? '#fffdf9' :
              status === 'errored' ? colors.accentForeground :
              colors.primaryForeground
            }
          />
          <Text
            numberOfLines={1}
            style={[
              styles.recordLabel,
              {
                color:
                  status === 'recording' ? '#fffdf9' :
                  status === 'errored' ? colors.accentForeground :
                  colors.primaryForeground,
              },
            ]}
          >
            {primaryLabel}
          </Text>
        </Pressable>

        {savedRecording && status === 'idle' && (
          <Pressable
            onPress={() => playRecording(savedRecording)}
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: colors.background, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Play your pronunciation"
          >
            <Feather name="play" size={15} color={colors.foreground} />
            <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>Play mine</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  wrapEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    gap: 12,
  },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { flex: 1, gap: 3 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderRadius: 16,
  },
  recDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    flexShrink: 0,
  },
  recInfo: { flex: 1, gap: 8 },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  savedInfo: { flex: 1, gap: 8 },
  progress: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  savedMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  savedMetaLeft: { gap: 2, flexShrink: 1 },
  savedLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  submittedTag: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  savedStamp: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  recordButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  recordButtonPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  recordLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.85 },
});
