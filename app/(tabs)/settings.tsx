import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { LanguageSelector } from '@/components/LanguageSelector';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { direction, setDirection } = useApp();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: topInset + 18, paddingBottom: Platform.OS === 'web' ? 118 : 98 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>PREFERENCES</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Make it yours.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A few simple choices for your offline phrasebook.</Text>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Language direction</Text>
      <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="repeat" size={18} color={colors.accentForeground} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Default translation</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Choose the direction used on Translate.</Text></View>
        <LanguageSelector direction={direction} onChange={setDirection} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
      <Pressable onPress={() => router.push('/about')} style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
        <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}16` }]}><Feather name="info" size={18} color={colors.primary} /></View>
        <View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>About Bama</Text><Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Why this tool exists and how to review the content.</Text></View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>App</Text>
      <View style={[styles.infoCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phrasebook</Text><View style={styles.offlinePill}><Feather name="wifi-off" size={12} color={colors.accentForeground} /><Text style={[styles.pillText, { color: colors.accentForeground }]}>Available offline</Text></View></View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Version</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>1.0.0 MVP</Text></View>
      </View>
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>Built for practical moments in classrooms and communities.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 36, marginTop: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 29, marginBottom: 11 },
  settingCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
  linkCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, minWidth: 130 },
  settingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  settingDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  infoCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15 },
  infoRow: { minHeight: 53, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  infoValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  divider: { height: 1 },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#dce9df', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 32, paddingHorizontal: 28 },
});