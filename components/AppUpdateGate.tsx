import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAlert } from '@/components/AlertDialog';
import {
  applyOtaUpdate,
  checkForOtaUpdate,
  decideUpdate,
  fetchUpdatePolicy,
  PLAY_STORE_URL,
} from '@/services/appUpdates';

/**
 * Global update gate, rendered once at the app root.
 *
 * On launch it:
 *  1. Fetches the server's update policy and, if the installed version is
 *     behind, prompts the user to update from the Play Store (blocking when
 *     below the forced minimum).
 *  2. Otherwise, if an EAS OTA (JS) update has been downloaded, offers to
 *     restart and apply it.
 *
 * The store update takes priority, and only one prompt is shown per launch.
 */
export function AppUpdateGate() {
  const { show } = useAlert();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;

    const run = async () => {
      // Never block the app on a failed policy fetch — treat it as "no update".
      const [otaReady, policy] = await Promise.all([
        checkForOtaUpdate(),
        fetchUpdatePolicy().catch(() => null),
      ]);
      if (cancelled) return;

      const currentVersion = Constants.expoConfig?.version ?? '';
      const decision = policy ? decideUpdate(currentVersion, policy) : null;

      if (decision) {
        const storeUrl = policy?.storeUrl || PLAY_STORE_URL;
        const openStore = () => {
          void Linking.openURL(storeUrl).catch(() => undefined);
        };
        if (decision === 'force') {
          show({
            variant: 'warning',
            title: 'Update required',
            message:
              policy?.message ||
              'Please update Bama to the latest version to keep using the app.',
            dismissible: false,
            buttons: [{ label: 'Update now', style: 'default', onPress: openStore }],
          });
        } else {
          show({
            variant: 'info',
            title: 'Update available',
            message:
              policy?.message || 'A newer version of Bama is available on the Play Store.',
            buttons: [
              { label: 'Later', style: 'cancel' },
              { label: 'Update', style: 'default', onPress: openStore },
            ],
          });
        }
        return;
      }

      if (otaReady) {
        show({
          variant: 'info',
          title: 'Update ready',
          message: 'A new version has been downloaded. Restart Bama to apply it.',
          buttons: [
            { label: 'Later', style: 'cancel' },
            { label: 'Restart', style: 'default', onPress: applyOtaUpdate },
          ],
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [show]);

  return null;
}
