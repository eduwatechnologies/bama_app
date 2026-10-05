import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
  /** Delay in ms before the pulse starts, so staggered rows do not blink in unison. */
  delay?: number;
  testID?: string;
}

/**
 * A single shimmering placeholder block. Use it to mirror the exact shape of the
 * content it stands in for, so the layout does not jump when real data lands.
 */
export function Skeleton({ style, delay = 0, testID }: SkeletonProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      testID={testID}
      style={[styles.block, { backgroundColor: colors.muted, opacity }, style]}
    />
  );
}

/** Placeholder shaped like CategoryCard in its horizontal (rail) layout. */
export function CategoryCardSkeleton({ width = 154, delay = 0 }: { width?: number; delay?: number }) {
  return (
    <View style={[styles.railCard, { width }]} testID="category-skeleton">
      <Skeleton style={styles.railIcon} delay={delay} />
      <Skeleton style={styles.railTitleWide} delay={delay + 60} />
      <Skeleton style={styles.railTitleNarrow} delay={delay + 100} />
      <Skeleton style={styles.railMeta} delay={delay + 140} />
    </View>
  );
}

/** Placeholder shaped like PhraseCard in its horizontal (rail) layout. */
export function PhraseCardSkeleton({ width = 292, delay = 0 }: { width?: number; delay?: number }) {
  return (
    <View style={[styles.phraseCard, { width }]} testID="phrase-skeleton">
      <View style={styles.phraseCopy}>
        <Skeleton style={styles.phraseEnglish} delay={delay} />
        <Skeleton style={styles.phraseHausa} delay={delay + 70} />
      </View>
      <View style={styles.phraseActions}>
        <Skeleton style={styles.phraseButton} delay={delay + 120} />
        <Skeleton style={styles.phraseButton} delay={delay + 170} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 8 },
  railCard: { minHeight: 158, borderRadius: 18, padding: 14, gap: 10 },
  railIcon: { width: 38, height: 38, borderRadius: 12 },
  railTitleWide: { height: 12, width: '82%', marginTop: 5 },
  railTitleNarrow: { height: 12, width: '54%' },
  railMeta: { height: 10, width: '40%', marginTop: 'auto' },
  phraseCard: {
    minHeight: 93,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  phraseCopy: { flex: 1, gap: 8, paddingTop: 4 },
  phraseEnglish: { height: 13, width: '62%' },
  phraseHausa: { height: 15, width: '48%' },
  phraseActions: { flexDirection: 'row', gap: 7 },
  phraseButton: { width: 34, height: 34, borderRadius: 17 },
});