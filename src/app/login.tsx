/**
 * Sign in / create an account.
 *
 * Reached from Settings, from the sign-in wall when the AI allowance runs out,
 * and from the axios interceptor when a refresh finally fails — which is why
 * this route has to exist even before anyone chooses to sign in.
 */
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";

import { Box, TextInput } from "@/components/atoms";
import {
  Divider,
  IconGlobe,
  ProtoScreen,
  ScreenHeader,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useToastStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useProtoTheme } from "@/theme/proto";
import { authApi, getApiErrorMessage, tokenStorage } from "@/utils/axios";

// Native Google sign-in via the on-device account picker — no browser, no
// redirect scheme (which is what the browser flow kept tripping over). The
// webClientId makes Google issue an ID token our backend can verify; the
// Android OAuth client (package + SHA-1) is what gates the request itself.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

type Mode = "register" | "signin";

export default function LoginScreen() {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registering = mode === "register";
  const ready =
    email.trim().includes("@") &&
    password.length >= 8 &&
    (!registering || name.trim().length > 0);

  const finishGoogle = async (idToken: string) => {
    setBusy(true);
    setError(null);
    try {
      // An anonymous session is upgraded in place (`/auth/link/google`) so the
      // reading already saved on it carries over; if that Google identity
      // already owns an account, sign into it instead (`/auth/google`).
      let result;
      if (tokenStorage.getAccessToken()) {
        try {
          result = await authApi.linkGoogle(idToken);
        } catch {
          result = await authApi.google(idToken);
        }
      } else {
        result = await authApi.google(idToken);
      }
      setUser(result.user);
      showToast("Signed in with Google");
      router.back();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (busy) return;
    setError(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type === "cancelled") return;
      const idToken = response.data?.idToken;
      if (!idToken) {
        setError("Google didn't return a sign-in token. Try again.");
        return;
      }
      await finishGoogle(idToken);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) return;
      setError("Google sign-in couldn't complete. Try again.");
    }
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Signing up upgrades the anonymous row in place (`/auth/link/email`)
      // rather than creating a second user — everything already read,
      // highlighted and saved belongs to that row. `/auth/register` is only
      // right when there is no session to upgrade.
      const result = registering
        ? await (tokenStorage.getAccessToken() ? authApi.linkEmail : authApi.register)({
            email: email.trim(),
            name: name.trim(),
            password,
          })
        : await authApi.login({ email: email.trim(), password });
      setUser(result.user);
      showToast(registering ? "Account created" : "Signed in");
      router.back();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProtoScreen>
      <ScreenHeader onBack={() => router.back()} title="" />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 8, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Box gap={8}>
          <Text ls={-0.3} serif size={27} weight="600">
            {registering ? "Create your account" : "Welcome back"}
          </Text>
          <Text color={t.sub} lh={20} size={13.5}>
            Your highlights, notes and words are saved on this device already.
            Signing in keeps them across devices and unlocks Lexi.
          </Text>
        </Box>

        {/* Native Google sign-in (on-device account picker). */}
        <Tap disabled={busy} onPress={signInWithGoogle} scale={0.97}>
          <Box
            align="center"
            bg={t.card}
            borderColor={t.line}
            borderWidth={1}
            direction="row"
            gap={10}
            justify="center"
            paddingY={14}
            rounded={13}
          >
            <IconGlobe color={t.ink} size={17} />
            <Text size={14} weight="600">
              Continue with Google
            </Text>
          </Box>
        </Tap>

        <Box align="center" direction="row" gap={12}>
          <Box flex={1}>
            <Divider />
          </Box>
          <Text color={t.faint} size={12}>
            or
          </Text>
          <Box flex={1}>
            <Divider />
          </Box>
        </Box>

        <Box gap={10}>
          {registering ? (
            <Field
              onChangeText={setName}
              placeholder="Your name"
              value={name}
            />
          ) : null}
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            value={email}
          />
          <Field
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            value={password}
          />
          {password.length > 0 && password.length < 8 ? (
            <Text color={t.faint} size={12}>
              At least 8 characters.
            </Text>
          ) : null}
          {error ? (
            <Text color={t.accentText} lh={18} size={12.5}>
              {error}
            </Text>
          ) : null}
        </Box>

        <Tap disabled={!ready || busy} onPress={submit} scale={0.97}>
          <Box
            align="center"
            bg={ready ? t.accent : t.chip}
            paddingY={14}
            rounded={13}
          >
            <Text
              color={ready ? t.onAccent : t.faint}
              size={14}
              weight="600"
            >
              {busy
                ? "One moment…"
                : registering
                  ? "Create account"
                  : "Sign in"}
            </Text>
          </Box>
        </Tap>

        <Tap
          onPress={() => {
            setMode(registering ? "signin" : "register");
            setError(null);
          }}
          scale={0.98}
        >
          <Box align="center" paddingY={6}>
            <Text color={t.sub} size={13} weight="500">
              {registering
                ? "I already have an account"
                : "Create an account instead"}
            </Text>
          </Box>
        </Tap>
      </ScrollView>
    </ProtoScreen>
  );
}

function Field({
  autoCapitalize,
  keyboardType,
  onChangeText,
  placeholder,
  secureTextEntry,
  value,
}: {
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "email-address";
  onChangeText: (next: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
}) {
  const t = useProtoTheme();
  return (
    <TextInput
      autoCapitalize={autoCapitalize}
      backgroundColor={t.card}
      borderColor={t.line}
      borderWidth={1}
      fontSize={14.5}
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.faint}
      rounded={13}
      secureTextEntry={secureTextEntry}
      textColor={t.ink}
    />
  );
}
