import { Linking } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { ApiAd } from '@/services/api';

interface PersonalAdsProps {
  ad: ApiAd;
}

const MAX_HEIGHT = 220;
const PENDING_HEIGHT = 160;
const AUTO_ADVANCE_MS = 4500;

function isSafeUrl(value: string | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export function PersonalAds({ ad }: PersonalAdsProps) {
  const colors = useColors();
  const personal = ad.personal;
  const [hidden, setHidden] = useState<string[]>([]);
  const [ratio, setRatio] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const imageUrls =
    personal && Array.isArray(personal.imageUrls) && personal.imageUrls.length > 0
      ? personal.imageUrls
      : personal?.imageUrl
        ? [personal.imageUrl]
        : [];
  const slides = imageUrls.filter((url) => isSafeUrl(url) && !hidden.includes(url));
  const targetUrl = personal && isSafeUrl(personal.targetUrl) ? personal.targetUrl : undefined;

  // One shared ratio keeps every slide the same height so paging stays clean.
  const firstSlide = slides[0];
  useEffect(() => {
    setRatio(null);
    if (!firstSlide) return;
    let active = true;
    Image.getSize(
      firstSlide,
      (w, h) => {
        if (active && w > 0 && h > 0) setRatio(w / h);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [firstSlide]);

  const openTarget = useCallback(() => {
    if (targetUrl) void Linking.openURL(targetUrl).catch(() => undefined);
  }, [targetUrl]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      const measured = event.nativeEvent.layoutMeasurement.width;
      if (measured > 0) {
        setIndex(Math.round(offset / measured));
      }
    },
    [],
  );

  useEffect(() => {
    if (slides.length < 2 || width === 0) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length, width]);

  if (ad.type !== 'PERSONAL' || !personal || slides.length === 0) return null;

  // Percentage heights cannot resolve inside a horizontal ScrollView, so the
  // carousel box is measured and applied in pixels.
  const boxHeight = ratio ? Math.min(MAX_HEIGHT, Math.round(width / ratio)) : PENDING_HEIGHT;

  return (
    <View
      testID="personal-ads"
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          height: boxHeight,
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ width: '100%', height: boxHeight }}
        contentContainerStyle={{ height: boxHeight }}
        accessibilityRole={targetUrl ? 'button' : undefined}
        accessibilityLabel={targetUrl ? `Open ${personal.title}` : personal.title}
      >
        {slides.map((url) => (
          <Pressable
            key={url}
            onPress={openTarget}
            disabled={!targetUrl}
            style={({ pressed }) => [
              styles.slide,
              { width, height: boxHeight },
              targetUrl && pressed && styles.pressed,
            ]}
          >
            <Image
              source={{ uri: url }}
              style={{ width, height: boxHeight }}
              resizeMode="contain"
              onError={() => setHidden((prev) => (prev.includes(url) ? prev : [...prev, url]))}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ))}
      </ScrollView>

      {slides.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {slides.map((url, dotIndex) => (
            <View
              key={url}
              style={[styles.dot, dotIndex === index && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.78 },
  slide: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: {
    width: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});
