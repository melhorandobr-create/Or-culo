import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, SourceMonitor, ApiError } from "../api/client";

export default function IntelligenceScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<SourceMonitor[]>([]);
  const [query, setQuery] = useState("");

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

  const filtered = monitors.filter((m) =>
    !query.trim() || String(m.query || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inteligência</Text>
        <Text style={styles.subtitle}>Consultar e capturar fontes para os casos</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={color.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Consultar fonte, nome ou local"
          placeholderTextColor={color.textFaint}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma fonte monitorada ainda.</Text>
          ) : (
            filtered.map((m) => (
              <View key={m.id} style={styles.card}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={styles.icon}>
                    <Ionicons name="people-outline" size={17} color={color.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.query}</Text>
                    <Text style={styles.meta}>{m.kind || "Monitoramento"} {m.tribunal ? `· ${m.tribunal}` : ""}</Text>
                  </View>
                </View>
                {m.purpose ? <Text style={styles.snippet}>{m.purpose}</Text> : null}
              </View>
            ))
          )}

          <Pressable style={styles.captureButton}>
            <Ionicons name="add" size={15} color={color.primary} />
            <Text style={styles.captureButtonText}>Capturar e preservar fonte</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function buildStyles(theme: Theme) {
  const { color, space, radius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg, paddingTop: 44 },
    header: { paddingHorizontal: space.xl, paddingTop: space.md },
    title: { fontSize: 23, fontWeight: "700", color: color.text, letterSpacing: -0.4 },
    subtitle: { fontSize: 12.5, color: color.textMuted, marginTop: 4 },
    searchBox: {
      marginHorizontal: space.xl,
      marginTop: space.lg,
      backgroundColor: color.surface,
      borderRadius: radius.xl,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      ...theme.shadow.card,
    },
    searchInput: { flex: 1, fontSize: 13.5, color: color.text },
    list: { padding: space.xl, gap: space.md },
    emptyText: { textAlign: "center", color: color.textFaint, fontSize: 13, paddingVertical: 30 },
    errorText: { color: color.danger, fontSize: 12.5, marginBottom: 8 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, ...theme.shadow.card },
    icon: { width: 38, height: 38, borderRadius: 11, backgroundColor: color.infoTint, alignItems: "center", justifyContent: "center" },
    name: { fontSize: 14, fontWeight: "600", color: color.text },
    meta: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    snippet: { fontSize: 12, color: "#475569", marginTop: 10, backgroundColor: color.bg, borderRadius: 9, padding: 10, lineHeight: 17 },
    captureButton: {
      borderWidth: 1.5,
      borderColor: color.border,
      borderStyle: "dashed",
      borderRadius: radius.xl,
      padding: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    captureButtonText: { fontSize: 13.5, fontWeight: "600", color: color.primary },
  });
}
