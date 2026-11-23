import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Dimensions,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { label as humanize } from "@/lib/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** AucWin colours (same as the website). */
export const C = {
  brand: "#0B857D", // teal buttons / links
  accent: "#12ACA2", // bright teal from the logo
  brandLight: "#E6F7F5",
  bg: "#F1F4F8",
  card: "#ffffff",
  border: "#E4E9F0",
  text: "#0F2F58", // navy from the logo
  muted: "#64748B",
  faint: "#94A3B8",
  danger: "#C2410C",
  success: "#16A34A",
  warn: "#B7791F",
  dark: "#0F2F58",
  darker: "#0A2142",
};
/** Soft card shadow used everywhere. */
export const shadow = {
  shadowColor: "#0F2F58",
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const money = (n, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));
export const fmtDate = (d) => (d ? format(new Date(d), "MMM d, yyyy") : "—");
export const fmtDateTime = (d) =>
  d ? format(new Date(d), "MMM d · h:mm a") : "—";
export const fmtRelative = (d) =>
  d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "—";
export const isOverdue = (d) => !!d && isPast(new Date(d));

/** Returns `value` only after it stopped changing for `ms` (used for search boxes). */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------
// Keyboard handling
// A ScrollView that always scrolls the field you are typing in so it is
// visible above the keyboard (works on every phone size, Android + iOS).
// ---------------------------------------------------------------------
const RevealCtx = createContext(null);
/** Inside a KeyboardScrollView: call it to bring the focused field into view. */
export const useRevealInput = () => useContext(RevealCtx);

export function KeyboardScrollView({ children, onScroll, ...props }) {
  const ref = useRef(null);
  const offsetY = useRef(0);
  const reveal = useCallback(() => {
    setTimeout(
      () => {
        const input = TextInput.State?.currentlyFocusedInput?.();
        const sv = ref.current;
        const host = sv?.getNativeScrollRef?.() ?? sv;
        if (!input?.measureInWindow || !host?.measureInWindow) return;
        host.measureInWindow((_sx, sy, _sw, sh) => {
          input.measureInWindow((_ix, iy, _iw, ih) => {
            if (!sh) return;
            // the visible part of the list = above the keyboard
            const kb = Keyboard.isVisible?.() ? Keyboard.metrics?.() : null;
            const visibleBottom =
              Math.min(sy + sh, kb?.screenY ?? Infinity) - 16;
            const visibleTop = sy + 12;
            const inputBottom =
              iy + Math.min(ih, Math.max(40, visibleBottom - visibleTop - 8));
            let delta = 0;
            if (inputBottom > visibleBottom)
              delta = inputBottom - visibleBottom;
            else if (iy < visibleTop) delta = iy - visibleTop;
            if (Math.abs(delta) > 2)
              sv.scrollTo({
                y: Math.max(0, offsetY.current + delta),
                animated: true,
              });
          });
        });
      },
      Platform.OS === "ios" ? 80 : 180,
    );
  }, []);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", reveal);
    return () => sub.remove();
  }, [reveal]);
  return (
    <RevealCtx.Provider value={reveal}>
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        {...props}
        onScroll={(e) => {
          offsetY.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
      >
        {children}
      </ScrollView>
    </RevealCtx.Provider>
  );
}

const TONES = {
  new: "#1E8F99",
  contacted: "#6B4A9E",
  qualified: "#B7791F",
  proposal: "#C2410C",
  won: "#2F7D4A",
  lost: "#94A3B8",
  pending: "#B7791F",
  done: "#2F7D4A",
  cancelled: "#94A3B8",
  todo: "#64748B",
  in_progress: "#1E8F99",
  onboarding: "#6B4A9E",
  on_hold: "#B7791F",
  completed: "#2F7D4A",
  paid: "#2F7D4A",
  overdue: "#C2410C",
  refunded: "#94A3B8",
  low: "#94A3B8",
  medium: "#B7791F",
  high: "#C2410C",
  call: "#DB2777",
  meeting: "#EA580C",
  reminder: "#D97706",
  email: "#2563EB",
  whatsapp: "#16A34A",
  followup: "#DB2777",
  task: "#7C3AED",
  not_interested: "#DC2626",
  hanged_up: "#E11D48",
};
export const toneOf = (v) => TONES[v] ?? "#64748B";
/** Soft coloured pill: dot + label. */
export function Badge({ value, style, label }) {
  const c = toneOf(value);
  return (
    <View style={[s.badge, { backgroundColor: c + "1A" }, style]}>
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }}
      />
      <Text style={[s.badgeText, { color: c }]} numberOfLines={1}>
        {label ?? humanize(value)}
      </Text>
    </View>
  );
}
/** Small coloured icon tile used in headers and lists. */
export function IconTile({
  icon,
  color = C.brand,
  bg = C.brandLight,
  size = 38,
  iconSize,
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={icon}
        size={iconSize ?? Math.round(size * 0.5)}
        color={color}
      />
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function SectionTitle({
  title,
  action,
  onAction,
  icon,
  color = C.brand,
  bg = C.brandLight,
  count,
  sub,
}) {
  return (
    <View style={s.sectionRow}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
      >
        {icon && <IconTile icon={icon} color={color} bg={bg} size={32} />}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={s.sectionTitle}>{title}</Text>
            {count > 0 && (
              <View
                style={{
                  backgroundColor: "#E4E9F0",
                  borderRadius: 999,
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "800", color: C.muted }}
                >
                  {count}
                </Text>
              </View>
            )}
          </View>
          {sub ? (
            <Text
              style={{ fontSize: 12, color: C.muted, marginTop: 1 }}
              numberOfLines={1}
            >
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {action && (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [s.actionPill, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
export function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}
/** Password field with an eye button to show / hide what you type. */
export function PasswordInput({ style, onFocus, ...props }) {
  const [show, setShow] = useState(false);
  const reveal = useRevealInput();
  return (
    <View style={{ justifyContent: "center" }}>
      <TextInput
        placeholderTextColor={C.faint}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        onFocus={(e) => {
          onFocus?.(e);
          reveal?.();
        }}
        secureTextEntry={!show}
        style={[s.input, { paddingRight: 46 }, style]}
      />
      <Pressable
        onPress={() => setShow((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 46,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={show ? "eye-off-outline" : "eye-outline"}
          size={21}
          color={C.muted}
        />
      </Pressable>
    </View>
  );
}
export function Input({ onFocus, onContentSizeChange, ...props }) {
  const reveal = useRevealInput();
  return (
    <TextInput
      placeholderTextColor={C.faint}
      {...props}
      onFocus={(e) => {
        onFocus?.(e);
        reveal?.();
      }}
      onContentSizeChange={(e) => {
        onContentSizeChange?.(e);
        if (props.multiline) reveal?.();
      }}
      style={[
        s.input,
        // long text scrolls inside the box instead of growing under the keyboard
        props.multiline && {
          minHeight: 90,
          maxHeight: 170,
          textAlignVertical: "top",
        },
        props.style,
      ]}
    />
  );
}
/** Horizontal scrollable chip selector used in place of <select>. */
export function Chips({ value, options, onChange, allowEmpty }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {allowEmpty && (
        <Chip active={!value} label="All" onPress={() => onChange("")} />
      )}
      {options.map((o) => (
        <Chip
          key={o.value}
          active={value === o.value}
          label={o.label}
          onPress={() => onChange(o.value)}
        />
      ))}
    </ScrollView>
  );
}
export function Chip({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
export const enumOptions = (values) =>
  values.map((v) => ({ value: v, label: humanize(v) }));

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
}) {
  const bg = {
    primary: C.brand,
    secondary: "#fff",
    danger: C.danger,
    ghost: "transparent",
  }[variant];
  const fg = {
    primary: "#fff",
    secondary: C.text,
    danger: "#fff",
    ghost: C.brand,
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.7 : 1 },
        variant === "secondary" && { borderWidth: 1, borderColor: C.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={17} color={fg} />}
          <Text style={[s.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
export function IconButton({ icon, onPress, color = C.muted, size = 20 }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={C.brand} />
    </View>
  );
}
export function Empty({ title, hint, icon = "file-tray-outline" }) {
  return (
    <View style={{ padding: 28, alignItems: "center" }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 18,
          backgroundColor: "#EAF0F5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color={C.faint} />
      </View>
      <Text
        style={{
          marginTop: 10,
          fontWeight: "800",
          color: C.text,
          fontSize: 15,
        }}
      >
        {title}
      </Text>
      {hint && (
        <Text
          style={{
            marginTop: 4,
            color: C.faint,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}
export function ErrorBox({ message, onRetry }) {
  return (
    <View
      style={{
        margin: 16,
        padding: 14,
        backgroundColor: "#fef2f2",
        borderRadius: 12,
      }}
    >
      <Text style={{ color: C.danger, fontSize: 13 }}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry}>
          <Text style={[s.link, { marginTop: 6 }]}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Height of the on-screen keyboard (0 when hidden). */
function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setH(e?.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setH(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

export function Sheet({ open, onClose, title, children }) {
  const insets = useSafeAreaInsets();
  // Keep the sheet's top edge stable while Android resizes for the keyboard.
  // Only the form's scrollable area changes height; the whole modal does not jump.
  const topSpace = Math.max(insets.top, Platform.OS === "android" ? 72 : 60);

  return (
    <RNModal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{ height: topSpace, flexShrink: 0 }}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />
        <View
          style={[
            s.sheet,
            {
              flex: 1,
              flexShrink: 0,
              paddingBottom: Platform.OS === "ios" ? insets.bottom : 0,
            },
          ]}
        >
          <View style={s.sheetHeader}>
            <Text style={[s.sheetTitle, { flex: 1 }]} numberOfLines={1}>
              {title}
            </Text>
            <IconButton icon="close" onPress={onClose} />
          </View>
          <KeyboardScrollView
            style={{ flex: 1 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          >
            {children}
          </KeyboardScrollView>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
export function Avatar({ name, size = 36 }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const palette = [
    "#0B857D",
    "#0F2F58",
    "#6B4A9E",
    "#2F7D4A",
    "#B7791F",
    "#1E5A8A",
  ];
  const bg =
    palette[
      [...(name ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0) %
        palette.length
    ];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>
        {initials}
      </Text>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
    ...shadow,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  link: { color: C.brand, fontWeight: "700", fontSize: 13 },
  actionPill: {
    backgroundColor: C.brandLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: { fontSize: 13, fontWeight: "600", color: C.muted, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    color: C.text,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.dark, borderColor: C.dark },
  chipText: { fontSize: 13, color: C.muted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  btnText: { fontSize: 15, fontWeight: "700" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: "700", color: C.muted },
  backdrop: { flex: 1, backgroundColor: "rgba(10,33,66,0.5)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexShrink: 1,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  title: { fontSize: 17, fontWeight: "700", color: C.text },
  muted: { color: C.muted, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
