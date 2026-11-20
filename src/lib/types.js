// Lead pipeline, in order — from a brand-new lead through to a closed sale,
// with the negative/closed outcomes grouped at the end.
export const LEAD_STATUSES = [
  "new_lead",
  "prospect",
  "qualified",
  "follow_up",
  "meeting_scheduled",
  "meeting_done",
  "rspv",
  "sale_done",
  "unreachable",
  "dnp",
  "junk",
];
export const LEAD_SOURCES = [
  "website",
  "referral",
  "social_media",
  "facebook",
  "phone",
  "walk_in",
  "advertisement",
  "other",
];
export const FOLLOWUP_TYPES = [
  "call",
  "meeting",
  "reminder",
  "email",
  "whatsapp",
];
export const TASK_STATUSES = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES = ["low", "medium", "high"];
export const SERVICE_STATUSES = [
  "onboarding",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
];
export const PAYMENT_STATUSES = ["pending", "paid", "overdue", "refunded"];

export const label = (s) =>
  String(s ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Dnp$/, "DNP")
    .replace(/^Rspv$/, "RSPV");

// ---------------- 0004 modules ----------------
export const NOTE_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
];
