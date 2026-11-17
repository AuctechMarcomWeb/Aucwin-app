import * as Device from "expo-device";
import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "./api";

const TOKEN_KEY = "crm.pushToken";

/**
 * Expo Go (SDK 53+) no longer supports expo-notifications on Android and shows
 * a red error as soon as the library is loaded. So the library is only loaded
 * in the real app (APK / development build). In Expo Go every function below
 * simply does nothing — the rest of the app works normally.
 */
export const IS_EXPO_GO =
  isRunningInExpoGo() ||
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo";

let N = null;
function lib() {
  if (IS_EXPO_GO || Platform.OS === "web") return null;
  if (!N) {
    try {
      N = require("expo-notifications");
    } catch {
      return null; // library not available in this app build
    }
    if (!N || typeof N.setNotificationHandler !== "function") { N = null; return null; }
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return N;
}

/**
 * Asks for permission, obtains an Expo push token and stores it on the user's
 * profile so the backend reminder job (every 5 minutes) can reach this device.
 * Requires a real device and an EAS projectId in app.json.
 */
export async function registerForPushNotifications() {
  const Notifications = lib();
  if (!Notifications || !Device.isDevice) return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("followups", {
      name: "Follow-up reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2546eb",
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted")
    status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId || projectId.startsWith("REPLACE")) {
    console.warn(
      "Set extra.eas.projectId in app.json to enable push notifications",
    );
    return null;
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken(token);
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}

export async function unregisterPush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    await unregisterPushToken(token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
  const Notifications = lib();
  if (Notifications) await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Local (on-device) reminder, scheduled 10 minutes before a follow-up is due.
 * Works even without a server round-trip or internet connection. The server
 * push (backend reminder job) is the second layer so other devices are reached too.
 */
export async function scheduleLocalReminder(f) {
  const Notifications = lib();
  if (!Notifications) return;
  const when = new Date(new Date(f.due_at).getTime() - 10 * 60 * 1000);
  if (when.getTime() <= Date.now()) return;
  await cancelLocalReminder(f.id);
  await Notifications.scheduleNotificationAsync({
    identifier: `followup-${f.id}`,
    content: {
      title: `${f.type[0].toUpperCase()}${f.type.slice(1)} in 10 minutes`,
      body: f.title,
      data: { followup_id: f.id },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: "followups",
    },
  });
}
export async function cancelLocalReminder(id) {
  const Notifications = lib();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(`followup-${id}`).catch(
    () => {},
  );
}

/** Calls fn(data) when the user taps a notification. Returns a cleanup function. */
export function onNotificationTap(fn) {
  const Notifications = lib();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((resp) =>
    fn(resp.notification.request.content.data || {}),
  );
  return () => sub.remove();
}
