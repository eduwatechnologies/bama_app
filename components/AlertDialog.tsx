import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { setAudioAlert } from '@/services/audio';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface AlertButton {
  label: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'destructive' | 'cancel';
}

export interface AlertOptions {
  title: string;
  message?: string;
  variant?: AlertVariant;
  buttons?: AlertButton[];
  dismissible?: boolean;
}

interface AlertState extends Required<Pick<AlertOptions, 'variant' | 'dismissible'>> {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AlertContextValue {
  show: (opts: AlertOptions) => void;
  hide: () => void;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

const VARIANT_META: Record<
  AlertVariant,
  { icon: keyof typeof Feather.glyphMap; toneLight: string; toneDark: string; haptic: Haptics.NotificationFeedbackType | null }
> = {
  info: {
    icon: 'info',
    toneLight: 'rgba(217, 101, 59, 0.12)',
    toneDark: 'rgba(217, 101, 59, 0.20)',
    haptic: null,
  },
  success: {
    icon: 'check-circle',
    toneLight: 'rgba(49, 88, 67, 0.12)',
    toneDark: 'rgba(49, 88, 67, 0.24)',
    haptic: Haptics.NotificationFeedbackType.Success,
  },
  warning: {
    icon: 'alert-triangle',
    toneLight: 'rgba(184, 139, 58, 0.14)',
    toneDark: 'rgba(245, 198, 95, 0.18)',
    haptic: Haptics.NotificationFeedbackType.Warning,
  },
  error: {
    icon: 'x-circle',
    toneLight: 'rgba(184, 75, 58, 0.12)',
    toneDark: 'rgba(239, 123, 103, 0.20)',
    haptic: Haptics.NotificationFeedbackType.Error,
  },
  confirm: {
    icon: 'help-circle',
    toneLight: 'rgba(122, 128, 124, 0.12)',
    toneDark: 'rgba(201, 209, 205, 0.16)',
    haptic: null,
  },
};

function defaultButtons(variant: AlertVariant): AlertButton[] {
  if (variant === 'confirm') {
    return [
      { label: 'Cancel', style: 'cancel' },
      { label: 'Confirm', style: 'default' },
    ];
  }
  return [{ label: 'OK', style: 'default' }];
}

export function AlertProvider({ children }: PropsWithChildren) {
  const colors = useColors();
  const scheme = useColorScheme();
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<AlertState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  const runIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 320,
        damping: 26,
        mass: 0.85,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [opacity, scale]);

  const runOut = useCallback(
    (onDone?: () => void) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setVisible(false);
        setState(null);
        onDone?.();
      });
    },
    [opacity, scale],
  );

  const hide = useCallback(() => {
    if (!visible) return;
    runOut();
  }, [visible, runOut]);

  const show = useCallback(
    (opts: AlertOptions) => {
      const variant: AlertVariant = opts.variant ?? 'info';
      const meta = VARIANT_META[variant];
      if (meta.haptic != null) {
        void Haptics.notificationAsync(meta.haptic);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const next: AlertState = {
        title: opts.title,
        message: opts.message,
        variant,
        dismissible: opts.dismissible ?? true,
        buttons:
          opts.buttons && opts.buttons.length > 0
            ? opts.buttons
            : defaultButtons(variant),
      };
      setState(next);
      setVisible(true);
      setTimeout(runIn, 0);
    },
    [runIn],
  );

  const onBackdropPress = useCallback(() => {
    if (state?.dismissible) runOut();
  }, [state?.dismissible, runOut]);

  const handleButtonPress = useCallback(
    async (button: AlertButton) => {
      if (button.style !== 'cancel') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        void Haptics.selectionAsync();
      }
      let handled = false;
      try {
        await button.onPress?.();
        handled = true;
      } finally {
        if (handled) runOut();
        else runOut();
      }
    },
    [runOut],
  );

  const value = useMemo<AlertContextValue>(() => ({ show, hide }), [show, hide]);

  useEffect(() => {
    setAudioAlert(value.show);
    return () => {
      setAudioAlert(null);
    };
  }, [value.show]);

  const isDark = scheme === 'dark';
  const { width: screenW } = Dimensions.get('window');
  const modalWidth = Math.min(screenW - 48, 420);

  return (
    <AlertContext.Provider value={value}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onBackdropPress}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFill}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <Pressable
            style={styles.backdrop}
            onPress={onBackdropPress}
            accessibilityRole="none"
          >
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity }]}
              pointerEvents="none"
            >
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={22}
                  tint={isDark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(10,12,16,0.45)' },
                  ]}
                />
              )}
            </Animated.View>

            <SafeAreaView style={styles.shell} pointerEvents="box-none">
              <Animated.View
                style={[
                  styles.card,
                  {
                    width: modalWidth,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity,
                    transform: [{ scale }],
                  },
                ]}
              >
                {state && (
                  <>
                    <View style={styles.body}>
                      <View
                        style={[
                          styles.iconWrap,
                          {
                            backgroundColor: isDark
                              ? VARIANT_META[state.variant].toneDark
                              : VARIANT_META[state.variant].toneLight,
                          },
                        ]}
                      >
                        <Feather
                          name={VARIANT_META[state.variant].icon}
                          size={26}
                          color={
                            state.variant === 'error'
                              ? colors.destructive
                              : state.variant === 'success'
                                ? colors.accentForeground
                                : state.variant === 'warning'
                                  ? '#b88b3a'
                                  : colors.primary
                          }
                        />
                      </View>
                      <Text
                        style={[styles.title, { color: colors.foreground }]}
                        numberOfLines={5}
                      >
                        {state.title}
                      </Text>
                      {state.message ? (
                        <Text
                          style={[styles.message, { color: colors.mutedForeground }]}
                        >
                          {state.message}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={[styles.divider, { backgroundColor: colors.border }]}
                    />

                    <View
                      style={[
                        styles.actions,
                        state.buttons.length > 2 && styles.actionsStacked,
                      ]}
                    >
                      {state.buttons.map((button, index) => {
                        const isDestructive = button.style === 'destructive';
                        const isCancel = button.style === 'cancel';
                        const isDefault = !isDestructive && !isCancel;
                        const bgColor = isDestructive
                          ? colors.destructive
                          : isDefault
                            ? colors.primary
                            : colors.secondary;
                        const fgColor = isDestructive
                          ? colors.destructiveForeground
                          : isDefault
                            ? colors.primaryForeground
                            : colors.secondaryForeground;
                        return (
                          <Pressable
                            key={`${button.label}-${index}`}
                            onPress={() => handleButtonPress(button)}
                            style={({ pressed }) => [
                              styles.action,
                              state.buttons.length === 2 && styles.actionHalf,
                              state.buttons.length > 2 && styles.actionFull,
                              { backgroundColor: bgColor },
                              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={button.label}
                          >
                            <Text
                              style={[
                                styles.actionText,
                                { color: fgColor },
                                isCancel && { fontFamily: 'Inter_500Medium' },
                                !isCancel && { fontFamily: 'Inter_600SemiBold' },
                              ]}
                            >
                              {button.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
              </Animated.View>
            </SafeAreaView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAlert() must be used inside an <AlertProvider>.');
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: Platform.select({ ios: 0.22, android: 0.35, default: 0.2 }),
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    lineHeight: 26,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  message: {
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  actions: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },
  actionsStacked: { flexDirection: 'column' },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionHalf: { flex: 1 },
  actionFull: { width: '100%' },
  actionText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
