import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Phrase } from '@/types/phrase';
import { playPhraseAudio } from '@/services/audio';

interface PhraseCardProps {
  phrase: Phrase;
  onPress: () => void;
  compact?: boolean;
  horizontal?: boolean;
}

export function PhraseCard({ phrase, onPress, compact = false, horizontal = false }: PhraseCardProps) {
  const colors = useColors();
  const { isFavorite, toggleFavorite, getTranslation, getAudioUrl } = useApp();
  const [isPlaying, setIsPlaying] = useState(false);
  const favorite = isFavorite(phrase.id);
  const translation = getTranslation(phrase);
  const audioUrl = getAudioUrl(phrase);

  const handleAudioPress = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await playPhraseAudio(phrase, audioUrl);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, compact && styles.compactCard, horizontal && styles.horizontalCard]}>
      <View style={styles.content}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open phrase ${translation}`}
        >
          <Text style={[styles.source, { color: colors.foreground }]} numberOfLines={compact ? 1 : 2}>
            {translation}
          </Text>
          {!compact ? (
            <Text style={[styles.pronunciation, { color: colors.mutedForeground }]} numberOfLines={2}>
              {phrase.pronunciation}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            testID={`audio-${phrase.id}`}
            onPress={handleAudioPress}
            disabled={isPlaying || !audioUrl}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.secondary },
              isPlaying && styles.playing,
              pressed && styles.pressed,
              !audioUrl && styles.disabled,
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? `Playing ${translation}` : audioUrl ? `Listen to ${translation}` : 'Audio not available'}
            accessibilityState={{ busy: isPlaying, disabled: !audioUrl }}
          >
            <Feather
              name={isPlaying ? 'pause-circle' : 'volume-2'}
              size={17}
              color={colors.secondaryForeground}
            />
          </Pressable>
          <Pressable
            testID={`favorite-${phrase.id}`}
            onPress={() => toggleFavorite(phrase.id)}
            style={[styles.iconButton, { backgroundColor: favorite ? colors.accent : colors.secondary }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={favorite ? `Remove ${translation} from favorites` : `Add ${translation} to favorites`}
          >
            <Feather name={favorite ? 'star' : 'star'} size={17} color={favorite ? colors.accentForeground : colors.secondaryForeground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 11,
    overflow: 'hidden',
  },
  compactCard: { marginBottom: 10 },
  horizontalCard: { width: 292, marginBottom: 0 },
  content: {
    minHeight: 93,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pressed: { opacity: 0.72 },
  copy: { flex: 1, gap: 4 },
  source: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
  pronunciation: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, fontStyle: 'italic', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 7 },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  playing: { opacity: 0.88 },
  disabled: { opacity: 0.4 },
});