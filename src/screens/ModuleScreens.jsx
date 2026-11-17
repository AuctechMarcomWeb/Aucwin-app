// Reminders, Meetings, To-Do, Notes — the smaller module screens.
import { useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  createNote,
  createTodo,
  deleteFollowUp,
  deleteNote,
  deleteTodo,
  getFollowUps,
  getNotes,
  getTodos,
  updateNote,
  updateTodo,
} from "@/lib/api";
import { errMsg } from "@/lib/http";
import { cancelLocalReminder } from "@/lib/notifications";
import { MODULES, NOTE_BG } from "@/lib/modules";
import { NOTE_COLORS } from "@/lib/types";
import {
  Button,
  C,
  Card,
  Chip,
  Empty,
  ErrorBox,
  IconButton,
  Loading,
  Sheet,
  fmtDateTime,
  fmtRelative,
  isOverdue,
  s,
  toneOf,
  useDebounced,
  useRevealInput,
} from "@/components/ui";
import { FollowUpForm } from "@/components/forms";
import { CompleteFollowUpSheet } from "@/components/panels";
import { OfflineBanner } from "@/components/OfflineBanner";

const mod = (k) => MODULES.find((m) => m.key === k);

function Fab({ color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        right: 18,
        bottom: 22,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name="add" size={30} color="#fff" />
    </Pressable>
  );
}

// ---------------- Reminders / Meetings ----------------
export function RemindersScreen() {
  return <Scheduled type="reminder" moduleKey="reminders" />;
}
export function MeetingsScreen() {
  return <Scheduled type="meeting" moduleKey="meetings" />;
}
function Scheduled({ type, moduleKey }) {
  const qc = useQueryClient();
  const nav = useNavigation();
  const m = mod(moduleKey);
  const [tab, setTab] = useState("upcoming");
  const q = useQuery({
    queryKey: ["follow_ups", "scheduled", type],
    queryFn: () => getFollowUps({ type }),
  });
  const [modal, setModal] = useState(null);
  const [complete, setComplete] = useState(null);
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["follow_ups"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["module_counts"] });
  };
  const del = useMutation({
    mutationFn: async (id) => {
      await deleteFollowUp(id);
      await cancelLocalReminder(id);
    },
    onSuccess: inval,
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const rows = (q.data ?? []).filter((f) =>
    tab === "upcoming" ? f.status === "pending" : f.status !== "pending",
  );
  return (
    <View style={s.screen}>
      <OfflineBanner />
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          padding: 12,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <Chip
          active={tab === "upcoming"}
          label="Upcoming"
          onPress={() => setTab("upcoming")}
        />
        <Chip
          active={tab === "past"}
          label="Done & past"
          onPress={() => setTab("past")}
        />
      </View>
      {q.isLoading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <Empty
              title={`No ${tab === "upcoming" ? "upcoming" : "past"} ${type}s`}
              hint={
                type === "reminder"
                  ? "Reminders ping this phone 10 minutes before."
                  : "Add a meeting with place and video link."
              }
            />
          }
          renderItem={({ item: f }) => {
            const late = f.status === "pending" && isOverdue(f.due_at);
            const d = new Date(f.due_at);
            const time = fmtDateTime(f.due_at).split("· ")[1];
            const end = f.ends_at ? fmtDateTime(f.ends_at).split("· ")[1] : null;
            const openParent = () =>
              nav.navigate(
                f.lead_id ? "Leads" : "More",
                f.lead_id
                  ? { screen: "LeadDetail", params: { id: f.lead_id }, initial: false }
                  : { screen: "ClientDetail", params: { id: f.client_id }, initial: false },
              );
            return (
              <Card style={{ paddingVertical: 12, opacity: f.status === "pending" ? 1 : 0.65, flexDirection: "row", gap: 12 }}>
                {/* date block */}
                <View style={{ width: 54, borderRadius: 14, backgroundColor: late ? "#FFEDD5" : m.bg, alignItems: "center", justifyContent: "center", paddingVertical: 8, alignSelf: "flex-start" }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "800", color: late ? C.danger : m.color, textTransform: "uppercase" }}>
                    {d.toLocaleDateString("en-GB", { month: "short" })}
                  </Text>
                  <Text style={{ fontSize: 21, fontWeight: "800", color: C.text, lineHeight: 25 }}>{d.getDate()}</Text>
                  <Text style={{ fontSize: 10.5, fontWeight: "700", color: C.muted }}>{d.toLocaleDateString("en-GB", { weekday: "short" })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 5, paddingTop: 7 }}>
                      <Ionicons name={late ? "alert-circle" : "time-outline"} size={13} color={late ? C.danger : m.color} />
                      <Text style={{ flex: 1, flexWrap: "wrap", fontSize: 12.5, fontWeight: "800", color: late ? C.danger : m.color }}>
                        {time}{end ? ` – ${end}` : ""}{late ? " · late" : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginRight: -6, marginTop: 2, marginBottom: 4 }}>
                    {f.status === "pending" && <IconButton icon="checkmark-circle" color={C.success} onPress={() => setComplete(f)} />}
                    <IconButton icon="create-outline" onPress={() => setModal(f)} />
                    <IconButton icon="trash-outline" color={C.danger} onPress={() => Alert.alert("Delete?", f.title, [
                      { text: "Cancel" },
                      { text: "Delete", style: "destructive", onPress: () => del.mutate(f.id) },
                    ])} />
                  </View>
                  <Text style={{ fontWeight: "800", color: C.text, fontSize: 15, textDecorationLine: f.status === "done" ? "line-through" : "none" }}>{f.title}</Text>
                  {(f.lead || f.client) && (
                    <Pressable onPress={openParent} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Ionicons name="person-circle-outline" size={15} color={C.brand} />
                      <Text style={{ color: C.brand, fontWeight: "700", fontSize: 13 }}>{f.lead?.name ?? f.client?.name}</Text>
                    </Pressable>
                  )}
                  {f.location ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Ionicons name="location-outline" size={14} color={C.muted} />
                      <Text style={s.muted}>{f.location}</Text>
                    </View>
                  ) : null}
                  {f.meeting_link ? (
                    <Pressable onPress={() => Linking.openURL(f.meeting_link)} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, backgroundColor: "#E0F2FE", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Ionicons name="videocam" size={14} color="#0369A1" />
                      <Text style={{ color: "#0369A1", fontWeight: "800", fontSize: 12.5 }}>Join video call</Text>
                    </Pressable>
                  ) : null}
                  {f.notes ? <Text style={{ color: "#334155", fontSize: 13, marginTop: 6 }}>{f.notes}</Text> : null}
                  {f.outcome ? (
                    <Text style={{ color: "#334155", fontSize: 13, marginTop: 6, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 8 }}>{f.outcome}</Text>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}
      <Fab color={m.color} onPress={() => setModal("new")} />
      <Sheet
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? `New ${type}` : "Edit"}
      >
        {modal && (
          <FollowUpForm
            followUp={modal === "new" ? undefined : modal}
            fixedType={type}
            onDone={() => {
              setModal(null);
              inval();
            }}
          />
        )}
      </Sheet>
      <CompleteFollowUpSheet
        followUp={complete}
        onClose={() => setComplete(null)}
        onDone={inval}
      />
    </View>
  );
}

// ---------------- To-do ----------------
const PRIO = {
  low: { label: "Low", fg: "#64748B", bg: "#EEF2F6" },
  medium: { label: "Medium", fg: "#B7791F", bg: "#FEF3C7" },
  high: { label: "High", fg: "#C2410C", bg: "#FFEDD5" },
};
const atHour = (days, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};
export function TodoScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["todos"], queryFn: getTodos });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState(null); // "today" | "tomorrow" | null
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["todos"] });
    qc.invalidateQueries({ queryKey: ["module_counts"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  };
  const add = useMutation({
    mutationFn: () =>
      createTodo({
        title: title.trim(),
        priority,
        due_at: due === "today" ? atHour(0, Math.min(Math.max(new Date().getHours() + 1, 18), 23)).toISOString() : due === "tomorrow" ? atHour(1, 10).toISOString() : null,
        position: q.data?.length ?? 0,
      }),
    onSuccess: () => {
      setTitle("");
      setDue(null);
      setPriority("medium");
      inval();
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const toggle = useMutation({
    mutationFn: (t) => updateTodo(t.id, { done: !t.done }),
    onSuccess: inval,
  });
  const del = useMutation({ mutationFn: deleteTodo, onSuccess: inval });
  const rows = [...(q.data ?? [])].sort((a, b) => Number(a.done) - Number(b.done));
  const doneN = rows.filter((t) => t.done).length;
  const pct = rows.length ? Math.round((doneN / rows.length) * 100) : 0;
  const QuickChip = ({ on, label, onPress, fg = C.brand, bg = C.brandLight }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? bg : "#fff", borderWidth: 1, borderColor: on ? fg : C.border }}>
      <Text style={{ fontSize: 12.5, fontWeight: on ? "800" : "600", color: on ? fg : C.muted }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={s.screen}>
      <OfflineBanner />
      <View style={{ padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 }}>
        <View style={s.row}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="What do you need to do?"
            placeholderTextColor={C.faint}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={() => title.trim() && add.mutate()}
            returnKeyType="done"
          />
          <Pressable
            onPress={() => title.trim() && add.mutate()}
            accessibilityLabel="Add to-do"
            style={({ pressed }) => ({ backgroundColor: title.trim() ? C.brand : "#9FD3CF", borderRadius: 12, padding: 11, opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <QuickChip on={due === "today"} label="Today" onPress={() => setDue(due === "today" ? null : "today")} />
          <QuickChip on={due === "tomorrow"} label="Tomorrow" onPress={() => setDue(due === "tomorrow" ? null : "tomorrow")} />
          <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 2 }} />
          {Object.entries(PRIO).map(([k, p]) => (
            <QuickChip key={k} on={priority === k} label={p.label} fg={p.fg} bg={p.bg} onPress={() => setPriority(k)} />
          ))}
        </View>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={
            rows.length ? (
              <View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 14 }]}>
                <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 5, borderColor: pct ? C.accent : "#E4E9F0", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: C.text }}>{pct}%</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: C.text }}>
                    {doneN} of {rows.length} done
                  </Text>
                  <Text style={s.muted}>{rows.length - doneN ? `${rows.length - doneN} left to do` : "All done — great work! 🎉"}</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={<Empty title="Your list is empty" hint="Only you can see this list. Items with a date also show on your calendar." icon="list-outline" />}
          renderItem={({ item: t }) => {
            const p = PRIO[t.priority] ?? PRIO.medium;
            const late = !t.done && isOverdue(t.due_at);
            return (
              <View style={[s.card, { paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: t.done ? 0.6 : 1 }]}>
                <Pressable onPress={() => toggle.mutate(t)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: t.done }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.done ? C.brand : "#CBD5E1", backgroundColor: t.done ? C.brand : "#fff", alignItems: "center", justifyContent: "center" }}>
                    {t.done && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </View>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: t.done ? C.faint : C.text, textDecorationLine: t.done ? "line-through" : "none" }}>{t.title}</Text>
                  {t.due_at && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <Ionicons name={late ? "alert-circle" : "calendar-outline"} size={12} color={late ? C.danger : C.muted} />
                      <Text style={[s.muted, { fontSize: 12.5 }, late ? { color: C.danger, fontWeight: "700" } : null]}>
                        {late ? "Late · " : ""}
                        {fmtDateTime(t.due_at)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ backgroundColor: p.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name="flag" size={11} color={p.fg} />
                  <Text style={{ fontSize: 11.5, fontWeight: "800", color: p.fg }}>{p.label}</Text>
                </View>
                <IconButton icon="trash-outline" color={C.faint} onPress={() => del.mutate(t.id)} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ---------------- Notes ----------------
export function NotesScreen() {
  const qc = useQueryClient();
  const m = mod("notes");
  const { width } = useWindowDimensions();
  const cardW = (width - 24 - 10) / 2; // two equal columns on every screen size
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());
  const q = useQuery({
    queryKey: ["notes", term],
    queryFn: () => getNotes({ search: term }),
    placeholderData: (p) => p,
  });
  const [editing, setEditing] = useState(null);
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["notes"] });
    qc.invalidateQueries({ queryKey: ["module_counts"] });
  };
  return (
    <View style={s.screen}>
      <OfflineBanner />
      <View
        style={{
          padding: 12,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <View style={[s.input, s.row, { paddingVertical: 6 }]}>
          <Ionicons name="search" size={18} color={C.faint} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: C.text }}
            placeholder="Search notes…"
            placeholderTextColor={C.faint}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(n) => n.id}
          numColumns={2}
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 12, paddingBottom: 90, gap: 10 }}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<Empty title="No notes yet" />}
          renderItem={({ item: n }) => {
            const [bg, fg] = NOTE_BG[n.color] ?? NOTE_BG.yellow;
            return (
              <Pressable
                onPress={() => setEditing(n)}
                style={({ pressed }) => ({
                  width: cardW,
                  backgroundColor: bg,
                  borderRadius: 16,
                  padding: 12,
                  opacity: pressed ? 0.8 : 1,
                  minHeight: 110,
                })}
              >
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Text
                    style={{ fontWeight: "800", color: fg, flex: 1 }}
                    numberOfLines={2}
                  >
                    {n.title || "Untitled"}
                  </Text>
                  {n.pinned && <Ionicons name="pin" size={14} color={fg} />}
                </View>
                {n.body ? (
                  <Text
                    style={{ color: "#334155", fontSize: 13, marginTop: 4 }}
                    numberOfLines={6}
                  >
                    {n.body}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 10, color: "#64748B", marginTop: 6 }}>
                  {n.lead?.name ?? n.client?.name ?? n.owner?.full_name} ·{" "}
                  {fmtRelative(n.updated_at)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
      <Fab color={m.color} onPress={() => setEditing("new")} />
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New note" : "Edit note"}
      >
        {editing && (
          <NoteEditor
            note={editing === "new" ? undefined : editing}
            onDone={() => {
              setEditing(null);
              inval();
            }}
          />
        )}
      </Sheet>
    </View>
  );
}
export function NoteEditor({ note, leadId, clientId, onDone }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [color, setColor] = useState(note?.color ?? "yellow");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const reveal = useRevealInput();
  const save = useMutation({
    mutationFn: () =>
      note
        ? updateNote(note.id, { title, body, color, pinned })
        : createNote({
            title,
            body,
            color,
            pinned,
            lead_id: leadId ?? null,
            client_id: clientId ?? null,
          }),
    onSuccess: onDone,
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const del = useMutation({
    mutationFn: () => deleteNote(note.id),
    onSuccess: onDone,
  });
  return (
    <View
      style={{
        backgroundColor: NOTE_BG[color][0],
        borderRadius: 16,
        padding: 14,
        margin: -4,
      }}
    >
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor="#94A3B8"
        onFocus={() => reveal?.()}
        style={{ fontSize: 19, fontWeight: "800", color: C.text, paddingVertical: 6 }}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write your note…"
        placeholderTextColor="#94A3B8"
        multiline
        onFocus={() => reveal?.()}
        onContentSizeChange={() => reveal?.()}
        style={{
          fontSize: 15,
          color: "#1E293B",
          minHeight: 140,
          // long notes scroll inside the box, so the text never hides under the keyboard
          maxHeight: 240,
          textAlignVertical: "top",
          marginTop: 6,
        }}
      />
      <View style={[s.row, { marginTop: 10, justifyContent: "space-between" }]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
          {NOTE_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              hitSlop={6}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: NOTE_BG[c][1],
                borderWidth: color === c ? 3 : 0,
                borderColor: C.text,
              }}
            />
          ))}
        </View>
        <Pressable onPress={() => setPinned(!pinned)} hitSlop={8} style={[s.row, { gap: 4 }]}>
          <Ionicons
            name={pinned ? "pin" : "pin-outline"}
            size={18}
            color={C.text}
          />
          <Text style={{ fontSize: 13 }}>Pin</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        {note && (
          <Button
            title="Delete"
            variant="secondary"
            onPress={() =>
              Alert.alert("Delete note?", undefined, [
                { text: "Cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => del.mutate(),
                },
              ])
            }
          />
        )}
        <Button
          title={note ? "Save" : "Add note"}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!title.trim() && !body.trim()}
          style={{ flex: 1, backgroundColor: "#9333EA" }}
        />
      </View>
    </View>
  );
}
