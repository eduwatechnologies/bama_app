import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { ApiAd } from '@/services/api';

interface GoogleAdsProps {
  ad: ApiAd;
}

export function GoogleAds({ ad }: GoogleAdsProps) {
  const colors = useColors();
  const google = ad.google;
  if (ad.type !== 'GOOGLE' || !google) return null;

  const isTest = google.testMode;
  const minHeight = google.format === 'BANNER' ? 86 : 116;

  return (
    <View
      testID="google-ads"
      style={[
        styles.container,
        { minHeight, backgroundColor: colors.card, borderColor: colors.border },
      ]}
      accessibilityRole="none"
      accessibilityLabel="Google advertisement"
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ADVERTISEMENT</Text>
        <Text style={[styles.mode, { color: isTest ? colors.accentForeground : colors.primary }]}>
          {isTest ? 'TEST' : 'LIVE'}
        </Text>
      </View>
      <View style={styles.content}>
        <Feather name="monitor" size={22} color={colors.primary} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Google Ads</Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>
            {google.format} · {isTest ? 'Test mode' : 'Ad slot'}
          </Text>
          {isTest && <Text style={[styles.unit, { color: colors.mutedForeground }]} numberOfLines={1}>{google.adUnitId}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  mode: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: { flex: 1, gap: 3 },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    lineHeight: 21,
  },
  detail: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 16,
  },
  unit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14,
  },
});
