import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, ActivationCode, ApiError } from "../api/client";

export default function ActivationCodesScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<ActivationCode[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listActivationCodes();
      setCodes(res.codes || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setCreating(true);
    try {
      await api.createActivationCode({ role: "operativo", secretClearance: false });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível gerar o código.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await api.revokeActivationCode(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível revogar.");
    }
  }

  const active = codes.filter((c) => !c.usedByUserId);
  const used = codes.filter((c) => c.usedByUserId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Códigos de ativação</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Cada código vincula um novo operativo a um papel e a um nível de sigilo antes mesmo do
            primeiro acesso. Uso único.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable style={styles.primaryButton} onPress={handleCreate} disabled={creating}>
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Gerar código de ativação</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.sectionLabel}>Ativos</Text>
          <View style={{ gap: theme.space.md, marginBottom: theme.space.xxl }}>
            {active.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum código ativo.</Text>
            ) : (
              active.map((c) => (
                <View key={c.id} style={styles.card}>
                  <View style={styles.codeRow}>
                    <Text style={styles.codeText}>{c.code}</Text>
                    <View style={styles.availableBadge}>
                      <View style={styles.availableDot} />
                      <Text style={styles.availableText}>DISPONÍVEL</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{c.role || "operativo"}</Text>
                    </View>
                    {c.secretClearance && (
                      <View style={[styles.tag, { backgroundColor: color.dangerTint }]}>
                        <Text style={[styles.tagText, { color: color.danger }]}>Acesso a Secreto</Text>
                      </View>
                    )}
                  </View>
                  {c.linkedName ? <Text style={styles.linkedText}>Vinculado a {c.linkedName}</Text> : null}
                  <Pressable style={styles.revokeButton} onPress={() => handleRevoke(c.id)}>
                    <Text style={styles.revokeText}>Revogar</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionLabel}>Utilizados</Text>
          <View style={styles.card}>
            {used.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum código utilizado ainda.</Text>
            ) : (
              used.map((c, i) => (
                <View key={c.id} style={[styles.usedRow, i < used.length - 1 && styles.usedRowBorder]}>
                  <Text style={styles.usedCode}>{c.code}</Text>
                  <Text style={styles.usedBy}>{c.usedByUserId}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function buildStyles(theme: Theme) {
  const { color, space, radius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg, paddingTop: 44 },
    header: { paddingHorizontal: 16, paddingTop: 6, flexDirection: "row", alignItems: "center", gap: 10 },
    backButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", ...theme.shadow.card },
    headerTitle: { fontSize: 17, fontWeight: "700", color: color.text },
    scroll: { padding: space.xl },
    intro: { fontSize: 12.5, color: color.textMuted, lineHeight: 19, marginBottom: space.lg },
    errorText: { color: color.danger, fontSize: 12.5, marginBottom: 8 },
    primaryButton: { backgroundColor: color.primary, borderRadius: radius.lg, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: space.xxl },
    primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 14.5 },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    emptyText: { color: color.textFaint, fontSize: 13 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, ...theme.shadow.card },
    codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    codeText: { fontSize: 15, fontWeight: "700", color: color.text, letterSpacing: 1 },
    availableBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: color.successTint, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
    availableDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.success },
    availableText: { fontSize: 10.5, color: color.success, fontWeight: "700" },
    tag: { backgroundColor: "#F2F4F7", borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9 },
    tagText: { fontSize: 11, color: "#344054", fontWeight: "600" },
    linkedText: { fontSize: 11.5, color: color.textFaint, marginTop: 10 },
    revokeButton: { marginTop: 12, alignSelf: "flex-start" },
    revokeText: { fontSize: 12, color: color.danger, fontWeight: "600" },
    usedRow: { paddingVertical: 12 },
    usedRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
    usedCode: { fontSize: 12.5, color: color.textFaint, letterSpacing: 0.6 },
    usedBy: { fontSize: 11, color: color.textMuted, marginTop: 2 },
  });
}
