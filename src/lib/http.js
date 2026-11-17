/**
 * Fetch wrapper for the Harbour CRM backend.
 * The login token lives in the device keychain/keystore (expo-secure-store).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
if (!API_URL) console.warn("Missing EXPO_PUBLIC_API_URL (see .env.example)");

const TOKEN_KEY = "harbour.token";
let token = null;
const listeners = new Set();

async function storeGet(k) {
  if (Platform.OS === "web") return AsyncStorage.getItem(k);
  return (await SecureStore.getItemAsync(k).catch(() => null)) ?? AsyncStorage.getItem(k);
}
async function storeSet(k, v) {
  if (Platform.OS === "web") return v ? AsyncStorage.setItem(k, v) : AsyncStorage.removeItem(k);
  if (v) await SecureStore.setItemAsync(k, v).catch(() => AsyncStorage.setItem(k, v));
  else { await SecureStore.deleteItemAsync(k).catch(() => {}); await AsyncStorage.removeItem(k); }
}

/** Load the saved token once at startup. */
export async function loadToken() { token = await storeGet(TOKEN_KEY); return token; }
export const getToken = () => token;
export async function setToken(t) {
  token = t || null;
  await storeSet(TOKEN_KEY, token);
  listeners.forEach((fn) => fn(token));
}
export function onTokenChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

export async function request(method, path, { query, body, form } = {}) {
  let url = API_URL + path;
  if (query) {
    const qs = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(url, { method, headers, body: form ? form : body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Network request failed", 0, "network");
  }
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    if (res.status === 401 && token && path !== "/api/auth/login") await setToken(null);
    throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status, data && data.code);
  }
  return data;
}

export const http = {
  get: (path, query) => request("GET", path, { query }),
  post: (path, body) => request("POST", path, { body: body ?? {} }),
  patch: (path, body) => request("PATCH", path, { body: body ?? {} }),
  del: (path, body) => request("DELETE", path, body !== undefined ? { body } : {}),
  upload: (path, form, query) => request("POST", path, { form, query }),
};

export function errMsg(e) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e.message?.includes("Network request failed")) return "No connection. Check your internet and try again.";
  return e.message || "Something went wrong";
}
