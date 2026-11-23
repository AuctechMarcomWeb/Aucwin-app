import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getDataSources } from "@/lib/api";
import { label } from "@/lib/types";
import { C, Card, Loading, ErrorBox, Empty, fmtDate } from "@/components/ui";

function Stat({ value, title, color }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color: color || C.text }}>
        {value ?? 0}
      </Text>
      <Text style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>
        {title}
      </Text>
    </View>
  );
}

function SourceCard({ row }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>
          {label(row.source)}
        </Text>
        <View
          style={{
            backgroundColor: C.brandLight,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: C.brand }}>
            {row.total} leads
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <Stat value={row.qualified} title="Qualified" color="#B7791F" />
        <Stat value={row.converted} title="Converted" color="#2F7D4A" />
        <Stat value={row.unassigned} title="Unassigned" color="#C2410C" />
      </View>
    </Card>
  );
}

export default function DataSourcesScreen() {
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["data-sources"], queryFn: getDataSources });

  const sources = useMemo(
    () => (q.data?.sources ?? []).slice().sort((a, b) => b.total - a.total),
    [q.data],
  );
  const datasets = q.data?.datasets ?? [];
  const totalLeads = q.data?.total_leads ?? 0;

  if (q.isLoading) return <Loading />;
  if (q.error)
    return (
      <ErrorBox message="Could not load data sources." onRetry={q.refetch} />
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      refreshControl={
        <RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} />
      }
    >
      {/* total */}
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: C.brandLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="git-network" size={22} color={C.brand} />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.text }}>
              {totalLeads}
            </Text>
            <Text style={{ fontSize: 12, color: C.faint }}>
              Total leads across all sources
            </Text>
          </View>
        </View>
      </Card>

      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: C.faint,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 10,
        }}
      >
        By source
      </Text>
      {sources.length === 0 ? (
        <Empty title="No leads yet" hint="Sources appear once leads come in." />
      ) : (
        sources.map((row) => <SourceCard key={row.source} row={row} />)
      )}

      {datasets.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: C.faint,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginTop: 8,
              marginBottom: 10,
            }}
          >
            Imported datasets
          </Text>
          {datasets.map((d, i) => (
            <Card key={`${d.dataset_name}-${i}`} style={{ marginBottom: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: C.text,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {d.dataset_name}
                </Text>
                <Text
                  style={{ fontSize: 12, fontWeight: "800", color: C.brand }}
                >
                  {d.total}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: C.faint }}>
                {label(d.source)}
                {d.last_imported_at
                  ? ` · imported ${fmtDate(d.last_imported_at)}`
                  : ""}
              </Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}
