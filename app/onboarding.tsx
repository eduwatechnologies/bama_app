import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

const slides = [
  {
    eyebrow: 'WELCOME TO BAMA',
    title: 'Start with a simple hello.',
    description: 'Practical English and Hausa phrases for classrooms, communities, and everyday moments.',
    icon: 'message-circle' as const,
  },
  {
    eyebrow: 'YOUR OFFLINE PHRASEBOOK',
    title: 'The right words, even offline.',
    description: 'Browse useful phrases by situation, search in either language, and keep your favorites close.',
    icon: 'book-open' as const,
  },
  {
    eyebrow: 'MADE FOR REAL MOMENTS',
    title: 'Build understanding, one phrase at a time.',
    description: 'Use the phrasebook as a friendly reference while native Hausa speakers help us keep every translation useful.',
    icon: 'users' as const,
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();
  const [slideIndex, setSlideIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = slides[slideIndex];
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const next = () => {
    if (slideIndex === slides.length - 1) {
      finish();
      return;
    }
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setSlideIndex((current) => current + 1);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topInset + 10 }]}>
        <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
          <Image source={require('../assets/images/icon.png')} style={styles.brandImage} />
        </View>
        <Text style={[styles.brand, { color: colors.foreground }]}>Bama</Text>
        <Pressable onPress={finish} style={styles.skip} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip onboarding">
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.main, { opacity: fade }]}>
        <View style={[styles.illustration, { backgroundColor: colors.primary }]}>
          <View style={[styles.illustrationCircle, { backgroundColor: colors.card }]}>
            <Feather name={slide.icon} size={43} color={colors.primary} />
          </View>
          <View style={[styles.dot, styles.dotOne, { backgroundColor: colors.accent }]} />
          <View style={[styles.dot, styles.dotTwo, { backgroundColor: colors.card }]} />
          <View style={[styles.dot, styles.dotThree, { backgroundColor: colors.accent }]} />
        </View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{slide.eyebrow}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{slide.title}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{slide.description}</Text>
      </Animated.View>

      <View style={[styles.bottom, { paddingBottom: bottomInset + 12 }]}>
        <View style={styles.pagination}>
          {slides.map((item, index) => (
            <View key={item.eyebrow} style={[styles.pageDot, { backgroundColor: index === slideIndex ? colors.primary : colors.border }, index === slideIndex && styles.activePageDot]} />
          ))}
        </View>
        <Pressable onPress={next} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={slideIndex === slides.length - 1 ? 'Start using Bama' : 'Continue onboarding'}>
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{slideIndex === slides.length - 1 ? 'Start using Bama' : 'Continue'}</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 22 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandImage: { width: 35, height: 35 },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  skip: { marginLeft: 'auto', padding: 7 },
  skipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 20 },
  illustration: { width: 224, height: 224, borderRadius: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 48 },
  illustrationCircle: { width: 113, height: 113, borderRadius: 57, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 13, height: 13, borderRadius: 7 },
  dotOne: { top: 42, right: 42 },
  dotTwo: { bottom: 53, left: 34 },
  dotThree: { bottom: 30, right: 70 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5, textAlign: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 31, lineHeight: 38, textAlign: 'center', marginTop: 12, maxWidth: 350 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 14, maxWidth: 330 },
  bottom: { gap: 21 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  pageDot: { width: 7, height: 7, borderRadius: 4 },
  activePageDot: { width: 24 },
  button: { minHeight: 56, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});