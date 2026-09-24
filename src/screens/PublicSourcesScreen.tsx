import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, SourceMonitor, ApiError } from "../api/client";

type Kind = "company" | "court" | "url";

export default function PublicSourcesScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<SourceMonitor[]>([]);
  const [checking, setChecking] = useState<Record<string, string>>({});

  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<Kind>("company");
  const [query, setQuery] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listSourceMonitors();
      setMonitors(res.monitors || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = monitors.filter((m) => (m.createdAt || 0) >= weekAgo).length;

  async function handleCreate() {
    setFormError(null);
    if (purpose.trim().length < 10) {
      setFormError("Descreva a finalidade do monitoramento (mín. 10 caracteres).");
      return;
    }
    if (!query.trim()) {
      setFormError("Informe o que monitorar.");
      return;
    }
    setSaving(true);
    try {
      await api.createSourceMonitor({
        kind,
        query: query.trim(),
        tribunal: kind === "court" ? tribunal.trim() : undefined,
        purpose: purpose.trim(),
      });
      setCreating(false);
      setQuery("");
      setTribunal("");
      setPurpose("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível criar o monitoramento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck(id: string) {
    setChecking((prev) => ({ ...prev, [id]: "..." }));
    try {
      const result = await api.checkSourceMonitor(id);
      setChecking((prev) => ({ ...prev, [id]: `Verificado agora — ${JSON.stringify(result).slice(0, 80)}` }));
    } catch (err) {
      setChecking((prev) => ({ ...prev, [id]: err instanceof ApiError ? err.message : "Falha ao verificar." }));
    }
  }

  function handleDelete(id: string) {
    Alert.alert("Remover monitoramento?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteSourceMonitor(id);
            await load();
          } catch (err) {
            Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível remover.");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Central de dados e fontes</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{monitors.length}</Text>
              <Text style={styles.statLabel}>Fontes monitoradas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: color.primary }]}>{newThisWeek}</Text>
              <Text style={styles.statLabel}>Novos esta semana</Text>
            </View>
          </View>

          {!creating ? (
            <Pressable style={styles.primaryButton} onPress={() => setCreating(true)}>
              <Ionicons name="add" size={15} color="#fff" />
              <Text style={styles.primaryButtonText}>Novo monitoramento</Text>
            </Pressable>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Novo monitoramento</Text>
              <View style={styles.kindRow}>
                {(["company", "court", "url"] as Kind[]).map((k) => (
                  <Pressable key={k} style={[styles.kindChip, kind === k && styles.kindChipActive]} onPress={() => setKind(k)}>
                    <Text style={[styles.kindChipText, kind === k && styles.kindChipTextActive]}>
                      {k === "company" ? "CNPJ" : k === "court" ? "Processo" : "URL"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder={kind === "company" ? "CNPJ (14 dígitos)" : kind === "court" ? "Número CNJ (20 dígitos)" : "https://..."}
                placeholderTextColor={color.textFaint}
                value={query}
                onChangeText={setQuery}
                keyboardType={kind === "url" ? "url" : "number-pad"}
                autoCapitalize="none"
              />
              {kind === "court" && (
                <TextInput
                  style={styles.input}
                  placeholder="Sigla do tribunal (ex.: TJBA)"
                  placeholderTextColor={color.textFaint}
                  value={tribunal}
                  onChangeText={setTribunal}
                  autoCapitalize="characters"
                />
              )}
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
                placeholder="Finalidade legítima da consulta (mín. 10 caracteres)"
                placeholderTextColor={color.textFaint}
                value={purpose}
                onChangeText={setPurpose}
                multiline
              />
              {formError && <Text style={styles.errorText}>{formError}</Text>}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }, saving && { opacity: 0.6 }]}
                  disabled={saving}
                  onPress={handleCreate}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Criar</Text>}
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setCreating(false);
                    setFormError(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>Monitoramentos</Text>
          <View style={{ gap: theme.space.md }}>
            {monitors.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma fonte acompanhada ainda.</Text>
            ) : (
              monitors.map((m) => (
                <View key={m.id} style={styles.card}>
                  <Text style={styles.query}>{m.query}</Text>
                  <Text style={styles.meta}>
                    {m.kind || "Monitoramento"} {m.purpose ? `· ${m.purpose}` : ""}
                  </Text>
                  {m.tribunal ? (
                    <View style={styles.tribunalBox}>
                      <Ionicons name="business-outline" size={12} color={color.textMuted} />
                      <Text style={styles.tribunalText}>{m.tribunal}</Text>
                    </View>
                  ) : null}
                  {checking[m.id] && <Text style={styles.checkResult}>{checking[m.id]}</Text>}
                  <View style={styles.cardActions}>
                    <Pressable style={styles.actionButton} onPress={() => handleCheck(m.id)}>
                      <Ionicons name="refresh-outline" size={13} color={color.primary} />
                      <Text style={styles.actionButtonText}>Verificar</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={() => handleDelete(m.id)}>
                      <Ionicons name="trash-outline" size={13} color={color.danger} />
                      <Text style={[styles.actionButtonText, { color: color.danger }]}>Remover</Text>
                    </Pressable>
                  </View>
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
    errorText: { color: color.danger, fontSize: 12.5, marginBottom: 8 },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: space.lg },
    statCard: { flex: 1, backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, ...theme.shadow.card },
    statValue: { fontSize: 22, fontWeight: "700", color: color.text },
    statLabel: { fontSize: 11.5, color: color.textMuted, marginTop: 3 },
    primaryButton: { backgroundColor: color.primary, borderRadius: radius.lg, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: space.xxl },
    primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
    formCard: { backgroundColor: color.surface, borderRadius: radius.xl, padding: space.lg, marginBottom: space.xxl, ...theme.shadow.card, gap: 10 },
    formTitle: { fontSize: 14, fontWeight: "700", color: color.text, marginBottom: 4 },
    kindRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
    kindChip: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: color.bg, borderWidth: 1, borderColor: color.border },
    kindChipActive: { backgroundColor: color.primary, borderColor: color.primary },
    kindChipText: { fontSize: 12, fontWeight: "600", color: color.textMuted },
    kindChipTextActive: { color: "#fff" },
    input: { backgroundColor: color.bg, borderRadius: 10, borderWidth: 1, borderColor: color.border, padding: 12, fontSize: 13.5, color: color.text },
    cancelButton: { paddingHorizontal: 18, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: color.bg, borderWidth: 1, borderColor: color.border },
    cancelButtonText: { fontSize: 13, fontWeight: "600", color: color.textMuted },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    emptyText: { color: color.textFaint, fontSize: 13 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, ...theme.shadow.card },
    query: { fontSize: 13.5, fontWeight: "600", color: color.text },
    meta: { fontSize: 11.5, color: color.textFaint, marginTop: 2 },
    tribunalBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color.bg, borderRadius: 8, padding: 7, marginTop: 10 },
    tribunalText: { fontSize: 11, color: color.textMuted },
    checkResult: { fontSize: 11, color: color.textMuted, marginTop: 8, fontStyle: "italic" },
    cardActions: { flexDirection: "row", gap: 16, marginTop: 12 },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 5 },
    actionButtonText: { fontSize: 12, fontWeight: "600", color: color.primary },
  });
}
