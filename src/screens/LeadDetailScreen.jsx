import { useState } from "react";
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { convertLead, deleteLead, getLead, updateLead } from "@/lib/api";
import { errMsg } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { label, LEAD_STATUSES } from "@/lib/types";
import { Avatar, Button, C, ErrorBox, Field, Input, Loading, Sheet, fmtDateTime, fmtRelative, money, s, shadow, toneOf } from "@/components/ui";
import { LeadForm } from "@/components/forms";
import { ActivityPanel, DocumentsPanel, FollowUpsPanel, TasksPanel } from "@/components/panels";
import { OfflineBanner } from "@/components/OfflineBanner";

/** Lead stages shared with the web CRM and backend. */
const STEPS = LEAD_STATUSES.map((key) => ({ key, name: label(key) }));

function openUrl(url) {
  Linking.openURL(url).catch(() => Alert.alert("Not available", "No app on this device can open that."));
}

/** Round quick-action button used in the dark header. */
function QuickAction({ icon, text, color, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flex: 1 }}>
      {({ pressed }) => (
        <>
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)" }}>
            <Ionicons name={icon} size={21} color={color} />
          </View>
          <Text numberOfLines={1} style={{ color: "#CBD5E1", fontSize: 11.5, fontWeight: "700", marginTop: 5 }}>
            {text}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Small fact tile (value + label + coloured icon). */
function Fact({ icon, k, v, color, bg }) {
  return (
    <View style={{ width: "48.5%", backgroundColor: "#fff", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: C.border, ...shadow }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ fontSize: 11.5, color: C.muted, fontWeight: "700", marginTop: 8 }}>{k}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15.5, color: C.text, fontWeight: "800", marginTop: 1 }}>
        {v}
      </Text>
    </View>
  );
}

export default function LeadDetailScreen() {
  const { id } = useRoute().params;
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const q = useQuery({ queryKey: ["leads", id], queryFn: () => getLead(id) });
  const [edit, setEdit] = useState(false);
  const [convert, setConvert] = useState(false);
  const [service, setService] = useState("");
  const [value, setValue] = useState("");
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["module_counts"] });
  };
  const status = useMutation({
    mutationFn: (st) => updateLead(id, { status: st }),
    onSuccess: async () => {
      inval();
      await qc.refetchQueries({ queryKey: ["activities", { lead_id: id }], type: "active" });
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: () => deleteLead(id),
    onSuccess: () => {
      inval();
      nav.goBack();
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const conv = useMutation({
    mutationFn: () => convertLead(id, service || undefined, Number(value) || undefined),
    onSuccess: (c) => {
      inval();
      qc.invalidateQueries({ queryKey: ["clients"] });
      setConvert(false);
      nav.navigate("More", { screen: "ClientDetail", params: { id: c.id }, initial: false });
    },
    onError: (e) => Alert.alert("Could not convert", errMsg(e)),
  });

  const back = (
    <Pressable
      onPress={() => nav.goBack()}
      hitSlop={8}
      accessibilityLabel="Back"
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)" })}
    >
      <Ionicons name="chevron-back" size={22} color="#fff" />
    </Pressable>
  );

  if (q.isLoading || q.error || !q.data)
    return (
      <View style={s.screen}>
        {focused && <StatusBar style="light" />}
        <View style={{ backgroundColor: C.dark, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 14 }}>{back}</View>
        {q.isLoading ? <Loading /> : <ErrorBox message={q.error ? errMsg(q.error) : "Lead not found or no access"} onRetry={() => q.refetch()} />}
      </View>
    );

  const l = q.data;
  const lost = l.status === "junk";
  const stepIdx = STEPS.findIndex((x) => x.key === l.status);
  const setStage = (st) => st !== l.status && !status.isPending && status.mutate(st);
  const digits = l.phone?.replace(/[^\d]/g, "");
  const tone = toneOf(l.status);
  const mapUrl = l.address
    ? Platform.select({ ios: `maps:0,0?q=${encodeURIComponent(l.address)}`, default: `geo:0,0?q=${encodeURIComponent(l.address)}` })
    : null;
  const confirmDelete = () =>
    Alert.alert("Delete lead?", `Delete "${l.name}" with all its follow-ups, documents and history? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);

  return (
    <View style={s.screen}>
      {focused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} progressViewOffset={insets.top} />}
      >
        {/* ---------- dark header ---------- */}
        <View style={{ backgroundColor: C.dark, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" }}>
          <View pointerEvents="none" style={{ position: "absolute", top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: C.accent, opacity: 0.16 }} />
          <View pointerEvents="none" style={{ position: "absolute", bottom: -80, left: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: C.accent, opacity: 0.08 }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {back}
            <Text style={{ color: "#94A3B8", fontSize: 13, fontWeight: "700" }}>Lead</Text>
            {isAdmin ? (
              <Pressable
                onPress={confirmDelete}
                hitSlop={8}
                accessibilityLabel="Delete lead"
                style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(251,146,60,0.45)" : "rgba(255,255,255,0.12)" })}
              >
                <Ionicons name="trash-outline" size={18} color="#FDBA74" />
              </Pressable>
            ) : (
              <View style={{ width: 38 }} />
            )}
          </View>

          <View style={{ alignItems: "center", marginTop: 12 }}>
            <View style={{ borderRadius: 40, borderWidth: 3, borderColor: "rgba(255,255,255,0.25)" }}>
              <Avatar name={l.name} size={72} />
            </View>
            <Text numberOfLines={2} style={{ color: "#fff", fontSize: 23, fontWeight: "800", marginTop: 10, textAlign: "center" }}>
              {l.name}
            </Text>
            {!!(l.company || l.source) && (
              <Text style={{ color: "#94A3B8", fontSize: 13.5, marginTop: 2, textAlign: "center" }}>{[l.company, label(l.source)].filter(Boolean).join(" · ")}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: lost ? "#CBD5E1" : "#5EEAD4" }} />
                <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "800" }}>{label(l.status)}</Text>
              </View>
              {l.converted_client_id && (
                <Pressable
                  onPress={() => nav.navigate("More", { screen: "ClientDetail", params: { id: l.converted_client_id }, initial: false })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#16A34A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}
                >
                  <Ionicons name="person-circle-outline" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "800" }}>View customer</Text>
                </Pressable>
              )}
            </View>
          </View>

          {(l.phone || l.email || l.address) && (
            <View style={{ flexDirection: "row", marginTop: 20 }}>
              {l.phone && <QuickAction icon="call" text="Call" color="#5EEAD4" onPress={() => openUrl(`tel:${l.phone}`)} />}
              {digits && <QuickAction icon="logo-whatsapp" text="WhatsApp" color="#86EFAC" onPress={() => openUrl(`https://wa.me/${digits}`)} />}
              {l.phone && <QuickAction icon="chatbubble-ellipses" text="SMS" color="#93C5FD" onPress={() => openUrl(`sms:${l.phone}`)} />}
              {l.email && <QuickAction icon="mail" text="Email" color="#FCD34D" onPress={() => openUrl(`mailto:${l.email}`)} />}
              {mapUrl && <QuickAction icon="location" text="Map" color="#FDA4AF" onPress={() => openUrl(mapUrl)} />}
            </View>
          )}
        </View>
        <OfflineBanner />

        <View style={{ paddingHorizontal: 16 }}>
          {/* ---------- actions ---------- */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <Button title="Edit" variant="secondary" icon="create-outline" onPress={() => setEdit(true)} style={{ flex: 1 }} />
            {!l.converted_client_id && !lost && (
              <Button
                title="Convert"
                icon="person-add"
                onPress={() => {
                  setValue(String(l.estimated_value ?? 0));
                  setConvert(true);
                }}
                style={{ flex: 1.4 }}
              />
            )}
          </View>

          {/* ---------- stage ---------- */}
          <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border, marginTop: 12, ...shadow }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: C.text }}>Stage</Text>
              {lost ? (
                <Pressable onPress={() => setStage("prospect")} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="refresh" size={14} color={C.brand} />
                  <Text style={{ color: C.brand, fontWeight: "800", fontSize: 12.5 }}>Reopen lead</Text>
                </Pressable>
              ) : (
                l.status !== "sale_done" && (
                  <Pressable onPress={() => setStage("junk")} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="close-circle-outline" size={14} color={C.faint} />
                    <Text style={{ color: C.muted, fontWeight: "700", fontSize: 12.5 }}>Mark as Junk</Text>
                  </Pressable>
                )
              )}
            </View>
            {lost ? (
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 12 }}>
                <Ionicons name="close-circle" size={20} color={C.faint} />
                <Text style={{ flex: 1, color: C.muted, fontSize: 13 }}>
                  Marked <Text style={{ fontWeight: "800", color: C.text }}>Junk</Text>. Reopen it if they get in touch again.
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {STEPS.map((st, i) => {
                  const done = i < stepIdx;
                  const cur = i === stepIdx;
                  return (
                    <Pressable
                      key={st.key}
                      onPress={() => setStage(st.key)}
                      accessibilityLabel={`Move to ${st.name}`}
                      style={({ pressed }) => ({
                        width: "31%",
                        minWidth: 88,
                        alignItems: "center",
                        paddingVertical: 9,
                        borderRadius: 12,
                        backgroundColor: cur ? C.brand : done ? C.brandLight : "#F1F4F8",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: cur ? "#fff" : done ? C.brand : "#fff" }}>
                        {done ? (
                          <Ionicons name="checkmark" size={13} color="#fff" />
                        ) : (
                          <Text style={{ fontSize: 10.5, fontWeight: "800", color: cur ? C.brand : C.faint }}>{i + 1}</Text>
                        )}
                      </View>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4, fontSize: 11, fontWeight: "800", color: cur ? "#fff" : done ? "#065F5B" : C.muted }}>
                        {st.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {status.isPending && <Text style={{ marginTop: 8, fontSize: 12, color: C.muted, textAlign: "center" }}>Saving…</Text>}
          </View>

          {/* ---------- facts ---------- */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginTop: 12 }}>
            <Fact icon="cash-outline" k="Estimated value" v={money(l.estimated_value)} color="#16A34A" bg="#DCFCE7" />
            <Fact icon="person-outline" k="Assigned to" v={l.assignee?.full_name ?? "Unassigned"} color="#7C3AED" bg="#EDE9FE" />
            <Fact icon="time-outline" k="Last contact" v={l.last_contacted_at ? fmtRelative(l.last_contacted_at) : "Not yet"} color="#EA580C" bg="#FFEDD5" />
            <Fact icon="calendar-outline" k="Added" v={fmtDateTime(l.created_at)} color={tone} bg={tone + "1F"} />
          </View>

          {!!l.notes && (
            <View style={{ backgroundColor: "#FEF9C3", borderRadius: 18, padding: 14, marginTop: 12, borderWidth: 1, borderColor: "#FDE68A" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Ionicons name="document-text-outline" size={16} color="#A16207" />
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#A16207" }}>About this lead</Text>
              </View>
              <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }}>{l.notes}</Text>
            </View>
          )}

          <View style={{ marginTop: 8 }}>
            <FollowUpsPanel lead_id={id} />
            <TasksPanel lead_id={id} />
            <DocumentsPanel lead_id={id} />
            <ActivityPanel lead_id={id} />
          </View>
        </View>
      </ScrollView>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit lead">
        {edit && (
          <LeadForm
            lead={l}
            onDone={() => {
              setEdit(false);
              inval();
            }}
          />
        )}
      </Sheet>
      <Sheet open={convert} onClose={() => setConvert(false)} title="Convert to customer">
        <Text style={[s.muted, { marginBottom: 12 }]}>The lead is marked Sale Done and a customer record is created with all the details.</Text>
        <Field label="Service / package">
          <Input value={service} onChangeText={setService} placeholder="e.g. Premium Package" />
        </Field>
        <Field label="Contract value (CAD)">
          <Input value={value} onChangeText={setValue} keyboardType="decimal-pad" />
        </Field>
        <Button title="Convert to customer" icon="person-add" onPress={() => conv.mutate()} loading={conv.isPending} />
      </Sheet>
    </View>
  );
}
