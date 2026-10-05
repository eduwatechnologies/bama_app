import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
  const { phrases, categories, isReady, isSyncing } = useApp();
  const [query, setQuery] = useState('');
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const categoryMetas = useMemo(() => categories.map(serverCategoryToMeta), [categories]);
  const popular = useMemo(() => phrases.slice(0, 3), [phrases]);
  const isLoadingCategories = isLoadingContent(isReady, isSyncing, categories.length);
  const isLoadingPopular = isLoadingContent(isReady, isSyncing, phrases.length);
  const dailyPhrase = useMemo(
    () => phrases[(new Date().getDate() - 1) % Math.max(1, phrases.length)] ?? phrases[0],
    [phrases],
  );
  const [quickFrom, setQuickFrom] = useState<'english' | 'hausa'>('english');

  const goToSearch = () => router.push(query.trim() ? `/phrases?q=${encodeURIComponent(query.trim())}` : '/phrases');
  const goToDirection = (direction: 'english-to-hausa' | 'hausa-to-english') => router.push(`/translate?direction=${direction}`);

  const swapQuick = useCallback(() => {
    void Haptics.selectionAsync();
    setQuickFrom((prev) => (prev === 'english' ? 'hausa' : 'english'));
  }, []);

  const activeFromLabel = quickFrom === 'english' ? 'English' : 'Hausa';
  const activeFromCode = quickFrom === 'english' ? 'EN' : 'HA';
  const activeToLabel = quickFrom === 'english' ? 'Hausa' : 'English';
  const activeToCode = quickFrom === 'english' ? 'HA' : 'EN';
  const activeDirection: 'english-to-hausa' | 'hausa-to-english' =
    quickFrom === 'english' ? 'english-to-hausa' : 'hausa-to-english';

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
        <View style={styles.heroCopy}>
          <Text style={[styles.heroEyebrow, { color: colors.primaryForeground }]}>HELLO, LEARNER</Text>
          <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>Break the language barrier.</Text>
          <Text style={[styles.heroDescription, { color: colors.primaryForeground }]}>Simple words for real moments in your classroom and community.</Text>
        </View>
        <View style={[styles.bridgeMark, { backgroundColor: colors.card }]}>
          <Feather name="message-circle" size={22} color={colors.primary} />
          <View style={[styles.bridgeLine, { backgroundColor: colors.primary }]} />
          <Feather name="message-circle" size={22} color={colors.primary} />
        </View>
      </View>
     

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick translate</Text>
        <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
      </View>
      <View style={styles.quickRow}>
        <Pressable onPress={() => goToDirection('english-to-hausa')} style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
          <View style={[styles.quickIcon, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.quickIconText, { color: colors.primary }]}>EN</Text></View>
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>English</Text>
          <Feather name="arrow-right" size={15} color={colors.mutedForeground} />
          <Text style={[styles.quickLabel, { color: colors.primary }]}>Hausa</Text>
        </Pressable>
        <Pressable onPress={() => goToDirection('hausa-to-english')} style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
          <View style={[styles.quickIcon, { backgroundColor: `${colors.accentForeground}16` }]}><Text style={[styles.quickIconText, { color: colors.accentForeground }]}>HA</Text></View>
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>Hausa</Text>
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
  hero: { minHeight: 184, borderRadius: 24, padding: 21, flexDirection: 'row', overflow: 'hidden' },
  heroCopy: { flex: 1, paddingRight: 12 },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 27, lineHeight: 31, marginTop: 11 },
  heroDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 11 },
  bridgeMark: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 2, gap: 5 },
  bridgeLine: { height: 3, width: 28, borderRadius: 2 },
  searchButton: { marginTop: 17 },
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
  dailyCard: { borderWidth: 1, borderRadius: 20, padding: 17 },
  dailyTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dailyBadge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dailyBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  dailyCategory: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  dailyEnglish: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 23, marginTop: 20 },
  dailyHausa: { fontFamily: 'Inter_700Bold', fontSize: 23, lineHeight: 30, marginTop: 4 },
  dailyPronunciation: { fontFamily: 'Inter_400Regular', fontSize: 12, fontStyle: 'italic', marginTop: 3 },
  dailyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  dailyListen: { borderRadius: 12, minHeight: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dailyListenText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  dailyOpen: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  dailyOpenText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  disclaimer: { fontFamily: 'Inter_400Regular', textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 18, marginTop: 5 },
});
