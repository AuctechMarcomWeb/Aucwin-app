// Lead pipeline, in order — from a brand-new lead through to a closed sale,
// with the negative/closed outcomes grouped at the end.
// Fallback pipeline — the app loads the company's real stages from the API
// (see lib/stages.js). This list is only used until those arrive.
export const LEAD_STATUSES = [
  "new_lead",
  "prospect",
  "follow_up",
  "qualified",
  "meeting_scheduled",
  "rspv",
  "meeting_done",
  "sale_done",
  "unreachable",
  "dnp",
  "not_interested",
  "hanged_up",
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
