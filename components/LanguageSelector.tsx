import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Modal, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { TargetLanguage, useApp } from '@/context/AppContext';
import { Language } from '@/services/api';

interface LanguageSelectorProps {
  targetLanguage: TargetLanguage;
  onChange: (languageCode: TargetLanguage) => void;
  /** Show the base/source language (English) as a selectable option. Off by default. */
  includeBase?: boolean;
  showModal?: boolean;
  /** Render the language as a static, non-interactive chip. */
  readOnly?: boolean;
}

export function LanguageSelector({ targetLanguage, onChange, includeBase = false, showModal = true, readOnly = false }: LanguageSelectorProps) {
  const colors = useColors();
  const { languages, baseLanguage } = useApp();
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Languages are administered on the backend and synced into the app context.
  const activeLanguages = useMemo<Language[]>(
    () =>
      languages
        .filter((lang) => lang.isActive)
        .filter((lang) => includeBase || lang.code !== baseLanguage)
        .sort((a, b) => a.order - b.order),
    [languages, includeBase, baseLanguage],
  );

  const currentLanguage =
    languages.find((lang) => lang.code === targetLanguage) ?? activeLanguages[0];

  const handleLanguageSelect = (languageCode: TargetLanguage) => {
    onChange(languageCode);
    if (showModal) setIsModalVisible(false);
  };

  if (readOnly) {
    // Static chip — displays the current language without allowing changes.
    return (
      <View style={[styles.trigger, { backgroundColor: colors.secondary }]}>
        <View style={styles.triggerContent}>
          <Text style={styles.triggerFlag}>{currentLanguage?.flag || '🌐'}</Text>
          <Text style={[styles.triggerLabel, { color: colors.foreground }]}>
            {currentLanguage?.nativeName || targetLanguage}
          </Text>
        </View>
      </View>
    );
  }

  if (!showModal) {
    // Simple inline selector for compact spaces
    return (
      <View style={[styles.container, { backgroundColor: colors.secondary }]}>
        {activeLanguages.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => handleLanguageSelect(lang.code)}
            style={[
              styles.option,
              lang.code === targetLanguage && { backgroundColor: colors.card },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${lang.name} (${lang.nativeName})`}
          >
            <Text style={[
              styles.label,
              { color: lang.code === targetLanguage ? colors.foreground : colors.mutedForeground }
            ]}>
              {lang.flag} {lang.nativeName}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setIsModalVisible(true)}
        style={[styles.trigger, { backgroundColor: colors.secondary }]}
        accessibilityRole="button"
        accessibilityLabel={`Current language: ${currentLanguage?.nativeName || targetLanguage}`}
      >
        <View style={styles.triggerContent}>
          <Text style={styles.triggerFlag}>{currentLanguage?.flag || '🌐'}</Text>
          <Text style={[styles.triggerLabel, { color: colors.foreground }]}>
            {currentLanguage?.nativeName || targetLanguage}
          </Text>
          <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
        </View>
      </Pressable>

      <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsModalVisible(false)}>
        <Pressable onPress={() => setIsModalVisible(false)} style={styles.modalOverlay} />
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Language</Text>
            <Pressable onPress={() => setIsModalVisible(false)} accessibilityLabel="Close">
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {activeLanguages.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => handleLanguageSelect(lang.code)}
                style={[
                  styles.modalItem,
                  { backgroundColor: lang.code === targetLanguage ? colors.primary + '16' : colors.card },
                  { borderColor: lang.code === targetLanguage ? colors.primary : colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${lang.name} (${lang.nativeName})${lang.code === targetLanguage ? ', selected' : ''}`}
              >
                <View style={styles.modalItemContent}>
                  <Text style={styles.modalItemFlag}>{lang.flag}</Text>
                  <View style={styles.modalItemText}>
                    <Text style={[styles.modalItemName, { color: colors.foreground }]}>{lang.name}</Text>
                    <Text style={[styles.modalItemNative, { color: colors.mutedForeground }]}>{lang.nativeName}</Text>
                  </View>
                </View>
                {lang.code === targetLanguage && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 13, padding: 4, gap: 2 },
  option: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  trigger: { borderRadius: 12, padding: 12, minWidth: 140 },
  triggerContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  triggerFlag: { fontSize: 18 },
  triggerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  modalList: { paddingHorizontal: 16, paddingTop: 12 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1 },
  modalItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalItemFlag: { fontSize: 24 },
  modalItemText: { flex: 1 },
  modalItemName: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  modalItemNative: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
});