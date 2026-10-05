import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { createContribution, type IssueCategory, type ReportKind } from '@/services/api';
import type { ContentType } from '@/types/phrase';
import { useAlert } from './AlertDialog';
import { RecordPronunciation } from './RecordPronunciation';

type ReportMode = 'translation' | 'english' | 'problem' | 'pronunciation';

interface ReportPhraseSheetProps {
  visible: boolean;
  phraseId: string;
  english: string;
  hausa: string;
  /** Which server collection this id belongs to; words and phrases are not interchangeable. */
  contentType?: ContentType;
  onClose: () => void;
}

const MODES: Array<{ key: ReportMode; icon: string; title: string; hint: string }> = [
  {
    key: 'pronunciation',
    icon: 'mic',
    title: 'Record the pronunciation',
    hint: 'Record a natural Hausa voice for this phrase.',
  },
  {
    key: 'translation',
    icon: 'edit-3',
    title: 'Suggest a better translation',
    hint: 'Tell us the Hausa you would use instead.',
  },
  {
    key: 'english',
    icon: 'globe',
    title: 'The English is wrong',
    hint: 'Suggest the English wording for this phrase.',
  },
  {
    key: 'problem',
    icon: 'flag',
    title: 'Report a problem',
    hint: 'Duplicate, wrong category, offensive, or anything else.',
  },
];

// Modes the server can triage, keyed by the sheet's mode.
const REPORT_KIND_BY_MODE: Record<Exclude<ReportMode, 'pronunciation'>, ReportKind> = {
  translation: 'TRANSLATION',
  english: 'ENGLISH',
  problem: 'PROBLEM',
};

const ISSUE_OPTIONS: Array<{ value: IssueCategory; label: string }> = [
  { value: 'DUPLICATE', label: 'Duplicate entry' },
  { value: 'WRONG_CATEGORY', label: 'Wrong category' },
  { value: 'OFFENSIVE', label: 'Offensive or inappropriate' },
  { value: 'INACCURATE', label: 'Meaning is inaccurate' },
  { value: 'BROKEN_AUDIO', label: 'Audio is wrong or missing' },
  { value: 'OTHER', label: 'Something else' },
];

export function ReportPhraseSheet({
  visible,
  phraseId,
  english,
  hausa,
  contentType = 'phrase',
  onClose,
}: ReportPhraseSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { installationId } = useApp();
  const { show } = useAlert();

  const [kind, setKind] = useState<ReportMode>('pronunciation');
  const [suggestion, setSuggestion] = useState('');
  const [reason, setReason] = useState('');
  const [issueCategory, setIssueCategory] = useState<IssueCategory | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setKind('pronunciation');
    setSuggestion('');
    setReason('');
    setIssueCategory('');
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (kind === 'pronunciation') return;

    if (!installationId) {
      show({
        title: 'Not ready yet',
        message: 'The app is still registering this device. Try again in a moment.',
        variant: 'warning',
      });
      return;
    }

    const trimmedSuggestion = suggestion.trim();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      show({
        title: 'Add a short reason',
        message: 'Tell the moderators what looks wrong so they can act on it.',
        variant: 'warning',
      });
      return;
    }

    if ((kind === 'translation' || kind === 'english') && !trimmedSuggestion) {
      show({
        title: 'Add your suggestion',
        message: 'Type the wording you think is correct.',
        variant: 'warning',
      });
      return;
    }

    if (kind === 'problem' && !issueCategory) {
      show({
        title: 'Pick the problem',
        message: 'Choose what is wrong so the right moderator can pick it up.',
        variant: 'warning',
      });
      return;
    }

    const payload = {
      type: 'CORRECTION' as const,
      contentType,
      contentId: phraseId,
      reason: trimmedReason,
      reportKind: REPORT_KIND_BY_MODE[kind],
      ...(issueCategory ? { issueCategory } : {}),
      installationId,
      ...(kind === 'translation' ? { suggestedHausa: trimmedSuggestion } : {}),
      ...(kind === 'english' ? { suggestedEnglish: trimmedSuggestion } : {}),
    };

    setSubmitting(true);
    try {
      await createContribution(payload);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onClose();
      show({
        title: 'Thanks for the report',
        message: 'A moderator will review it shortly.',
        variant: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      show({
        title: 'Could not send',
        message: message.length > 180 ? 'Please try again in a moment.' : message,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeMode = MODES.find((item) => item.key === kind) ?? MODES[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={close}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Suggest a change</Text>
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={19} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={[styles.quote, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.quoteEnglish, { color: colors.foreground }]} numberOfLines={2}>
              {english}
            </Text>
            <Text style={[styles.quoteHausa, { color: colors.primary }]} numberOfLines={2}>
              {hausa}
            </Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.kinds}>
              {MODES.map((item) => {
                const active = item.key === kind;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setKind(item.key)}
                    style={({ pressed }) => [
                      styles.kindRow,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.accent : colors.card,
                      },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Feather
                      name={item.icon as never}
                      size={15}
                      color={active ? colors.accentForeground : colors.mutedForeground}
                    />
                    <View style={styles.kindCopy}>
                      <Text
                        style={[
                          styles.kindTitle,
                          { color: active ? colors.accentForeground : colors.foreground },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.kindHint, { color: colors.mutedForeground }]}>
                        {item.hint}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {kind === 'pronunciation' ? (
              <RecordPronunciation phraseId={phraseId} languageLabel="Hausa" embedded />
            ) : (
              <>
                {kind !== 'problem' ? (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.foreground }]}>
                      {kind === 'translation' ? 'Correct Hausa' : 'Correct English'}
                    </Text>
                    <TextInput
                      value={suggestion}
                      onChangeText={setSuggestion}
                      placeholder={kind === 'translation' ? hausa : english}
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      style={[
                        styles.input,
                        {
                          color: colors.foreground,
                          borderColor: colors.input,
                          backgroundColor: colors.background,
                        },
                      ]}
                    />
                  </View>
                ) : null}

                {kind === 'problem' ? (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.foreground }]}>
                      What is wrong?
                    </Text>
                    <View style={styles.issueRow}>
                      {ISSUE_OPTIONS.map((option) => {
                        const active = option.value === issueCategory;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => setIssueCategory(option.value)}
                            style={({ pressed }) => [
                              styles.issueChip,
                              {
                                borderColor: active ? colors.primary : colors.border,
                                backgroundColor: active ? colors.accent : colors.background,
                              },
                              pressed && styles.pressed,
                            ]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                          >
                            <Text
                              style={[
                                styles.issueChipText,
                                { color: active ? colors.accentForeground : colors.foreground },
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Reason</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder={activeMode.hint}
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    style={[
                      styles.input,
                      {
                        color: colors.foreground,
                        borderColor: colors.input,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={close}
              style={({ pressed }) => [
                styles.cancel,
                kind === 'pronunciation' && styles.cancelWide,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelText, { color: colors.foreground }]}>
                {kind === 'pronunciation' ? 'Done' : 'Cancel'}
              </Text>
            </Pressable>
            {kind === 'pronunciation' ? null : (
              <Pressable
                onPress={() => void submit()}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submit,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                  {submitting ? 'Sending…' : 'Send report'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,18,15,0.45)' },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 14,
    maxHeight: '88%',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  quote: { borderRadius: 14, padding: 12, gap: 3 },
  quoteEnglish: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 19 },
  quoteHausa: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 19 },
  body: { flexShrink: 1 },
  bodyContent: { gap: 14, paddingBottom: 4 },
  kinds: { gap: 8 },
  issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  issueChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  issueChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  kindCopy: { flex: 1, gap: 2 },
  kindTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  kindHint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15 },
  field: { gap: 6 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    minHeight: 66,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10 },
  cancel: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelWide: { flex: 1 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  submit: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});
