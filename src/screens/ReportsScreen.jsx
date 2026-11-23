import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAgentOutreachReport } from "@/lib/api";
import { label } from "@/lib/types";
import { C, Card, Loading, ErrorBox, Empty, Avatar } from "@/components/ui";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

function dayRange(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function Metric({ value, title, color }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: color || C.text }}>
        {value ?? 0}
      </Text>
      <Text style={{ fontSize: 10.5, color: C.faint, marginTop: 1 }}>
        {title}
      </Text>
    </View>
  );
}

function AgentCard({ row }) {
  return (
    <Card style={{ marginBottom: 10, opacity: row.is_active ? 1 : 0.6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <Avatar name={row.full_name} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.text }}>
            {row.full_name || "—"}
          </Text>
          <Text style={{ fontSize: 11, color: C.faint }}>
            {label(row.role)}
            {row.is_active ? "" : " · inactive"}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <Metric value={row.leads_assigned} title="Leads" />
        <Metric value={row.logged_calls} title="Calls" color={C.brand} />
        <Metric value={row.unique_leads_contacted} title="Contacted" />
        <Metric value={row.completed_call_followups} title="Call f/ups" />
      </View>
    </Card>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState(30);
  const { from, to } = useMemo(() => dayRange(days), [days]);

  const q = useQuery({
    queryKey: ["agent-outreach", from, to],
    queryFn: () => getAgentOutreachReport(from, to),
  });

  const rows = q.data?.rows ?? [];
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          leads: a.leads + (r.leads_assigned || 0),
          calls: a.calls + (r.logged_calls || 0),
          contacted: a.contacted + (r.unique_leads_contacted || 0),
          followups: a.followups + (r.completed_call_followups || 0),
        }),
        { leads: 0, calls: 0, contacted: 0, followups: 0 },
      ),
    [rows],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      refreshControl={
        <RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} />
      }
    >
      {/* range selector */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        {RANGES.map((r) => {
          const active = r.value === days;
          return (
            <Pressable
              key={r.value}
              onPress={() => setDays(r.value)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: active ? C.brand : "#fff",
                borderWidth: 1,
                borderColor: active ? C.brand : C.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: active ? "#fff" : C.muted,
                }}
              >
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message="Could not load the report." onRetry={q.refetch} />
      ) : (
        <>
          {/* totals */}
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row" }}>
              <Metric value={totals.leads} title="Leads assigned" />
              <Metric value={totals.calls} title="Calls" color={C.brand} />
              <Metric value={totals.contacted} title="Contacted" />
              <Metric value={totals.followups} title="Call f/ups" />
            </View>
          </Card>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
            }}
          >
            <Ionicons name="people" size={15} color={C.faint} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: C.faint,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Per agent
            </Text>
          </View>

          {rows.length === 0 ? (
            <Empty
              title="No data yet"
              hint="Figures appear as your team works leads and logs calls."
            />
          ) : (
            rows.map((row) => <AgentCard key={row.id} row={row} />)
          )}

          <Text
            style={{
              fontSize: 11,
              color: C.faint,
              marginTop: 10,
              lineHeight: 16,
            }}
          >
            Calls counts logged outbound calls. Times are in UTC.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
