import { useState } from "react";
import { KeyboardAvoidingView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { Button, C, Input, KeyboardScrollView, PasswordInput } from "@/components/ui";
import { BrandLogo } from "@/components/Brand";

/** Label + input with an icon on the left. */
function LabeledField({ label, icon, children }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted, marginBottom: 6 }}>{label}</Text>
      <View style={{ justifyContent: "center" }}>
        {children}
        <Ionicons
          name={icon}
          size={19}
          color={C.faint}
          style={{ position: "absolute", left: 13 }}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const friendly = (err) =>
  err === "Invalid login credentials"
    ? "That email and password don't match. Check both and try again."
    : err;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (err) setError(friendly(err));
  }

  const inputStyle = { paddingLeft: 42, paddingVertical: 13, borderRadius: 12, backgroundColor: "#F7F9FB" };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.dark, overflow: "hidden" }}>
      {/* soft background circles */}
      <View pointerEvents="none" style={{ position: "absolute", top: -120, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: C.accent, opacity: 0.14 }} />
      <View pointerEvents="none" style={{ position: "absolute", bottom: -140, left: -110, width: 320, height: 320, borderRadius: 160, backgroundColor: C.accent, opacity: 0.08 }} />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <KeyboardScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, paddingVertical: 24 }}
        >
          {/* AucWin logo, centred */}
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <BrandLogo width={250} variant="white" />
          </View>

          {/* Card */}
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 22,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 10,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, textAlign: "center" }}>Welcome back</Text>
            <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", marginTop: 4, marginBottom: 22 }}>
              Sign in with the email and password{"\n"}your administrator gave you
            </Text>

            <LabeledField label="Email" icon="mail-outline">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                style={inputStyle}
              />
            </LabeledField>

            <LabeledField label="Password" icon="lock-closed-outline">
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                style={inputStyle}
              />
            </LabeledField>

            {error && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#FFF4ED",
                  borderColor: "#FFE4D1",
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Ionicons name="alert-circle-outline" size={18} color={C.danger} />
                <Text style={{ color: C.danger, fontSize: 13, flex: 1 }}>{error}</Text>
              </View>
            )}

            <Button
              title="Sign in"
              onPress={submit}
              loading={busy}
              disabled={!email || !password}
              style={{ paddingVertical: 15, borderRadius: 12, marginTop: 4 }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 22 }}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#64748B" />
            <Text style={{ color: "#94A3B8", fontSize: 12, textAlign: "center" }}>
              Accounts are created by your administrator
            </Text>
          </View>
        </KeyboardScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
