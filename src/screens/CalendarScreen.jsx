import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getCalendarEvents } from "@/lib/api";
import { KIND_STYLE } from "@/lib/modules";
import { Badge, C, Loading, Sheet, fmtDateTime, s } from "@/components/ui";
import { FollowUpForm } from "@/components/forms";
import { OfflineBanner } from "@/components/OfflineBanner";

const KIND_LABEL = {
  meeting: "Meeting",
  reminder: "Reminder",
  followup: "Follow-up",
  task: "Task",
  todo: "To-do",
};
const KIND_ICON = {
  meeting: "people",
  reminder: "notifications",
  followup: "call",
  task: "checkbox",
  todo: "list",
};
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SKY = "#0B857D"; // AucWin teal
const time = (iso) => fmtDateTime(iso).split("· ")[1];
const timeParts = (iso) => {
  const t = time(iso) ?? "";
  const [hm, ap] = t.split(" ");
  return [hm, (ap ?? "").toUpperCase()];
};
// Android adds extra space above/below text; turn it off so icons and text line up
const T = { includeFontPadding: false, textAlignVertical: "center" };

export default function CalendarScreen() {
  const nav = useNavigation();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selected, setSelected] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [create, setCreate] = useState(null);

  const grid = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - ((month.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);
  const from = grid[0];
  const to = new Date(grid[41]);
  to.setDate(to.getDate() + 1);
  const q = useQuery({
    queryKey: ["calendar", from.toISOString(), to.toISOString()],
    queryFn: () => getCalendarEvents(from, to),
    placeholderData: (p) => p,
  });
  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of q.data ?? []) {
      const k = new Date(e.starts_at).toDateString();
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [q.data]);
  // hide the last row if it belongs entirely to the next month
  const rows = grid[35].getMonth() !== month.getMonth() ? 5 : 6;
  const todayKey = new Date().toDateString();
  const dayEvents = byDay.get(selected.toDateString()) ?? [];
  const monthCount = (q.data ?? []).filter((e) => new Date(e.starts_at).getMonth() === month.getMonth()).length;

  const goMonth = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const goToday = () => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    setSelected(t);
    setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
  };
  const openEvent = (e) => {
    if (e.kind === "todo") return nav.navigate("More", { screen: "Todo", initial: false });
    if (e.kind === "task") return nav.navigate("More", { screen: "Tasks", initial: false });
    if (e.kind === "meeting") return nav.navigate("More", { screen: "Meetings", initial: false });
    if (e.kind === "reminder") return nav.navigate("More", { screen: "Reminders", initial: false });
    if (e.lead_id) return nav.navigate("Leads", { screen: "LeadDetail", params: { id: e.lead_id }, initial: false });
    if (e.client_id) return nav.navigate("More", { screen: "ClientDetail", params: { id: e.client_id }, initial: false });
  };
  const isToday = selected.toDateString() === todayKey;

  return (
    <View style={s.screen}>
      {focused && <StatusBar style="light" />}
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* ---------- header ---------- */}
        <View style={{ backgroundColor: C.dark, paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 70, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" }}>
          <View pointerEvents="none" style={{ position: "absolute", top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: "#12ACA2", opacity: 0.16 }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: "#94A3B8", fontSize: 13 }}>Calendar</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 }}>
                {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </Text>
              <Text style={{ color: "#7DD3FC", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
                {monthCount} item{monthCount === 1 ? "" : "s"} this month
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[["chevron-back", -1], ["chevron-forward", 1]].map(([icon, d]) => (
                <Pressable
                  key={icon}
                  onPress={() => goMonth(d)}
                  hitSlop={6}
                  style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)" })}
                >
                  <Ionicons name={icon} size={20} color="#fff" />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* ---------- month grid (card overlapping the header) ---------- */}
        <View style={{ marginHorizontal: 14, marginTop: -54, backgroundColor: "#fff", borderRadius: 22, padding: 12, borderWidth: 1, borderColor: C.border, shadowColor: C.dark, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {DOW.map((d) => (
              <Text key={d} style={[T, { flex: 1, textAlign: "center", fontSize: 11, lineHeight: 14, fontWeight: "800", color: d === "Sun" ? "#F87171" : C.faint }]}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {grid.slice(0, rows * 7).map((d) => {
              const k = d.toDateString();
              const evs = byDay.get(k) ?? [];
              const other = d.getMonth() !== month.getMonth();
              const sel = k === selected.toDateString();
              const today = k === todayKey;
              return (
                <Pressable key={k} onPress={() => setSelected(d)} style={{ width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 }}>
                  <View
                    style={{
                      width: "92%", maxWidth: 38, aspectRatio: 1, borderRadius: 13, alignItems: "center", justifyContent: "center",
                      backgroundColor: sel ? SKY : today ? "#E6F7F5" : "transparent",
                      borderWidth: today && !sel ? 1.5 : 0, borderColor: SKY,
                    }}
                  >
                    <Text style={[T, { fontSize: 14.5, lineHeight: 18, fontWeight: sel || today ? "800" : "600", color: sel ? "#fff" : other ? "#CBD5E1" : C.text }]}>{d.getDate()}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 2, height: 6, marginTop: 3 }}>
                    {evs.slice(0, 3).map((e, i) => (
                      <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: other ? "#CBD5E1" : KIND_STYLE[e.kind]?.[1] ?? C.muted }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {/* colour key */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", marginTop: 8, paddingTop: 10 }}>
            {Object.keys(KIND_LABEL).map((k) => (
              <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: KIND_STYLE[k]?.[1] }} />
                <Text style={[T, { fontSize: 11, lineHeight: 14, color: C.muted, fontWeight: "600" }]}>{KIND_LABEL[k]}</Text>
              </View>
            ))}
          </View>
        </View>
        <OfflineBanner />

        {/* ---------- selected day ---------- */}
        <View style={{ paddingHorizontal: 14, marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[T, { fontWeight: "800", color: C.text, fontSize: 17, lineHeight: 22 }]}>
                {isToday ? "Today" : selected.toLocaleDateString("en-IN", { weekday: "long" })}
              </Text>
              <Text numberOfLines={1} style={[T, { color: C.muted, fontSize: 12.5, lineHeight: 16 }]}>
                {selected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {dayEvents.length} item{dayEvents.length === 1 ? "" : "s"}
              </Text>
              {!isToday && (
                <Pressable onPress={goToday} hitSlop={6} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                  <Text style={[T, { color: SKY, fontWeight: "800", fontSize: 12.5 }]}>← Go to today</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => setCreate("reminder")}
              accessibilityLabel="New reminder"
              style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "#FDE68A" : "#FEF3C7" })}
            >
              <Ionicons name="notifications" size={19} color="#D97706" />
            </Pressable>
            <Pressable
              onPress={() => setCreate("meeting")}
              accessibilityLabel="New meeting"
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: pressed ? "#086B64" : SKY })}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={[T, { color: "#fff", fontWeight: "800", fontSize: 13.5, lineHeight: 17 }]}>Meeting</Text>
            </Pressable>
          </View>

          {q.isLoading ? <Loading /> : dayEvents.length === 0 ? (
            <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#E6F7F5", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="calendar-clear-outline" size={24} color={SKY} />
              </View>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "800", marginTop: 10 }}>Nothing scheduled</Text>
              <Text style={{ color: C.muted, fontSize: 13, marginTop: 2, textAlign: "center" }}>Use “Meeting” or the bell above to add something.</Text>
            </View>
          ) : (
            dayEvents.map((e) => {
              const [bg, fg] = KIND_STYLE[e.kind] ?? ["#EEF2F6", "#475569"];
              const done = e.status === "done";
              const [hm, ap] = timeParts(e.starts_at);
              return (
                <Pressable
                  key={e.kind + e.id}
                  onPress={() => openEvent(e)}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 18,
                    padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border, opacity: pressed ? 0.8 : 1,
                  })}
                >
                  {/* fixed-size box: icon, time, AM/PM — same size on every card */}
                  <View style={{ width: 64, height: 70, alignItems: "center", justifyContent: "center", backgroundColor: bg, borderRadius: 14 }}>
                    <Ionicons name={KIND_ICON[e.kind] ?? "ellipse"} size={17} color={fg} />
                    <Text numberOfLines={1} style={[T, { fontSize: 13, lineHeight: 16, fontWeight: "800", color: fg, marginTop: 4, fontVariant: ["tabular-nums"] }]}>{hm}</Text>
                    {!!ap && <Text numberOfLines={1} style={[T, { fontSize: 10, lineHeight: 12, fontWeight: "800", color: fg }]}>{ap}</Text>}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[T, { fontSize: 11, lineHeight: 14, fontWeight: "800", color: fg, letterSpacing: 0.5 }]}>{KIND_LABEL[e.kind]?.toUpperCase()}</Text>
                    <Text numberOfLines={2} style={[T, { fontWeight: "700", color: done ? C.faint : C.text, fontSize: 15, lineHeight: 20, marginTop: 2, textDecorationLine: done ? "line-through" : "none" }]}>
                      {e.title}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      {e.ends_at && (
                        <Text style={[T, { fontSize: 12, lineHeight: 16, color: C.muted }]}>
                          {time(e.starts_at)} – {time(e.ends_at)}
                        </Text>
                      )}
                      <Badge value={e.status} />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Sheet open={!!create} onClose={() => setCreate(null)} title={create === "meeting" ? "New meeting" : "New reminder"}>
        {create && <FollowUpForm fixedType={create} onDone={() => setCreate(null)} />}
      </Sheet>
    </View>
  );
}
