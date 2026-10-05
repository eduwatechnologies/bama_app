import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export default function AboutScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: topInset + 12, paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={21} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Settings</Text></Pressable>
      <View style={[styles.mark, { backgroundColor: colors.primary }]}><Feather name="message-circle" size={34} color={colors.primaryForeground} /></View>
      <Text style={[styles.title, { color: colors.foreground }]}>About Bama</Text>
      <Text style={[styles.lead, { color: colors.foreground }]}>A small tool for more confident everyday communication.</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Bama was created to help corps members, teachers, volunteers and visitors communicate more easily with Hausa-speaking students and communities.</Text>
      <View style={[styles.note, { backgroundColor: colors.accent, borderColor: '#c1d9c7' }]}><Feather name="check-circle" size={18} color={colors.accentForeground} /><Text style={[styles.noteText, { color: colors.accentForeground }]}>The core phrasebook works offline, so you can use it where connectivity is limited.</Text></View>
      <Text style={[styles.heading, { color: colors.foreground }]}>About the translations</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>These starter translations are practical reference content, not an authoritative language resource. Hausa-speaking reviewers should verify and improve the wording, pronunciation, and context before wider use.</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>Built for real moments</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>The phrasebook focuses on greetings, classrooms, community conversations, markets, directions, and emergencies rather than trying to replace a full language course.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  mark: { width: 70, height: 70, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 34 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 38, marginTop: 20 },
  lead: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 24, marginTop: 10 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, marginTop: 14 },
  note: { borderWidth: 1, borderRadius: 17, padding: 15, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 23 },
  noteText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20, flex: 1 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 29 },
});