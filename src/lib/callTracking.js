/**
 * Android-only outbound-call tracking.
 *
 * iPhone and Expo Go CANNOT read the call log (Apple blocks it; Expo Go has no
 * native module), so every function here no-ops safely on anything but a real
 * Android build. On Android it reads the device call log after a call to work
 * out whether it was answered and the talk time.
 *
 * Requires the `react-native-call-log` native module and the READ_CALL_LOG
 * permission (declared in app.json). This only works in a Dev Build / APK —
 * never in Expo Go.
 */
import { Platform, PermissionsAndroid } from "react-native";
import { requireNativeModule } from "expo-modules-core";
import { API_URL, getToken } from "./http";

// Our own native module (modules/aucwin-calllog) — Android only, no 3rd-party lib.
let _mod;
function callLogModule() {
  if (_mod !== undefined) return _mod;
  try {
    _mod = Platform.OS === "android" ? requireNativeModule("AucwinCallLog") : null;
  } catch {
    _mod = null; // not present (iOS, Expo Go, or not built yet)
  }
  return _mod;
}

/** True only where we can actually read call results. */
export const callTrackingSupported = () =>
  Platform.OS === "android" && !!callLogModule();

/** Ask for the Call Log permission once; returns true if granted. */
export async function ensureCallLogPermission() {
  if (Platform.OS !== "android") return false;
  try {
    const perm = PermissionsAndroid.PERMISSIONS.READ_CALL_LOG;
    if (await PermissionsAndroid.check(perm)) return true;
    const res = await PermissionsAndroid.request(perm, {
      title: "Allow call tracking",
      message:
        "AucWin records your outbound calls — answered or not, and talk time — so they appear in reports.",
      buttonPositive: "Allow",
      buttonNegative: "Not now",
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const digits = (s) => String(s || "").replace(/\D/g, "");

/**
 * Look up the most recent OUTGOING call to `number` made at/after `sinceMs`.
 * Returns { outcome, duration_seconds } or null if nothing matched (yet).
 *   - duration > 0  -> answered (that's the talk time)
 *   - duration == 0 -> not answered
 */
export async function readCallResult(number, sinceMs) {
  if (Platform.OS !== "android") return null;
  const mod = callLogModule();
  if (!mod || typeof mod.recent !== "function") return null;

  const want = digits(number).slice(-9); // match last 9 digits (ignore country code / formatting)

  // Android writes the call-log entry a moment AFTER the call ends, so poll a
  // few times before giving up.
  for (let attempt = 0; attempt < 4; attempt++) {
    let entries = [];
    try {
      entries = (await mod.recent(30)) || []; // 30 most recent calls
    } catch {
      return null; // permission revoked mid-read, etc.
    }

    let best = null; // best match on the dialed number
    let bestAny = null; // most recent OUTGOING call after our tap (number-agnostic fallback)
    for (const e of entries) {
      if (Number(e.type) !== 2) continue; // type 2 == OUTGOING
      const ts = Number(e.timestamp || e.dateTime || 0);
      if (sinceMs && ts && ts < sinceMs - 60000) continue; // older than our tap -> skip
      if (!bestAny || ts > bestAny.ts)
        bestAny = { ts, duration: Number(e.duration) || 0 };
      const num = digits(e.phoneNumber).slice(-9);
      if (want && num && num !== want) continue;
      if (!best || ts > best.ts) best = { ts, duration: Number(e.duration) || 0 };
    }

    const hit = best || bestAny; // prefer exact number; fall back to latest outgoing
    if (hit) {
      const duration = Math.max(0, hit.duration);
      return {
        outcome: duration > 0 ? "answered" : "not_answered",
        duration_seconds: duration,
        at: hit.ts, // the call-log entry's own timestamp (used to de-duplicate)
      };
    }
    await new Promise((r) => setTimeout(r, 1200)); // wait and retry
  }
  return null;
}

/** True if the READ_CALL_LOG permission is currently granted. */
export async function checkCallLogPermission() {
  if (Platform.OS !== "android") return false;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    );
  } catch {
    return false;
  }
}

/**
 * One-shot diagnostic: tells us exactly why a call did or didn't record.
 * Returns { platform, moduleLoaded, permission, entries, outgoing, result, error }.
 */
export async function diagnoseCall(number, sinceMs) {
  const mod = callLogModule();
  const info = {
    platform: Platform.OS,
    moduleLoaded: !!mod,
    permission: await checkCallLogPermission(),
    entries: 0,
    outgoing: 0,
    result: null,
    error: null,
  };
  if (!mod || typeof mod.recent !== "function") return info;
  let entries = [];
  try {
    entries = (await mod.recent(30)) || [];
  } catch (e) {
    info.error = String(e?.message || e);
    return info;
  }
  info.entries = entries.length;
  info.outgoing = entries.filter((e) => Number(e.type) === 2).length;
  info.result = await readCallResult(number, sinceMs);
  return info;
}

/**
 * Ask for READ_PHONE_STATE — needed so the background receiver is told when a
 * call ends. Returns true if granted.
 */
export async function ensurePhoneStatePermission() {
  if (Platform.OS !== "android") return false;
  try {
    const perm = PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE;
    if (await PermissionsAndroid.check(perm)) return true;
    const res = await PermissionsAndroid.request(perm, {
      title: "Allow call detection",
      message:
        "AucWin needs to know when your call ends so it can record the outcome automatically — even if you switch to another app.",
      buttonPositive: "Allow",
      buttonNegative: "Not now",
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Remember the call the agent just started. The native background receiver (or
 * the next app open) then records its outcome, so the agent never has to come
 * back to the app. kind: "lead" | "client".
 */
export async function armCall(recordId, number, kind = "lead") {
  const mod = callLogModule();
  if (Platform.OS !== "android" || !mod || typeof mod.armCall !== "function")
    return false;
  try {
    return await mod.armCall(
      String(recordId),
      kind,
      String(number || ""),
      API_URL || "",
      getToken() || "",
    );
  } catch {
    return false;
  }
}

/**
 * Catch-up path: records any queued call the background receiver didn't get to
 * (e.g. the app was force-stopped). Safe to call on every app foreground — it
 * no-ops when the queue is empty. It first refreshes the auth token on the
 * queued entries (so a retry uses a valid token), then reconciles the whole
 * queue natively. The server de-duplicates by the call's timestamp, so this
 * never double-logs.
 */
export async function reconcilePendingCall() {
  const mod = callLogModule();
  if (
    Platform.OS !== "android" ||
    !mod ||
    typeof mod.flushPending !== "function"
  )
    return;
  try {
    if (typeof mod.refreshAuth === "function") {
      await mod.refreshAuth(API_URL || "", getToken() || "");
    }
    await mod.flushPending();
  } catch {
    // ignore — we'll try again on the next app open
  }
}
