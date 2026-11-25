import { useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { deleteTask, getTasks, updateTask } from "@/lib/api";
import { errMsg } from "@/lib/http";
import { TASK_STATUSES, label } from "@/lib/types";
import {
  Badge,
  C,
  Chip,
  Empty,
  ErrorBox,
  IconButton,
  Loading,
  Sheet,
  fmtDateTime,
  isOverdue,
  s,
  toneOf,
} from "@/components/ui";
import { TaskForm } from "@/components/forms";
import { OfflineBanner } from "@/components/OfflineBanner";

export default function TasksScreen() {
  const nav = useNavigation();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const q = useQuery({
    queryKey: ["tasks", "list", status],
    queryFn: () => getTasks({ status: status || undefined }),
  });
  const [modal, setModal] = useState(null);
  const inval = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const cycle = useMutation({
    mutationFn: (t) =>
      updateTask(t.id, {
        status:
          t.status === "todo"
            ? "in_progress"
            : t.status === "in_progress"
              ? "done"
              : "todo",
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
  const icon = (st) =>
    st === "done"
      ? "checkbox"
      : st === "in_progress"
        ? "ellipse-half-outline"
        : "square-outline";

  return (
    <View style={s.screen}>
      <OfflineBanner />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border }}
        contentContainerStyle={{ flexDirection: "row", gap: 6, padding: 12 }}
      >
        <Chip active={!status} label="All" onPress={() => setStatus("")} />
        {TASK_STATUSES.map((st) => (
          <Chip
            key={st}
            active={status === st}
            label={label(st)}
            onPress={() => setStatus(st)}
          />
        ))}
      </ScrollView>
      {q.isLoading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          refreshing={false}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <Empty title="No tasks" hint="Tap + to create one." />
          }
          renderItem={({ item: t }) => (
            <View style={[s.card, { paddingVertical: 12, borderLeftWidth: 4, borderLeftColor: toneOf(t.priority) }]}>
              <View style={s.row}>
                {/* tap to move: To do -> In progress -> Done */}
                <Pressable onPress={() => cycle.mutate(t)} hitSlop={10} accessibilityLabel={`Status: ${label(t.status)}. Tap to change`}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      borderWidth: 2,
                      alignItems: "center",
                      justifyContent: "center",
                      borderColor: t.status === "done" ? C.brand : t.status === "in_progress" ? "#2563EB" : "#CBD5E1",
                      backgroundColor: t.status === "done" ? C.brand : t.status === "in_progress" ? "#DBEAFE" : "#fff",
                    }}
                  >
                    {t.status === "done" ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : t.status === "in_progress" ? (
                      <Ionicons name="play" size={11} color="#2563EB" />
                    ) : null}
                  </View>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => setModal(t)}>
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 15,
                      color: t.status === "done" ? C.faint : C.text,
                      textDecorationLine:
                        t.status === "done" ? "line-through" : "none",
                    }}
                  >
                    {t.title}
                  </Text>
                  <Text
                    style={[
                      s.muted,
                      t.status !== "done" && isOverdue(t.due_at)
                        ? { color: C.danger, fontWeight: "600" }
                        : null,
                    ]}
                  >
                    {t.due_at ? fmtDateTime(t.due_at) : "No due date"}
                    {t.assignee ? ` · ${t.assignee.full_name}` : ""}
                  </Text>
                  {(t.lead || t.client) && (
                    <Pressable
                      onPress={() =>
                        nav.navigate(
                          t.lead ? "Leads" : "More",
                          t.lead
                            ? {
                                screen: "LeadDetail",
                                params: { id: t.lead.id },
                                initial: false,
                              }
                            : {
                                screen: "ClientDetail",
                                params: { id: t.client.id },
                                initial: false,
                              },
                        )
                      }
                    >
                      <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, backgroundColor: C.brandLight, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                        <Ionicons name="person-circle-outline" size={13} color={C.brand} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: C.brand }}>{t.lead?.name ?? t.client?.name}</Text>
                      </View>
                    </Pressable>
                  )}
                </Pressable>
                <Badge value={t.priority} />
                <IconButton
                  icon="trash-outline"
                  color={C.danger}
                  onPress={() =>
                    Alert.alert("Delete task?", t.title, [
                      { text: "Cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => del.mutate(t.id),
                      },
                    ])
                  }
                />
              </View>
            </View>
          )}
        />
      )}
      <Pressable
        onPress={() => setModal("new")}
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
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
      <Sheet
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? "New task" : "Edit task"}
      >
        {modal && (
          <TaskForm
            task={modal === "new" ? undefined : modal}
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
