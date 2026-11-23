import { useState } from "react";
import { Alert, Platform, Pressable, Text, View, Linking } from "react-native";
import { telUri, smsUri, waUri } from "@/lib/phone";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  createFollowUp,
  createLead,
  createTask,
  getProfiles,
  updateFollowUp,
  updateLead,
  updateTask,
} from "@/lib/api";
import { errMsg } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { scheduleLocalReminder } from "@/lib/notifications";
import {
  FOLLOWUP_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  label,
} from "@/lib/types";
import { useStages } from "@/lib/stages";
import {
  Button,
  C,
  Chips,
  Field,
  Input,
  enumOptions,
  fmtDateTime,
  s,
} from "./ui";

export function DateTimeField({
  label: lbl,
  value,
  onChange,
  optional,
  defaultDate,
}) {
  const [mode, setMode] = useState(null);
  const d = value ?? defaultDate ?? new Date(Date.now() + 3600_000);
  return (
    <Field label={lbl}>
      <View style={[s.row, { gap: 8 }]}>
        <Pressable
          style={[s.input, { flex: 1 }]}
          onPress={() => setMode("date")}
        >
          <Text
            numberOfLines={1}
            style={{ color: value ? C.text : C.faint, fontSize: 15 }}
          >
            {value ? fmtDateTime(value.toISOString()) : "Tap to set"}
          </Text>
        </Pressable>
        {value && (
          <Pressable
            style={[s.input, { paddingHorizontal: 10 }]}
            onPress={() => setMode("time")}
          >
            <Ionicons name="time-outline" size={18} color={C.muted} />
          </Pressable>
        )}
        {optional && value && (
          <Pressable
            style={[s.input, { paddingHorizontal: 10 }]}
            onPress={() => onChange(null)}
          >
            <Ionicons name="close" size={18} color={C.muted} />
          </Pressable>
        )}
      </View>
      {mode && (
        <DateTimePicker
          value={d}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, picked) => {
            if (Platform.OS !== "ios") setMode(null);
            if (!picked) return;
            const next = new Date(d);
            if (mode === "date") {
              next.setFullYear(
                picked.getFullYear(),
                picked.getMonth(),
                picked.getDate(),
              );
              onChange(next);
              if (Platform.OS !== "ios") setTimeout(() => setMode("time"), 150);
            } else {
              next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
              onChange(next);
            }
          }}
        />
      )}
      {mode && Platform.OS === "ios" && (
        <Button
          title="Done"
          variant="secondary"
          onPress={() => setMode(null)}
          style={{ marginTop: 6 }}
        />
      )}
    </Field>
  );
}

export function AssigneeChips({ value, onChange }) {
  const { isAdmin, profile } = useAuth();
  const q = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
    enabled: isAdmin,
  });
  if (!isAdmin)
    return (
      <Field label="Assigned to">
        <Text style={s.muted}>{profile?.full_name} (you)</Text>
      </Field>
    );
  return (
    <Field label="Assigned to">
      <Chips
        value={value ?? ""}
        allowEmpty
        onChange={(v) => onChange(v || null)}
        options={(q.data ?? [])
          .filter((p) => p.is_active)
          .map((p) => ({ value: p.id, label: p.full_name }))}
      />
    </Field>
  );
}

export function LeadForm({ lead, onDone }) {
  const qc = useQueryClient();
  const { stages } = useStages();
  const [f, setF] = useState({
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    company: lead?.company ?? "",
    address: lead?.address ?? "",
    source: lead?.source ?? "other",
    status: lead?.status ?? "new_lead",
    estimated_value: lead?.estimated_value ?? 0,
    notes: lead?.notes ?? "",
    assigned_to: lead?.assigned_to ?? null,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => {
      if (!f.name.trim()) throw new Error("Name is required");
      const payload = {
        ...f,
        name: f.name.trim(),
        email: f.email || null,
        phone: f.phone || null,
        company: f.company || null,
        address: f.address || null,
        notes: f.notes || null,
        estimated_value: Number(f.estimated_value) || 0,
      };
      return lead ? updateLead(lead.id, payload) : createLead(payload);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDone(saved);
    },
    onError: (e) => Alert.alert("Could not save", errMsg(e)),
  });
  return (
    <View>
      <Field label="Full name *">
        <Input
          value={f.name}
          onChangeText={(v) => set("name", v)}
          autoCapitalize="words"
        />
      </Field>
      <Field label="Phone">
        <Input
          value={f.phone ?? ""}
          onChangeText={(v) => set("phone", v)}
          keyboardType="phone-pad"
          placeholder="+1 514 555 0100"
        />
      </Field>
      <Field label="Email">
        <Input
          value={f.email ?? ""}
          onChangeText={(v) => set("email", v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Company">
        <Input
          value={f.company ?? ""}
          onChangeText={(v) => set("company", v)}
        />
      </Field>
      <Field label="Address">
        <Input
          value={f.address ?? ""}
          onChangeText={(v) => set("address", v)}
        />
      </Field>
      <Field label="Estimated value (CAD)">
        <Input
          value={String(f.estimated_value ?? "")}
          onChangeText={(v) => set("estimated_value", v)}
          keyboardType="decimal-pad"
        />
      </Field>
      <Field label="Source">
        <Chips
          value={f.source ?? "other"}
          onChange={(v) => set("source", v)}
          options={enumOptions(LEAD_SOURCES)}
        />
      </Field>
      <Field label="Status">
        <Chips
          value={f.status ?? "new_lead"}
          onChange={(v) => set("status", v)}
          options={stages.map((st) => ({ value: st.key, label: st.label }))}
        />
      </Field>
      <AssigneeChips
        value={f.assigned_to ?? null}
        onChange={(v) => set("assigned_to", v)}
      />
      <Field label="Notes">
        <Input
          value={f.notes ?? ""}
          onChangeText={(v) => set("notes", v)}
          multiline
        />
      </Field>
      <Button
        title={lead ? "Save changes" : "Create lead"}
        onPress={() => m.mutate()}
        loading={m.isPending}
      />
    </View>
  );
}

export function FollowUpForm({
  followUp,
  leadId,
  clientId,
  fixedType,
  onDone,
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(followUp?.title ?? "");
  const [type, setType] = useState(followUp?.type ?? fixedType ?? "call");
  const [ends, setEnds] = useState(
    followUp?.ends_at ? new Date(followUp.ends_at) : null,
  );
  const [location, setLocation] = useState(followUp?.location ?? "");
  const [link, setLink] = useState(followUp?.meeting_link ?? "");
  const [due, setDue] = useState(
    followUp ? new Date(followUp.due_at) : new Date(Date.now() + 3600_000),
  );
  const [notes, setNotes] = useState(followUp?.notes ?? "");
  const [assigned, setAssigned] = useState(followUp?.assigned_to ?? null);
  const m = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !due)
        throw new Error("Title and due date are required");
      const isMeeting = type === "meeting";
      if (isMeeting && ends && ends <= due)
        throw new Error("The end time must be after the start time");
      const payload = {
        title: title.trim(),
        type,
        due_at: due.toISOString(),
        ends_at: isMeeting ? (ends?.toISOString() ?? null) : null,
        location: isMeeting ? location || null : null,
        meeting_link: isMeeting ? link || null : null,
        notes: notes || null,
        assigned_to: assigned,
      };
      const saved = followUp
        ? await updateFollowUp(followUp.id, payload)
        : await createFollowUp({
            ...payload,
            lead_id: leadId ?? null,
            client_id: clientId ?? null,
          });
      await scheduleLocalReminder(saved).catch(() => {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow_ups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDone();
    },
    onError: (e) => Alert.alert("Could not save", errMsg(e)),
  });
  return (
    <View>
      <Field label="Title *">
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Call about proposal"
        />
      </Field>
      {!fixedType && (
        <Field label="Type">
          <Chips
            value={type}
            onChange={(v) => v && setType(v)}
            options={enumOptions(FOLLOWUP_TYPES)}
          />
        </Field>
      )}
      <DateTimeField
        label={type === "meeting" ? "Starts *" : "When *"}
        value={due}
        onChange={setDue}
      />
      {type === "meeting" && (
        <DateTimeField
          label="Ends"
          value={ends}
          onChange={setEnds}
          optional
          defaultDate={due ? new Date(due.getTime() + 3600_000) : undefined}
        />
      )}
      {type === "meeting" && (
        <Field label="Location">
          <Input
            value={location}
            onChangeText={setLocation}
            placeholder="Office, Room B"
          />
        </Field>
      )}
      {type === "meeting" && (
        <Field label="Video link">
          <Input
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            placeholder="https://meet…"
          />
        </Field>
      )}
      <AssigneeChips value={assigned} onChange={setAssigned} />
      <Field label="Notes">
        <Input value={notes} onChangeText={setNotes} multiline />
      </Field>
      <Button
        title={
          followUp
            ? "Save"
            : type === "meeting"
              ? "Schedule meeting"
              : type === "reminder"
                ? "Set reminder"
                : "Schedule"
        }
        onPress={() => m.mutate()}
        loading={m.isPending}
      />
    </View>
  );
}

export function TaskForm({ task, leadId, clientId, onDone }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "todo");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [due, setDue] = useState(task?.due_at ? new Date(task.due_at) : null);
  const [assigned, setAssigned] = useState(task?.assigned_to ?? null);
  const m = useMutation({
    mutationFn: () => {
      if (!title.trim()) throw new Error("Title is required");
      const payload = {
        title: title.trim(),
        description: desc || null,
        status,
        priority,
        due_at: due?.toISOString() ?? null,
        assigned_to: assigned,
      };
      return task
        ? updateTask(task.id, payload)
        : createTask({
            ...payload,
            lead_id: leadId ?? null,
            client_id: clientId ?? null,
          });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onDone();
    },
    onError: (e) => Alert.alert("Could not save", errMsg(e)),
  });
  return (
    <View>
      <Field label="Title *">
        <Input value={title} onChangeText={setTitle} />
      </Field>
      <Field label="Description">
        <Input value={desc} onChangeText={setDesc} multiline />
      </Field>
      <Field label="Status">
        <Chips
          value={status}
          onChange={(v) => v && setStatus(v)}
          options={enumOptions(TASK_STATUSES)}
        />
      </Field>
      <Field label="Priority">
        <Chips
          value={priority}
          onChange={(v) => v && setPriority(v)}
          options={enumOptions(TASK_PRIORITIES)}
        />
      </Field>
      <DateTimeField label="Due" value={due} onChange={setDue} optional />
      <AssigneeChips value={assigned} onChange={setAssigned} />
      <Button
        title={task ? "Save" : "Create task"}
        onPress={() => m.mutate()}
        loading={m.isPending}
      />
    </View>
  );
}

/** Call / WhatsApp / Email / Maps quick actions. */
export function ContactActions({ phone, email, address }) {
  const open = (url) =>
    Linking.openURL(url).catch(() =>
      Alert.alert("Not available", "No app on this device can open that."),
    );
  const digits = phone?.replace(/[^\d]/g, "");
  const Item = ({ icon, text, onPress, color }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          flex: 1,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: C.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text
        style={{
          fontSize: 11,
          color: C.muted,
          marginTop: 4,
          fontWeight: "600",
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
      {phone && (
        <Item
          icon="call"
          text="Call"
          color={C.brand}
          onPress={() => open(telUri(phone))}
        />
      )}
      {phone && (
        <Item
          icon="chatbubble-ellipses"
          text="SMS"
          color={C.brand}
          onPress={() => open(smsUri(phone))}
        />
      )}
      {digits && (
        <Item
          icon="logo-whatsapp"
          text="WhatsApp"
          color="#16a34a"
          onPress={() => open(waUri(phone))}
        />
      )}
      {email && (
        <Item
          icon="mail"
          text="Email"
          color={C.warn}
          onPress={() => open(`mailto:${email}`)}
        />
      )}
      {address && (
        <Item
          icon="map"
          text="Map"
          color={C.danger}
          onPress={() =>
            open(
              Platform.select({
                ios: `maps:0,0?q=${encodeURIComponent(address)}`,
                default: `geo:0,0?q=${encodeURIComponent(address)}`,
              }),
            )
          }
        />
      )}
    </View>
  );
}

export const statusLabel = label;
