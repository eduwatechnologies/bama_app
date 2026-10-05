import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { CategoryMeta } from '@/types/phrase';

interface CategoryCardProps {
  category: CategoryMeta;
  count: number;
  onPress: () => void;
  horizontal?: boolean;
}

export function CategoryCard({ category, count, onPress, horizontal = false }: CategoryCardProps) {
  const colors = useColors();
  const categoryColor = category.color;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        horizontal && styles.horizontalCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${category.name}`}
    >
      <View style={[styles.icon, { backgroundColor: `${categoryColor}18` }]}>
        <Feather name={category.icon as keyof typeof Feather.glyphMap} size={20} color={categoryColor} />
      </View>
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>{category.name}</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={1}>{category.description}</Text>
      <View style={styles.footer}>
        <Text style={[styles.count, { color: categoryColor }]}>{count} phrases</Text>
        <Feather name="arrow-up-right" size={15} color={categoryColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '48.5%', minHeight: 150, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
  horizontalCard: { width: 154, marginBottom: 0 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 19 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 14 },
  count: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});