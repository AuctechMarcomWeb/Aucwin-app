// Shared helpers for Call, SMS and WhatsApp links.
//
// Why: a stored number like "971 50 900 5522" or "971509005522" (country code,
// no "+") makes the dialer open a wrong/invalid number. These helpers strip the
// spaces/dashes/brackets and, when a number already includes a country code,
// add a leading "+" so the phone dials it correctly as an international number.

export function cleanPhone(phone) {
  if (!phone) return "";
  const raw = String(phone).trim();
  const hadPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (hadPlus) return "+" + digits; // keep an explicit +
  if (digits.startsWith("00")) return "+" + digits.slice(2); // 00 = international prefix
  if (digits.length >= 11) return "+" + digits; // already has a country code
  return digits; // short local number, dial as-is
}

export const telUri = (phone) => `tel:${cleanPhone(phone)}`;
export const smsUri = (phone) => `sms:${cleanPhone(phone)}`;
// WhatsApp expects the full international number with no "+".
export const waDigits = (phone) => cleanPhone(phone).replace(/^\+/, "");
export const waUri = (phone) => `https://wa.me/${waDigits(phone)}`;
