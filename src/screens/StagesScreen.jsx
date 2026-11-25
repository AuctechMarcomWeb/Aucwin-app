import { useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getLeadStages,
  createLeadStage,
  updateLeadStage,
  reorderLeadStages,
  deleteLeadStage,
} from "@/lib/api";
import { errMsg } from "@/lib/http";
import { C, Card, Button, Input, Field, Loading, Sheet } from "@/components/ui";

const PALETTE = [
  "#1E8F99",
  "#0D9488",
  "#2563EB",
  "#0284C7",
  "#6B4A9E",
  "#7C3AED",
  "#9333EA",
  "#2F7D4A",
  "#16A34A",
  "#B7791F",
  "#D97706",
  "#C2410C",
  "#DC2626",
  "#E11D48",
  "#64748B",
  "#94A3B8",
];

export default function StagesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [isOpen, setIsOpen] = useState(true);

  const q = useQuery({ queryKey: ["lead_stages"], queryFn: getLeadStages });
  const stages = q.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["lead_stages"] });

  const createM = useMutation({
    mutationFn: createLeadStage,
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const updateM = useMutation({
    mutationFn: ({ id, patch }) => updateLeadStage(id, patch),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e) => Alert.alert("Error", errMsg(e)),
  });
  const reorderM = useMutation({
    mutationFn: reorderLeadStages,
    onMutate: async (order) => {
      await qc.cancelQueries({ queryKey: ["lead_stages"] });
      const prev = qc.getQueryData(["lead_stages"]);
      if (Array.isArray(prev)) {
        const byId = {};
        for (const s of prev) byId[s.id] = s;
        qc.setQueryData(
          ["lead_stages"],
          order.map((id) => byId[id]).filter(Boolean),
        );
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["lead_stages"], ctx.prev);
      Alert.alert("Error", errMsg(e));
    },
    onSettled: invalidate,
  });
  const deleteM = useMutation({
    mutationFn: deleteLeadStage,
    onSuccess: invalidate,
    onError: (e) => Alert.alert("Can't delete", errMsg(e)),
  });

  const openAdd = () => {
    setEditing(null);
    setName("");
    setColor(PALETTE[0]);
    setIsOpen(true);
    setFormOpen(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setName(s.label);
    setColor(s.color || PALETTE[0]);
    setIsOpen(!!s.is_open);
    setFormOpen(true);
  };
  const submit = () => {
    const label = name.trim();
    if (!label) return Alert.alert("Stage name is required");
    const data = { label, color, is_open: isOpen };
    if (editing) updateM.mutate({ id: editing.id, patch: data });
    else createM.mutate(data);
  };
  const move = (index, dir) => {
    const next = [...stages];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    reorderM.mutate(next.map((s) => s.id));
  };
  const confirmDelete = (s) =>
    Alert.alert(
      "Delete stage?",
      `Delete the "${s.label}" stage? If any leads are still on it, you'll need to move them first.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteM.mutate(s.id),
        },
      ],
    );

  const busy = createM.isPending || updateM.isPending;

  if (q.isLoading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 90,
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={q.refetch} />
        }
      >
        {stages.map((s, i) => (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View>
                <Pressable
                  disabled={i === 0 || reorderM.isPending}
                  onPress={() => move(i, -1)}
                  hitSlop={6}
                >
                  <Ionicons
                    name="chevron-up"
                    size={18}
                    color={i === 0 ? C.border : C.muted}
                  />
                </Pressable>
                <Pressable
                  disabled={i === stages.length - 1 || reorderM.isPending}
                  onPress={() => move(i, 1)}
                  hitSlop={6}
                >
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={i === stages.length - 1 ? C.border : C.muted}
                  />
                </Pressable>
              </View>

              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: s.color || "#64748B",
                }}
              />

              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14.5, fontWeight: "700", color: C.text }}
                >
                  {s.label}
                </Text>
                <Text style={{ fontSize: 11.5, color: C.faint }}>
                  {s.is_open ? "Open / active" : "Closed outcome"}
                  {s.role ? ` · ${s.role}` : ""}
                </Text>
              </View>

              <Pressable
                onPress={() => openEdit(s)}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Ionicons name="create-outline" size={20} color={C.muted} />
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(s)}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Ionicons name="trash-outline" size={19} color="#E11D48" />
              </Pressable>
            </View>
          </Card>
        ))}

        <Text
          style={{ fontSize: 12, color: C.faint, marginTop: 6, lineHeight: 17 }}
        >
          Renaming or recolouring a stage keeps every lead on it. A stage can
          only be deleted once no leads are using it.
        </Text>
      </ScrollView>

      {/* floating add button */}
      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + 14,
        }}
      >
        <Button title="Add stage" icon="add" onPress={openAdd} />
      </View>

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit stage" : "Add stage"}
      >
        <Field label="Stage name">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. Not Interested"
          />
        </Field>

        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: C.text,
            marginBottom: 8,
          }}
        >
          Colour
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {PALETTE.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: c,
                  borderWidth: color === c ? 3 : 0,
                  borderColor: "#fff",
                  shadowColor: color === c ? c : "transparent",
                  shadowOpacity: color === c ? 0.6 : 0,
                  shadowRadius: 4,
                  elevation: color === c ? 3 : 0,
                }}
              />
            </Pressable>
          ))}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.text }}>
              Counts as open / active
            </Text>
            <Text style={{ fontSize: 11.5, color: C.faint }}>
              Turn off for closed outcomes like Junk or Not Interested.
            </Text>
          </View>
          <Switch value={isOpen} onValueChange={setIsOpen} />
        </View>

        <Button
          title={editing ? "Save" : "Add stage"}
          onPress={submit}
          loading={busy}
        />
      </Sheet>
    </View>
  );
}
