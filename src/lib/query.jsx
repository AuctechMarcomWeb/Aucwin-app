import { useEffect } from "react";
import {
  QueryClient,
  onlineManager,
  useQueryClient,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { io } from "socket.io-client";
import { API_URL } from "./http";
import { useAuth } from "./auth";

// Tell React Query about connectivity so queries pause offline and resume
// automatically; cached data keeps rendering meanwhile.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) =>
    setOnline(!!state.isConnected && state.isInternetReachable !== false),
  ),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // keep cache a day so the app opens instantly on poor connections
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      networkMode: "offlineFirst",
    },
    mutations: { networkMode: "online", retry: 1 },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "crm-query-cache",
  throttleTime: 1000,
});

export function QueryProvider({ children }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

const subscribers = new Set();
/** Subscribe to server change events: fn({ table, channel_id? }). Returns an unsubscribe function. */
export function onServerChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Realtime: invalidate caches when anything changes on the server (e.g. from the web app). */
export function RealtimeSync() {
  const qc = useQueryClient();
  const { session } = useAuth();
  useEffect(() => {
    if (!session?.token) return;
    const socket = io(API_URL, {
      auth: { token: session.token },
      transports: ["websocket"],
      reconnectionDelayMax: 10000,
    });
    socket.on("change", (p) => {
      const table = p?.table;
      if (!table) return;
      // Big lists (leads/clients) are only marked stale, not re-fetched on the
      // spot — otherwise every change re-loaded the whole open list. They
      // refresh on pull-to-refresh or when the screen is re-opened.
      const heavy = table === "leads" || table === "clients";
      qc.invalidateQueries({
        queryKey: [table],
        refetchType: heavy ? "none" : "active",
      });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["module_counts"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      if (table === "chat_messages" || table === "chat_channels")
        qc.invalidateQueries({ queryKey: ["chat_channels"] });
      subscribers.forEach((fn) => fn(p));
    });
    socket.io.on("reconnect", () =>
      qc.invalidateQueries({ refetchType: "none" }),
    );
    // the OS pauses sockets in the background; reconnect and refresh the light
    // things only — don't re-load the big lists just because the app returned.
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        if (!socket.connected) socket.connect();
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["module_counts"] });
        qc.invalidateQueries({ queryKey: ["calendar"] });
        qc.invalidateQueries({ queryKey: ["chat_channels"] });
      }
    });
    return () => {
      sub.remove();
      socket.close();
    };
  }, [session?.token, qc]);
  return null;
}
