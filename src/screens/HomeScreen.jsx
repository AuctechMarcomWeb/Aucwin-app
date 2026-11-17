import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getCalendarEvents, getModuleCounts } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { KIND_STYLE, MODULES } from "@/lib/modules";
import { label } from "@/lib/types";
import { Avatar, Badge, C, fmtDateTime, s } from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";
import { BrandLogo } from "@/components/Brand";

const KIND_LABEL = {
  meeting: "Meeting",
  reminder: "Reminder",
  followup: "Follow-up",
  task: "Task",
  todo: "To-do",
};

/** One of the three quick numbers inside the header. */
function HeaderStat({ icon, value, text, tint, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.09)",
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={16} color={tint} />
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: "#CBD5E1", fontSize: 11.5, fontWeight: "600", marginTop: 3, textAlign: "center" }}>{text}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const nav = useNavigation();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { profile, isAdmin, signOut } = useAuth();
  const counts = useQuery({ queryKey: ["module_counts"], queryFn: getModuleCounts });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const today = useQuery({ queryKey: ["calendar", "today"], queryFn: () => getCalendarEvents(start, end) });
  const c = counts.data ?? {};
  const countText = (key) => {
    if (!key || !counts.data) return "";
    const n = c[key] ?? 0;
    return {
      leads: `${n} open`,
      tasks: `${n} open`,
      reminders: `${n} pending`,
      meetings: `${n} upcoming`,
      todos: `${n} to do`,
      notes: `${n} notes`,
      chat: n ? `${n} unread` : "all read",
      calendar: `${n} today`,
      clients: `${n} active`,
    }[key];
  };
  const go = (m) => {
    if (m.route === "Leads") return nav.navigate("Leads");
    if (m.route === "Chat") return nav.navigate("Chat");
    if (m.route === "Calendar") return nav.navigate("Calendar");
    nav.navigate("More", { screen: m.route, initial: false });
  };
  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You will need your email and password to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const roleLine = profile ? `${label(profile.role)}${profile.department?.name ? ` · ${profile.department.name}` : ""}` : "";

  return (
    <View style={s.screen}>
      {focused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={counts.isFetching && !counts.isLoading}
            onRefresh={() => { counts.refetch(); today.refetch(); }}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* ================= Header ================= */}
        <View
          style={{
            backgroundColor: C.dark,
            paddingTop: insets.top + 12,
            paddingHorizontal: 18,
            paddingBottom: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: "hidden",
          }}
        >
          {/* decorative circles */}
          <View pointerEvents="none" style={{ position: "absolute", top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: C.accent, opacity: 0.16 }} />
          <View pointerEvents="none" style={{ position: "absolute", bottom: -70, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: C.accent, opacity: 0.08 }} />

          {/* top row: logo · sign out · avatar */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <BrandLogo width={128} variant="white" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                hitSlop={8}
                onPress={confirmSignOut}
                style={({ pressed }) => ({
                  width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
                  backgroundColor: pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
                })}
              >
                <Ionicons name="log-out-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable onPress={() => nav.navigate("More", { screen: "MoreHome" })} style={{ borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" }}>
                <Avatar name={profile?.full_name} size={40} />
              </Pressable>
            </View>
          </View>

          {/* greeting */}
          <Text style={{ color: "#5EEAD4", fontSize: 13, fontWeight: "600", marginTop: 20 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 }}>
            {greeting()}, {firstName} 👋
          </Text>
          {!!roleLine && (
            <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(18,172,162,0.25)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text numberOfLines={1} style={{ color: "#CCFBF1", fontSize: 12, fontWeight: "700" }}>{roleLine}</Text>
            </View>
          )}

          {/* quick numbers */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <HeaderStat icon="alert-circle" tint="#FDBA74" value={counts.data ? c.followups_overdue ?? 0 : "–"} text="Overdue" onPress={() => nav.navigate("Calendar")} />
            <HeaderStat icon="today" tint="#7DD3FC" value={today.data ? today.data.length : "–"} text="Today" onPress={() => nav.navigate("Calendar")} />
            <HeaderStat icon="chatbubbles" tint="#FDA4AF" value={counts.data ? c.chat ?? 0 : "–"} text="Unread" onPress={() => nav.navigate("Chat")} />
          </View>
        </View>

        <OfflineBanner />

        {/* ================= Modules ================= */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: C.text, marginTop: 20, marginBottom: 12 }}>Modules</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 }}>
            {MODULES.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => go(m)}
                style={({ pressed }) => ({
                  width: "48.3%",
                  minHeight: 142,
                  justifyContent: "space-between",
                  backgroundColor: "#fff",
                  borderRadius: 20,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: C.border,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  overflow: "hidden",
                  shadowColor: C.dark,
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                })}
              >
                <View style={{ position: "absolute", right: -24, top: -24, width: 84, height: 84, borderRadius: 42, backgroundColor: m.bg, opacity: 0.8 }} />
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: m.bg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={m.icon} size={24} color={m.color} />
                </View>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.text, marginTop: 12 }} numberOfLines={2}>{m.label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: "700", color: m.color }}>
                    {countText(m.countKey) || " "}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={C.faint} />
                </View>
              </Pressable>
            ))}
          </View>

          {/* ================= Today ================= */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 10 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: C.text }}>Today</Text>
            <Pressable onPress={() => nav.navigate("Calendar")} hitSlop={8}>
              <Text style={{ color: C.brand, fontWeight: "700", fontSize: 13 }}>Open calendar</Text>
            </Pressable>
          </View>
          {!today.data?.length ? (
            <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 22, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
              <Ionicons name="sunny-outline" size={28} color="#F59E0B" />
              <Text style={{ color: C.text, fontSize: 14, fontWeight: "700", marginTop: 8 }}>A clear day</Text>
              <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 2 }}>Add a meeting, reminder or to-do.</Text>
            </View>
          ) : (
            today.data.map((e) => {
              const [bg, fg] = KIND_STYLE[e.kind] ?? ["#EEF2F6", "#475569"];
              return (
                <Pressable
                  key={e.kind + e.id}
                  onPress={() => nav.navigate("Calendar")}
                  style={[s.card, { paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16 }]}
                >
                  <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: fg }} />
                  <View style={{ width: 62, height: 44, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontWeight: "800", color: fg, fontSize: 12.5, fontVariant: ["tabular-nums"] }}>
                      {fmtDateTime(e.starts_at).split("· ")[1]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: C.text, fontSize: 14 }} numberOfLines={1}>{e.title}</Text>
                    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3 }}>
                      <Text style={{ color: fg, fontSize: 10, fontWeight: "800" }}>{KIND_LABEL[e.kind]}</Text>
                    </View>
                  </View>
                  <Badge value={e.status} />
                </Pressable>
              );
            })
          )}

          {isAdmin && (
            <Pressable
              onPress={() => nav.navigate("More", { screen: "Overview", initial: false })}
              style={({ pressed }) => ({
                marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: pressed ? C.brandLight : "#fff", borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: C.border,
              })}
            >
              <Ionicons name="stats-chart" size={16} color={C.brand} />
              <Text style={{ color: C.brand, fontWeight: "800" }}>See team overview</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
