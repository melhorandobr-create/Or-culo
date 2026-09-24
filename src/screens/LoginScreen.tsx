import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { ApiError } from "../api/client";

export default function LoginScreen() {
  const { login, submitMfaChallenge, cancelMfaChallenge, mfaChallenge, sessionExpired } =
    useAuth();
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    sessionExpired ? "Sua sessão expirou. Entre de novo para continuar." : null
  );
  const [loading, setLoading] = useState(false);

  // Passo 2: desafio de MFA (aberto quando mfaChallenge !== null)
  const [mode, setMode] = useState<"otp" | "recovery">("otp");
  const [code, setCode] = useState("");

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Sem conexão com a internet. Tente de novo."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit() {
    setError(null);
    setLoading(true);
    try {
      await submitMfaChallenge(
        mode === "otp" ? { otp: code.trim() } : { recoveryCode: code.trim() }
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Sem conexão com a internet. Tente de novo."
      );
    } finally {
      setLoading(false);
    }
  }

  if (mfaChallenge) {
    return (
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>ORÁCULO</Text>
          <Text style={styles.subtitle}>Verificação em duas etapas</Text>

          <View style={styles.mfaTabs}>
            <Pressable
              style={[styles.mfaTab, mode === "otp" && styles.mfaTabActive]}
              onPress={() => {
                setMode("otp");
                setCode("");
                setError(null);
              }}
            >
              <Text style={[styles.mfaTabText, mode === "otp" && styles.mfaTabTextActive]}>
                Código do autenticador
              </Text>
            </Pressable>
            <Pressable
              style={[styles.mfaTab, mode === "recovery" && styles.mfaTabActive]}
              onPress={() => {
                setMode("recovery");
                setCode("");
                setError(null);
              }}
            >
              <Text style={[styles.mfaTabText, mode === "recovery" && styles.mfaTabTextActive]}>
                Usar código de recuperação
              </Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            placeholder={mode === "otp" ? "Código de 6 dígitos" : "XXXXXX-XXXXXX"}
            placeholderTextColor={color.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType={mode === "otp" ? "number-pad" : "default"}
            value={code}
            onChangeText={setCode}
            autoFocus
          />

          {mode === "recovery" && (
            <Text style={styles.hint}>
              Cada código de recuperação só funciona uma vez. Depois de usar, gere um novo lote
              nas configurações de segurança.
            </Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, (loading || !code) && styles.buttonDisabled]}
            onPress={handleMfaSubmit}
            disabled={loading || !code}
          >
            {loading ? (
              <ActivityIndicator color={color.text} />
            ) : (
              <Text style={styles.buttonText}>Confirmar</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.linkButton}
            onPress={() => {
              cancelMfaChallenge();
              setCode("");
              setError(null);
            }}
          >
            <Text style={styles.linkButtonText}>Voltar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flexOne}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>ORÁCULO</Text>
        <Text style={styles.subtitle}>Acesso institucional seguro</Text>

        <TextInput
          style={styles.input}
          placeholder="Usuário"
          placeholderTextColor={color.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />

        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Senha"
            placeholderTextColor={color.textFaint}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            style={styles.passwordToggle}
            accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={color.textFaint}
            />
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, (loading || !username || !password) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || !username || !password}
        >
          {loading ? (
            <ActivityIndicator color={color.text} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function buildStyles(theme: Theme) {
  const { color, font, radius, space } = theme;
  return StyleSheet.create({
    flexOne: { flex: 1, backgroundColor: color.bg },
    container: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: space.xxl + 4,
      paddingVertical: space.xxl,
      backgroundColor: color.bg,
    },
    logo: {
      fontFamily: font.display,
      fontSize: 36,
      fontWeight: "700",
      color: color.text,
      textAlign: "center",
      marginBottom: 4,
    },
    subtitle: {
      fontFamily: font.body,
      fontSize: 14,
      color: color.textMuted,
      textAlign: "center",
      marginBottom: space.xxxl,
    },
    input: {
      backgroundColor: color.surface,
      color: color.text,
      borderRadius: radius.md - 2,
      paddingHorizontal: space.lg,
      paddingVertical: space.lg - 2,
      marginBottom: space.md,
      fontSize: 16,
      fontFamily: font.bodyMedium,
      borderWidth: 1,
      borderColor: color.border,
    },
    passwordRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: color.surface,
      borderRadius: radius.md - 2,
      marginBottom: space.md,
      borderWidth: 1,
      borderColor: color.border,
    },
    passwordInput: {
      flex: 1,
      color: color.text,
      paddingHorizontal: space.lg,
      paddingVertical: space.lg - 2,
      fontSize: 16,
      fontFamily: font.bodyMedium,
    },
    passwordToggle: { paddingHorizontal: space.md },
    hint: {
      fontFamily: font.body,
      fontSize: 12,
      color: color.textMuted,
      marginBottom: space.md,
    },
    error: {
      fontFamily: font.body,
      color: color.danger,
      marginBottom: space.md,
      textAlign: "center",
    },
    button: {
      backgroundColor: color.primary,
      borderRadius: radius.md - 2,
      paddingVertical: space.lg - 2,
      alignItems: "center",
      marginTop: space.sm,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontFamily: font.bodyBold, color: "#fff", fontSize: 16, fontWeight: "700" },
    linkButton: { alignItems: "center", marginTop: space.lg },
    linkButtonText: { fontFamily: font.body, color: color.primary, fontSize: 14 },
    mfaTabs: {
      flexDirection: "row",
      backgroundColor: color.surface,
      borderRadius: radius.md - 2,
      borderWidth: 1,
      borderColor: color.border,
      marginBottom: space.lg,
      overflow: "hidden",
    },
    mfaTab: { flex: 1, paddingVertical: space.md, alignItems: "center" },
    mfaTabActive: { backgroundColor: color.primary },
    mfaTabText: { fontFamily: font.bodyMedium, color: color.textMuted, fontSize: 13 },
    mfaTabTextActive: { color: "#fff", fontWeight: "700" },
  });
}
