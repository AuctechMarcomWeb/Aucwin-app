import { useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { telUri, smsUri, waUri } from "@/lib/phone";
import {
  armCall,
  ensureCallLogPermission,
  ensurePhoneStatePermission,
} from "@/lib/callTracking";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import {
  getClient,
  getClients,
  getPayments,
  logClientCall,
  updateClient,
} from "@/lib/api";
import { errMsg } from "@/lib/http";
import { SERVICE_STATUSES } from "@/lib/types";
import {
  Avatar,
  Badge,
  C,
  Chips,
  Empty,
  ErrorBox,
  Loading,
  enumOptions,
  fmtDate,
  money,
  s,
  toneOf,
  useDebounced,
} from "@/components/ui";
import {
  ActivityPanel,
  DocumentsPanel,
  FollowUpsPanel,
  PaymentsPanel,
  TasksPanel,
} from "@/components/panels";
import { OfflineBanner } from "@/components/OfflineBanner";

export function ClientsScreen() {
  const nav = useNavigation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const term = useDebounced(search.trim());
  const q = useQuery({
    queryKey: ["clients", { search: term, status }],
    queryFn: () => getClients({ search: term, status }),
    placeholderData: (prev) => prev, // keep the list on screen while typing
  });
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
            placeholder="Search clients…"
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
          onChange={setStatus}
          options={enumOptions(SERVICE_STATUSES)}
        />
      </View>
      {q.isLoading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshing={false}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <Empty
              title="No clients"
              hint="Convert a lead to create a client."
            />
          }
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => nav.navigate("ClientDetail", { id: c.id })}
              style={({ pressed }) => [
                s.card,
                { paddingVertical: 12, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={s.row}>
                <Avatar name={c.name} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontWeight: "600", color: C.text, fontSize: 15 }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  <Text style={s.muted} numberOfLines={1}>
                    {[c.service_name, c.phone].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Badge value={c.service_status} />
                  <Text style={{ fontSize: 11, color: C.faint }}>
                    {money(c.contract_value)}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const SERVICE_LABEL = {
  onboarding: "Onboarding",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
const SERVICE_ICON = {
  onboarding: "rocket-outline",
  in_progress: "construct-outline",
  on_hold: "pause-circle-outline",
  completed: "checkmark-circle-outline",
  cancelled: "close-circle-outline",
};

function openUrl(url) {
  Linking.openURL(url).catch(() =>
    Alert.alert("Not available", "No app on this device can open that."),
  );
}

/** Round quick-action button used in the dark header. */
function QuickAction({ icon, label, color, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flex: 1 }}>
      {({ pressed }) => (
        <>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed
                ? "rgba(255,255,255,0.25)"
                : "rgba(255,255,255,0.12)",
            }}
          >
            <Ionicons name={icon} size={21} color={color} />
          </View>
          <Text
            numberOfLines={1}
            style={{
              color: "#CBD5E1",
              fontSize: 11.5,
              fontWeight: "700",
              marginTop: 5,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** One row in the details card: icon, label, value. */
function InfoRow({ icon, label, value, onPress, last }) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "#F1F5F9",
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          backgroundColor: "#F1F5F9",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={C.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11.5, color: C.faint, fontWeight: "700" }}>
          {label}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: onPress ? C.brand : C.text,
            fontWeight: "600",
            marginTop: 1,
          }}
        >
          {value}
        </Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={C.faint} />}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** Small money tile. */
function MoneyTile({ label, value, color, bg, icon }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text
        style={{
          fontSize: 11.5,
          color: C.muted,
          fontWeight: "700",
          marginTop: 8,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ fontSize: 16, color: C.text, fontWeight: "800", marginTop: 1 }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

export function ClientDetailScreen() {
  const { id } = useRoute().params;
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["clients", id],
    queryFn: () => getClient(id),
  });
  const pays = useQuery({
    queryKey: ["payments", id],
    queryFn: () => getPayments(id),
  });
  const status = useMutation({
    mutationFn: (st) => updateClient(id, { service_status: st }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  // Outbound call tracking for customers — same as leads. Android arms the native
  // recorder (outcome + talk time recorded in the background); iOS just logs the
  // attempt. kind "client" routes it to the customer's record.
  const startCall = (phone) => {
    if (Platform.OS === "android") {
      (async () => {
        await ensureCallLogPermission();
        await ensurePhoneStatePermission();
        await armCall(id, phone, "client");
      })().catch(() => {});
    } else {
      logClientCall(id).catch(() => {});
    }
    openUrl(telUri(phone));
  };
  if (q.isLoading || q.error || !q.data)
    return (
      <View style={s.screen}>
        {focused && <StatusBar style="light" />}
        <View
          style={{
            backgroundColor: C.dark,
            paddingTop: insets.top + 8,
            paddingHorizontal: 18,
            paddingBottom: 14,
          }}
        >
          <Pressable
            onPress={() => nav.goBack()}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        </View>
        {q.isLoading ? (
          <Loading />
        ) : (
          <ErrorBox
            message={q.error ? errMsg(q.error) : "Customer not found"}
            onRetry={() => q.refetch()}
          />
        )}
      </View>
    );

  const c = q.data;
  const paid = (pays.data ?? [])
    .filter((p) => p.status === "paid")
    .reduce((a, p) => a + Number(p.amount), 0);
  const due = (pays.data ?? [])
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((a, p) => a + Number(p.amount), 0);
  const digits = c.phone?.replace(/[^\d]/g, "");
  const tone = toneOf(c.service_status);
  const mapUrl = c.address
    ? Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(c.address)}`,
        default: `geo:0,0?q=${encodeURIComponent(c.address)}`,
      })
    : null;

  return (
    <View style={s.screen}>
      {focused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              q.refetch();
              pays.refetch();
            }}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* ---------- dark header ---------- */}
        <View
          style={{
            backgroundColor: C.dark,
            paddingTop: insets.top + 8,
            paddingHorizontal: 18,
            paddingBottom: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -60,
              right: -50,
              width: 190,
              height: 190,
              borderRadius: 95,
              backgroundColor: C.accent,
              opacity: 0.16,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={() => nav.goBack()}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed
                  ? "rgba(255,255,255,0.22)"
                  : "rgba(255,255,255,0.12)",
              })}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <Text style={{ color: "#94A3B8", fontSize: 13, fontWeight: "700" }}>
              Customer
            </Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={{ alignItems: "center", marginTop: 14 }}>
            <View
              style={{
                borderRadius: 40,
                borderWidth: 3,
                borderColor: "rgba(255,255,255,0.25)",
              }}
            >
              <Avatar name={c.name} size={72} />
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: "#fff",
                fontSize: 23,
                fontWeight: "800",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              {c.name}
            </Text>
            {!!(c.company || c.service_name) && (
              <Text
                style={{
                  color: "#94A3B8",
                  fontSize: 13.5,
                  marginTop: 2,
                  textAlign: "center",
                }}
              >
                {[c.company, c.service_name].filter(Boolean).join(" · ")}
              </Text>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                backgroundColor: tone + "33",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Ionicons
                name={SERVICE_ICON[c.service_status] ?? "ellipse"}
                size={14}
                color="#fff"
              />
              <Text
                style={{ color: "#fff", fontSize: 12.5, fontWeight: "800" }}
              >
                {SERVICE_LABEL[c.service_status] ?? c.service_status}
              </Text>
            </View>
          </View>

          {(c.phone || c.email || c.address) && (
            <View style={{ flexDirection: "row", marginTop: 20 }}>
              {c.phone && (
                <QuickAction
                  icon="call"
                  label="Call"
                  color="#5EEAD4"
                  onPress={() => startCall(c.phone)}
                />
              )}
              {digits && (
                <QuickAction
                  icon="logo-whatsapp"
                  label="WhatsApp"
                  color="#86EFAC"
                  onPress={() => openUrl(waUri(c.phone))}
                />
              )}
              {c.phone && (
                <QuickAction
                  icon="chatbubble-ellipses"
                  label="SMS"
                  color="#93C5FD"
                  onPress={() => openUrl(smsUri(c.phone))}
                />
              )}
              {c.email && (
                <QuickAction
                  icon="mail"
                  label="Email"
                  color="#FCD34D"
                  onPress={() => openUrl(`mailto:${c.email}`)}
                />
              )}
              {mapUrl && (
                <QuickAction
                  icon="location"
                  label="Map"
                  color="#FDA4AF"
                  onPress={() => openUrl(mapUrl)}
                />
              )}
            </View>
          )}
        </View>
        <OfflineBanner />

        <View style={{ paddingHorizontal: 16 }}>
          {/* ---------- money ---------- */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <MoneyTile
              label="Contract"
              value={money(c.contract_value)}
              icon="document-text"
              color="#2563EB"
              bg="#DBEAFE"
            />
            <MoneyTile
              label="Paid"
              value={money(paid)}
              icon="checkmark-done"
              color="#16A34A"
              bg="#DCFCE7"
            />
            <MoneyTile
              label="Due"
              value={money(due)}
              icon="time"
              color={due > 0 ? "#C2410C" : C.muted}
              bg={due > 0 ? "#FFEDD5" : "#F1F5F9"}
            />
          </View>

          {/* ---------- service status ---------- */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: C.border,
              marginTop: 12,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: C.text,
                marginBottom: 10,
              }}
            >
              Service status
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SERVICE_STATUSES.map((st) => {
                const on = c.service_status === st;
                const t = toneOf(st);
                return (
                  <Pressable
                    key={st}
                    disabled={status.isPending}
                    onPress={() => !on && status.mutate(st)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: on ? t : "#fff",
                      borderWidth: 1,
                      borderColor: on ? t : C.border,
                    }}
                  >
                    <Ionicons
                      name={SERVICE_ICON[st]}
                      size={14}
                      color={on ? "#fff" : t}
                    />
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: "700",
                        color: on ? "#fff" : C.text,
                      }}
                    >
                      {SERVICE_LABEL[st]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ---------- details ---------- */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: C.border,
              marginTop: 12,
            }}
          >
            {c.phone && (
              <InfoRow
                icon="call-outline"
                label="Phone"
                value={c.phone}
                onPress={() => startCall(c.phone)}
              />
            )}
            {c.email && (
              <InfoRow
                icon="mail-outline"
                label="Email"
                value={c.email}
                onPress={() => openUrl(`mailto:${c.email}`)}
              />
            )}
            {c.address && (
              <InfoRow
                icon="location-outline"
                label="Address"
                value={c.address}
                onPress={mapUrl ? () => openUrl(mapUrl) : undefined}
              />
            )}
            <InfoRow
              icon="person-outline"
              label="Handled by"
              value={c.assignee?.full_name ?? "Unassigned"}
            />
            <InfoRow
              icon="calendar-outline"
              label="Customer since"
              value={fmtDate(c.created_at)}
              last
            />
          </View>

          {!!c.notes && (
            <View
              style={{
                backgroundColor: "#FEF9C3",
                borderRadius: 18,
                padding: 14,
                marginTop: 12,
                borderWidth: 1,
                borderColor: "#FDE68A",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color="#A16207"
                />
                <Text
                  style={{ fontSize: 13, fontWeight: "800", color: "#A16207" }}
                >
                  Notes
                </Text>
              </View>
              <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }}>
                {c.notes}
              </Text>
            </View>
          )}

          {/* ---------- existing sections ---------- */}
          <View style={{ marginTop: 8 }}>
            <PaymentsPanel clientId={id} />
            <FollowUpsPanel client_id={id} />
            <TasksPanel client_id={id} />
            <DocumentsPanel client_id={id} />
            <ActivityPanel client_id={id} lead_id={c.lead_id ?? undefined} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
