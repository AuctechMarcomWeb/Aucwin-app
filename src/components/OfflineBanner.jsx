import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";

/** Shows a thin bar when the device is offline; cached data keeps working underneath. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((st) =>
        setOffline(!st.isConnected || st.isInternetReachable === false),
      ),
    [],
  );
  if (!offline) return null;
  return (
    <View
      style={{
        backgroundColor: "#b45309",
        paddingVertical: 5,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
        You're offline — showing saved data. Changes will fail until you
        reconnect.
      </Text>
    </View>
  );
}
