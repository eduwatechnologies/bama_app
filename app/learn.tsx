import { Feather } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Phrase } from '@/types/phrase';
import { playPhraseAudio } from '@/services/audio';
import { fetchLearningProgress, pushLearningProgress } from '@/services/api';
import { EmptyState } from '@/components/EmptyState';
import { DailyWordShareCard } from '@/components/DailyWordShareCard';
import {
  DEFAULT_PROGRESS,
  LearningProgress,
  getRecentLearnedWords,
  isLearnedToday,
  loadProgress,
  markWordLearned,
  mergeProgress,
  saveProgress,
  selectDailyWord,
  toDateKey,
} from '@/services/learningPath';
import {
  DEFAULT_REMINDER,
  LearningReminderSettings,
  ReminderPermission,
  formatReminderTime,
  getReminderPermissionAsync,
  loadReminderSettings,
  requestReminderPermissionAsync,
  saveReminderSettings,
  syncLearningReminder,
} from '@/services/learningReminder';

export default function LearnScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    phrases,
    rawWords,
    installationId,
    targetLanguage,
    baseLanguage,
    isReady,
    isSyncing,
    languages,
    getTranslation,
    getAudioUrl,
  } = useApp();

  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [reminder, setReminder] = useState<LearningReminderSettings | null>(null);
  const [permission, setPermission] = useState<ReminderPermission>('undetermined');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  const todayKey = toDateKey();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  // Learn is reached from Settings (and from the daily notification), so prefer
  // popping back to where the user came from.
  const goToSettings = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/settings');
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [loadedProgress, loadedReminder, loadedPermission] = await Promise.all([
          loadProgress(todayKey),
          loadReminderSettings(),
          getReminderPermissionAsync(),
        ]);
        // Restore any server backup (optional, non-blocking): merge it into the
        // local snapshot so reconnecting never loses offline progress.
        let merged = loadedProgress;
        if (installationId) {
          try {
            const remote = await fetchLearningProgress(installationId);
            merged = mergeProgress(loadedProgress, remote);
            if (merged !== loadedProgress) {
              await saveProgress(merged);
              void pushLearningProgress(installationId, merged).catch(() => {});
            }
          } catch {
            // Offline or unreachable — local progress stands on its own.
          }
        }
        if (!active) return;
        setProgress(merged);
        setReminder(loadedReminder);
        setPermission(loadedPermission);
      })();
      return () => {
        active = false;
      };
    }, [installationId, todayKey]),
  );

  const currentProgress = progress ?? DEFAULT_PROGRESS;

  const dailyWord = useMemo(
    () =>
      selectDailyWord(phrases, {
        targetLanguage,
        baseLanguage,
        installationId,
        dateKey: todayKey,
      }),
    [phrases, targetLanguage, baseLanguage, installationId, todayKey],
  );

  const targetLabel = useMemo(
    () => languages.find((lang) => lang.code === targetLanguage)?.name ?? targetLanguage.toUpperCase(),
    [languages, targetLanguage],
  );

  const targetText = dailyWord ? getTranslation(dailyWord) : '';
  const baseText = dailyWord ? dailyWord.translations[baseLanguage] ?? '' : '';
  const pronunciation = dailyWord?.pronunciation ?? '';
  const audioUrl = dailyWord ? getAudioUrl(dailyWord) : null;
  const example = useMemo(() => {
    if (!dailyWord) return '';
    const raw = rawWords.find((word) => word._id === dailyWord.id);
    return raw?.exampleSentence?.[targetLanguage] ?? '';
  }, [dailyWord, rawWords, targetLanguage]);

  const learnedToday = isLearnedToday(currentProgress, todayKey);
  const recentWords = useMemo(
    () => getRecentLearnedWords(phrases, currentProgress.learnedWordIds, 5),
    [phrases, currentProgress.learnedWordIds],
  );

  const isLoading = !isReady || (phrases.length === 0 && isSyncing);

  const handlePlay = useCallback(async () => {
    if (!dailyWord || isPlaying) return;
    setIsPlaying(true);
    try {
      await playPhraseAudio(dailyWord, audioUrl, { language: targetLanguage });
    } finally {
      setIsPlaying(false);
    }
  }, [dailyWord, audioUrl, isPlaying, targetLanguage]);

  const handleMarkLearned = useCallback(async () => {
    if (!dailyWord || learnedToday || isMarking) return;
    setIsMarking(true);
    try {
      const { progress: next, changed } = markWordLearned(currentProgress, dailyWord.id, todayKey);
      setProgress(next);
      await saveProgress(next);
      if (installationId) {
        // Best-effort backup; the device keeps working if this fails.
        void pushLearningProgress(installationId, next).catch(() => {});
      }
      if (changed) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (reminder) {
        await syncLearningReminder(reminder, { learnedToday: true, targetLabel });
      }
    } finally {
      setIsMarking(false);
    }
  }, [currentProgress, dailyWord, learnedToday, isMarking, reminder, targetLabel, todayKey, installationId]);

  const handleEnableReminder = useCallback(async () => {
    const granted = await requestReminderPermissionAsync();
    setPermission(await getReminderPermissionAsync());
    if (!granted) return;
    const next = { ...(reminder ?? DEFAULT_REMINDER), enabled: true };
    setReminder(next);
    await saveReminderSettings(next);
    await syncLearningReminder(next, { learnedToday, targetLabel });
  }, [reminder, learnedToday, targetLabel]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 12, paddingBottom: Platform.OS === 'web' ? 60 : 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={goToSettings} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back to Settings">
        <Feather name="arrow-left" size={21} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Settings</Text>
      </Pressable>

      <Text style={[styles.eyebrow, { color: colors.primary }]}>DAILY PRACTICE</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>One word a day.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        A small habit that grows. Learn today&apos;s {targetLabel} word and keep your streak alive.
      </Text>

      <View style={styles.statRow}>
        <StatCard
          icon="zap"
          value={String(currentProgress.currentStreak)}
          label={currentProgress.currentStreak === 1 ? 'day streak' : 'day streak'}
          tint={colors.primary}
        />
        <StatCard
          icon="book-open"
          value={String(currentProgress.learnedWordIds.length)}
          label="words learned"
          tint={colors.accentForeground}
        />
        <StatCard
          icon="award"
          value={String(currentProgress.longestStreak)}
          label="best streak"
          tint={colors.secondaryForeground}
        />
      </View>

      {isLoading ? (
        <View style={[styles.wordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Preparing today&apos;s word…</Text>
        </View>
      ) : dailyWord ? (
        <View style={[styles.wordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.wordTopRow}>
            <View style={[styles.wordBadge, { backgroundColor: `${colors.primary}16` }]}>
              <Feather name="sun" size={12} color={colors.primary} />
              <Text style={[styles.wordBadgeText, { color: colors.primary }]}>TODAY&apos;S WORD</Text>
            </View>
            {learnedToday ? (
              <View style={[styles.doneBadge, { backgroundColor: colors.accent }]}>
                <Feather name="check-circle" size={12} color={colors.accentForeground} />
                <Text style={[styles.doneBadgeText, { color: colors.accentForeground }]}>LEARNED</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.wordTarget, { color: colors.foreground }]}>{targetText || baseText}</Text>
          {baseText ? (
            <Text style={[styles.wordMeaning, { color: colors.mutedForeground }]}>{baseText}</Text>
          ) : null}
          {pronunciation ? (
            <Text style={[styles.wordPronunciation, { color: colors.mutedForeground }]}>{pronunciation}</Text>
          ) : null}

          {example ? (
            <View style={[styles.exampleBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.exampleLabel, { color: colors.mutedForeground }]}>EXAMPLE</Text>
              <Text style={[styles.exampleText, { color: colors.secondaryForeground }]}>{example}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handlePlay}
            disabled={isPlaying || !audioUrl}
            style={({ pressed }) => [
              styles.listenButton,
              { backgroundColor: colors.secondary },
              (isPlaying || !audioUrl) && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={audioUrl ? 'Listen to today’s word' : 'Audio not available'}
            accessibilityState={{ busy: isPlaying, disabled: !audioUrl }}
          >
            <Feather name={isPlaying ? 'pause-circle' : 'volume-2'} size={17} color={colors.secondaryForeground} />
            <Text style={[styles.listenText, { color: colors.secondaryForeground }]}>
              {isPlaying ? 'Playing' : audioUrl ? 'Listen' : 'No audio yet'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleMarkLearned}
            disabled={learnedToday || isMarking}
            style={({ pressed }) => [
              styles.markButton,
              { backgroundColor: learnedToday ? colors.accent : colors.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={learnedToday ? 'Already learned today' : 'Mark today’s word as learned'}
            accessibilityState={{ disabled: learnedToday || isMarking }}
          >
            <Feather
              name={learnedToday ? 'check-circle' : 'check'}
              size={17}
              color={learnedToday ? colors.accentForeground : colors.primaryForeground}
            />
            <Text
              style={[
                styles.markText,
                { color: learnedToday ? colors.accentForeground : colors.primaryForeground },
              ]}
            >
              {learnedToday ? 'Learned today — come back tomorrow' : 'Mark as learned'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.wordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <EmptyState
            icon="book"
            title="No words to learn yet"
            message={`Connect to the internet once to download ${targetLabel} words, then they'll be available offline.`}
          />
        </View>
      )}

      {dailyWord ? <DailyWordShareCard word={dailyWord} languageLabel={targetLabel} /> : null}

      <ReminderCard
        permission={permission}
        reminder={reminder}
        learnedToday={learnedToday}
        onEnable={handleEnableReminder}
        onOpenSettings={goToSettings}
      />

      {recentWords.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recently learned</Text>
            <Feather name="clock" size={16} color={colors.mutedForeground} />
          </View>
          <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recentWords.map((word, index) => (
              <ReviewRow key={word.id} word={word} isLast={index === recentWords.length - 1} />
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Your progress is saved on this device and works offline.
      </Text>
    </ScrollView>
  );
}

function StatCard({
  icon,
  value,
  label,
  tint,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
  tint: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}16` }]}>
        <Feather name={icon} size={16} color={tint} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ReminderCard({
  permission,
  reminder,
  learnedToday,
  onEnable,
  onOpenSettings,
}: {
  permission: ReminderPermission;
  reminder: LearningReminderSettings | null;
  learnedToday: boolean;
  onEnable: () => void;
  onOpenSettings: () => void;
}) {
  const colors = useColors();
  const enabled = reminder?.enabled ?? false;
  const timeLabel = reminder ? formatReminderTime(reminder.hour, reminder.minute) : '';

  if (permission !== 'granted') {
    if (permission === 'denied') {
      return (
        <Pressable
          onPress={onOpenSettings}
          style={[styles.reminderCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <View style={[styles.reminderIcon, { backgroundColor: colors.card }]}>
            <Feather name="bell-off" size={18} color={colors.mutedForeground} />
          </View>
          <View style={styles.reminderCopy}>
            <Text style={[styles.reminderTitle, { color: colors.foreground }]}>Reminders are off</Text>
            <Text style={[styles.reminderDescription, { color: colors.mutedForeground }]}>
              Enable notifications for Bama in your device settings to get a daily nudge.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      );
    }
    return (
      <View style={[styles.reminderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.reminderIcon, { backgroundColor: colors.accent }]}>
          <Feather name="bell" size={18} color={colors.accentForeground} />
        </View>
        <View style={styles.reminderCopy}>
          <Text style={[styles.reminderTitle, { color: colors.foreground }]}>Never miss a word</Text>
          <Text style={[styles.reminderDescription, { color: colors.mutedForeground }]}>
            Turn on a daily reminder to keep learning — around {formatReminderTime(18, 30)} by default.
          </Text>
        </View>
        <Pressable
          onPress={onEnable}
          style={({ pressed }) => [styles.enableButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.enableText, { color: colors.primaryForeground }]}>Enable</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.reminderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.reminderIcon, { backgroundColor: enabled ? colors.accent : colors.secondary }]}>
        <Feather name={enabled ? 'bell' : 'bell-off'} size={18} color={enabled ? colors.accentForeground : colors.mutedForeground} />
      </View>
      <View style={styles.reminderCopy}>
        <Text style={[styles.reminderTitle, { color: colors.foreground }]}>
          {enabled ? `Daily reminder at ${timeLabel}` : 'Daily reminder is off'}
        </Text>
        <Text style={[styles.reminderDescription, { color: colors.mutedForeground }]}>
          {learnedToday
            ? 'Today is done — your next reminder will be tomorrow.'
            : 'Manage the reminder time in Settings.'}
        </Text>
      </View>
      <Pressable onPress={onOpenSettings} style={styles.reminderLink} accessibilityRole="button">
        <Feather name="sliders" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function ReviewRow({ word, isLast }: { word: Phrase; isLast: boolean }) {
  const colors = useColors();
  const { targetLanguage, baseLanguage, getTranslation, getAudioUrl } = useApp();
  const [isPlaying, setIsPlaying] = useState(false);
  const targetText = getTranslation(word);
  const baseText = word.translations[baseLanguage] ?? '';
  const audioUrl = getAudioUrl(word);

  const handlePlay = async () => {
    if (isPlaying || !audioUrl) return;
    setIsPlaying(true);
    try {
      await playPhraseAudio(word, audioUrl, { language: targetLanguage });
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <View style={[styles.reviewRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={styles.reviewCopy}>
        <Text style={[styles.reviewTarget, { color: colors.foreground }]} numberOfLines={1}>
          {targetText || baseText}
        </Text>
        {baseText ? (
          <Text style={[styles.reviewMeaning, { color: colors.mutedForeground }]} numberOfLines={1}>
            {baseText}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={handlePlay}
        disabled={isPlaying || !audioUrl}
        style={({ pressed }) => [
          styles.reviewListen,
          { backgroundColor: colors.secondary },
          (isPlaying || !audioUrl) && styles.disabled,
          pressed && styles.pressed,
        ]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={audioUrl ? `Listen to ${targetText}` : 'Audio not available'}
      >
        <Feather name={isPlaying ? 'pause-circle' : 'volume-2'} size={16} color={colors.secondaryForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44, marginBottom: 18 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 36, marginTop: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8 },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 13, alignItems: 'flex-start' },
  statIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 10 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 2 },

  wordCard: { borderWidth: 1, borderRadius: 22, padding: 19, marginTop: 18 },
  wordTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordBadge: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  wordBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  doneBadge: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  doneBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  wordTarget: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 42, marginTop: 18 },
  wordMeaning: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 23, marginTop: 6 },
  wordPronunciation: { fontFamily: 'Inter_400Regular', fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  exampleBox: { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 16 },
  exampleLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1 },
  exampleText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, marginTop: 6 },
  listenButton: { minHeight: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  listenText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  markButton: { minHeight: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingHorizontal: 14 },
  markText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center' },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center', paddingVertical: 18 },

  reminderCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 18 },
  reminderIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1, minWidth: 120 },
  reminderTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  reminderDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  enableButton: { borderRadius: 12, paddingHorizontal: 14, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  enableText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  reminderLink: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 27, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  reviewCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15 },
  reviewRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewCopy: { flex: 1 },
  reviewTarget: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  reviewMeaning: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  reviewListen: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.4 },
  footer: { fontFamily: 'Inter_400Regular', textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 26, paddingHorizontal: 20 },
});
