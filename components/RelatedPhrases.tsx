import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { PhraseCard } from './PhraseCard';
import type { Phrase } from '@/types/phrase';

interface RelatedPhrasesProps {
  current: Phrase;
  limit?: number;
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{M}]+/u)
      .filter(Boolean),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let score = 0;
  for (const token of a) {
    if (b.has(token)) score += 1;
  }
  return score;
}

/**
 * Horizontal rail of sibling phrases: same category first, then ranked by how
 * many words they share with the phrase being viewed, so the suggestions stay
 * useful rather than arbitrary.
 */
export function RelatedPhrases({ current, limit = 6 }: RelatedPhrasesProps) {
  const colors = useColors();
  const router = useRouter();
  const { phrases, categories } = useApp();

  const related = useMemo(() => {
    const currentTokens = tokenSet(`${current.english} ${current.hausa}`);
    return phrases
      .filter((item) => item.id !== current.id)
      .map((item) => ({
        item,
        sameCategory: item.category === current.category,
        score: overlap(currentTokens, tokenSet(`${item.english} ${item.hausa}`)),
      }))
      .filter((entry) => entry.sameCategory || entry.score > 0)
      .sort((a, b) => {
        if (a.sameCategory !== b.sameCategory) return a.sameCategory ? -1 : 1;
        if (a.score !== b.score) return b.score - a.score;
        return 0;
      })
      .slice(0, limit)
      .map((entry) => entry.item);
  }, [current, phrases]);

  if (related.length === 0) return null;

  const slug = categories.find((c) => c.name === current.category)?.slug;

  const openPhrase = (id: string) => {
    router.push({ pathname: '/phrase/[id]', params: { id } });
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Related phrases</Text>
        {slug ? (
          <Pressable
            onPress={() => router.push({ pathname: '/phrases', params: { category: slug } })}
            style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`See all ${current.category} phrases`}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {related.map((item) => (
          <PhraseCard
            key={item.id}
            phrase={item}
            compact
            horizontal
            onPress={() => openPhrase(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20, gap: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 30 },
  seeAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  rail: { gap: 10, paddingRight: 18 },
  pressed: { opacity: 0.7 },
});
