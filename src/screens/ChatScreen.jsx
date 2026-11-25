import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { telUri, smsUri, waUri } from "@/lib/phone";
import { Ionicons } from "@expo/vector-icons";
import {
  createGroupChannel,
  deleteMessage,
  getChannels,
  getChatPeople,
  getClients,
  getLeads,
  getMessages,
  markChannelRead,
  openDirectChannel,
  sendMessage,
} from "@/lib/api";
import { errMsg } from "@/lib/http";
import { onServerChange } from "@/lib/query";
import { useAuth } from "@/lib/auth";
import {
  Avatar,
  Button,
  C,
  Empty,
  Field,
  Input,
  Loading,
  Sheet,
  fmtRelative,
  s,
  useDebounced,
} from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";

const ROSE = "#E11D48";
const ROSE_BG = "#FFE4E6";

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
function dayLabel(iso) {
  const d = new Date(iso);
  const t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
const shortWhen = (iso) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? timeOf(iso)
    : fmtRelative(iso).replace(" ago", "").replace("about ", "");
};

/** Round icon for a channel (people for groups, # for channels, initials for DMs). */
function ChannelIcon({ c, size = 48 }) {
  if (c.type === "direct") return <Avatar name={c.name} size={size} />;
  const icon =
    c.type === "group"
      ? "people"
      : c.type === "general"
        ? "megaphone"
        : "chatbubbles";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ROSE_BG,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={size * 0.44} color={ROSE} />
    </View>
  );
}

// =====================================================================
// Conversation list
// =====================================================================
const ROLE_LABEL = {
  super_admin: "Owner",
  admin: "Admin",
  employee: "Employee",
};
const ROLE_ORDER = { super_admin: 0, admin: 1, employee: 2 };
const personSub = (p) =>
  [ROLE_LABEL[p.role] ?? p.role, p.department?.name]
    .filter(Boolean)
    .join(" · ");

function openUrl(url) {
  Linking.openURL(url).catch(() =>
    Alert.alert("Not available", "No app on this phone can open that."),
  );
}

/** Small labelled action button (Message / WhatsApp / Call). */
function ActionPill({ icon, text, color, bg, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityLabel={text}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: pressed ? color + "26" : bg,
      })}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text
        numberOfLines={1}
        style={{ color, fontWeight: "800", fontSize: 12.5 }}
      >
        {text}
      </Text>
    </Pressable>
  );
}

/** Customer / lead card: they don't use this app, so we reach them by text message, WhatsApp or a call. */
function ContactRow({ name, sub, phone, onOpen }) {
  const digits = phone?.replace(/[^\d]/g, "");
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Avatar name={name} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{ fontWeight: "700", color: C.text, fontSize: 15 }}
          >
            {name}
          </Text>
          <Text numberOfLines={1} style={s.muted}>
            {phone || "No phone number"}
          </Text>
          {sub ? (
            <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12 }}>
              {sub}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </Pressable>
      {digits ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <ActionPill
            icon="chatbubble-outline"
            text="Message"
            color="#2563EB"
            bg="#DBEAFE"
            onPress={() => openUrl(smsUri(phone))}
          />
          <ActionPill
            icon="chatbubbles-outline"
            text="WhatsApp"
            color="#15803D"
            bg="#DCFCE7"
            onPress={() => openUrl(waUri(phone))}
          />
          <ActionPill
            icon="call-outline"
            text="Call"
            color={C.brand}
            bg={C.brandLight}
            onPress={() => openUrl(telUri(phone))}
          />
        </View>
      ) : null}
    </View>
  );
}

function TabPill({ active, label, icon, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: active ? "#fff" : "transparent",
        ...(active
          ? {
              shadowColor: C.dark,
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }
          : null),
      }}
    >
      <Ionicons name={icon} size={15} color={active ? ROSE : C.muted} />
      <Text
        numberOfLines={1}
        style={{
          fontWeight: "800",
          fontSize: 13,
          color: active ? C.text : C.muted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChannelsScreen() {
  const nav = useNavigation();
  const qc = useQueryClient();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: ["chat_channels"],
    queryFn: getChannels,
    refetchInterval: 20_000,
  });
  const people = useQuery({
    queryKey: ["chat_people"],
    queryFn: getChatPeople,
  });
  const { profile } = useAuth();
  const [picker, setPicker] = useState(false);
  const [tab, setTab] = useState("team");
  const [find, setFind] = useState("");
  const [group, setGroup] = useState(null); // { name, ids: Set }
  const [search, setSearch] = useState("");
  const findTerm = useDebounced(find.trim());

  const team = useMemo(
    () =>
      (people.data ?? [])
        .filter((p) => p.id !== profile?.id && p.is_active !== false)
        .sort(
          (a, b) =>
            (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
            a.full_name.localeCompare(b.full_name, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
        ),
    [people.data, profile?.id],
  );
  const clients = useQuery({
    queryKey: ["chat_clients", findTerm],
    queryFn: () => getClients({ search: findTerm }),
    enabled: picker && tab === "customers",
    placeholderData: (p) => p,
  });
  const leads = useQuery({
    queryKey: ["chat_leads", findTerm],
    queryFn: () => getLeads({ search: findTerm, page: 0, pageSize: 40 }),
    enabled: picker && tab === "leads",
    placeholderData: (p) => p,
  });

  const dm = useMutation({
    mutationFn: (p) => openDirectChannel(p.id),
    onSuccess: (id, p) => {
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
      setPicker(false);
      nav.navigate("Thread", {
        id,
        title: p.full_name,
        type: "direct",
        phone: p.phone ?? null,
      });
    },
    onError: (e) => Alert.alert("Could not open chat", errMsg(e)),
  });
  const makeGroup = useMutation({
    mutationFn: () => createGroupChannel(group.name.trim(), [...group.ids]),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
      const name = group.name.trim();
      setGroup(null);
      nav.navigate("Thread", { id, title: name, type: "group" });
    },
    onError: (e) => Alert.alert("Could not create group", errMsg(e)),
  });

  const totalUnread = (q.data ?? []).reduce((a, c) => a + (c.unread || 0), 0);
  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (q.data ?? []).filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.last_message ?? "").toLowerCase().includes(term),
    );
    const channels = rows.filter((c) => c.type !== "direct");
    const direct = rows.filter((c) => c.type === "direct");
    return [
      ...(direct.length ? [{ title: "Direct messages", data: direct }] : []),
      ...(channels.length
        ? [{ title: "Channels & groups", data: channels }]
        : []),
    ];
  }, [q.data, search]);
  const phoneOf = (userId) => team.find((p) => p.id === userId)?.phone ?? null;
  const openPicker = (t = "team") => {
    setTab(t);
    setFind("");
    setPicker(true);
  };
  const teamFiltered = team.filter(
    (p) =>
      !findTerm ||
      p.full_name.toLowerCase().includes(findTerm.toLowerCase()) ||
      personSub(p).toLowerCase().includes(findTerm.toLowerCase()),
  );

  return (
    <View style={s.screen}>
      {focused && <StatusBar style="light" />}
      {/* ---------- header ---------- */}
      <View
        style={{
          backgroundColor: C.dark,
          paddingTop: insets.top + 10,
          paddingHorizontal: 18,
          paddingBottom: 18,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -70,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: C.accent,
            opacity: 0.14,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "#fff",
                fontSize: 26,
                fontWeight: "800",
                letterSpacing: -0.5,
              }}
            >
              Chat
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: "#94A3B8", fontSize: 13, marginTop: 2 }}
            >
              {totalUnread
                ? `${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`
                : "You're all caught up"}
            </Text>
          </View>
          <Pressable
            onPress={() => openPicker("team")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 42,
              paddingHorizontal: 14,
              borderRadius: 21,
              backgroundColor: pressed ? C.brand : C.accent,
            })}
            accessibilityLabel="New message"
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13.5 }}>
              New
            </Text>
          </Pressable>
        </View>
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 14,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Ionicons name="search" size={17} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations"
            placeholderTextColor="#94A3B8"
            style={{
              flex: 1,
              color: "#fff",
              paddingVertical: 11,
              paddingHorizontal: 8,
              fontSize: 15,
            }}
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>
      <OfflineBanner />

      {/* ---------- list ---------- */}
      {q.isLoading ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshing={false}
          onRefresh={() => {
            q.refetch();
            people.refetch();
          }}
          ListHeaderComponent={
            !search && team.length ? (
              <View style={{ marginBottom: 6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: C.muted,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    marginBottom: 10,
                    marginLeft: 4,
                  }}
                >
                  Team
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    gap: 14,
                    paddingHorizontal: 4,
                    paddingBottom: 6,
                  }}
                >
                  {team.slice(0, 20).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => dm.mutate(p)}
                      style={({ pressed }) => ({
                        width: 62,
                        alignItems: "center",
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <View>
                        <Avatar name={p.full_name} size={52} />
                        {p.role !== "employee" && (
                          <View
                            style={{
                              position: "absolute",
                              right: -2,
                              bottom: -2,
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              backgroundColor:
                                p.role === "super_admin" ? "#F59E0B" : C.brand,
                              borderWidth: 2,
                              borderColor: C.bg,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons
                              name={
                                p.role === "super_admin"
                                  ? "star"
                                  : "shield-checkmark"
                              }
                              size={10}
                              color="#fff"
                            />
                          </View>
                        )}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: C.text,
                          marginTop: 5,
                        }}
                      >
                        {p.full_name.split(" ")[0]}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => openPicker("customers")}
                    style={({ pressed }) => ({
                      width: 62,
                      alignItems: "center",
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: "#DBEAFE",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="briefcase-outline"
                        size={23}
                        color="#2563EB"
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: C.text,
                        marginTop: 5,
                      }}
                    >
                      Customers
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Empty
              title={search ? "No matches" : "No conversations yet"}
              hint={
                search
                  ? "Try another name."
                  : "Tap a person above or “New” to start."
              }
            />
          }
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: C.muted,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginTop: 8,
                marginBottom: 8,
                marginLeft: 4,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item: c }) => {
            const unread = c.unread > 0;
            return (
              <Pressable
                onPress={() =>
                  nav.navigate("Thread", {
                    id: c.id,
                    title: c.name,
                    type: c.type,
                    phone:
                      c.type === "direct" ? phoneOf(c.other_user_id) : null,
                  })
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: pressed ? "#F8FAFC" : "#fff",
                  borderRadius: 18,
                  padding: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: unread ? "#FECDD3" : C.border,
                })}
              >
                <ChannelIcon c={c} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontWeight: unread ? "800" : "700",
                        color: C.text,
                        fontSize: 15,
                      }}
                      numberOfLines={1}
                    >
                      {c.type === "department" || c.type === "general"
                        ? `# ${c.name}`
                        : c.name}
                    </Text>
                    {c.last_message_at && (
                      <Text
                        style={{
                          fontSize: 11.5,
                          color: unread ? ROSE : C.faint,
                          fontWeight: unread ? "700" : "500",
                        }}
                      >
                        {shortWhen(c.last_message_at)}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 3,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        color: unread ? C.text : C.muted,
                        fontSize: 13.5,
                        fontWeight: unread ? "600" : "400",
                      }}
                      numberOfLines={1}
                    >
                      {c.last_message ??
                        (c.type === "direct"
                          ? "Say hello 👋"
                          : "No messages yet")}
                    </Text>
                    {unread && (
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: 11,
                          paddingHorizontal: 6,
                          backgroundColor: ROSE,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: "800",
                          }}
                        >
                          {c.unread > 99 ? "99+" : c.unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* ---------- new message ---------- */}
      <Sheet open={picker} onClose={() => setPicker(false)} title="New message">
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#F1F5F9",
            borderRadius: 14,
            padding: 4,
            marginBottom: 12,
          }}
        >
          <TabPill
            active={tab === "team"}
            label="Team"
            icon="people"
            onPress={() => setTab("team")}
          />
          <TabPill
            active={tab === "customers"}
            label="Customers"
            icon="briefcase"
            onPress={() => setTab("customers")}
          />
          <TabPill
            active={tab === "leads"}
            label="Leads"
            icon="funnel"
            onPress={() => setTab("leads")}
          />
        </View>
        <View
          style={[
            s.input,
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 4,
              marginBottom: 10,
            },
          ]}
        >
          <Ionicons name="search" size={17} color={C.faint} />
          <Input
            value={find}
            onChangeText={setFind}
            placeholder={
              tab === "team"
                ? "Search people"
                : tab === "customers"
                  ? "Search customers"
                  : "Search leads"
            }
            style={{
              flex: 1,
              borderWidth: 0,
              paddingHorizontal: 0,
              paddingVertical: 6,
              backgroundColor: "transparent",
            }}
          />
        </View>

        {tab === "team" && (
          <>
            <Pressable
              onPress={() => {
                setPicker(false);
                setTimeout(() => setGroup({ name: "", ids: new Set() }), 350);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 10,
                paddingHorizontal: 4,
                borderRadius: 12,
                backgroundColor: pressed ? "#F8FAFC" : "transparent",
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: ROSE_BG,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="people" size={20} color={ROSE} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontWeight: "800",
                  color: ROSE,
                  fontSize: 15,
                }}
              >
                New group
              </Text>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </Pressable>
            {people.isLoading ? (
              <Loading />
            ) : !teamFiltered.length ? (
              <Empty title="Nobody found" />
            ) : (
              teamFiltered.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => dm.mutate(p)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderRadius: 12,
                    backgroundColor: pressed ? "#F8FAFC" : "transparent",
                  })}
                >
                  <Avatar name={p.full_name} size={42} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontWeight: "700", color: C.text, fontSize: 15 }}
                    >
                      {p.full_name}
                    </Text>
                    <Text numberOfLines={1} style={s.muted}>
                      {personSub(p)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color={ROSE}
                  />
                </Pressable>
              ))
            )}
          </>
        )}

        {tab === "customers" && (
          <>
            <Text style={[s.muted, { marginBottom: 10 }]}>
              Customers don't use this app. Send them a message, WhatsApp or
              call.
            </Text>
            {clients.isLoading ? (
              <Loading />
            ) : !(clients.data ?? []).length ? (
              <Empty title="No customers found" />
            ) : (
              (clients.data ?? []).slice(0, 50).map((c) => (
                <ContactRow
                  key={c.id}
                  name={c.name}
                  sub={c.company || c.service_name}
                  phone={c.phone}
                  onOpen={() => {
                    setPicker(false);
                    nav.navigate("More", {
                      screen: "ClientDetail",
                      params: { id: c.id },
                      initial: false,
                    });
                  }}
                />
              ))
            )}
          </>
        )}

        {tab === "leads" && (
          <>
            <Text style={[s.muted, { marginBottom: 10 }]}>
              Send a lead a message, WhatsApp or call.
            </Text>
            {leads.isLoading ? (
              <Loading />
            ) : !(leads.data?.rows ?? []).length ? (
              <Empty title="No leads found" />
            ) : (
              leads.data.rows.map((l) => (
                <ContactRow
                  key={l.id}
                  name={l.name}
                  sub={l.company}
                  phone={l.phone}
                  onOpen={() => {
                    setPicker(false);
                    nav.navigate("Leads", {
                      screen: "LeadDetail",
                      params: { id: l.id },
                      initial: false,
                    });
                  }}
                />
              ))
            )}
          </>
        )}
      </Sheet>

      {/* ---------- new group ---------- */}
      <Sheet open={!!group} onClose={() => setGroup(null)} title="New group">
        {group && (
          <>
            <Field label="Group name">
              <Input
                value={group.name}
                onChangeText={(v) => setGroup((g) => ({ ...g, name: v }))}
                placeholder="e.g. Sales team, Project Alpha"
              />
            </Field>
            <Text style={s.label}>Add people ({group.ids.size} selected)</Text>
            {team.map((p) => {
              const on = group.ids.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    setGroup((g) => {
                      const ids = new Set(g.ids);
                      if (ids.has(p.id)) ids.delete(p.id);
                      else ids.add(p.id);
                      return { ...g, ids };
                    })
                  }
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 9,
                    paddingHorizontal: 4,
                    borderRadius: 12,
                    backgroundColor: pressed ? "#F8FAFC" : "transparent",
                  })}
                >
                  <Avatar name={p.full_name} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontWeight: "700", color: C.text }}
                    >
                      {p.full_name}
                    </Text>
                    <Text numberOfLines={1} style={s.muted}>
                      {personSub(p)}
                    </Text>
                  </View>
                  <Ionicons
                    name={on ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={on ? ROSE : C.faint}
                  />
                </Pressable>
              );
            })}
            <Button
              title={
                group.ids.size
                  ? `Create group (${group.ids.size + 1} people)`
                  : "Create group"
              }
              onPress={() => {
                if (!group.name.trim())
                  return Alert.alert("Give the group a name");
                if (!group.ids.size)
                  return Alert.alert("Add at least one person");
                makeGroup.mutate();
              }}
              loading={makeGroup.isPending}
              style={{ marginTop: 12, backgroundColor: ROSE }}
            />
          </>
        )}
      </Sheet>
    </View>
  );
}

/** Header title for a conversation: icon + name + small subtitle. */
export function ThreadTitle({ title, type }) {
  const { width } = useWindowDimensions();
  const sub =
    type === "direct"
      ? "Direct message"
      : type === "general"
        ? "Everyone in the company"
        : type === "department"
          ? "Department channel"
          : type === "group"
            ? "Group"
            : "";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        maxWidth: width - 160,
      }}
    >
      <ChannelIcon c={{ type, name: title }} size={34} />
      <View style={{ flexShrink: 1 }}>
        <Text
          style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!sub && (
          <Text style={{ fontSize: 11.5, color: "#94A3B8" }}>{sub}</Text>
        )}
      </View>
    </View>
  );
}

// =====================================================================
// One conversation
// =====================================================================
export function ThreadScreen() {
  const { id, type, phone } = useRoute().params;
  const nav = useNavigation();
  const qc = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { profile, isAdmin } = useAuth();

  // direct chat: call button in the top bar
  useEffect(() => {
    if (type !== "direct" || !phone) return;
    nav.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => openUrl(telUri(phone))}
          hitSlop={8}
          accessibilityLabel="Call"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? "#FECDD3" : ROSE_BG,
          })}
        >
          <Ionicons name="call" size={18} color={ROSE} />
        </Pressable>
      ),
    });
  }, [nav, type, phone]);
  const removeMsg = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat_messages", id] });
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
    },
    onError: (e) => Alert.alert("Could not delete", errMsg(e)),
  });
  const q = useQuery({
    queryKey: ["chat_messages", id],
    queryFn: () => getMessages(id),
  });
  const [text, setText] = useState("");

  useEffect(() => {
    const off = onServerChange((p) => {
      if (p.table !== "chat_messages" || p.channel_id !== id) return;
      qc.invalidateQueries({ queryKey: ["chat_messages", id] });
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
      markChannelRead(id);
    });
    markChannelRead(id).then(() => {
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
      qc.invalidateQueries({ queryKey: ["module_counts"] });
    });
    return () => off();
  }, [id, qc]);

  const send = useMutation({
    mutationFn: () => sendMessage(id, text.trim()),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["chat_messages", id] });
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
    },
    onError: (e) => Alert.alert("Could not send", errMsg(e)),
  });

  // newest first (the list is inverted); add a date chip where the day changes
  const rows = useMemo(() => {
    const msgs = q.data ?? [];
    const out = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      const older = msgs[i - 1];
      const newer = msgs[i + 1];
      const sameAsOlder =
        older &&
        older.user_id === m.user_id &&
        new Date(m.created_at) - new Date(older.created_at) < 5 * 60_000 &&
        new Date(older.created_at).toDateString() ===
          new Date(m.created_at).toDateString();
      const sameAsNewer =
        newer &&
        newer.user_id === m.user_id &&
        new Date(newer.created_at) - new Date(m.created_at) < 5 * 60_000 &&
        new Date(newer.created_at).toDateString() ===
          new Date(m.created_at).toDateString();
      out.push({
        kind: "msg",
        m,
        showName: !sameAsOlder,
        showTime: !sameAsNewer,
      });
      if (
        !older ||
        new Date(older.created_at).toDateString() !==
          new Date(m.created_at).toDateString()
      ) {
        out.push({
          kind: "day",
          key: "day-" + m.id,
          label: dayLabel(m.created_at),
        });
      }
    }
    return out;
  }, [q.data]);

  const canSend = !!text.trim() && !send.isPending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F4F6FA" }}
      // Push the message box up by the keyboard's height (Android with SDK 54+ no longer resizes the screen itself).
      // The offset is the height of the bar above this screen.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      {q.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        // Rendered outside the inverted list so the text is never mirrored/flipped.
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 80,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: ROSE_BG,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chatbubbles" size={30} color={ROSE} />
          </View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: C.text,
              marginTop: 12,
            }}
          >
            No messages yet
          </Text>
          <Text style={{ color: C.muted, marginTop: 4 }}>Say hello 👋</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          inverted
          keyboardShouldPersistTaps="handled"
          keyExtractor={(r) => (r.kind === "day" ? r.key : r.m.id)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 14 }}
          renderItem={({ item: r }) => {
            if (r.kind === "day") {
              return (
                <View style={{ alignItems: "center", marginVertical: 10 }}>
                  <View
                    style={{
                      backgroundColor: "#E3E9F0",
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: "700",
                        color: C.muted,
                      }}
                    >
                      {r.label}
                    </Text>
                  </View>
                </View>
              );
            }
            const m = r.m;
            const mine = m.user_id === profile?.id;
            return (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: mine ? "flex-end" : "flex-start",
                  alignItems: "flex-end",
                  marginTop: r.showName ? 10 : 2,
                  gap: 8,
                }}
              >
                {!mine && (
                  <View style={{ width: 30 }}>
                    {r.showTime && (
                      <Avatar name={m.user?.full_name} size={30} />
                    )}
                  </View>
                )}
                <View style={{ maxWidth: "76%" }}>
                  {!mine && r.showName && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: C.muted,
                        marginBottom: 3,
                        marginLeft: 4,
                        fontWeight: "700",
                      }}
                    >
                      {m.user?.full_name}
                    </Text>
                  )}
                  <Pressable
                    delayLongPress={350}
                    onLongPress={() =>
                      (mine || isAdmin) &&
                      Alert.alert(
                        "Delete this message?",
                        m.body.length > 80 ? m.body.slice(0, 80) + "…" : m.body,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => removeMsg.mutate(m.id),
                          },
                        ],
                      )
                    }
                    style={{
                      backgroundColor: mine ? C.brand : "#fff",
                      borderRadius: 18,
                      borderBottomRightRadius: mine && r.showTime ? 6 : 18,
                      borderBottomLeftRadius: !mine && r.showTime ? 6 : 18,
                      paddingHorizontal: 13,
                      paddingVertical: 9,
                      borderWidth: mine ? 0 : 1,
                      borderColor: C.border,
                      shadowColor: C.dark,
                      shadowOpacity: mine ? 0.12 : 0.04,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: mine ? 2 : 1,
                    }}
                  >
                    {m.lead && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: mine
                            ? "rgba(255,255,255,0.2)"
                            : C.brandLight,
                          borderRadius: 8,
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          marginBottom: 5,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Ionicons
                          name="link"
                          size={12}
                          color={mine ? "#fff" : C.brand}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "800",
                            color: mine ? "#fff" : C.brand,
                          }}
                        >
                          {m.lead.name}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{
                        color: mine ? "#fff" : C.text,
                        fontSize: 15,
                        lineHeight: 20,
                      }}
                    >
                      {m.body}
                    </Text>
                  </Pressable>
                  {r.showTime && (
                    <Text
                      style={{
                        fontSize: 10.5,
                        color: C.faint,
                        marginTop: 3,
                        marginHorizontal: 4,
                        textAlign: mine ? "right" : "left",
                      }}
                    >
                      {timeOf(m.created_at)}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ---------- composer ---------- */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 8 + (Platform.OS === "ios" ? insets.bottom : 0),
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: C.border,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#F1F5F9",
            borderRadius: 22,
            paddingHorizontal: 14,
            minHeight: 44,
            justifyContent: "center",
          }}
        >
          <TextInput
            style={{
              fontSize: 15,
              color: C.text,
              maxHeight: 120,
              paddingVertical: Platform.OS === "ios" ? 11 : 8,
            }}
            value={text}
            onChangeText={setText}
            placeholder="Write a message…"
            placeholderTextColor={C.faint}
            maxLength={4000}
            multiline
          />
        </View>
        <Pressable
          onPress={() => canSend && send.mutate()}
          disabled={!canSend}
          accessibilityLabel="Send"
          style={({ pressed }) => ({
            backgroundColor: canSend
              ? pressed
                ? "#086B64"
                : C.brand
              : "#9FD3CF",
            borderRadius: 22,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Ionicons
            name="send"
            size={18}
            color="#fff"
            style={{ marginLeft: 2 }}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
