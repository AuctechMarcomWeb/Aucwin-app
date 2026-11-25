import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { errMsg, setToken } from "@/lib/http";
import { changePassword, updateProfile } from "@/lib/api";
import { registerForPushNotifications } from "@/lib/notifications";
import { label } from "@/lib/types";
import {
  Avatar,
  Button,
  C,
  Field,
  Input,
  PasswordInput,
  Sheet,
} from "@/components/ui";
import { MODULES } from "@/lib/modules";
import { BrandLogo } from "@/components/Brand";

/** White rounded box that groups rows. */
function Group({ children }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 14,
        paddingVertical: 4,
        shadowColor: C.dark,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
      }}
    >
      {children}
    </View>
  );
}

/** One tappable row: coloured icon, title, optional subtitle, arrow. */
function Row({ icon, iconColor, iconBg, title, sub, onPress, last, danger }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "#F1F5F9",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: danger ? C.danger : C.text,
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{ color: C.muted, fontSize: 12.5, marginTop: 1 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={18} color={C.faint} />}
    </Pressable>
  );
}

function GroupTitle({ children }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "800",
        color: C.muted,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        marginTop: 20,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {children}
    </Text>
  );
}

export default function MoreScreen() {
  const nav = useNavigation();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile, isAdmin } = useAuth();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [pw, setPw] = useState("");
  const [curPw, setCurPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return Alert.alert("Name is required");
    if (pw && pw.length < 8)
      return Alert.alert("Password too short", "Use at least 8 characters.");
    if (pw && !curPw)
      return Alert.alert(
        "Current password needed",
        "Type your current password to set a new one.",
      );
    if (pw && pw === curPw)
      return Alert.alert(
        "Same password",
        "The new password must be different from your current one.",
      );
    setBusy(true);
    try {
      if (profile)
        await updateProfile(profile.id, {
          full_name: name.trim(),
          phone: phone || null,
        });
      if (pw) {
        const res = await changePassword(pw, curPw);
        if (res?.token) await setToken(res.token); // other devices are signed out; keep this one signed in
      }
      await refreshProfile();
      setEdit(false);
      setPw("");
      setCurPw("");
      Alert.alert(
        "Saved",
        pw
          ? "Your profile and password were updated. Other devices are signed out."
          : "Your profile was updated.",
      );
    } catch (e) {
      Alert.alert("Could not save", errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const openEdit = () => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setPw("");
    setCurPw("");
    setEdit(true);
  };

  const open = (m) => {
    if (m.route === "Leads") return nav.navigate("Leads");
    if (m.route === "Chat") return nav.navigate("Chat");
    if (m.route === "Calendar") return nav.navigate("Calendar");
    nav.navigate(m.route);
  };

  const enablePush = async () => {
    try {
      const t = await registerForPushNotifications();
      Alert.alert(
        t ? "Notifications enabled" : "Not available",
        t
          ? "This phone will receive follow-up reminders."
          : "Notifications work in the installed app (APK), not in Expo Go. Also allow notifications in phone settings.",
      );
    } catch (e) {
      Alert.alert("Error", errMsg(e));
    }
  };

  const modules = MODULES.filter((m) => !m.superOnly);
  const roleLine = profile
    ? `${label(profile.role)}${profile.department?.name ? ` · ${profile.department.name}` : ""}`
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {focused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= dark header with your profile ================= */}
        <View
          style={{
            backgroundColor: C.dark,
            paddingTop: insets.top + 16,
            paddingHorizontal: 18,
            paddingBottom: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -60,
              right: -50,
              width: 190,
              height: 190,
              borderRadius: 95,
              backgroundColor: C.accent,
              opacity: 0.16,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -70,
              left: -40,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: C.accent,
              opacity: 0.08,
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                borderRadius: 34,
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.35)",
              }}
            >
              <Avatar name={profile?.full_name} size={60} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: "#fff",
                  fontSize: 21,
                  fontWeight: "800",
                  letterSpacing: -0.3,
                }}
              >
                {profile?.full_name}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: "#94A3B8", fontSize: 13, marginTop: 2 }}
              >
                {profile?.email}
              </Text>
              {!!roleLine && (
                <View
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 7,
                    backgroundColor: "rgba(18,172,162,0.25)",
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: "#CCFBF1",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {roleLine}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Pressable
            onPress={openEdit}
            style={({ pressed }) => ({
              marginTop: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 11,
              borderRadius: 14,
              backgroundColor: pressed
                ? "rgba(255,255,255,0.2)"
                : "rgba(255,255,255,0.1)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            })}
          >
            <Ionicons name="create-outline" size={17} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              Edit profile & password
            </Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* ================= modules ================= */}
          <GroupTitle>All modules</GroupTitle>
          <Group>
            {modules.map((m) => (
              <Row
                key={m.key}
                icon={m.icon}
                iconColor={m.color}
                iconBg={m.bg}
                title={m.label}
                onPress={() => open(m)}
              />
            ))}
            {/* Everyone — including agents — can see their own call log. */}
            <Row
              icon="call"
              iconColor="#0D9488"
              iconBg="#CCFBF1"
              title="My calls"
              sub="Your outbound calls — answered, missed and talk time"
              onPress={() => nav.navigate("MyCalls")}
              last={!isAdmin}
            />
            {isAdmin && (
              <>
                <Row
                  icon="stats-chart"
                  iconColor={C.brand}
                  iconBg={C.brandLight}
                  title="Team overview"
                  sub="Pipeline, money and team performance"
                  onPress={() => nav.navigate("Overview")}
                />
                <Row
                  icon="git-network"
                  iconColor="#2563EB"
                  iconBg="#DBEAFE"
                  title="Data Sources"
                  sub="Where your leads come from"
                  onPress={() => nav.navigate("DataSources")}
                />
                <Row
                  icon="bar-chart"
                  iconColor="#7C3AED"
                  iconBg="#EDE9FE"
                  title="Reports"
                  sub="Agent outreach and calls"
                  onPress={() => nav.navigate("Reports")}
                />
                <Row
                  icon="git-branch"
                  iconColor="#0D9488"
                  iconBg="#CCFBF1"
                  title="Lead Stages"
                  sub="Add, rename, recolour and reorder your pipeline"
                  onPress={() => nav.navigate("Stages")}
                  last
                />
              </>
            )}
          </Group>

          {/* ================= account ================= */}
          <GroupTitle>Account</GroupTitle>
          <Group>
            <Row
              icon="notifications"
              iconColor="#D97706"
              iconBg="#FEF3C7"
              title="Enable notifications"
              sub="Get follow-up reminders on this phone"
              onPress={enablePush}
            />
            <Row
              icon="log-out-outline"
              iconColor={C.danger}
              iconBg="#FFEDD5"
              title="Sign out"
              danger
              last
              onPress={() =>
                Alert.alert(
                  "Sign out?",
                  "You will need your email and password to sign in again.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Sign out",
                      style: "destructive",
                      onPress: signOut,
                    },
                  ],
                )
              }
            />
          </Group>

          <View style={{ alignItems: "center", marginTop: 24, gap: 6 }}>
            <BrandLogo width={150} />
            <Text style={{ textAlign: "center", color: C.faint, fontSize: 12 }}>
              Version 1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit profile">
        <Field label="Full name">
          <Input value={name} onChangeText={setName} autoCapitalize="words" />
        </Field>
        <Field label="Phone">
          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </Field>
        <View
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: C.border,
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: C.text,
              marginBottom: 10,
            }}
          >
            Change password (optional)
          </Text>
          <Field label="New password">
            <PasswordInput
              value={pw}
              onChangeText={setPw}
              placeholder="At least 8 characters"
            />
          </Field>
          {!!pw && (
            <Field label="Current password">
              <PasswordInput
                value={curPw}
                onChangeText={setCurPw}
                placeholder="Your current password"
              />
            </Field>
          )}
          <Text style={{ fontSize: 12, color: C.muted, marginTop: -4 }}>
            Leave empty to keep your password. Changing it signs you out on
            other devices.
          </Text>
        </View>
        <Button title="Save" onPress={save} loading={busy} />
      </Sheet>
    </View>
  );
}
