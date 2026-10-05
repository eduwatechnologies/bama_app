import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function VoiceFab() {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const hidden = pathname === '/' || pathname === '/onboarding' || pathname === '/voice';

  if (hidden) return null;

  return (
    <Pressable
      testID="voice-fab"
      onPress={() => router.push('/voice')}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.foreground, bottom: Math.max(insets.bottom, 12) + 78 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open Bama voice assistant"
    >
      <Feather name="mic" size={18} color={colors.background} />
      <Text style={[styles.label, { color: colors.background }]}>Voice</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 18,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 5,
  },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});