import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { useAllCasesIntelligence } from "../hooks/useAllCasesIntelligence";
import { OfflineBanner } from "../components/OfflineBanner";

export default function SystemTimelineScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { loading, error, reports, intelByReportId, offline, cachedAt } = useAllCasesIntelligence();

  const events = useMemo(() => {
    const all: Array<{ id: string; title: string; description?: string; occurredAt: number; reportId: string; reportTitle: string; factType?: string }> = [];
    for (const r of reports) {
      const timeline = (intelByReportId[r.id] as any)?.timeline || [];
      for (const ev of timeline) {
        if (!ev.occurredAt) continue;
        all.push({
          id: ev.id || `${r.id}-${ev.occurredAt}`,
          title: ev.title,
          description: ev.description,
          occurredAt: ev.occurredAt,
          reportId: r.id,
          reportTitle: r.title || "Sem título",
          factType: ev.factType,
        });
      }
    }
    return all.sort((a, b) => b.occurredAt - a.occurredAt);
  }, [reports, intelByReportId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Linha do tempo geral</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {offline && <OfflineBanner cachedAt={cachedAt} />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.subtitle}>{events.length} eventos, de todos os casos visíveis, mais recentes primeiro.</Text>

          {events.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum evento registrado ainda.</Text>
          ) : (
            events.map((ev, i) => (
              <Pressable key={ev.id} style={styles.row} onPress={() => navigation.navigate("ReportDetail", { reportId: ev.reportId })}>
                <View style={styles.dotCol}>
                  <View style={styles.dot} />
                  {i < events.length - 1 && <View style={styles.line} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 20 }}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Text style={styles.eventMeta}>
                    {new Date(ev.occurredAt).toLocaleString("pt-BR")}
                    {ev.factType ? ` · ${ev.factType}` : ""}
                  </Text>
                  <View style={styles.caseTag}>
                    <Ionicons name="folder-outline" size={11} color={color.primary} />
                    <Text style={styles.caseTagText} numberOfLines={1}>{ev.reportTitle}</Text>
                  </View>
                  {ev.description ? <Text style={styles.eventDesc}>{ev.description}</Text> : null}
                </View>
              </Pressable>
            ))
          )}
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
    subtitle: { fontSize: 12, color: color.textMuted, marginBottom: space.lg },
    emptyText: { color: color.textFaint, fontSize: 13, textAlign: "center", paddingVertical: 30 },
    row: { flexDirection: "row", gap: 12 },
    dotCol: { width: 14, alignItems: "center" },
    dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.primary, marginTop: 4 },
    line: { flex: 1, width: 1.5, backgroundColor: color.border, marginTop: 4 },
    eventTitle: { fontSize: 13.5, fontWeight: "600", color: color.text },
    eventMeta: { fontSize: 11, color: color.textFaint, marginTop: 2 },
    caseTag: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, alignSelf: "flex-start", backgroundColor: color.infoTint, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 7, maxWidth: "100%" },
    caseTagText: { fontSize: 10.5, color: color.primary, fontWeight: "600" },
    eventDesc: { fontSize: 12.5, color: color.textMuted, marginTop: 6, lineHeight: 18 },
  });
}
