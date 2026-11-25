import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAgentOutreachReport, getTeamCalls } from "@/lib/api";
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

// "2m 14s" (or "—" when there's no talk time).
const fmtDur = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
};
const fmtWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
};

// A horizontal row of filter pills (All / option / option…).
function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 4 }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key || "all"}
            onPress={() => onChange(o.key)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: active ? C.brand : "#fff",
              borderWidth: 1,
              borderColor: active ? C.brand : C.border,
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: "700",
                color: active ? "#fff" : C.muted,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// One logged outbound call. The contact name taps through to the lead/customer.
function RecentCallRow({ c, first, onPress }) {
  const tappable = !!(c.lead_id || c.client_id);
  const out =
    c.outcome === "answered"
      ? { label: "Answered", color: "#15803D", bg: "#DCFCE7" }
      : c.outcome === "not_answered"
        ? { label: "Not answered", color: "#B91C1C", bg: "#FEE2E2" }
        : null;
  return (
    <Pressable
      onPress={tappable ? onPress : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: C.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: tappable ? C.brand : C.text,
          }}
        >
          {c.contact || "—"}
        </Text>
        <Text style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
          {[c.agent, c.kind, fmtWhen(c.at)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        {out ? (
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: out.color,
              backgroundColor: out.bg,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            {out.label}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: C.muted }}>
          {fmtDur(c.duration_seconds)}
        </Text>
      </View>
      {tappable ? (
        <Ionicons name="chevron-forward" size={16} color={C.faint} />
      ) : null}
    </Pressable>
  );
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
  const nav = useNavigation();
  const [days, setDays] = useState(30);
  const { from, to } = useMemo(() => dayRange(days), [days]);

  // Open the lead / customer a call belongs to (works from the More stack).
  const openCall = (c) => {
    if (c.lead_id)
      return nav.navigate("Leads", {
        screen: "LeadDetail",
        params: { id: c.lead_id },
        initial: false,
      });
    if (c.client_id)
      return nav.navigate("More", {
        screen: "ClientDetail",
        params: { id: c.client_id },
        initial: false,
      });
  };

  const q = useQuery({
    queryKey: ["agent-outreach", from, to],
    queryFn: () => getAgentOutreachReport(from, to),
  });

  const rows = q.data?.rows ?? [];
  const agentOpts = useMemo(
    () => rows.map((r) => ({ id: r.id, name: r.full_name })),
    [rows],
  );

  // Recent calls — fetched page-by-page from the server, with its own filters.
  const CALL_PAGE_SIZE = 20;
  const [callAgent, setCallAgent] = useState("");
  const [callType, setCallType] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [callQuery, setCallQuery] = useState("");
  const [callQueryDebounced, setCallQueryDebounced] = useState("");
  const [callPage, setCallPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setCallQueryDebounced(callQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [callQuery]);
  useEffect(() => {
    setCallPage(1);
  }, [callAgent, callType, callOutcome, callQueryDebounced, from, to]);
  const callsQ = useQuery({
    queryKey: [
      "team-calls",
      from,
      to,
      callPage,
      callAgent,
      callType,
      callOutcome,
      callQueryDebounced,
    ],
    queryFn: () =>
      getTeamCalls({
        from,
        to,
        page: callPage,
        pageSize: CALL_PAGE_SIZE,
        agent: callAgent || undefined,
        type: callType || undefined,
        outcome: callOutcome || undefined,
        q: callQueryDebounced || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const pagedCalls = callsQ.data?.rows ?? [];
  const callTotal = callsQ.data?.total ?? 0;
  const callPages = callsQ.data?.pages ?? 1;
  const callPageSafe = Math.min(callPage, callPages);
  const anyCallFilter =
    !!callAgent || !!callType || !!callOutcome || !!callQuery;

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
        <RefreshControl refreshing={false} onRefresh={q.refetch} />
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

          {/* Recent calls — filterable + paginated */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 20,
              marginBottom: 10,
            }}
          >
            <Ionicons name="call" size={15} color={C.faint} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: C.faint,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Recent calls
            </Text>
            <Text style={{ marginLeft: "auto", fontSize: 11, color: C.faint }}>
              {callsQ.isFetching ? "Loading…" : `${callTotal} call${callTotal === 1 ? "" : "s"}`}
            </Text>
          </View>

          {/* Filters */}
          <View style={{ gap: 8, marginBottom: 10 }}>
            <TextInput
              value={callQuery}
              onChangeText={setCallQuery}
              placeholder="Search name…"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              style={{
                height: 40,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                backgroundColor: "#fff",
                color: C.text,
                fontSize: 14,
              }}
            />
            <ChipRow
              options={[
                { key: "", label: "All members" },
                ...agentOpts.map((a) => ({ key: a.id, label: a.name })),
              ]}
              value={callAgent}
              onChange={setCallAgent}
            />
            <ChipRow
              options={[
                { key: "", label: "All types" },
                { key: "Lead", label: "Lead" },
                { key: "Customer", label: "Customer" },
              ]}
              value={callType}
              onChange={setCallType}
            />
            <ChipRow
              options={[
                { key: "", label: "All outcomes" },
                { key: "answered", label: "Answered" },
                { key: "not_answered", label: "Not answered" },
                { key: "none", label: "No outcome" },
              ]}
              value={callOutcome}
              onChange={setCallOutcome}
            />
            {anyCallFilter ? (
              <Pressable
                onPress={() => {
                  setCallQuery("");
                  setCallAgent("");
                  setCallType("");
                  setCallOutcome("");
                }}
                style={{ alignSelf: "flex-start" }}
              >
                <Text
                  style={{ fontSize: 12.5, fontWeight: "700", color: C.brand }}
                >
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Card style={{ paddingVertical: 2 }}>
            {pagedCalls.length ? (
              pagedCalls.map((c, i) => (
                <RecentCallRow
                  key={i}
                  c={c}
                  first={i === 0}
                  onPress={() => openCall(c)}
                />
              ))
            ) : (
              <Text
                style={{
                  padding: 16,
                  textAlign: "center",
                  color: C.faint,
                  fontSize: 13,
                }}
              >
                {callsQ.isLoading ? "Loading…" : "No calls match these filters."}
              </Text>
            )}
          </Card>

          {callPages > 1 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <Text style={{ fontSize: 12, color: C.muted }}>
                Page {callPageSafe} of {callPages}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  disabled={callPageSafe <= 1}
                  onPress={() => setCallPage((p) => Math.max(1, p - 1))}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.border,
                    opacity: callPageSafe <= 1 ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: C.muted }}>
                    Previous
                  </Text>
                </Pressable>
                <Pressable
                  disabled={callPageSafe >= callPages}
                  onPress={() =>
                    setCallPage((p) => Math.min(callPages, p + 1))
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.border,
                    opacity: callPageSafe >= callPages ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: C.muted }}>Next</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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
