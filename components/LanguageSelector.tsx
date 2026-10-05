import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { AppDirection } from '@/context/AppContext';

export function LanguageSelector({ direction, onChange }: { direction: AppDirection; onChange: (direction: AppDirection) => void }) {
  const colors = useColors();
  const englishFirst = direction === 'english-to-hausa';
  return (
    <View style={[styles.container, { backgroundColor: colors.secondary }]}>
      <Pressable
        onPress={() => onChange('english-to-hausa')}
        style={[styles.option, englishFirst && { backgroundColor: colors.card }]}
        accessibilityRole="button"
        accessibilityLabel="English to Hausa"
      >
        <Text style={[styles.label, { color: englishFirst ? colors.foreground : colors.mutedForeground }]}>English</Text>
      </Pressable>
      <Feather name="arrow-right" size={15} color={colors.mutedForeground} />
      <Pressable
        onPress={() => onChange('hausa-to-english')}
        style={[styles.option, !englishFirst && { backgroundColor: colors.card }]}
        accessibilityRole="button"
        accessibilityLabel="Hausa to English"
      >
        <Text style={[styles.label, { color: !englishFirst ? colors.foreground : colors.mutedForeground }]}>Hausa</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 13, padding: 4, gap: 2 },
  option: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});