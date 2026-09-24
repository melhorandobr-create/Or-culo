import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, SourceMonitor, ApiError } from "../api/client";

export default function PublicSourcesScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<SourceMonitor[]>([]);

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

  const alertCount = monitors.reduce((acc, m: any) => acc + (m.alertCount || 0), 0);

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
              <Text style={[styles.statValue, { color: color.warning }]}>{alertCount}</Text>
              <Text style={styles.statLabel}>Alertas ativos</Text>
            </View>
          </View>

          <Pressable style={styles.primaryButton}>
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={styles.primaryButtonText}>Novo monitoramento</Text>
          </Pressable>

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
                  <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Detectado e ativo</Text>
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
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    emptyText: { color: color.textFaint, fontSize: 13 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, ...theme.shadow.card },
    query: { fontSize: 13.5, fontWeight: "600", color: color.text },
    meta: { fontSize: 11.5, color: color.textFaint, marginTop: 2 },
    tribunalBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color.bg, borderRadius: 8, padding: 7, marginTop: 10 },
    tribunalText: { fontSize: 11, color: color.textMuted },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.success },
    statusText: { fontSize: 11, color: color.success, fontWeight: "600" },
  });
}
