import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getDashboardStats,
  getEmployeePerformance,
  getFollowUps,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/http";
import {
  Avatar,
  Badge,
  C,
  Card,
  Empty,
  ErrorBox,
  Loading,
  SectionTitle,
  fmtDateTime,
  isOverdue,
  money,
  s,
  toneOf,
} from "@/components/ui";
import { LEAD_STATUSES, label } from "@/lib/types";
import { OfflineBanner } from "@/components/OfflineBanner";

function Stat({ title, value, icon, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        {
          flex: 1,
          minWidth: "46%",
          marginBottom: 0,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Text style={{ fontSize: 13, color: C.muted, flex: 1 }} numberOfLines={2}>{title}</Text>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: color === C.danger ? C.danger : C.text,
          marginTop: 8,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </Pressable>
  );
}

function PipelineBand({ d }) {
  const nav = useNavigation();
  const total = Object.values(d.leads_by_status).reduce((a, b) => a + b, 0);
  const stages = LEAD_STATUSES.map((st) => ({
    st,
    n: d.leads_by_status[st] ?? 0,
  }));
  return (
    <View
      style={{
        backgroundColor: C.dark,
        marginHorizontal: -16,
        marginTop: -16,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 22,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: 16,
      }}
    >
      <Text style={{ color: "#94A3B8", fontSize: 13 }}>Pipeline right now</Text>
      <View
        style={[
          s.row,
          { alignItems: "flex-end", justifyContent: "space-between" },
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            flexShrink: 1,
            color: "#fff",
            fontSize: 40,
            fontWeight: "800",
            letterSpacing: -1,
            fontVariant: ["tabular-nums"],
          }}
        >
          {total}{" "}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#94A3B8" }}>
            leads
          </Text>
        </Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: "#94A3B8", fontSize: 12 }}>Open value</Text>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
            {money(d.pipeline_value)}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          height: 12,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.12)",
          marginTop: 14,
        }}
      >
        {total > 0 &&
          stages
            .filter((x) => x.n > 0)
            .map((x) => (
              <View
                key={x.st}
                style={{ flex: x.n, backgroundColor: toneOf(x.st) }}
              />
            ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 12,
        }}
      >
        {stages.map((x) => (
          <Pressable
            key={x.st}
            onPress={() =>
              nav.navigate("Leads", {
                screen: "LeadsList",
                params: { status: x.st },
              })
            }
            style={[s.row, { gap: 6 }]}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: toneOf(x.st),
              }}
            />
            <Text style={{ color: "#CBD5E1", fontSize: 13 }}>
              {label(x.st)}{" "}
              <Text style={{ color: "#fff", fontWeight: "700" }}>{x.n}</Text>
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const nav = useNavigation();
  const { profile, isAdmin } = useAuth();
  const stats = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardStats(30),
  });
  const upcoming = useQuery({
    queryKey: ["follow_ups", "dash"],
    queryFn: () => getFollowUps({ scope: "upcoming" }),
  });
  const overdue = useQuery({
    queryKey: ["follow_ups", "dash-overdue"],
    queryFn: () => getFollowUps({ scope: "overdue" }),
  });
  const perf = useQuery({
    queryKey: ["employee_performance"],
    queryFn: getEmployeePerformance,
    enabled: isAdmin,
  });
  const refreshing = stats.isFetching && !stats.isLoading;
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const d = stats.data;

  return (
    <View
      style={[s.screen, { paddingTop: insets.top, backgroundColor: C.dark }]}
    >
      {focused && <StatusBar style="light" />}
      {/* this screen has no top bar, so give it its own back button */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={8}
          accessibilityLabel="Back"
          style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)" })}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Team overview</Text>
      </View>
      <OfflineBanner />
      <ScrollView
        style={{ backgroundColor: C.dark }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
          backgroundColor: C.bg,
          minHeight: "100%",
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              stats.refetch();
              upcoming.refetch();
              overdue.refetch();
            }}
          />
        }
      >
        {stats.isLoading ? (
          <Loading />
        ) : stats.error && !d ? (
          <ErrorBox
            message={errMsg(stats.error)}
            onRetry={() => stats.refetch()}
          />
        ) : (
          d && (
            <>
              <PipelineBand d={d} />
              <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>
                {greeting()}, {profile?.full_name?.split(" ")[0] ?? ""}
              </Text>
              <Text style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                {d.followups_today
                  ? `${d.followups_today} follow-up${d.followups_today === 1 ? "" : "s"} due today`
                  : "Nothing due today"}
                {d.followups_overdue ? ` · ${d.followups_overdue} overdue` : ""}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Stat
                  title="New leads, 30 days"
                  value={d.new_leads}
                  icon="person-add-outline"
                  color={C.brand}
                  onPress={() =>
                    nav.navigate("Leads", {
                      screen: "LeadsList",
                      params: { status: "new_lead" },
                    })
                  }
                />
                <Stat
                  title="Active customers"
                  value={d.active_clients}
                  icon="briefcase-outline"
                  color={C.brand}
                  onPress={() => nav.navigate("More", { screen: "Clients" })}
                />
                <Stat
                  title="Follow-ups waiting"
                  value={d.followups_pending}
                  icon="calendar-outline"
                  color={d.followups_overdue ? C.danger : C.brand}
                  onPress={() => nav.navigate("Calendar")}
                />
                <Stat
                  title="Collected"
                  value={money(d.revenue_paid)}
                  icon="cash-outline"
                  color={C.success}
                />
              </View>
            </>
          )
        )}

        {!!overdue.data?.length && (
          <View style={{ marginTop: 18 }}>
            <SectionTitle
              title="Overdue follow-ups"
              action="See all"
              onAction={() => nav.navigate("Calendar")}
            />
            {overdue.data.slice(0, 3).map((f) => (
              <FollowUpRow
                key={f.id}
                f={f}
                onPress={() =>
                  nav.navigate(
                    f.lead_id ? "Leads" : "More",
                    f.lead_id
                      ? {
                          screen: "LeadDetail",
                          params: { id: f.lead_id },
                          initial: false,
                        }
                      : {
                          screen: "ClientDetail",
                          params: { id: f.client_id },
                          initial: false,
                        },
                  )
                }
              />
            ))}
          </View>
        )}
        <View style={{ marginTop: 18 }}>
          <SectionTitle
            title="Upcoming follow-ups"
            action="See all"
            onAction={() => nav.navigate("Calendar")}
          />
          {upcoming.isLoading ? (
            <Loading />
          ) : !upcoming.data?.length ? (
            <Card>
              <Empty title="Nothing scheduled" />
            </Card>
          ) : (
            upcoming.data
              .slice(0, 5)
              .map((f) => (
                <FollowUpRow
                  key={f.id}
                  f={f}
                  onPress={() =>
                    nav.navigate(
                      f.lead_id ? "Leads" : "More",
                      f.lead_id
                        ? {
                            screen: "LeadDetail",
                            params: { id: f.lead_id },
                            initial: false,
                          }
                        : {
                            screen: "ClientDetail",
                            params: { id: f.client_id },
                            initial: false,
                          },
                    )
                  }
                />
              ))
          )}
        </View>
        {isAdmin && (
          <View style={{ marginTop: 18 }}>
            <SectionTitle title="Team performance" icon="trophy" color="#B7791F" bg="#FEF3C7" sub="Ranked by money collected" />
            {perf.isLoading ? (
              <Loading />
            ) : (
              [...(perf.data ?? [])].sort((a, b) => (b.revenue_collected || 0) - (a.revenue_collected || 0) || b.leads_won - a.leads_won).map((p, i) => (
                <Card key={p.id} style={{ paddingVertical: 11 }}>
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: i === 0 ? "#FEF3C7" : i === 1 ? "#F1F5F9" : i === 2 ? "#FFEDD5" : "transparent" }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: i === 0 ? "#B45309" : i === 2 ? "#C2410C" : C.muted }}>{i + 1}</Text>
                    </View>
                    <Avatar name={p.full_name} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "800", color: C.text }}>
                        {p.full_name}
                      </Text>
                      <Text style={s.muted}>
                        {label(p.role)}
                        {p.department_name ? ` · ${p.department_name}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontWeight: "800", color: C.text }}>{money(p.revenue_collected ?? 0)}</Text>
                      <Text style={{ fontWeight: "700", color: C.success, fontSize: 12.5 }}>
                        {p.leads_won} sales
                      </Text>
                      <Text style={s.muted}>
                        {p.leads_assigned} leads · {p.followups_overdue} overdue
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export function FollowUpRow({ f, onPress }) {
  const late = f.status === "pending" && isOverdue(f.due_at);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { paddingVertical: 10, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Badge value={f.type} />
        <Text
          style={{
            fontSize: 12,
            color: late ? C.danger : C.muted,
            fontWeight: late ? "700" : "400",
          }}
        >
          {fmtDateTime(f.due_at)}
        </Text>
      </View>
      <Text style={{ fontWeight: "600", color: C.text, marginTop: 6 }}>
        {f.title}
      </Text>
      <Text style={s.muted}>{f.lead?.name ?? f.client?.name}</Text>
    </Pressable>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
