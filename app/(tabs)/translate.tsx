import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { phrases as staticPhrases } from '@/data/phrases';
import { findOfflineTranslation } from '@/services/translation';
import { LanguageSelector } from '@/components/LanguageSelector';
import { EmptyState } from '@/components/EmptyState';
import { PhraseCard } from '@/components/PhraseCard';
import { useRouter } from 'expo-router';
import { AdsFeed } from '@/components/AdsFeed';
import { AD_PLACEMENTS } from '@/constants/ads';
import { getLanguageByCode, BASE_LANGUAGE_CODE } from '@/types/language';

export default function TranslateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ direction?: string }>();
  const {
    targetLanguage: savedTargetLanguage,
    baseLanguage,
    phrases,
    isSyncing,
    lastSyncError
  } = useApp();

  // The learning language is a global setting, so the URL only carries the
  // translation direction. This keeps the screen in sync when the user changes
  // the target language in settings (persisted route params would get stale).
  const isReverse = params.direction === 'reverse';
  const sourceLanguage = isReverse ? savedTargetLanguage : baseLanguage;
  const targetLanguage = isReverse ? baseLanguage : savedTargetLanguage;
  
  const [input, setInput] = useState('');
  const useStaticFallback = !phrases.length && !isSyncing;
  const effectivePhrases = useStaticFallback ? staticPhrases : phrases;
  
  const result = useMemo(
    () => findOfflineTranslation(input, sourceLanguage, targetLanguage, effectivePhrases),
    [sourceLanguage, targetLanguage, effectivePhrases, input],
  );
  
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  
  const sourceLangInfo = getLanguageByCode(sourceLanguage);
  const targetLangInfo = getLanguageByCode(targetLanguage);
  const sourceLabel = sourceLangInfo?.name.toUpperCase() ?? sourceLanguage.toUpperCase();
  const targetLabel = targetLangInfo?.name.toUpperCase() ?? targetLanguage.toUpperCase();

  const swap = () => {
    // Toggle the direction: the learning language stays global and is never
    // baked into the route params.
    router.setParams({ direction: isReverse ? 'forward' : 'reverse' });
    setInput('');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: topInset + 18, paddingBottom: Platform.OS === 'web' ? 118 : 98 }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.eyebrow, { color: colors.primary }]}>OFFLINE LOOKUP</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Say what you mean.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Look up a phrase or a single word from the offline phrasebook. Closest match is shown when there is no exact entry.</Text>
      
      <View style={styles.languageRow}>
       
        <Pressable onPress={swap} style={[styles.swapButton, { borderColor: colors.border, backgroundColor: colors.secondary }]} accessibilityRole="button" accessibilityLabel="Swap languages">
          <Feather name="repeat" size={16} color={colors.secondaryForeground} />
        </Pressable>
        <LanguageSelector targetLanguage={targetLanguage} onChange={() => {}} readOnly />
      </View>

      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.inputLabelRow}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{sourceLabel}</Text>
          <Text style={[styles.offlineLabel, { color: colors.accentForeground }]}><Feather name="wifi-off" size={12} color={colors.accentForeground} />  OFFLINE</Text>
        </View>
        <TextInput
          testID="translation-input"
          value={input}
          onChangeText={setInput}
          placeholder={`Type a phrase in ${sourceLangInfo?.nativeName ?? sourceLanguage}`}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.input, { color: colors.foreground }]}
          accessibilityLabel={`${sourceLabel} phrase`}
        />
        {input.length > 0 ? <Pressable onPress={() => setInput('')} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear translation input"><Feather name="x" size={18} color={colors.mutedForeground} /></Pressable> : null}
      </View>

      <View style={[styles.resultCard, { backgroundColor: result.kind === 'match' ? colors.accent : colors.secondary, borderColor: result.kind === 'match' ? '#c1d9c7' : colors.border }]}>
        <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{targetLabel}</Text>
        {result.kind === 'match' && result.phrase ? (
          <>
            <Text style={[styles.resultText, { color: colors.foreground }]}>{result.translation}</Text>
            <Text style={[styles.resultPronunciation, { color: colors.accentForeground }]}>Pronunciation: {result.phrase.pronunciation}</Text>
            {result.matchKind === 'approximate' ? (
              <Text style={[styles.matchHint, { color: colors.accentForeground }]}>Closest match for "{result.source}"</Text>
            ) : null}
            <Pressable onPress={() => router.push(`/phrase/${result.phrase?.id}`)} style={styles.openPhrase} accessibilityRole="button"><Text style={[styles.openPhraseText, { color: colors.accentForeground }]}>Open phrase details <Feather name="arrow-up-right" size={13} color={colors.accentForeground} /></Text></Pressable>
          </>
        ) : (
          <View style={styles.unavailable}>
            <Feather name="book-open" size={18} color={colors.mutedForeground} />
            <Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>Phrase not available in the offline phrasebook.</Text>
          </View>
        )}
      </View>

      {result.alternatives.length > 0 ? (
        <View style={styles.suggestions}>
          <Text style={[styles.suggestionsLabel, { color: colors.mutedForeground }]}>OTHER MATCHES</Text>
          {result.alternatives.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/phrase/${item.id}`)}
              style={[styles.suggestionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.translations[sourceLanguage] ?? item.id}`}
            >
              <View style={styles.suggestionCopy}>
                <Text style={[styles.suggestionSource, { color: colors.foreground }]}>{item.translations[sourceLanguage] ?? ''}</Text>
                <Text style={[styles.suggestionTarget, { color: colors.mutedForeground }]}>{item.translations[targetLanguage] ?? ''}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {result.kind !== 'match' && input.trim().length === 0 ? <EmptyState icon="message-square" title="Start with a known phrase" message={`Try "Good morning", "sit down", or "Zauna" to see an offline result.`} /> : null}
      {result.kind === 'match' && result.phrase && result.matchKind === 'exact' ? <PhraseCard phrase={result.phrase} onPress={() => router.push(`/phrase/${result.phrase?.id}`)} compact /> : null}
      {!effectivePhrases.length ? (
        <Text style={[styles.syncNote, { color: colors.mutedForeground }]}>
          {lastSyncError
            ? `Offline content unavailable: ${lastSyncError}`
            : isSyncing
              ? 'Syncing offline content...'
              : 'No offline content available yet.'}
        </Text>
      ) : null}
      <AdsFeed placement={AD_PLACEMENTS.TRANSLATE_BOTTOM} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 36, marginTop: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18, maxWidth: 330 },
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  inputCard: { borderWidth: 1, borderRadius: 19, padding: 17, marginTop: 17, minHeight: 156 },
  inputLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  offlineLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  input: { flex: 1, minHeight: 90, fontFamily: 'Inter_500Medium', fontSize: 18, lineHeight: 26, paddingTop: 15, paddingBottom: 0, textAlignVertical: 'top' },
  clear: { position: 'absolute', right: 15, bottom: 15, padding: 5 },
  swapButton: { minHeight: 43, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 15 },
  swapText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  resultCard: { borderWidth: 1, borderRadius: 19, padding: 18, marginTop: 16, minHeight: 130 },
  resultLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  resultText: { fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 31, marginTop: 10 },
  resultPronunciation: { fontFamily: 'Inter_400Regular', fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  openPhrase: { marginTop: 13, alignSelf: 'flex-start' },
  openPhraseText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  matchHint: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  unavailable: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 19 },
  unavailableText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, flex: 1 },
  suggestions: { marginTop: 16, gap: 8 },
  suggestionsLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  suggestionRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionCopy: { flex: 1, gap: 2 },
  suggestionSource: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  suggestionTarget: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  syncNote: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 16 },
});