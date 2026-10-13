import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { playAudioUrl } from '@/services/audio';
import { getLanguageByCode } from '@/types/language';
import { ApiWord } from '@/services/api';

interface PhraseWordsProps {
  phraseId: string;
  targetLanguage?: string;
}

function normalize(token: string): string {
  return token
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}'’\s-]/gu, '')
    .trim();
}

/**
 * Breaks the target language line into words and highlights the ones the dictionary
 * knows about. Tapping a highlighted word plays that word's audio.
 */
export function PhraseWords({ phraseId, targetLanguage }: PhraseWordsProps) {
  const colors = useColors();
  const { rawWords, getPhraseById, targetLanguage: currentTargetLanguage } = useApp();
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const lang = targetLanguage ?? currentTargetLanguage;
  
  const phrase = getPhraseById(phraseId);
  const translation = phrase?.translations[lang] ?? '';
  
  if (!translation) return null;

  const lookup = useMemo(() => {
    const map = new Map<string, ApiWord>();
    for (const word of rawWords) {
      const key = normalize(word.translations[lang] ?? '');
      if (key && !map.has(key)) map.set(key, word);
    }
    return map;
  }, [rawWords, lang]);

  const tokens = useMemo(() => translation.trim().split(/\s+/).filter(Boolean), [translation]);
  const matched = useMemo(
    () => tokens.map((token) => ({ token, word: lookup.get(normalize(token)) })),
    [lookup, tokens],
  );
  const matchCount = matched.filter((item) => item.word).length;

  if (matchCount === 0) return null;

  const play = async (wordId: string, url: string) => {
    void Haptics.selectionAsync();
    setPlayingId(wordId);
    try {
      await playAudioUrl(url);
    } finally {
      setPlayingId((current) => (current === wordId ? null : current));
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Feather name="align-left" size={13} color={colors.mutedForeground} />
        <Text style={[styles.headerText, { color: colors.mutedForeground }]}>
          {matchCount} of {tokens.length} words · tap to hear
        </Text>
      </View>

      <View style={styles.tokens}>
        {matched.map(({ token, word }, index) => {
          if (!word) {
            return (
              <Text
                key={`${token}-${index}`}
                style={[styles.plainToken, { color: colors.foreground }]}
              >
                {token}
              </Text>
            );
          }

          const audioMap = (word.audio ?? {}) as Record<string, string | null | undefined>;
          const url = audioMap[lang] ?? audioMap['en'];
          const isPlaying = playingId === word._id;
          return (
            <Pressable
              key={`${token}-${index}`}
              onPress={url ? () => void play(word._id, url) : undefined}
              disabled={!url}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isPlaying ? colors.primary : colors.secondary,
                  borderColor: isPlaying ? colors.primary : colors.border,
                },
                pressed && url ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${word.translations[lang] ?? token} means ${word.translations['en'] ?? ''}`}
            >
              <Text
                style={[
                  styles.chipHausa,
                  { color: isPlaying ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {token}
              </Text>
              <Text
                style={[
                  styles.chipEnglish,
                  {
                    color: isPlaying
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
                numberOfLines={1}
              >
                {isPlaying ? 'playing…' : word.translations['en'] ?? ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, gap: 9 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  tokens: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 1,
    maxWidth: 170,
  },
  chipHausa: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 19 },
  chipEnglish: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14,
    maxWidth: 150,
  },
  plainToken: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20,
    paddingBottom: 6,
  },
  pressed: { opacity: 0.72 },
});
