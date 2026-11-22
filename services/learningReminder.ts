import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Daily local reminder for the learning path.
 *
 * Notifications are scheduled entirely on the device, so the reminder needs no
 * server and works offline. Instead of a single repeating trigger we schedule a
 * rolling window of one-off notifications, which lets us skip days the user has
 * already completed and stay reliable without the app being opened.
 */
const REMINDER_KEY = '@hausabridge/learning-reminder';
const CHANNEL_ID = 'learning-reminder';
const NOTIFICATION_TAG = 'learning-reminder';
const WINDOW_DAYS = 7;

/** In-app route the notification opens. Matches app/learn.tsx. */
export const LEARN_ROUTE = '/learn';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

export interface LearningReminderSettings {
  enabled: boolean;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
}

/** Early evening by default. */
export const DEFAULT_REMINDER: LearningReminderSettings = {
  enabled: false,
  hour: 18,
  minute: 30,
};

const isNotificationsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function atLocalTime(base: Date, hour: number, minute: number): Date {
  const date = new Date(base);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * The datetimes the reminder should fire for, starting from the next valid slot.
 * Today is skipped when the word is already learned or the reminder time has
 * already passed.
 */
export function planReminderDates(
  hour: number,
  minute: number,
  options: { learnedToday: boolean; now?: Date; count?: number },
): Date[] {
  const now = options.now ?? new Date();
  const count = options.count ?? WINDOW_DAYS;
  const passedToday = atLocalTime(now, hour, minute).getTime() <= now.getTime();
  const startOffset = options.learnedToday || passedToday ? 1 : 0;
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const base = new Date(now);
    base.setDate(base.getDate() + startOffset + i);
    dates.push(atLocalTime(base, hour, minute));
  }
  return dates;
}

/** Show reminders while the app is foregrounded too. */
export function configureNotificationHandler(): void {
  if (!isNotificationsSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily word reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch {
    // channel setup is best-effort
  }
}

export async function getReminderPermissionAsync(): Promise<ReminderPermission> {
  if (!isNotificationsSupported) return 'denied';
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return 'granted';
    return settings.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Prompts for permission; returns whether notifications are allowed. */
export async function requestReminderPermissionAsync(): Promise<boolean> {
  if (!isNotificationsSupported) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function loadReminderSettings(): Promise<LearningReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_KEY);
    if (!raw) return { ...DEFAULT_REMINDER };
    const parsed = JSON.parse(raw) as Partial<LearningReminderSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      hour: clamp(parsed.hour ?? DEFAULT_REMINDER.hour, 0, 23),
      minute: clamp(parsed.minute ?? DEFAULT_REMINDER.minute, 0, 59),
    };
  } catch {
    return { ...DEFAULT_REMINDER };
  }
}

export async function saveReminderSettings(settings: LearningReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
  } catch {
    // best-effort local persistence
  }
}

/** Cancels only the reminders this feature scheduled. */
export async function cancelLearningRemindersAsync(): Promise<void> {
  if (!isNotificationsSupported) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((request) => {
          const data = request.content?.data as Record<string, unknown> | undefined;
          return data?.tag === NOTIFICATION_TAG;
        })
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
  } catch {
    // ignore — there may be nothing scheduled
  }
}

/**
 * Rebuilds the reminder window to match the current settings and progress.
 * Safe to call repeatedly (e.g. on launch, on settings change, after marking a
 * word learned): it always clears the previous window first.
 */
export async function syncLearningReminder(
  settings: LearningReminderSettings,
  options: { learnedToday: boolean; targetLabel?: string },
): Promise<void> {
  if (!isNotificationsSupported) return;
  await cancelLearningRemindersAsync();
  if (!settings.enabled) return;

  const permission = await getReminderPermissionAsync();
  if (permission !== 'granted') return;

  await ensureAndroidChannelAsync();

  const label = options.targetLabel?.trim();
  const title = label ? `Today's ${label} word is ready` : 'Your daily word is ready';

  const dates = planReminderDates(settings.hour, settings.minute, {
    learnedToday: options.learnedToday,
  });

  await Promise.all(
    dates.map((date) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_TAG}-${date.getTime()}`,
        content: {
          title,
          body: 'Open Bama to learn it and keep your streak going.',
          sound: 'default',
          data: { url: LEARN_ROUTE, tag: NOTIFICATION_TAG },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
        },
      }),
    ),
  );
}

/** Formats a 24h hour/minute pair as a friendly 12h label. */
export function formatReminderTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}
