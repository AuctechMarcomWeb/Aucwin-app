import { Platform } from "react-native";
import * as LegacyFS from "expo-file-system/legacy";
import { API_URL, ApiError, getToken, http, request } from "./http";

// ---------------- Dashboard ----------------
export const getDashboardStats = (days = 30) =>
  http.get("/api/dashboard", { days });
export const getEmployeePerformance = () =>
  http.get("/api/employee-performance");
export const getDataSources = () => http.get("/api/data-sources");
export const getAgentOutreachReport = (from, to) =>
  http.get("/api/reports/agent-outreach", { from, to });
/** Paginated, filterable call log. params: { from, to, page, pageSize, agent, type, outcome, q } */
export const getTeamCalls = (params = {}) =>
  http.get("/api/reports/calls", params);
/** The signed-in user's OWN calls. params: { from, to, page, pageSize, type, outcome, q } */
export const getMyCalls = (params = {}) =>
  http.get("/api/reports/my-calls", params);
export const getLeadStages = () => http.get("/api/lead-stages");
export const createLeadStage = (input) => http.post("/api/lead-stages", input);
// Admin-managed lists (lead sources, follow-up types, designations)
export const getMasters = (type) => http.get("/api/masters", { type });
export const updateLeadStage = (id, patch) =>
  http.patch(`/api/lead-stages/${id}`, patch);
export const reorderLeadStages = (order) =>
  http.post("/api/lead-stages/reorder", { order });
export const deleteLeadStage = (id) => http.del(`/api/lead-stages/${id}`);

// ---------------- Departments & profiles ----------------
export const getDepartments = () => http.get("/api/departments");
export const createDepartment = (name) =>
  http.post("/api/departments", { name });
export const getProfiles = () => http.get("/api/profiles");
export const updateProfile = (id, patch) =>
  http.patch(`/api/profiles/${id}`, patch);
/** input: { email, password, full_name, phone, role, department_id } */
export const createEmployee = (input) => http.post("/api/profiles", input);

// ---------------- Leads ----------------
/** f: { search, status, source, assigned_to, sort, dir, page, pageSize } -> { rows, count } */
export const getLeads = (f = {}) => http.get("/api/leads", f);
export const getLead = (id) => http.get(`/api/leads/${id}`);
export const createLead = (input) => http.post("/api/leads", input);
export const updateLead = (id, patch) => http.patch(`/api/leads/${id}`, patch);
export const deleteLead = (id) => http.del(`/api/leads/${id}`);
// body (optional): { outcome: "answered"|"not_answered", duration_seconds }
export const logCall = (id, body) =>
  http.post(`/api/leads/${id}/log-call`, body || {});
export const logClientCall = (id, body) =>
  http.post(`/api/clients/${id}/log-call`, body || {});
export const importLeads = async (rows) =>
  (await http.post("/api/leads/import", { rows })).count;
export const exportLeads = () => http.get("/api/leads/export");
export const convertLead = (id, service_name, contract_value) =>
  http.post(`/api/leads/${id}/convert`, {
    service_name: service_name ?? null,
    contract_value: contract_value ?? null,
  });

// ---------------- Clients ----------------
export const getClients = (f = {}) => http.get("/api/clients", f);
export const getClient = (id) => http.get(`/api/clients/${id}`);
export const updateClient = (id, patch) => {
  const { assignee: _a, ...rest } = patch;
  return http.patch(`/api/clients/${id}`, rest);
};
export const createClientRecord = (input) => http.post("/api/clients", input);
export const deleteClient = (id) => http.del(`/api/clients/${id}`);

// ---------------- Follow-ups / reminders / meetings ----------------
/** f: { scope: upcoming|overdue|today|done|all, lead_id, client_id, type } */
export const getFollowUps = (f = {}) => http.get("/api/follow-ups", f);
export const createFollowUp = (input) => http.post("/api/follow-ups", input);
export const updateFollowUp = (id, patch) => {
  const { lead: _l, client: _c, assignee: _a, ...rest } = patch;
  return http.patch(`/api/follow-ups/${id}`, rest);
};
export const deleteFollowUp = (id) => http.del(`/api/follow-ups/${id}`);

// ---------------- Tasks ----------------
export const getTasks = (f = {}) => http.get("/api/tasks", f);
export const createTask = (input) => http.post("/api/tasks", input);
export const updateTask = (id, patch) => {
  const { lead: _l, client: _c, assignee: _a, ...rest } = patch;
  return http.patch(`/api/tasks/${id}`, rest);
};
export const deleteTask = (id) => http.del(`/api/tasks/${id}`);

// ---------------- Activities ----------------
export const getActivities = (f) => http.get("/api/activities", f);
export const addActivity = (input) => http.post("/api/activities", input);

// ---------------- Documents ----------------
export const getDocuments = (f) => http.get("/api/documents", f);
/** Upload a file picked from the camera / gallery / document picker: { uri, name, mimeType, size }. */
const MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  mp4: "video/mp4",
  mov: "video/quicktime",
};
const mimeOf = (name) =>
  MIME[
    String(name || "")
      .split(".")
      .pop()
      .toLowerCase()
  ];

/**
 * The server saves the name of the file it receives. Phones give photos random names
 * (e.g. "3f9c2e1a-77b0-….jpeg"), so copy the file to a temporary file with the friendly name first.
 */
async function copyWithName(file) {
  try {
    if (!file.name || !LegacyFS.cacheDirectory || !LegacyFS.copyAsync)
      return { uri: file.uri };
    const safe =
      file.name
        .replace(/[^\w.\-() ]+/g, "")
        .replace(/\s+/g, " ")
        .trim() || "file";
    const dir = `${LegacyFS.cacheDirectory}upload-${Date.now()}/`;
    await LegacyFS.makeDirectoryAsync(dir, { intermediates: true });
    const to = dir + encodeURIComponent(safe);
    await LegacyFS.copyAsync({ from: file.uri, to });
    return {
      uri: to,
      cleanup: () =>
        LegacyFS.deleteAsync(dir, { idempotent: true }).catch(() => {}),
    };
  } catch {
    return { uri: file.uri }; // if copying fails, upload the original (just with its own name)
  }
}

export async function uploadDocument(kind, recordId, file) {
  const type = file.mimeType || mimeOf(file.name) || "application/octet-stream";
  const query = { kind, record_id: recordId, name: file.name || undefined };

  if (Platform.OS === "web") {
    const form = new FormData();
    const blob = await (await fetch(file.uri)).blob();
    form.append("file", blob, file.name);
    return http.upload("/api/documents", form, query);
  }

  // Phone: use Expo's native uploader. It reads the file straight from the phone's storage,
  // which is much more reliable on Android than sending it with fetch().
  if (LegacyFS.uploadAsync) {
    const url =
      `${API_URL}/api/documents?kind=${encodeURIComponent(kind)}&record_id=${encodeURIComponent(recordId)}` +
      (file.name ? `&name=${encodeURIComponent(file.name)}` : "");
    const token = getToken();
    const local = await copyWithName(file);
    let r;
    try {
      r = await LegacyFS.uploadAsync(url, local.uri, {
        httpMethod: "POST",
        uploadType: LegacyFS.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: type,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        sessionType: LegacyFS.FileSystemSessionType?.FOREGROUND,
      });
    } catch (e) {
      throw new ApiError(
        /network|connect|timeout|host/i.test(String(e?.message))
          ? "Network request failed"
          : `Could not upload this file. ${e?.message ?? ""}`.trim(),
        0,
        "upload",
      );
    } finally {
      local.cleanup?.();
    }
    let data = null;
    try {
      data = JSON.parse(r.body);
    } catch {
      data = null;
    }
    if (r.status >= 200 && r.status < 300) return data;
    if (r.status === 413)
      throw new ApiError("This file is too big to upload.", 413);
    throw new ApiError(data?.error || `Upload failed (${r.status})`, r.status);
  }

  // fallback (older setups)
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name || "file", type });
  return http.upload("/api/documents", form, query);
}
/** Short-lived signed link that opens the file in a new tab. */
export const getDocumentUrl = async (docId) =>
  (await http.get(`/api/documents/${docId}/url`)).url;
export const deleteDocument = (doc) => http.del(`/api/documents/${doc.id}`);

// ---------------- Payments ----------------
export const getPayments = (client_id) =>
  http.get("/api/payments", { client_id });
export const createPayment = (input) => http.post("/api/payments", input);
export const updatePayment = (id, patch) =>
  http.patch(`/api/payments/${id}`, patch);
export const deletePayment = (id) => http.del(`/api/payments/${id}`);

// ---------------- Home counters ----------------
export const getModuleCounts = () => http.get("/api/module-counts");

// ---------------- To-do ----------------
export const getTodos = () => http.get("/api/todos");
export const createTodo = (input) => http.post("/api/todos", input);
export const updateTodo = (id, patch) => http.patch(`/api/todos/${id}`, patch);
export const deleteTodo = (id) => http.del(`/api/todos/${id}`);

// ---------------- Notes ----------------
export const getNotes = (f = {}) => http.get("/api/notes", f);
export const createNote = (input) => {
  const { lead: _l, client: _c, owner: _o, ...rest } = input;
  return http.post("/api/notes", rest);
};
export const updateNote = (id, patch) => {
  const { lead: _l, client: _c, owner: _o, ...rest } = patch;
  return http.patch(`/api/notes/${id}`, rest);
};
export const deleteNote = (id) => http.del(`/api/notes/${id}`);

// ---------------- Chat ----------------
export const getChannels = () => http.get("/api/chat/channels");
export const getMessages = (channel_id, before) =>
  http.get(`/api/chat/channels/${channel_id}/messages`, { before });
export const sendMessage = (channel_id, body, ref) =>
  http.post(`/api/chat/channels/${channel_id}/messages`, { body, ...ref });
export const markChannelRead = (channel_id) =>
  request("POST", `/api/chat/channels/${channel_id}/read`, { body: {} }).catch(
    () => {},
  );
export const openDirectChannel = async (other) =>
  (await http.post("/api/chat/direct", { user_id: other })).id;
export const createGroupChannel = async (name, memberIds) =>
  (await http.post("/api/chat/groups", { name, member_ids: memberIds })).id;
export const deleteMessage = (id) => http.del(`/api/chat/messages/${id}`);
/** Everyone you can message. Falls back to the profiles list if the server is older. */
export async function getChatPeople() {
  try {
    return await http.get("/api/chat/people");
  } catch (e) {
    if (e.status === 404) return getProfiles();
    throw e;
  }
}

// ---------------- Calendar ----------------
export const getCalendarEvents = (from, to) =>
  http.get("/api/calendar", { from: from.toISOString(), to: to.toISOString() });

// ---------------- Integrations (super admin) ----------------
export const getIntegrations = () => http.get("/api/integrations");
export const createIntegration = (input) =>
  http.post("/api/integrations", input);
export const updateIntegration = (id, patch) =>
  http.patch(`/api/integrations/${id}`, patch);
export const deleteIntegration = (id) => http.del(`/api/integrations/${id}`);
export const getIntegrationEvents = (integration_id) =>
  http.get(`/api/integrations/${integration_id}/events`);

// ---------------- Account ----------------
export const login = (email, password) =>
  http.post("/api/auth/login", { email, password });
export const getMe = () => http.get("/api/auth/me");
/** Change your own password. The current password is checked by the server. */
export const changePassword = (password, current_password) =>
  http.post(
    "/api/auth/password",
    current_password ? { password, current_password } : { password },
  );
export const requestPasswordReset = (email) =>
  http.post("/api/auth/forgot", { email });
export const resetPassword = (token, password) =>
  http.post("/api/auth/reset", { token, password });

// ---------------- Push tokens ----------------
export const registerPushToken = (token) =>
  http.post("/api/auth/push-token", { token });
export const unregisterPushToken = (token) =>
  http.del("/api/auth/push-token", { token }).catch(() => {});
