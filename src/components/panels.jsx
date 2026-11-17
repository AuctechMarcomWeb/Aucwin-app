import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { label } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  addActivity,
  deleteDocument,
  deleteFollowUp,
  deleteTask,
  getActivities,
  getDocuments,
  getDocumentUrl,
  getFollowUps,
  getPayments,
  getTasks,
  updateFollowUp,
  updateTask,
  uploadDocument,
} from "@/lib/api";
import { errMsg } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { cancelLocalReminder } from "@/lib/notifications";
import {
  Badge,
  Button,
  C,
  Card,
  Empty,
  Field,
  IconButton,
  Input,
  Loading,
  SectionTitle,
  Sheet,
  fmtDate,
  fmtDateTime,
  fmtRelative,
  isOverdue,
  money,
  s,
  shadow,
} from "./ui";
import { DateTimeField, FollowUpForm, TaskForm } from "./forms";

const kindOf = (p) => (p.client_id ? "client" : "lead");
/** Icon + colours for each kind of history entry / follow-up. */
const ACT = {
  note: ["document-text", "#7C3AED", "#EDE9FE"],
  call: ["call", "#DB2777", "#FCE7F3"],
  email: ["mail", "#2563EB", "#DBEAFE"],
  meeting: ["people", "#EA580C", "#FFEDD5"],
  whatsapp: ["logo-whatsapp", "#16A34A", "#DCFCE7"],
  reminder: ["notifications", "#D97706", "#FEF3C7"],
  status_change: ["swap-horizontal", "#0B857D", "#E6F7F5"],
  assignment: ["person-add", "#0F2F58", "#E3EAF4"],
  document: ["attach", "#475569", "#EEF2F6"],
  payment: ["cash", "#16A34A", "#DCFCE7"],
  created: ["add", "#0B857D", "#E6F7F5"],
  converted: ["checkmark-done", "#16A34A", "#DCFCE7"],
  system: ["information-circle", "#64748B", "#EEF2F6"],
};
/** White box that groups list rows (instead of one card per row). */
function ListBox({ children }) {
  return <View style={{ backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, marginBottom: 10, ...shadow }}>{children}</View>;
}
const idOf = (p) => p.client_id ?? p.lead_id;

// ---------------- Notes / history ----------------
/** "Uploaded 3f9c2e1a-77b0-….jpeg" -> "Uploaded a photo" (old uploads saved the phone's random file name). */
function cleanTitle(a) {
  const m = /^Uploaded (.+)$/.exec(a.title || "");
  if (a.type === "status_change") {
    const from = a.metadata?.from;
    const to = a.metadata?.to;
    const match = /^Status changed from (.+?) to (.+)$/i.exec(a.title || "");
    return `Status changed from ${label(from ?? match?.[1] ?? "unknown")} to ${label(to ?? match?.[2] ?? "unknown")}`;
  }
  if (!m) return a.title;
  const name = m[1];
  const base = name.replace(/\.[^.]+$/, "");
  const ext = (name.split(".").pop() || "").toLowerCase();
  const random = /^[0-9a-f-]{16,}$/i.test(base) || /^(ImagePicker|rn_image_picker|image_\d{10,}|photo_\d{10,}|file_\d{10,})/i.test(base) || /^[A-Za-z0-9_-]{28,}$/.test(base);
  if (!random) return a.title;
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "Uploaded a photo";
  if (["mp4", "mov", "3gp", "mkv"].includes(ext)) return "Uploaded a video";
  return "Uploaded a file";
}
export function ActivityPanel(parent) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["activities", parent],
    queryFn: () => getActivities(parent),
    refetchInterval: 5000,
    refetchOnMount: "always",
  });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("note");
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: () =>
      addActivity({
        ...parent,
        type,
        title: `${type[0].toUpperCase()}${type.slice(1)} logged`,
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      setBody("");
      setOpen(false);
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  return (
    <View>
      <SectionTitle
        title="History & activity"
        icon="time"
        color="#0B857D"
        bg="#E6F7F5"
        count={q.data?.length ?? 0}
        action="+ Add note"
        onAction={() => setOpen(true)}
      />
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card>
          <Empty title="No history yet" hint="Log your first call or note." icon="time-outline" />
        </Card>
      ) : (
        <ListBox>
          {q.data.slice(0, 30).map((a, i, arr) => {
            const [icon, fg, bg] = ACT[a.type] ?? ACT.system;
            const last = i === arr.length - 1;
            return (
              <View key={a.id} style={{ flexDirection: "row", gap: 12, paddingTop: 12 }}>
                <View style={{ alignItems: "center" }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={icon} size={15} color={fg} />
                  </View>
                  {!last && <View style={{ flex: 1, width: 2, backgroundColor: "#EEF2F6", marginTop: 4 }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Text style={{ flex: 1, fontWeight: "700", color: C.text, fontSize: 14 }} >
                      {cleanTitle(a)}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{fmtRelative(a.created_at)}</Text>
                  </View>
                  {a.body ? (
                    <Text style={{ color: "#334155", marginTop: 6, fontSize: 13.5, lineHeight: 19, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 9 }}>
                      {a.body}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>by {a.user?.full_name ?? "System"}</Text>
                </View>
              </View>
            );
          })}
        </ListBox>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Add to history">
        <Field label="Type">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {["note", "call", "email", "meeting"].map((t) => {
              const [icon, fg, bg] = ACT[t];
              const on = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[s.chip, { flexDirection: "row", alignItems: "center", gap: 6 }, on && { backgroundColor: bg, borderColor: fg }]}
                >
                  <Ionicons name={icon} size={14} color={on ? fg : C.faint} />
                  <Text style={[s.chipText, on && { color: fg, fontWeight: "800" }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <Field label="Notes">
          <Input
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="What happened? What was agreed?"
            autoFocus
          />
        </Field>
        <Button
          title="Save"
          onPress={() => add.mutate()}
          loading={add.isPending}
          disabled={!body.trim()}
        />
      </Sheet>
    </View>
  );
}

// ---------------- Follow-ups ----------------
export function FollowUpsPanel(parent) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["follow_ups", parent],
    queryFn: () => getFollowUps(parent),
  });
  const [modal, setModal] = useState(null);
  const [complete, setComplete] = useState(null);
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["follow_ups"] });
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };
  const del = useMutation({
    mutationFn: async (id) => {
      await deleteFollowUp(id);
      await cancelLocalReminder(id);
    },
    onSuccess: inval,
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  return (
    <View>
      <SectionTitle
        title="Follow-ups"
        icon="calendar"
        color="#EA580C"
        bg="#FFEDD5"
        count={(q.data ?? []).filter((f) => f.status === "pending").length}
        action="+ Schedule"
        onAction={() => setModal("new")}
      />
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card>
          <Empty title="No follow-ups yet" hint="Plan the next call or meeting so it isn't forgotten." icon="calendar-outline" />
        </Card>
      ) : (
        q.data.map((f) => {
          const late = f.status === "pending" && isOverdue(f.due_at);
          const [ficon, ffg, fbg] = ACT[f.type] ?? ACT.reminder;
          return (
            <Card
              key={f.id}
              style={{
                paddingVertical: 12,
                opacity: f.status === "pending" ? 1 : 0.6,
                flexDirection: "row",
                gap: 12,
                borderLeftWidth: 4,
                borderLeftColor: late ? "#EA580C" : ffg,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: fbg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={ficon} size={18} color={ffg} />
              </View>
              <View style={{ flex: 1 }}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Badge value={f.type} />
                <View style={{ flexDirection: "row" }}>
                  {f.status === "pending" && (
                    <IconButton
                      icon="checkmark-circle"
                      color={C.success}
                      onPress={() => setComplete(f)}
                    />
                  )}
                  <IconButton
                    icon="create-outline"
                    onPress={() => setModal(f)}
                  />
                  <IconButton
                    icon="trash-outline"
                    color={C.danger}
                    onPress={() =>
                      Alert.alert("Delete follow-up?", f.title, [
                        { text: "Cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => del.mutate(f.id),
                        },
                      ])
                    }
                  />
                </View>
              </View>
              <Text style={{ fontWeight: "700", color: C.text, fontSize: 14.5, textDecorationLine: f.status === "pending" ? "none" : "line-through" }}>
                {f.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                <Ionicons name={late ? "alert-circle" : f.status === "pending" ? "time-outline" : "checkmark-circle"} size={13} color={late ? C.danger : f.status === "pending" ? C.muted : C.success} />
                <Text style={{ fontSize: 12.5, color: late ? C.danger : C.muted, fontWeight: late ? "800" : "500" }}>
                  {fmtDateTime(f.due_at)}
                  {late ? " · late" : ""}
                  {f.status !== "pending" ? ` · ${f.status}` : ""}
                </Text>
              </View>
              {f.outcome ? (
                <Text style={{ fontSize: 13, color: "#334155", marginTop: 6, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 8 }}>
                  {f.outcome}
                </Text>
              ) : null}
              </View>
            </Card>
          );
        })
      )}
      <Sheet
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? "Schedule follow-up" : "Edit follow-up"}
      >
        {modal && (
          <FollowUpForm
            followUp={modal === "new" ? undefined : modal}
            leadId={parent.lead_id}
            clientId={parent.client_id}
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

export function CompleteFollowUpSheet({ followUp, onClose, onDone }) {
  const [outcome, setOutcome] = useState("");
  const [next, setNext] = useState(null);
  // start empty every time a different follow-up is opened
  useEffect(() => {
    setOutcome("");
    setNext(null);
  }, [followUp?.id]);
  const m = useMutation({
    mutationFn: async () => {
      if (!followUp) return;
      await updateFollowUp(followUp.id, { status: "done", outcome });
      await cancelLocalReminder(followUp.id);
      if (next) {
        const { createFollowUp } = await import("@/lib/api");
        const { scheduleLocalReminder } = await import("@/lib/notifications");
        const nf = await createFollowUp({
          title: `Follow-up: ${followUp.title}`,
          type: followUp.type,
          due_at: next.toISOString(),
          lead_id: followUp.lead_id,
          client_id: followUp.client_id,
          assigned_to: followUp.assigned_to,
        });
        await scheduleLocalReminder(nf).catch(() => {});
      }
    },
    onSuccess: () => {
      setOutcome("");
      setNext(null);
      onDone();
      onClose();
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  return (
    <Sheet open={!!followUp} onClose={onClose} title="Complete follow-up">
      <Field label="Call / meeting notes & outcome">
        <Input
          value={outcome}
          onChangeText={setOutcome}
          multiline
          placeholder="What happened? What was agreed?"
        />
      </Field>
      <DateTimeField
        label="Next follow-up (optional)"
        value={next}
        onChange={setNext}
        optional
      />
      <Button
        title="Mark as done"
        onPress={() => m.mutate()}
        loading={m.isPending}
      />
    </Sheet>
  );
}

// ---------------- Tasks ----------------
export function TasksPanel(parent) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tasks", parent],
    queryFn: () => getTasks(parent),
  });
  const [modal, setModal] = useState(null);
  const inval = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const toggle = useMutation({
    mutationFn: (t) =>
      updateTask(t.id, {
        status: t.status === "done" ? "todo" : "done",
        completed_at: null,
      }),
    onSuccess: inval,
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const del = useMutation({
    mutationFn: deleteTask,
    onSuccess: inval,
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  return (
    <View>
      <SectionTitle
        title="Tasks"
        icon="checkbox"
        color="#7C3AED"
        bg="#EDE9FE"
        count={(q.data ?? []).filter((t) => t.status !== "done").length}
        action="+ Add"
        onAction={() => setModal("new")}
      />
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card>
          <Empty title="No tasks yet" hint="Add things that need doing, like sending a quote." icon="checkbox-outline" />
        </Card>
      ) : (
        q.data.map((t) => (
          <Card key={t.id} style={{ paddingVertical: 11 }}>
            <View style={s.row}>
              <Pressable onPress={() => toggle.mutate(t)} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: t.status === "done" }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.status === "done" ? C.brand : "#CBD5E1", backgroundColor: t.status === "done" ? C.brand : "#fff", alignItems: "center", justifyContent: "center" }}>
                  {t.status === "done" && <Ionicons name="checkmark" size={15} color="#fff" />}
                </View>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => setModal(t)}>
                <Text
                  style={{
                    fontWeight: "600",
                    color: t.status === "done" ? C.faint : C.text,
                    textDecorationLine:
                      t.status === "done" ? "line-through" : "none",
                  }}
                >
                  {t.title}
                </Text>
                <Text style={s.muted}>
                  {t.due_at ? fmtDateTime(t.due_at) : "No due date"}
                  {t.assignee ? ` · ${t.assignee.full_name}` : ""}
                </Text>
              </Pressable>
              <Badge value={t.priority} />
              <IconButton
                icon="trash-outline"
                color={C.danger}
                onPress={() =>
                  Alert.alert("Delete task?", t.title, [
                    { text: "Cancel" },
                    { text: "Delete", style: "destructive", onPress: () => del.mutate(t.id) },
                  ])
                }
              />
            </View>
          </Card>
        ))
      )}
      <Sheet
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? "New task" : "Edit task"}
      >
        {modal && (
          <TaskForm
            task={modal === "new" ? undefined : modal}
            leadId={parent.lead_id}
            clientId={parent.client_id}
            onDone={() => {
              setModal(null);
              inval();
            }}
          />
        )}
      </Sheet>
    </View>
  );
}

// ---------------- Documents (camera / gallery / files) ----------------
const SOURCES = [
  { key: "camera", icon: "camera", title: "Camera", sub: "Take a photo", color: "#0284C7", bg: "#E0F2FE" },
  { key: "gallery", icon: "images", title: "Gallery", sub: "Photos & videos", color: "#7C3AED", bg: "#EDE9FE" },
  { key: "files", icon: "document-attach", title: "Files", sub: "PDF, Word, Excel…", color: "#D97706", bg: "#FEF3C7" },
];
const kindOfFile = (mime, name) => {
  const ext = String(name || "").split(".").pop().toLowerCase();
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (mime?.startsWith("video/") || ["mp4", "mov", "3gp", "mkv"].includes(ext)) return "video";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  return "file";
};
const FILE_STYLE = {
  image: ["image", "#7C3AED", "#EDE9FE"],
  video: ["play", "#fff", "#1E293B"],
  pdf: ["document-text", "#DC2626", "#FEE2E2"],
  file: ["document", "#0284C7", "#E0F2FE"],
};
const sizeText = (b) => (!b ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const stamp = () => format(new Date(), "d MMM, h.mm a");
/** Turn camera names like "3f9c2e1a-77b0-4c1d-….jpeg" into "Photo 24 Oct, 3.45 PM". */
function niceName(d) {
  const name = d.name || "File";
  const base = name.replace(/\.[^.]+$/, "");
  const random = /^[0-9a-f-]{16,}$/i.test(base) || /^(ImagePicker|rn_image_picker|image_\d{10,}|photo_\d{10,}|file_\d{10,})/i.test(base) || /^[A-Za-z0-9_-]{28,}$/.test(base);
  const k = kindOfFile(d.mime_type, name);
  if (!random) return k === "image" || k === "video" ? base : name; // photos: no ".jpg" at the end
  return `${k === "video" ? "Video" : k === "image" ? "Photo" : "File"} ${format(new Date(d.created_at), "d MMM, h.mm a")}`;
}
/** Short-lived link to view a document (refreshed automatically before it expires). */
function useDocUrl(id, enabled = true) {
  return useQuery({
    queryKey: ["doc_url", id],
    queryFn: () => getDocumentUrl(id),
    enabled,
    staleTime: 8 * 60_000,
    gcTime: 9 * 60_000,
    refetchInterval: 8 * 60_000,
  });
}

/** One square tile: real picture for photos, icon for other files. */
function DocTile({ d, size, onPress, onEdit, onDelete, canManage }) {
  const k = kindOfFile(d.mime_type, d.name);
  const url = useDocUrl(d.id, k === "image");
  const [failed, setFailed] = useState(false);
  const [icon, fg, bg] = FILE_STYLE[k];
  const ext = (d.name.split(".").pop() || "").slice(0, 4).toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ width: size, opacity: pressed ? 0.75 : 1 })}
    >
      <View style={{ width: size, height: size, borderRadius: 16, overflow: "hidden", backgroundColor: k === "image" ? "#E2E8F0" : bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
        {k === "image" && url.data && !failed ? (
          <Image
            source={{ uri: url.data }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            resizeMethod="resize"
            onError={() => setFailed(true)}
          />
        ) : k === "image" && !failed ? (
          <ActivityIndicator color="#7C3AED" />
        ) : (
          <>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: k === "video" ? "rgba(255,255,255,0.15)" : "#fff" }}>
              <Ionicons name={failed ? "image-outline" : icon} size={22} color={k === "video" ? "#fff" : fg} />
            </View>
            {!!ext && k !== "video" && (
              <Text style={{ marginTop: 6, fontSize: 11, fontWeight: "800", color: fg }}>{ext}</Text>
            )}
          </>
        )}
      </View>
      {canManage && (
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 5 }}>
          <Pressable accessibilityLabel={`Replace ${niceName(d)}`} onPress={onEdit} hitSlop={8} style={{ padding: 5, flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="create-outline" size={16} color={C.brand} />
            <Text style={{ color: C.brand, fontSize: 11, fontWeight: "700" }}>Edit</Text>
          </Pressable>
          <Pressable accessibilityLabel={`Delete ${niceName(d)}`} onPress={onDelete} hitSlop={8} style={{ padding: 5, flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="trash-outline" size={16} color={C.danger} />
            <Text style={{ color: C.danger, fontSize: 11, fontWeight: "700" }}>Delete</Text>
          </Pressable>
        </View>
      )}
      <Text numberOfLines={1} ellipsizeMode="middle" style={{ fontSize: 11.5, fontWeight: "600", color: C.text, marginTop: 5 }}>
        {niceName(d)}
      </Text>
    </Pressable>
  );
}

/** Full-screen photo viewer. */
function PhotoViewer({ doc, canDelete, onDelete, onClose }) {
  const insets = useSafeAreaInsets();
  const url = useDocUrl(doc?.id, !!doc);
  const [loading, setLoading] = useState(true);
  if (!doc) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" }}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} ellipsizeMode="middle" style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{niceName(doc)}</Text>
            <Text numberOfLines={1} style={{ color: "#CBD5E1", fontSize: 12 }}>
              {[sizeText(doc.size_bytes), doc.uploader?.full_name, fmtRelative(doc.created_at)].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {canDelete && (
            <Pressable onPress={onDelete} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" }}>
              <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
            </Pressable>
          )}
        </View>
        {url.data ? (
          <Image
            source={{ uri: url.data }}
            style={{ flex: 1 }}
            resizeMode="contain"
            onLoadEnd={() => setLoading(false)}
          />
        ) : null}
        {(loading || !url.data) && (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      </View>
    </Modal>
  );
}

export function DocumentsPanel(parent) {
  const qc = useQueryClient();
  const { isAdmin, profile } = useAuth();
  const { width } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, 700) - 32 - 2 * 10) / 3); // 3 per row on every phone
  const q = useQuery({
    queryKey: ["documents", parent],
    queryFn: () => getDocuments(parent),
  });
  const [picker, setPicker] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [viewing, setViewing] = useState(null);
  const [replacing, setReplacing] = useState(null);

  async function uploadAll(files) {
    if (!files.length) return;
    let failed = 0;
    let lastError = null;
    setProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadDocument(kindOf(parent), idOf(parent), files[i]);
      } catch (e) {
        failed++;
        lastError = e;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    qc.invalidateQueries({ queryKey: ["documents"] });
    await qc.invalidateQueries({ queryKey: ["activities"] });
    if (!failed && replacing && files.length === 1) {
      try {
        await deleteDocument(replacing);
        qc.invalidateQueries({ queryKey: ["documents"] });
        await qc.invalidateQueries({ queryKey: ["activities"] });
      } catch (e) {
        Alert.alert("Replacement uploaded", `The new file was uploaded, but the old file could not be removed: ${errMsg(e)}`);
      }
    }
    setReplacing(null);
    if (failed)
      Alert.alert(
        "Upload failed",
        `${failed === files.length ? "The file was" : `${failed} of ${files.length} files were`} not uploaded.\n\n${errMsg(lastError)}`,
      );
  }
  /** Give camera / gallery files a short readable name. */
  const asFile = (a, label, i, total) => {
    const ext = (a.mimeType?.split("/")[1] || (a.uri.split(".").pop() ?? "jpg")).replace("jpeg", "jpg").slice(0, 4);
    const own = a.fileName ?? a.name;
    const ownOk = own && own.length <= 40 && !/^[0-9a-f-]{16,}\./i.test(own);
    const name = ownOk ? own : `${label} ${stamp()}${total > 1 ? ` (${i + 1})` : ""}.${ext}`;
    return { uri: a.uri, name, mimeType: a.mimeType, size: a.fileSize ?? a.size };
  };
  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted)
      return Alert.alert("Camera blocked", "Allow camera access for this app in your phone settings.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (r.canceled) { setReplacing(null); return; }
    await uploadAll(r.assets.map((a, i) => asFile({ ...a, fileName: null }, "Photo", i, r.assets.length)));
  }
  async function fromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted)
      return Alert.alert("Gallery blocked", "Allow photo access for this app in your phone settings.");
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      allowsMultipleSelection: !replacing,
      selectionLimit: replacing ? 1 : 10,
    });
    if (r.canceled) { setReplacing(null); return; }
    await uploadAll(
      r.assets.map((a, i) => asFile(a, a.type === "video" ? "Video" : "Photo", i, r.assets.length)),
    );
  }
  async function fromFiles() {
    const r = await DocumentPicker.getDocumentAsync({
      multiple: !replacing,
      copyToCacheDirectory: true,
    });
    if (r.canceled) { setReplacing(null); return; }
    await uploadAll(r.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size })));
  }
  function choose(key) {
    setPicker(false);
    const run = { camera: fromCamera, gallery: fromGallery, files: fromFiles }[key];
    // wait for the sheet to close before opening the camera / gallery
    setTimeout(() => run().catch((e) => Alert.alert("Error", errMsg(e))), 450);
  }
  async function openExternal(d) {
    try {
      await Linking.openURL(await getDocumentUrl(d.id));
    } catch (e) {
      Alert.alert("Could not open", errMsg(e));
    }
  }
  const del = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      setViewing(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const canDelete = (d) => isAdmin || d.uploaded_by === profile?.id;
  const confirmDelete = (d) =>
    Alert.alert("Delete this file?", niceName(d), [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate(d) },
    ]);
  const tap = (d) => (kindOfFile(d.mime_type, d.name) === "image" ? setViewing(d) : openExternal(d));
  const editDocument = (d) => {
    setReplacing(d);
    setPicker(true);
  };
  const longPress = (d) =>
    Alert.alert(niceName(d), [sizeText(d.size_bytes), d.uploader?.full_name].filter(Boolean).join(" · ") || undefined, [
      { text: "Open", onPress: () => tap(d) },
      ...(canDelete(d) ? [{ text: "Delete", style: "destructive", onPress: () => confirmDelete(d) }] : []),
      { text: "Close", style: "cancel" },
    ]);
  const busy = !!progress;
  const docs = q.data ?? [];

  return (
    <View>
      <SectionTitle
        title="Documents"
        icon="folder-open"
        color="#2563EB"
        bg="#DBEAFE"
        count={docs.length}
        action={busy ? undefined : "+ Upload"}
        onAction={busy ? undefined : () => setPicker(true)}
      />

      {busy && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#E0F2FE", borderRadius: 14, padding: 12, marginBottom: 10 }}>
          <ActivityIndicator color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: "#075985" }}>
              Uploading{progress.total > 1 ? ` ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : ""}…
            </Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "#BAE6FD", marginTop: 6, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(8, (progress.done / progress.total) * 100)}%`, height: 6, backgroundColor: "#0284C7" }} />
            </View>
          </View>
        </View>
      )}

      {q.isLoading ? (
        <Loading />
      ) : !docs.length ? (
        <Pressable onPress={() => !busy && setPicker(true)}>
          <View style={{ alignItems: "center", padding: 22, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#CBD5E1", backgroundColor: "#fff", marginBottom: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="cloud-upload" size={24} color="#0284C7" />
            </View>
            <Text style={{ fontWeight: "800", color: C.text, marginTop: 8 }}>No documents yet</Text>
            <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>Tap to add a photo or file</Text>
          </View>
        </Pressable>
      ) : (
        <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {docs.map((d) => (
              <DocTile key={d.id} d={d} size={tile - 7} onPress={() => tap(d)} canManage={canDelete(d) && !busy} onEdit={() => editDocument(d)} onDelete={() => confirmDelete(d)} />
            ))}
          </View>
          <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 10, textAlign: "center" }}>
            Tap to view · use Edit or Delete below each file
          </Text>
        </View>
      )}

      <PhotoViewer
        key={viewing?.id ?? "none"}
        doc={viewing}
        canDelete={viewing ? canDelete(viewing) : false}
        onDelete={() => viewing && confirmDelete(viewing)}
        onClose={() => setViewing(null)}
      />

      {/* ---------- choose where the file comes from ---------- */}
      <Sheet open={picker} onClose={() => { setPicker(false); setReplacing(null); }} title={replacing ? "Replace document" : "Add a document"}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {SOURCES.map((src) => (
            <Pressable
              key={src.key}
              onPress={() => choose(src.key)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                paddingVertical: 16,
                paddingHorizontal: 6,
                borderRadius: 18,
                backgroundColor: pressed ? src.bg : "#fff",
                borderWidth: 1,
                borderColor: C.border,
              })}
            >
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: src.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={src.icon} size={26} color={src.color} />
              </View>
              <Text numberOfLines={1} style={{ fontWeight: "800", color: C.text, marginTop: 10, fontSize: 14 }}>{src.title}</Text>
              <Text numberOfLines={2} style={{ color: C.muted, fontSize: 11.5, marginTop: 2, textAlign: "center" }}>{src.sub}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: C.faint, fontSize: 12, textAlign: "center", marginTop: 14 }}>
          Up to 25 MB per file
        </Text>
      </Sheet>
    </View>
  );
}

// ---------------- Payments summary (clients) ----------------
export function PaymentsPanel({ clientId }) {
  const q = useQuery({
    queryKey: ["payments", clientId],
    queryFn: () => getPayments(clientId),
  });
  const paid = (q.data ?? [])
    .filter((p) => p.status === "paid")
    .reduce((a, p) => a + Number(p.amount), 0);
  const due = (q.data ?? [])
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((a, p) => a + Number(p.amount), 0);
  return (
    <View>
      <SectionTitle title="Payments" icon="wallet" color="#16A34A" bg="#DCFCE7" count={q.data?.length ?? 0} />
      <Card>
        <View style={[s.row, { justifyContent: "space-around" }]}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.success }}>
              {money(paid)}
            </Text>
            <Text style={s.muted}>Paid</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: due ? C.warn : C.text,
              }}
            >
              {money(due)}
            </Text>
            <Text style={s.muted}>Outstanding</Text>
          </View>
        </View>
        {(q.data ?? []).slice(0, 5).map((p) => (
          <View
            key={p.id}
            style={[
              s.row,
              {
                justifyContent: "space-between",
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: "#f1f5f9",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text }}>
                {p.description ?? "Payment"}
              </Text>
              <Text style={s.muted}>
                {p.paid_at
                  ? fmtDateTime(p.paid_at)
                  : p.due_at
                    ? `Due ${fmtDate(p.due_at)}`
                    : ""}
              </Text>
            </View>
            <Text style={{ fontWeight: "600", color: C.text, marginRight: 8 }}>
              {money(p.amount, p.currency)}
            </Text>
            <Badge value={p.status} />
          </View>
        ))}
        <Text style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>
          Record new payments from the web dashboard.
        </Text>
      </Card>
    </View>
  );
}
