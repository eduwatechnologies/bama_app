import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/components/AlertDialog';
import { AppUpdateGate } from '@/components/AppUpdateGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppProvider } from '@/context/AppContext';
import { VoiceFab } from '@/components/VoiceFab';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { configureNotificationHandler, LEARN_ROUTE } from '@/services/learningReminder';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Shows foreground reminders and opens the Learn tab when the user taps the
 * daily notification (covers both cold start and warm start).
 */
function useNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    configureNotificationHandler();

    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as { url?: string } | undefined;
      if (data?.url === LEARN_ROUTE) router.push('/learn');
    };

    // Cold start: the app may have been launched by tapping the notification.
    openFromResponse(Notifications.getLastNotificationResponse());
    // Warm start: handle taps that arrive while the app is already running.
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => subscription.remove();
  }, [router]);
}

function RootLayoutNav() {
  useNotificationRouting();
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="voice" options={{ headerShown: false }} />
      <Stack.Screen name="phrase/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="learn" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
            <AppProvider>
              <AlertProvider>
                {Platform.OS === 'web' ? (
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#e5e7eb' }}>
                    <View style={{ flex: 1, width: '100%', maxWidth: 430 }}>
                      <RootLayoutNav />
                    </View>
                  </View>
                ) : (
                  <RootLayoutNav />
                )}
                <AppUpdateGate />
              </AlertProvider>
            </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
