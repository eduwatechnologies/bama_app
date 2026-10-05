import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAlert } from '@/components/AlertDialog';

const languages = ['English', 'Pidgin'];

export default function VoiceScreen() {
  const colors = useColors();
  const router = useRouter();
  const { show: showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [status, setStatus] = useState<'ready' | 'unavailable'>('unavailable');
  const pulse = useRef(new Animated.Value(1)).current;
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
      Animated.timing(pulse, { toValue: 1.05, duration: 1500, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const requestVoice = () => {
    setStatus('unavailable');
    showAlert({
      variant: 'warning',
      title: 'AI voice is not connected',
      message:
        'Add an OpenAI key in the secure project secrets to enable Hausa speech recognition, translation, and spoken replies.',
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset + 10, paddingBottom: bottomInset + 22 }]} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={21} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
        </Pressable>

        <View style={styles.headingRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>VOICE BRIDGE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Speak naturally.</Text>
          </View>
          <View style={[styles.livePill, { backgroundColor: status === 'ready' ? colors.accent : colors.secondary }]}>
            <View style={[styles.liveDot, { backgroundColor: status === 'ready' ? colors.accentForeground : colors.mutedForeground }]} />
            <Text style={[styles.liveText, { color: status === 'ready' ? colors.accentForeground : colors.mutedForeground }]}>{status === 'ready' ? 'READY' : 'SETUP NEEDED'}</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Speak in Hausa and get a natural reply in the language you choose.</Text>

        <Animated.View style={[styles.orb, { backgroundColor: colors.primary, transform: [{ scale: pulse }] }]}>
          <View style={[styles.orbInner, { backgroundColor: colors.card }]}>
            <Feather name="mic" size={42} color={colors.primary} />
          </View>
          <View style={[styles.orbRing, { borderColor: colors.card }]} />
        </Animated.View>
        <Text style={[styles.orbLabel, { color: colors.foreground }]}>Hausa in</Text>
        <Text style={[styles.orbHint, { color: colors.mutedForeground }]}>Tap the microphone to start speaking</Text>

        <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routeRow}>
            <View style={[styles.routeIcon, { backgroundColor: colors.accent }]}><Text style={[styles.routeCode, { color: colors.accentForeground }]}>HA</Text></View>
            <View style={styles.routeCopy}><Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>YOU SPEAK</Text><Text style={[styles.routeValue, { color: colors.foreground }]}>Hausa</Text></View>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
            <View style={[styles.routeIcon, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.routeCode, { color: colors.primary }]}>{targetLanguage.slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.routeCopy}><Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>REPLY IN</Text><Text style={[styles.routeValue, { color: colors.foreground }]}>{targetLanguage}</Text></View>
          </View>
          <Text style={[styles.routeNote, { color: colors.mutedForeground }]}>Choose the language the other person should hear.</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reply language</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageList}>
          {languages.map((language) => {
            const selected = language === targetLanguage;
            return (
              <Pressable
                key={language}
                onPress={() => setTargetLanguage(language)}
                style={[styles.languageChip, { backgroundColor: selected ? colors.primary : colors.secondary }]}
                accessibilityRole="button"
                accessibilityLabel={`Reply in ${language}`}
              >
                <Text style={[styles.languageText, { color: selected ? colors.primaryForeground : colors.secondaryForeground }]}>{language}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable onPress={requestVoice} style={({ pressed }) => [styles.talkButton, { backgroundColor: colors.primary }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Start speaking in Hausa">
          <Feather name="mic" size={22} color={colors.primaryForeground} />
          <Text style={[styles.talkText, { color: colors.primaryForeground }]}>Tap to speak in Hausa</Text>
        </Pressable>

        <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="lock" size={16} color={colors.mutedForeground} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>Voice AI is not connected yet. Bama will never invent a transcript or translation while setup is incomplete.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 27 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 37, marginTop: 7 },
  livePill: { borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9, maxWidth: 335 },
  orb: { width: 205, height: 205, borderRadius: 103, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  orbInner: { width: 111, height: 111, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  orbRing: { position: 'absolute', width: 177, height: 177, borderRadius: 89, borderWidth: 1, opacity: 0.55 },
  orbLabel: { fontFamily: 'Inter_700Bold', fontSize: 17, textAlign: 'center', marginTop: 18 },
  orbHint: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 5 },
  routeCard: { borderWidth: 1, borderRadius: 19, padding: 15, marginTop: 24 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  routeCode: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  routeCopy: { flex: 1 },
  routeLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1 },
  routeValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 3 },
  routeNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 13 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 25, marginBottom: 10 },
  languageList: { gap: 8, paddingRight: 18 },
  languageChip: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10 },
  languageText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  talkButton: { minHeight: 57, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24 },
  talkText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  notice: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 15 },
  noticeText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});