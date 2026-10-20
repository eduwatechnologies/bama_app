import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { phrases as staticPhrases } from '@/data/phrases';
import { useApp } from '@/context/AppContext';
import { AudioButton } from '@/components/AudioButton';
import { EmptyState } from '@/components/EmptyState';
import { PhraseWords } from '@/components/PhraseWords';
import { RelatedPhrases } from '@/components/RelatedPhrases';
import { ReportPhraseSheet } from '@/components/ReportPhraseSheet';
import { playPhraseAudio } from '@/services/audio';
import { AdsFeed } from '@/components/AdsFeed';
import { AD_PLACEMENTS } from '@/constants/ads';
import { getLanguageByCode, BASE_LANGUAGE_CODE } from '@/types/language';

export default function PhraseDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    isFavorite,
    toggleFavorite,
    getPhraseById,
    phrases,
    isSyncing,
    targetLanguage,
    baseLanguage,
    getTranslation,
    getAudioUrl
  } = useApp();
  const useStaticFallback = !phrases.length && !isSyncing;
  const phrase = useStaticFallback ? staticPhrases.find((item) => item.id === id) : getPhraseById(id ?? '');
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const [reporting, setReporting] = useState(false);

  if (!phrase) {
    return <View style={[styles.missing, { backgroundColor: colors.background, paddingTop: topInset }]}><EmptyState icon="alert-circle" title="Phrase not found" message="This phrase is not in the offline phrasebook." /></View>;
  }
  const favorite = isFavorite(phrase.id);
  
  const translation = getTranslation(phrase);
  const audioUrl = getAudioUrl(phrase);
  const targetLangInfo = getLanguageByCode(targetLanguage);
  const targetLabel = targetLangInfo?.name.toUpperCase() ?? targetLanguage.toUpperCase();

  


  

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: topInset + 12, paddingBottom: Platform.OS === 'web' ? 40 : 28 }]} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={21} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Phrasebook</Text></Pressable>
      <View style={[styles.badge, { backgroundColor: colors.secondary }]}><Feather name="bookmark" size={13} color={colors.mutedForeground} /><Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{phrase.category}</Text></View>
      <Text style={[styles.source, { color: colors.foreground }]}>{phrase.translations[baseLanguage] ?? ''}</Text>
      <View style={[styles.translationCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.translationLabel}>{targetLabel}</Text>
        <Text style={styles.target}>{translation}</Text>
        <View style={styles.cardRule} />
        <Text style={styles.pronunciationLabel}>PRONUNCIATION</Text>
        
          <View style={styles.pronunciationRow}>
            <Pressable onPress={() => audioUrl && void playPhraseAudio(phrase, audioUrl)} disabled={!audioUrl} style={styles.pronunciationPlay} accessibilityRole="button" accessibilityLabel={audioUrl ? `Listen to pronunciation for ${translation}` : 'Audio not available'}>
              <Feather name={audioUrl ? 'play' : 'volume-x'} size={16} color={audioUrl ? '#fffdf9' : colors.mutedForeground} />
            </Pressable>
            <View style={styles.pronunciationTextWrap}>
              <Text style={[styles.pronunciation, { color: audioUrl ? '#fffdf9' : colors.mutedForeground }]}>{phrase.pronunciation}</Text>
            </View>
          </View>
      </View>

      {/* <PhraseWords phraseId={phrase.id} targetLanguage={targetLanguage} /> */}

      <View style={styles.actionRow}>
        <AudioButton phrase={phrase} />
        <Pressable onPress={() => toggleFavorite(phrase.id)} style={[styles.favoriteButton, { backgroundColor: favorite ? colors.accent : colors.card, borderColor: favorite ? colors.accent : colors.border }]} accessibilityRole="button" accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Feather name="star" size={19} color={favorite ? colors.accentForeground : colors.foreground} />
          <Text style={[styles.favoriteLabel, { color: favorite ? colors.accentForeground : colors.foreground }]}>{favorite ? 'Saved' : 'Favorite'}</Text>
        </Pressable>
      </View>

     
      <RelatedPhrases current={phrase} />

      <AdsFeed placement={AD_PLACEMENTS.PHRASE_DETAIL_BOTTOM} />
       <Pressable
        onPress={() => setReporting(true)}
        style={({ pressed }) => [
          styles.reportButton,
          { borderColor: colors.border, backgroundColor: colors.card },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Suggest a change or record the pronunciation"
      >
        <Feather name="flag" size={14} color={colors.mutedForeground} />
        <Text style={[styles.reportLabel, { color: colors.mutedForeground }]}>
          Suggest a change or record the pronunciation
        </Text>
      </Pressable>

      <ReportPhraseSheet
        visible={reporting}
        phraseId={phrase.id}
        sourceText={phrase.translations[baseLanguage] ?? ''}
        targetText={phrase.translations[targetLanguage] ?? ''}
        sourceLabel={getLanguageByCode(baseLanguage)?.name ?? 'English'}
        targetLabel={targetLangInfo?.name ?? 'Target'}
        contentType={phrase.contentType}
        onClose={() => setReporting(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1 },
  content: { paddingHorizontal: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  badge: { alignSelf: 'flex-start', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 24 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  source: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 37, marginTop: 18 },
  translationCard: { borderRadius: 23, padding: 21, marginTop: 20, minHeight: 205 },
  translationLabel: { color: '#fce8df', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4 },
  target: { color: '#fffdf9', fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 39, marginTop: 18 },
  cardRule: { height: 1, backgroundColor: '#edaa91', marginTop: 22, marginBottom: 16 },
  pronunciationLabel: { color: '#fce8df', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  pronunciation: { color: '#fffdf9', fontFamily: 'Inter_400Regular', fontSize: 15, fontStyle: 'italic', marginTop: 7 },
  pronunciationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
  pronunciationPlay: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  pronunciationTextWrap: { flex: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  favoriteButton: { minHeight: 52, borderWidth: 1, borderRadius: 16, flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  favoriteLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  reportButton: { marginTop: 10, minHeight: 40, borderWidth: 1, borderRadius: 13, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  reportLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.72 },
});
