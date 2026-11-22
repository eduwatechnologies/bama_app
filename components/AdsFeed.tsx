import { useQuery } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AdPlacement } from '@/constants/ads';
import { GoogleAds } from './GoogleAds';
import { PersonalAds } from './PersonalAds';
import { fetchAds } from '@/services/api';
import { trackAdImpression } from '@/services/adTracking';

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

  // One impression per served ad, deduped per session inside the tracker.
  // Only personal ads are real creatives — the Google card is a placeholder
  // until an ad SDK is integrated, so it must not inflate impressions.
  useEffect(() => {
    if (!data?.length) return;
    for (const ad of data) {
      if (ad.type === 'PERSONAL') trackAdImpression(ad._id, placement);
    }
  }, [data, placement]);

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
