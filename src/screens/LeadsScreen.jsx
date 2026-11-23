import { memo, useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getLeads } from "@/lib/api";
import { errMsg } from "@/lib/http";
import { LEAD_STATUSES, label } from "@/lib/types";
import { useStages } from "@/lib/stages";
import {
  Avatar,
  Badge,
  C,
  Chips,
  Empty,
  ErrorBox,
  Loading,
  Sheet,
  enumOptions,
  fmtDate,
  money,
  s,
  useDebounced,
} from "@/components/ui";
import { LeadForm } from "@/components/forms";
import { OfflineBanner } from "@/components/OfflineBanner";

const PAGE = 25;

function StageBadge({ status }) {
  const { labelOf, colorOf } = useStages();
  const c = colorOf(status);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: c + "1A",
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 3,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }}
      />
      <Text style={{ fontSize: 11.5, fontWeight: "700", color: c }}>
        {labelOf(status)}
      </Text>
    </View>
  );
}

export default function LeadsScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(route.params?.status ?? "");
  const [open, setOpen] = useState(false);
  const term = useDebounced(search.trim());
  const { stages } = useStages();
  // opening Leads again from Home / Overview with a status filter updates the filter
  useEffect(() => {
    if (route.params?.status !== undefined) setStatus(route.params.status);
  }, [route.params?.status]);

  const q = useInfiniteQuery({
    queryKey: ["leads", { search: term, status }],
    queryFn: ({ pageParam }) =>
      getLeads({ search: term, status, page: pageParam, pageSize: PAGE }),
    placeholderData: (prev) => prev, // keep the list on screen while typing
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      last.rows.length < PAGE ? undefined : all.length,
  });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = q.data?.pages[0]?.count ?? 0;

  const renderItem = useCallback(
    ({ item }) => (
      <LeadRow
        lead={item}
        onPress={() => nav.navigate("LeadDetail", { id: item.id })}
      />
    ),
    [nav],
  );

  return (
    <View style={s.screen}>
      <OfflineBanner />
      <View
        style={{
          padding: 12,
          gap: 10,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <View style={[s.input, s.row, { paddingVertical: 6 }]}>
          <Ionicons name="search" size={18} color={C.faint} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: C.text }}
            placeholder="Search leads…"
            placeholderTextColor={C.faint}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={C.faint} />
            </Pressable>
          ) : null}
        </View>
        <Chips
          value={status}
          allowEmpty
          onChange={(v) => setStatus(v)}
          options={stages.map((st) => ({ value: st.key, label: st.label }))}
        />
      </View>
      {q.isLoading ? (
        <Loading />
      ) : q.error && !rows.length ? (
        <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(l) => l.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => q.refetch()}
          onEndReached={() =>
            q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()
          }
          onEndReachedThreshold={0.4}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <Text style={[s.muted, { marginBottom: 8 }]}>
              {total} lead{total === 1 ? "" : "s"}
            </Text>
          }
          ListEmptyComponent={
            <Empty title="No leads found" hint="Tap + to add one." />
          }
          ListFooterComponent={q.isFetchingNextPage ? <Loading /> : null}
          renderItem={renderItem}
        />
      )}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          position: "absolute",
          right: 18,
          bottom: 22,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: C.brand,
          alignItems: "center",
          justifyContent: "center",
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title="New lead">
        <LeadForm
          onDone={(l) => {
            setOpen(false);
            nav.navigate("LeadDetail", { id: l.id });
          }}
        />
      </Sheet>
    </View>
  );
}

const LeadRow = memo(function LeadRow({ lead, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { paddingVertical: 12, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={s.row}>
        <Avatar name={lead.name} />
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontWeight: "600", color: C.text, fontSize: 15 }}
            numberOfLines={1}
          >
            {lead.name}
          </Text>
          <Text style={s.muted} numberOfLines={1}>
            {[lead.company, lead.phone].filter(Boolean).join(" · ") ||
              lead.email ||
              "No contact details"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <StageBadge status={lead.status} />
          <Text style={{ fontSize: 11, color: C.faint }}>
            {lead.estimated_value
              ? money(lead.estimated_value)
              : fmtDate(lead.created_at)}
          </Text>
        </View>
      </View>
      {lead.assignee && (
        <Text style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>
          {label(lead.source)} · {lead.assignee.full_name}
        </Text>
      )}
    </Pressable>
  );
});
