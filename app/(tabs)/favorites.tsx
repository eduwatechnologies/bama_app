import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { phrases as staticPhrases } from '@/data/phrases';
import { PhraseCard } from '@/components/PhraseCard';
import { EmptyState } from '@/components/EmptyState';

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favoriteIds, phrases, isSyncing } = useApp();
  const effectivePhrases = !phrases.length && !isSyncing ? staticPhrases : phrases;
  const favorites = useMemo(() => effectivePhrases.filter((item) => favoriteIds.includes(item.id)), [favoriteIds, effectivePhrases]);
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        scrollEnabled={favorites.length > 0}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topInset + 18, paddingBottom: Platform.OS === 'web' ? 118 : 98, paddingHorizontal: 18, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR COLLECTION</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Saved for the moment.</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Keep the phrases you reach for close by.</Text>
            {favorites.length > 0 ? <Text style={[styles.count, { color: colors.mutedForeground }]}>{favorites.length} saved {favorites.length === 1 ? 'phrase' : 'phrases'}</Text> : null}
          </View>
        }
        renderItem={({ item }) => <PhraseCard phrase={item} onPress={() => router.push(`/phrase/${item.id}`)} />}
        ListEmptyComponent={<EmptyState icon="star" title="Nothing saved yet" message="Tap the star on a phrase to keep it here for quick access." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { marginBottom: 19 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 36, marginTop: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8 },
  count: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 20 },
});
