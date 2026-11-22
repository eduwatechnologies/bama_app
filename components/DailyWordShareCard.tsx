import { Feather } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Phrase } from '@/types/phrase';
import { playPhraseAudio } from '@/services/audio';

/**
 * Where the QR code on the poster points. Anyone who scans it lands on the
 * Play Store listing so they can install Bama and start learning too.
 */
export const APP_DOWNLOAD_URL =
  'https://play.google.com/store/apps/details?id=com.sodiqabdulazeez.hausabridge';

interface DailyWordShareCardProps {
  /** Today's word — used for the poster content and for audio playback. */
  word: Phrase;
  /** Human-readable name of the language being learned. */
  languageLabel: string;
  /**
   * Controlled visibility. When provided, the parent owns the sheet (used by the
   * Home hero's Share button) and the built-in row trigger is hidden.
   */
  visible?: boolean;
  /** Called when the sheet asks to close while in controlled mode. */
  onClose?: () => void;
  /** Hide the default tappable row when the parent renders its own button. */
  hideTrigger?: boolean;
}

/**
 * A tappable row on the Learn screen that opens a bottom sheet with a branded
 * "word of the day" poster. The poster carries the app name and a QR code so
 * the people it is shared with can download Bama themselves.
 *
 * The poster is captured with react-native-view-shot; the action buttons live
 * outside the captured view so they never end up in the exported image. The
 * rounded frame around the poster is a wrapper, so the saved file stays a clean
 * full-bleed rectangle.
 */
export function DailyWordShareCard({
  word,
  languageLabel,
  visible,
  onClose,
  hideTrigger = false,
}: DailyWordShareCardProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { baseLanguage, targetLanguage, getTranslation, getAudioUrl } = useApp();
  const shotRef = useRef<ViewShot>(null);
  const [internalVisible, setInternalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // The sheet can either own its trigger (default) or be driven by a parent
  // button such as the Home hero's Share action.
  const isControlled = visible !== undefined;
  const isVisible = isControlled ? !!visible : internalVisible;
  const open = useCallback(() => setInternalVisible(true), []);

  const targetText = getTranslation(word);
  const baseText = word.translations[baseLanguage] ?? '';
  const pronunciation = word.pronunciation ?? '';
  const audioUrl = getAudioUrl(word);
  const headline = targetText || baseText;
  const showMeaning = !!targetText && !!baseText;
  // The pronunciation field falls back to the translation, so only show it when
  // it adds something the learner cannot already read on the poster.
  const showPronunciation =
    !!pronunciation && pronunciation !== targetText && pronunciation !== baseText;

  const close = useCallback(() => {
    if (isSaving) return;
    if (isControlled) {
      onClose?.();
      return;
    }
    setInternalVisible(false);
  }, [isSaving, isControlled, onClose]);

  const handleListen = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await playPhraseAudio(word, audioUrl, { language: targetLanguage });
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, word, audioUrl, targetLanguage]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    if (Platform.OS === 'web') {
      Alert.alert('Use the mobile app', 'Saving the card to your gallery works in the Bama mobile app.');
      return;
    }
    setIsSaving(true);
    try {
      // Save-only access: no need to read the user's existing photos.
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access so Bama can save the card to your gallery.');
        return;
      }
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        Alert.alert('Could not save', 'The card could not be created. Please try again.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved to gallery', 'Open WhatsApp, Instagram or X to share the card.');
    } catch {
      Alert.alert('Could not save', 'Something went wrong while saving the card. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  return (
    <>
      {hideTrigger ? null : (
        <Pressable
          onPress={open}
          style={({ pressed }) => [
            styles.trigger,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Share today's word as a card"
        >
          <View style={[styles.triggerIcon, { backgroundColor: colors.accent }]}>
            <Feather name="share-2" size={18} color={colors.accentForeground} />
          </View>
          <View style={styles.triggerCopy}>
            <Text style={[styles.triggerTitle, { color: colors.foreground }]}>Share today&apos;s word</Text>
            <Text style={[styles.triggerDescription, { color: colors.mutedForeground }]}>
              Save a card with the app QR code and post it on social media.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      )}

      <Modal visible={isVisible} animationType="slide" transparent onRequestClose={close} statusBarTranslucent>
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
              <Text style={[styles.title, { color: colors.foreground }]}>Share today&apos;s word</Text>
              <Pressable
                onPress={close}
                hitSlop={10}
                style={styles.close}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <Text style={[styles.instructions, { color: colors.mutedForeground }]}>
                Save the card, then post it on WhatsApp, Instagram or X. Anyone can scan the code to
                download Bama and start learning too.
              </Text>

              <View style={styles.posterFrame}>
                <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 0.98 }} style={styles.poster}>
                  <View style={[styles.posterHeader, { backgroundColor: colors.primary }]}>
                    <View style={styles.posterBrandRow}>
                      <View style={[styles.posterMark, { backgroundColor: colors.primaryForeground }]}>
                        <Feather name="message-circle" size={13} color={colors.primary} />
                      </View>
                      <Text style={[styles.posterBrand, { color: colors.primaryForeground }]}>Bama</Text>
                    </View>
                    <Text style={[styles.posterTag, { color: colors.primaryForeground }]}>
                      WORD OF THE DAY
                    </Text>
                  </View>

                  <View style={[styles.posterBody, { backgroundColor: colors.card }]}>
                    <Text style={[styles.posterLabel, { color: colors.mutedForeground }]}>
                      TODAY&apos;S {languageLabel.toUpperCase()} WORD
                    </Text>
                    <Text style={[styles.posterWord, { color: colors.foreground }]}>{headline}</Text>
                    {showMeaning ? (
                      <Text style={[styles.posterMeaning, { color: colors.primary }]}>{baseText}</Text>
                    ) : null}
                    {showPronunciation ? (
                      <Text style={[styles.posterPronunciation, { color: colors.mutedForeground }]}>
                        {pronunciation}
                      </Text>
                    ) : null}

                    <View style={[styles.posterDivider, { backgroundColor: colors.border }]} />
                    <Text style={[styles.posterFooter, { color: colors.mutedForeground }]}>
                      A new {languageLabel} word every day — free and offline.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.posterCta,
                      { backgroundColor: colors.secondary, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={styles.posterQr}>
                      <QRCode
                        value={APP_DOWNLOAD_URL}
                        size={56}
                        color={colors.foreground}
                        backgroundColor="#ffffff"
                      />
                    </View>
                    <View style={styles.posterCtaCopy}>
                      <Text style={[styles.posterCtaTitle, { color: colors.foreground }]}>
                        Learn with Bama
                      </Text>
                      <Text style={[styles.posterCtaText, { color: colors.mutedForeground }]}>
                        Scan to download on Google Play.
                      </Text>
                    </View>
                  </View>
                </ViewShot>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={handleListen}
                  disabled={isPlaying || !audioUrl}
                  style={({ pressed }) => [
                    styles.action,
                    styles.listenAction,
                    { backgroundColor: colors.accent },
                    (pressed || isPlaying) && styles.pressed,
                    !audioUrl && styles.disabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={audioUrl ? 'Listen to today’s word' : 'Audio not available yet'}
                  accessibilityState={{ busy: isPlaying, disabled: !audioUrl }}
                >
                  <Feather
                    name={isPlaying ? 'pause-circle' : 'volume-2'}
                    size={16}
                    color={colors.accentForeground}
                  />
                  <Text style={[styles.actionText, { color: colors.accentForeground }]}>
                    {isPlaying ? 'Playing' : audioUrl ? 'Listen' : 'No audio'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.action,
                    styles.saveAction,
                    { backgroundColor: colors.primary },
                    (pressed || isSaving) && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save today's word card to your gallery"
                  accessibilityState={{ busy: isSaving, disabled: isSaving }}
                >
                  <Feather name="download" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                    {isSaving ? 'Saving…' : 'Save card'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  triggerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  triggerCopy: { flex: 1, minWidth: 120 },
  triggerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  triggerDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },

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
  grabber: { width: 40, height: 4, borderRadius: 999, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  close: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { paddingBottom: 6 },
  instructions: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 14 },

  posterFrame: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  poster: { backgroundColor: '#fffdf9' },
  posterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  posterBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  posterMark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  posterBrand: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  posterTag: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.3, opacity: 0.9 },
  posterBody: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20 },
  posterLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  posterWord: { fontFamily: 'Inter_700Bold', fontSize: 40, lineHeight: 48, marginTop: 10 },
  posterMeaning: { fontFamily: 'Inter_600SemiBold', fontSize: 19, lineHeight: 25, marginTop: 4 },
  posterPronunciation: { fontFamily: 'Inter_400Regular', fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  posterDivider: { height: 1, marginTop: 18, marginBottom: 12 },
  posterFooter: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  posterCta: { flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, paddingHorizontal: 22, paddingVertical: 16 },
  posterQr: { padding: 6, borderRadius: 12, backgroundColor: '#ffffff' },
  posterCtaCopy: { flex: 1 },
  posterCtaTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  posterCtaText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 3 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  listenAction: { flex: 0.85 },
  saveAction: { flex: 1.15 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
});
