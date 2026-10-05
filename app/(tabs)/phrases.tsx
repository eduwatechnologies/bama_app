import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { categories as staticCategories, phrases as staticPhrases } from '@/data/phrases';
import { SearchBar } from '@/components/SearchBar';
import { PhraseCard } from '@/components/PhraseCard';
import { EmptyState } from '@/components/EmptyState';
import { AdsFeed } from '@/components/AdsFeed';
import { AD_PLACEMENTS } from '@/constants/ads';
import { useApp } from '@/context/AppContext';
import { ApiCategory } from '@/services/api';

type SelectableCategory = { name: string; slug?: string };

export default function PhrasesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const { phrases, categories, getCategoryBySlug, isSyncing } = useApp();

  const useStaticFallback = !phrases.length && !isSyncing;
  const effectivePhrases = useStaticFallback ? staticPhrases : phrases;
  const effectiveCategories = useStaticFallback
    ? staticCategories.map((c) => ({ name: c.name }))
    : categories.map((c) => ({ name: c.name, slug: c.slug }));

  const initialCategoryName = useMemo(() => {
    if (!params.category || typeof params.category !== 'string') return null;
    if (useStaticFallback) return params.category;
    const cat = categories.find((c: ApiCategory) => c.slug === params.category);
    return cat?.name ?? null;
  }, [params.category, useStaticFallback, categories]);

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [category, setCategory] = useState<string | null>(initialCategoryName);

  useEffect(() => {
    setCategory(initialCategoryName);
  }, [initialCategoryName]);

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const filterItems: SelectableCategory[] = useMemo(
    () => [{ name: 'All phrases' }, ...effectiveCategories],
    [effectiveCategories],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return effectivePhrases.filter((item) => {
      const inCategory = !category || item.category === category;
      const matchesSearch = !normalized || item.english.toLocaleLowerCase().includes(normalized) || item.hausa.toLocaleLowerCase().includes(normalized);
      return inCategory && matchesSearch;
    });
  }, [category, query, effectivePhrases]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        scrollEnabled={filtered.length > 0}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topInset + 18, paddingBottom: Platform.OS === 'web' ? 118 : 98, paddingHorizontal: 18 }}
        ListHeaderComponent={
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>OFFLINE PHRASEBOOK</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Find the right words.</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Search in English or Hausa, then tap a phrase to see it.</Text>
            <View style={styles.searchWrap}><SearchBar value={query} onChangeText={setQuery} /></View>
            <FlatList
              data={filterItems}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.name}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => {
                const selected = item.name === 'All phrases' ? !category : category === item.name;
                return (
                  <Text
                    onPress={() => setCategory(item.name === 'All phrases' ? null : item.name)}
                    style={[styles.filter, { color: selected ? colors.primaryForeground : colors.mutedForeground, backgroundColor: selected ? colors.primary : colors.secondary }]}
                  >
                    {item.name}
                  </Text>
                );
              }}
            />
            <View style={styles.resultsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{category ?? 'All phrases'}</Text>
              <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>{filtered.length} results</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => <PhraseCard phrase={item} onPress={() => router.push(`/phrase/${item.id}`)} />}
        ListEmptyComponent={<EmptyState title="No phrase found" message="Try another English or Hausa word, or browse the full phrasebook." />}
        ListFooterComponent={<AdsFeed placement={AD_PLACEMENTS.PHRASES_BOTTOM} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 36, marginTop: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 330 },
  searchWrap: { marginTop: 5 },
  filterList: { gap: 8, paddingVertical: 16 },
  filter: { fontFamily: 'Inter_600SemiBold', fontSize: 12, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 9, overflow: 'hidden' },
  resultsHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, marginTop: 2 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  resultCount: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
