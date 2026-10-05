import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Phrase } from '@/types/phrase';
import { playPhraseAudio } from '@/services/audio';


export function AudioButton({ phrase }: { phrase: Phrase }) {
  const colors = useColors();
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePress = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await playPhraseAudio(phrase);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <Pressable
      testID={`detail-audio-${phrase.id}`}
      onPress={handlePress}
      disabled={isPlaying}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.primary },
        isPlaying && styles.playing,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? `Playing ${phrase.english}` : `Listen to ${phrase.english}`}
      accessibilityState={{ busy: isPlaying }}
    >
      <Feather
        name={isPlaying ? 'pause-circle' : 'volume-2'}
        size={18}
        color={colors.primaryForeground}
      />
      <Text style={[styles.label, { color: colors.primaryForeground }]}>
        {isPlaying ? 'Playing' : 'Listen'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 22 },
  playing: { opacity: 0.92 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
