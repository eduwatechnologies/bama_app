import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { AdPlacement } from '@/constants/ads';
import { GoogleAds } from './GoogleAds';
import { PersonalAds } from './PersonalAds';
import { fetchAds } from '@/services/api';

interface AdsFeedProps {
  placement: AdPlacement;
  limit?: number;
}

export function AdsFeed({ placement, limit = 3 }: AdsFeedProps) {
  const { data } = useQuery({
    queryKey: ['ads', placement],
    queryFn: () => fetchAds({ placement, limit }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (!data?.length) return null;

  const googleAd = data.find((ad) => ad.type === 'GOOGLE');
  const personalAd = data.find((ad) => ad.type === 'PERSONAL');

  return (
    <View style={styles.container}>
      {googleAd ? <GoogleAds ad={googleAd} /> : null}
      {personalAd ? <PersonalAds ad={personalAd} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
    marginTop: 18,
  },
});
