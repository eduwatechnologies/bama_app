import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export default function PrivacyScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: topInset + 12, paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={21} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Settings</Text></Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>Privacy Policy</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Bama respects your privacy. The phrasebook works offline and does not collect personal data. Any optional usage analytics are anonymized and never sold.</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>Data collected</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>We do not collect names, emails, or identifiers. Language preferences stay on your device.</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>Contact</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Questions about privacy can be sent through the project repository.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 38, marginTop: 20 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, marginTop: 14 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 29 },
});
