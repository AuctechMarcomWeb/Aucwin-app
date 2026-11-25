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
import { getMyCalls } from "@/lib/api";
import { C, Card, Loading, ErrorBox } from "@/components/ui";

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

function CallRow({ c, first, onPress }) {
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
          {[c.kind, fmtWhen(c.at)].filter(Boolean).join(" · ")}
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

export default function MyCallsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [days, setDays] = useState(30);
  const { from, to } = useMemo(() => dayRange(days), [days]);

  const [callType, setCallType] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const t = setTimeout(() => setQueryDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    setPage(1);
  }, [callType, callOutcome, queryDebounced, from, to]);

  const q = useQuery({
    queryKey: ["my-calls", from, to, page, callType, callOutcome, queryDebounced],
    queryFn: () =>
      getMyCalls({
        from,
        to,
        page,
        pageSize: PAGE_SIZE,
        type: callType || undefined,
        outcome: callOutcome || undefined,
        q: queryDebounced || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.rows || [];
  const totals = q.data?.totals || {
    calls: 0,
    answered: 0,
    not_answered: 0,
    talk_time_seconds: 0,
  };
  const total = q.data?.total || 0;
  const pages = q.data?.pages || 1;
  const pageSafe = Math.min(page, pages);
  const anyFilter = !!callType || !!callOutcome || !!query;

  const openCall = (c) => {
    if (c.lead_id)
      return nav.navigate("Leads", {
        screen: "LeadDetail",
        params: { id: c.lead_id },
        initial: false,
      });
    if (c.client_id)
      return nav.navigate("ClientDetail", { id: c.client_id });
  };

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
        <ErrorBox message="Could not load your calls." onRetry={q.refetch} />
      ) : (
        <>
          {/* totals */}
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row" }}>
              <Metric value={totals.calls} title="My calls" color={C.brand} />
              <Metric value={totals.answered} title="Answered" />
              <Metric value={totals.not_answered} title="Not answered" />
              <Metric
                value={fmtDur(totals.talk_time_seconds)}
                title="Talk time"
              />
            </View>
          </Card>

          {/* filters */}
          <View style={{ gap: 8, marginBottom: 10 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 11, color: C.faint }}>
                {q.isFetching
                  ? "Loading…"
                  : `${total} call${total === 1 ? "" : "s"}`}
              </Text>
              {anyFilter ? (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setCallType("");
                    setCallOutcome("");
                  }}
                >
                  <Text
                    style={{ fontSize: 12.5, fontWeight: "700", color: C.brand }}
                  >
                    Clear filters
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Card style={{ paddingVertical: 2 }}>
            {rows.length ? (
              rows.map((c, i) => (
                <CallRow
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
                {q.isLoading ? "Loading…" : "No calls match these filters."}
              </Text>
            )}
          </Card>

          {pages > 1 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <Text style={{ fontSize: 12, color: C.muted }}>
                Page {pageSafe} of {pages}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  disabled={pageSafe <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.border,
                    opacity: pageSafe <= 1 ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: C.muted }}>
                    Previous
                  </Text>
                </Pressable>
                <Pressable
                  disabled={pageSafe >= pages}
                  onPress={() => setPage((p) => Math.min(pages, p + 1))}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.border,
                    opacity: pageSafe >= pages ? 0.4 : 1,
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
            Your outbound calls only. Answered / talk time is recorded on Android.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
