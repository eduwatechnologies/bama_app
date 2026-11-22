import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CategoryCard } from '@/components/CategoryCard';
import { PhraseCard } from '@/components/PhraseCard';
import { SearchBar } from '@/components/SearchBar';
import { useApp } from '@/context/AppContext';
import { CategoryCardSkeleton, PhraseCardSkeleton, Skeleton } from '@/components/Skeleton';
import { CategoryMeta } from '@/types/phrase';
import { categoryMetaFromServer } from '@/services/categories';
import { playPhraseAudio } from '@/services/audio';
import { ApiCategory } from '@/services/api';
import { AdsFeed } from '@/components/AdsFeed';
import { AD_PLACEMENTS } from '@/constants/ads';
import { DailyWordShareCard } from '@/components/DailyWordShareCard';
import { LearningProgress, loadProgress, selectDailyWord, toDateKey } from '@/services/learningPath';

function serverCategoryToMeta(cat: ApiCategory, index: number): CategoryMeta {
  return categoryMetaFromServer(cat, index);
}

/**
 * Keeps skeletons up until the app has finished its first sync AND the given
 * collection actually holds content. Once loading finishes an empty list is a
 * real empty state, not a pending request, so it must not shimmer forever.
 */
function isLoadingContent(isReady: boolean, isSyncing: boolean, count: number): boolean {
  if (count > 0) return false;
  return !isReady || isSyncing;
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    phrases,
    categories,
    isReady,
    isSyncing,
    languages,
    targetLanguage,
    baseLanguage,
    installationId,
    rawWords,
    getTranslation,
    getAudioUrl,
  } = useApp();
  const [query, setQuery] = useState('');
  const [isPlayingWord, setIsPlayingWord] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const categoryMetas = useMemo(() => categories.map(serverCategoryToMeta), [categories]);
  const popular = useMemo(() => phrases.slice(0, 3), [phrases]);
  const isLoadingCategories = isLoadingContent(isReady, isSyncing, categories.length);
  const isLoadingPopular = isLoadingContent(isReady, isSyncing, phrases.length);
  const todayKey = toDateKey();
  const dailyWord = useMemo(
    () => selectDailyWord(phrases, { targetLanguage, baseLanguage, installationId, dateKey: todayKey }),
    [phrases, targetLanguage, baseLanguage, installationId, todayKey],
  );
  const dailyTargetText = dailyWord ? getTranslation(dailyWord) : '';
  const dailyBaseText = dailyWord ? dailyWord.translations[baseLanguage] ?? '' : '';
  const dailyPronunciation = dailyWord?.pronunciation ?? '';
  const dailyAudioUrl = dailyWord ? getAudioUrl(dailyWord) : null;
  // Example sentences live on the raw word records, keyed by language.
  const dailyExample = useMemo(() => {
    if (!dailyWord) return '';
    const raw = rawWords.find((word) => word._id === dailyWord.id);
    return raw?.exampleSentence?.[targetLanguage] ?? '';
  }, [dailyWord, rawWords, targetLanguage]);
  // The pronunciation field falls back to the translation, so skip it when it
  // would just repeat the word, its meaning, or the example already on screen.
  const showDailyPronunciation =
    !!dailyPronunciation &&
    dailyPronunciation !== dailyTargetText &&
    dailyPronunciation !== dailyBaseText &&
    dailyPronunciation !== dailyExample;

  const hasProgress = !!progress && (progress.currentStreak > 0 || progress.learnedWordIds.length > 0);

  // Keep the streak/learned stats in sync when the user returns from the Learn tab.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadProgress(todayKey)
        .then((loaded) => {
          if (active) setProgress(loaded);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [todayKey]),
  );

  const handlePlayDailyWord = useCallback(async () => {
    if (!dailyWord || isPlayingWord) return;
    setIsPlayingWord(true);
    try {
      await playPhraseAudio(dailyWord, dailyAudioUrl, { language: targetLanguage });
    } finally {
      setIsPlayingWord(false);
    }
  }, [dailyWord, dailyAudioUrl, isPlayingWord, targetLanguage]);

  // Quick translate follows the learning language chosen in settings.
  const targetLangInfo = useMemo(
    () => languages.find((lang) => lang.code === targetLanguage),
    [languages, targetLanguage],
  );
  const targetLangName = targetLangInfo?.name ?? targetLanguage.toUpperCase();
  const targetLangBadge = (targetLangInfo?.code ?? targetLanguage).toUpperCase().slice(0, 2);

  const goToSearch = () => router.push(query.trim() ? `/phrases?q=${encodeURIComponent(query.trim())}` : '/phrases');
  const goToTranslate = (direction: 'forward' | 'reverse') => router.push(`/translate?direction=${direction}`);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: topInset + 17, paddingBottom: Platform.OS === 'web' ? 118 : 98 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <View>
            <Text style={[styles.brand, { color: colors.foreground }]}>Bama</Text>
            <Text style={[styles.kicker, { color: colors.mutedForeground }]}>PRACTICAL COMMUNICATION</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={[styles.settings, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Open settings">
          <Feather name="sliders" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        {dailyWord ? (
          <>
            <Feather
              name="message-circle"
              size={150}
              color={`${colors.primaryForeground}12`}
              style={styles.heroWatermark}
            />

            <View style={styles.heroStrip}>
              <View style={styles.heroStripStats}>
                {hasProgress ? (
                  <>
                    <View style={[styles.heroStat, { backgroundColor: `${colors.primaryForeground}14` }]}>
                      <Feather name="zap" size={12} color={colors.primaryForeground} />
                      <Text style={[styles.heroStatText, { color: colors.primaryForeground }]}>
                        {progress!.currentStreak} day{progress!.currentStreak === 1 ? '' : 's'} streak
                      </Text>
                    </View>
                    <View style={[styles.heroStat, { backgroundColor: `${colors.primaryForeground}14` }]}>
                      <Feather name="book-open" size={12} color={colors.primaryForeground} />
                      <Text style={[styles.heroStatText, { color: colors.primaryForeground }]}>
                        {progress!.learnedWordIds.length} learned
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={[styles.heroStripHint, { color: colors.primaryForeground }]}>
                    Learn to start your streak
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => router.push('/learn')}
                hitSlop={8}
                style={({ pressed }) => [styles.heroStripLink, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Open the Learn section"
              >
                <Text style={[styles.heroStripLinkText, { color: colors.primaryForeground }]}>Practice</Text>
                <Feather name="arrow-right" size={13} color={colors.primaryForeground} />
              </Pressable>
            </View>

            <View style={styles.heroTopRow}>
              <View style={styles.heroBadgeGroup}>
                <View style={[styles.heroBadge, { backgroundColor: `${colors.primaryForeground}26` }]}>
                  <Feather name="sun" size={11} color={colors.primaryForeground} />
                  <Text style={[styles.heroBadgeText, { color: colors.primaryForeground }]}>
                    {dailyWord.category
                      ? `WORD OF THE DAY · ${dailyWord.category.toUpperCase()}`
                      : 'WORD OF THE DAY'}
                  </Text>
                </View>
              </View>
              <View style={[styles.heroChip, { backgroundColor: `${colors.primaryForeground}1f` }]}>
                <Text style={[styles.heroChipText, { color: colors.primaryForeground }]}>{targetLangName}</Text>
              </View>
            </View>

            <Text style={[styles.heroWord, { color: colors.primaryForeground }]}>
              {dailyTargetText || dailyBaseText}
            </Text>
            {dailyBaseText ? (
              <Text style={[styles.heroMeaning, { color: colors.primaryForeground }]}>{dailyBaseText}</Text>
            ) : null}
            {showDailyPronunciation ? (
              <Text style={[styles.heroPronunciation, { color: colors.primaryForeground }]}>{dailyPronunciation}</Text>
            ) : null}

            {dailyExample ? (
              <View style={[styles.heroExample, { backgroundColor: `${colors.primaryForeground}14` }]}>
                <Text style={[styles.heroExampleLabel, { color: colors.primaryForeground }]}>EXAMPLE</Text>
                <Text style={[styles.heroExampleText, { color: colors.primaryForeground }]}>{dailyExample}</Text>
              </View>
            ) : null}

            <View style={styles.heroActions}>
              <Pressable
                onPress={handlePlayDailyWord}
                disabled={isPlayingWord || !dailyAudioUrl}
                style={({ pressed }) => [
                  styles.heroListen,
                  { backgroundColor: colors.primaryForeground },
                  (pressed || isPlayingWord) && styles.pressed,
                  !dailyAudioUrl && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={dailyAudioUrl ? 'Listen to today’s word' : 'Audio not available yet'}
                accessibilityState={{ busy: isPlayingWord, disabled: !dailyAudioUrl }}
              >
                <Feather
                  name={isPlayingWord ? 'pause-circle' : 'volume-2'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.heroListenText, { color: colors.primary }]}>
                  {isPlayingWord ? 'Playing' : dailyAudioUrl ? 'Listen' : 'No audio yet'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShareVisible(true)}
                style={({ pressed }) => [
                  styles.heroShare,
                  { borderColor: `${colors.primaryForeground}59` },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Share today’s word as a card"
              >
                <Feather name="share-2" size={16} color={colors.primaryForeground} />
                <Text style={[styles.heroListenText, { color: colors.primaryForeground }]}>Share</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.heroBadgeText, { color: colors.primaryForeground }]}>HELLO, LEARNER</Text>
            <Text style={[styles.heroFallbackTitle, { color: colors.primaryForeground }]}>
              Break the language barrier.
            </Text>
            <Text style={[styles.heroFallbackText, { color: colors.primaryForeground }]}>
              Simple words for real moments in your classroom and community.
            </Text>
          </>
        )}
      </View>

      {dailyWord ? (
        <DailyWordShareCard
          word={dailyWord}
          languageLabel={targetLangName}
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          hideTrigger
        />
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick translate</Text>
        <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
      </View>
      <View style={styles.quickRow}>
        <Pressable onPress={() => goToTranslate('forward')} style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
          <View style={[styles.quickIcon, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.quickIconText, { color: colors.primary }]}>EN</Text></View>
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>English</Text>
          <Feather name="arrow-right" size={15} color={colors.mutedForeground} />
          <Text style={[styles.quickLabel, { color: colors.primary }]} numberOfLines={1}>{targetLangName}</Text>
        </Pressable>
        <Pressable onPress={() => goToTranslate('reverse')} style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
          <View style={[styles.quickIcon, { backgroundColor: `${colors.accentForeground}16` }]}><Text style={[styles.quickIconText, { color: colors.accentForeground }]}>{targetLangBadge}</Text></View>
          <Text style={[styles.quickLabel, { color: colors.foreground }]} numberOfLines={1}>{targetLangName}</Text>
          <Feather name="arrow-right" size={15} color={colors.mutedForeground} />
          <Text style={[styles.quickLabel, { color: colors.accentForeground }]}>English</Text>
        </Pressable>
      </View>

       <AdsFeed placement={AD_PLACEMENTS.HOME_TOP} /> 


      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Browse by situation</Text>
        <Pressable onPress={() => router.push('/phrases')} accessibilityRole="button"><Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text></Pressable>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {isLoadingCategories
          ? Array.from({ length: 4 }, (_, index) => (
              <CategoryCardSkeleton key={`category-skeleton-${index}`} delay={index * 90} />
            ))
          : categoryMetas.map((meta, index) => (
              <CategoryCard
                key={meta.name}
                category={meta}
                horizontal
                count={phrases.filter((p) => p.category === meta.name).length}
                onPress={() => router.push(`/phrases?category=${encodeURIComponent(categories[index]?.slug ?? meta.name)}`)}
              />
            ))}
      </ScrollView>

      {isLoadingPopular ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular phrases</Text>
            <Skeleton style={styles.sectionIconPlaceholder} />
          </View>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {Array.from({ length: 2 }, (_, index) => (
              <PhraseCardSkeleton key={`phrase-skeleton-${index}`} delay={index * 110} />
            ))}
          </ScrollView>
        </>
      ) : popular.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular phrases</Text>
            <Feather name="trending-up" size={16} color={colors.primary} />
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {popular.map((item) => <PhraseCard key={item.id} phrase={item} compact horizontal onPress={() => router.push(`/phrase/${item.id}`)} />)}
          </ScrollView>
        </>
      ) : null}
      <AdsFeed placement={AD_PLACEMENTS.HOME_BOTTOM} />
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>Translations are starter content for review by native Hausa speakers.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 39, height: 39, borderRadius: 12 },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 8, letterSpacing: 1.1, marginTop: 2 },
  settings: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 26, padding: 22, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  heroWatermark: { position: 'absolute', right: -26, bottom: -30 },
  heroStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroStripStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
  heroStripHint: { fontFamily: 'Inter_500Medium', fontSize: 11, opacity: 0.72 },
  heroStripLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 999 },
  heroStripLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  heroBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  heroChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  heroChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  heroWord: { fontFamily: 'Inter_700Bold', fontSize: 38, lineHeight: 46, marginTop: 16 },
  heroMeaning: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, marginTop: 4, opacity: 0.95 },
  heroPronunciation: { fontFamily: 'Inter_400Regular', fontSize: 12, fontStyle: 'italic', marginTop: 4, opacity: 0.8 },
  heroListen: { minHeight: 42, borderRadius: 999, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroListenText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  heroBadgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  heroExample: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 16 },
  heroExampleLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1, opacity: 0.72 },
  heroExampleText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, marginTop: 5 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  heroStatText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  heroShare: { minHeight: 42, borderRadius: 999, borderWidth: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFallbackTitle: { fontFamily: 'Inter_700Bold', fontSize: 27, lineHeight: 31, marginTop: 11 },
  heroFallbackText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 11 },
  searchButton: { marginTop: 17 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sectionIconPlaceholder: { width: 16, height: 16, borderRadius: 8 },
  sectionHint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  seeAll: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, minHeight: 54, borderRadius: 18, borderWidth: 1, padding: 13, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  quickIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 3 },
  quickIconText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  quickLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  horizontalList: { gap: 10, paddingRight: 18 },
  disclaimer: { fontFamily: 'Inter_400Regular', textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 18, marginTop: 5 },
});
