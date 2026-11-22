import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { BASE_LANGUAGE } from '@/context/AppContext';
import { downloadLanguagePack, removeLanguagePack } from '@/services/audioCache';
import { isLearnedToday, loadProgress, toDateKey } from '@/services/learningPath';
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

const REMINDER_PRESETS: { label: string; hour: number; minute: number }[] = [
  { label: '8:00 AM', hour: 8, minute: 0 },
  { label: '12:30 PM', hour: 12, minute: 30 },
  { label: '6:30 PM', hour: 18, minute: 30 },
  { label: '9:00 PM', hour: 21, minute: 0 },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { targetLanguage, setTargetLanguage, rawWords, rawPhrases, languages } = useApp();
  const isWeb = Platform.OS === 'web';
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ completed: 0, total: 0 });
  const [removing, setRemoving] = useState(false);
  const [reminder, setReminder] = useState<LearningReminderSettings | null>(null);
  const [reminderPermission, setReminderPermission] = useState<ReminderPermission>('undetermined');
  const [learnedToday, setLearnedToday] = useState(false);
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const targetLabel = languages.find((lang) => lang.code === targetLanguage)?.name ?? targetLanguage.toUpperCase();

  useEffect(() => {
    let active = true;
    (async () => {
      const todayKey = toDateKey();
      const [settings, permission, progress] = await Promise.all([
        loadReminderSettings(),
        getReminderPermissionAsync(),
        loadProgress(todayKey),
      ]);
      if (!active) return;
      setReminder(settings);
      setReminderPermission(permission);
      setLearnedToday(isLearnedToday(progress, todayKey));
    })();
    return () => {
      active = false;
    };
  }, []);

  const applyReminder = useCallback(
    async (next: LearningReminderSettings) => {
      setReminder(next);
      await saveReminderSettings(next);
      await syncLearningReminder(next, { learnedToday, targetLabel });
    },
    [learnedToday, targetLabel],
  );

  const handleToggleReminder = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestReminderPermissionAsync();
        setReminderPermission(await getReminderPermissionAsync());
        if (!granted) return;
      }
      await applyReminder({ ...(reminder ?? DEFAULT_REMINDER), enabled: value });
    },
    [applyReminder, reminder],
  );

  const buildPackItems = useCallback((): { contentId: string; language: string; url: string; size?: number }[] => {
    const items: { contentId: string; language: string; url: string; size?: number }[] = [];
    const seen = new Set<string>();
    for (const item of [...rawWords, ...rawPhrases]) {
      const audioMap = (item.audio ?? {}) as Record<string, string | null>;
      const url = audioMap[targetLanguage] ?? audioMap[BASE_LANGUAGE] ?? null;
      if (!url) continue;
      const key = `${item._id}:${targetLanguage}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ contentId: item._id, language: targetLanguage, url });
    }
    return items;
  }, [rawWords, rawPhrases, targetLanguage]);

  const handleDownload = useCallback(async () => {
    const items = buildPackItems();
    if (items.length === 0) return;
    setDownloading(true);
    try {
      await downloadLanguagePack(targetLanguage, items, (completed, total) => {
        setDownloadProgress({ completed, total });
      });
    } finally {
      setDownloading(false);
      setDownloadProgress({ completed: 0, total: 0 });
    }
  }, [buildPackItems, targetLanguage]);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      await removeLanguagePack(targetLanguage);
    } finally {
      setRemoving(false);
    }
  }, [targetLanguage]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: topInset + 18, paddingBottom: Platform.OS === 'web' ? 118 : 98 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>PREFERENCES</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Make it yours.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A few simple choices for your offline phrasebook.</Text>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Learning Language</Text>
      <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="globe" size={18} color={colors.accentForeground} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Target Language</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Choose the language you want to learn.</Text></View>
        <LanguageSelector targetLanguage={targetLanguage} onChange={setTargetLanguage} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Daily Practice</Text>
      <Pressable onPress={() => router.push('/learn')} style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="zap" size={18} color={colors.accentForeground} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Word of the day</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Learn today&apos;s word, track your streak and review past words.</Text></View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Daily Reminder</Text>
      <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="bell" size={18} color={colors.accentForeground} /></View>
        <View style={styles.settingCopy}>
          <Text style={[styles.settingTitle, { color: colors.foreground }]}>Daily reminder</Text>
          <Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>
            {reminder?.enabled
              ? `A reminder at ${formatReminderTime(reminder.hour, reminder.minute)}.`
              : 'A gentle nudge to learn a new word each day.'}
          </Text>
        </View>
        <Switch
          value={reminder?.enabled ?? false}
          onValueChange={handleToggleReminder}
          disabled={reminder === null || (reminderPermission === 'denied' && !reminder?.enabled)}
          trackColor={{ false: colors.secondary, true: colors.primary }}
          thumbColor={colors.card}
        />
      </View>
      {reminder?.enabled ? (
        <View style={styles.presetRow}>
          {REMINDER_PRESETS.map((preset) => {
            const selected = reminder.hour === preset.hour && reminder.minute === preset.minute;
            return (
              <Pressable
                key={preset.label}
                onPress={() => applyReminder({ ...reminder, hour: preset.hour, minute: preset.minute, enabled: true })}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.presetText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {reminderPermission === 'denied' ? (
        <Text style={[styles.reminderNote, { color: colors.mutedForeground }]}>
          Notifications are blocked for Bama. Enable them in your device settings to use the daily reminder.
        </Text>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
      <Pressable onPress={() => router.push('/about')} style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
        <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}16` }]}><Feather name="info" size={18} color={colors.primary} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>About Bama</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Why this tool exists and how to review the content.</Text></View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
      <Pressable onPress={() => router.push('/privacy')} style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
        <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}16` }]}><Feather name="shield" size={18} color={colors.primary} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Privacy Policy</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>How Bama handles your data.</Text></View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
      <Pressable onPress={() => router.push('/terms')} style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
        <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}16` }]}><Feather name="file-text" size={18} color={colors.primary} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Terms of Use</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Rules for using Bama.</Text></View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Offline Audio</Text>
      <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="download" size={18} color={colors.accentForeground} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Download {targetLanguage.toUpperCase()} Audio</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Save official audio for offline playback.</Text></View>
        {downloading ? (
          <Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>{downloadProgress.completed} / {downloadProgress.total}</Text>
        ) : (
          <Pressable onPress={handleDownload} disabled={downloading} style={[styles.linkCard, { backgroundColor: colors.secondary, borderColor: colors.border }]} accessibilityRole="button">
            <Feather name="download" size={16} color={colors.secondaryForeground} />
            <Text style={[styles.settingTitle, { color: colors.secondaryForeground }]}>Download Pack</Text>
          </Pressable>
        )}
      </View>
      {!isWeb && (
        <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}16` }]}><Feather name="trash-2" size={18} color={colors.primary} /></View>
          <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Remove {targetLanguage.toUpperCase()} Audio</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Reclaim cached offline audio storage.</Text></View>
          {removing ? (
            <Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Removing...</Text>
          ) : (
            <Pressable onPress={handleRemove} disabled={removing} style={[styles.linkCard, { backgroundColor: colors.secondary, borderColor: colors.border }]} accessibilityRole="button">
              <Feather name="trash-2" size={16} color={colors.secondaryForeground} />
              <Text style={[styles.settingTitle, { color: colors.secondaryForeground }]}>Remove Pack</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>App</Text>
      <View style={[styles.infoCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phrasebook</Text><View style={styles.offlinePill}><Feather name="wifi-off" size={12} color={colors.accentForeground} /><Text style={[styles.pillText, { color: colors.accentForeground }]}>Available offline</Text></View></View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Version</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>1.0.0 MVP</Text></View>
      </View>
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>Built for practical moments in classrooms and communities.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 36, marginTop: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 29, marginBottom: 11 },
  settingCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
  linkCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, minWidth: 130 },
  settingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  settingDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  presetChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  presetText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  reminderNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 9, paddingHorizontal: 3 },
  infoCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15 },
  infoRow: { minHeight: 53, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  infoValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  divider: { height: 1 },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#dce9df', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 32, paddingHorizontal: 28 },
});