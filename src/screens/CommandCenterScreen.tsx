import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { useAllCasesIntelligence } from "../hooks/useAllCasesIntelligence";

// Visão de comando: cruza o "command" (risco, fase, tarefas) de TODOS os
// casos visíveis de uma vez, em vez de olhar caso por caso. É a diferença
// entre "gerenciador de casos" e "central de operações".
export default function CommandCenterScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { loading, error, reports, intelByReportId } = useAllCasesIntelligence();

  const rows = reports.map((r) => ({
    report: r,
    command: intelByReportId[r.id]?.command,
  }));

  const totals = rows.reduce(
    (acc, row) => {
      acc.pending += row.command?.pendingTasks ?? 0;
      acc.overdue += row.command?.overdueTasks ?? 0;
      acc.openHypotheses += row.command?.openHypotheses ?? 0;
      if (row.report.classification === "SECRETO") acc.secret += 1;
      if ((row.command?.riskLevel || row.report.riskLevel) === "ALTO") acc.highRisk += 1;
      return acc;
    },
    { pending: 0, overdue: 0, openHypotheses: 0, secret: 0, highRisk: 0 }
  );

  const byPhase: Record<string, number> = {};
  for (const row of rows) {
    const phase = row.command?.operationPhase || row.report.operationPhase || "SEM_FASE";
    byPhase[phase] = (byPhase[phase] || 0) + 1;
  }

  const sortedByUrgency = [...rows].sort((a, b) => (b.command?.overdueTasks ?? 0) - (a.command?.overdueTasks ?? 0));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Central de comando</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.statsGrid}>
            <StatBox theme={theme} value={reports.length} label="Casos ativos" />
            <StatBox theme={theme} value={totals.overdue} label="Tarefas atrasadas" danger={totals.overdue > 0} />
            <StatBox theme={theme} value={totals.pending} label="Tarefas pendentes" />
            <StatBox theme={theme} value={totals.openHypotheses} label="Hipóteses em aberto" />
            <StatBox theme={theme} value={totals.highRisk} label="Casos de risco alto" danger={totals.highRisk > 0} />
            <StatBox theme={theme} value={totals.secret} label="Casos SECRETO" />
          </View>

          <Text style={styles.sectionLabel}>Casos por fase</Text>
          <View style={[styles.card, { marginBottom: theme.space.xxl }]}>
            {Object.entries(byPhase).map(([phase, count]) => (
              <View key={phase} style={styles.phaseRow}>
                <Text style={styles.phaseLabel}>{phase}</Text>
                <Text style={styles.phaseValue}>{count}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Casos por urgência (mais tarefas atrasadas primeiro)</Text>
          <View style={{ gap: theme.space.md }}>
            {sortedByUrgency.map(({ report, command }) => (
              <Pressable key={report.id} style={styles.caseCard} onPress={() => navigation.navigate("ReportDetail", { reportId: report.id })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseTitle} numberOfLines={1}>{report.title}</Text>
                  <Text style={styles.caseMeta}>
                    {command?.operationPhase || report.operationPhase || "—"} · risco {command?.riskLevel || report.riskLevel || "—"}
                  </Text>
                </View>
                {(command?.overdueTasks ?? 0) > 0 && (
                  <View style={styles.overdueBadge}>
                    <Text style={styles.overdueBadgeText}>{command!.overdueTasks} atrasada(s)</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function StatBox({ theme, value, label, danger }: { theme: Theme; value: number; label: string; danger?: boolean }) {
  const { color } = theme;
  return (
    <View style={{ width: "31%", backgroundColor: color.surface, borderRadius: theme.radius.xl, padding: 12, ...theme.shadow.card }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: danger ? color.danger : color.text }}>{value}</Text>
      <Text style={{ fontSize: 10.5, color: color.textMuted, marginTop: 3, lineHeight: 13 }}>{label}</Text>
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
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: "3.5%" as any, marginBottom: space.xl, rowGap: 10 },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 6, ...theme.shadow.card },
    phaseRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 9 },
    phaseLabel: { fontSize: 12.5, color: color.text, fontWeight: "600" },
    phaseValue: { fontSize: 12.5, color: color.textMuted },
    caseCard: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, ...theme.shadow.card },
    caseTitle: { fontSize: 13.5, fontWeight: "600", color: color.text },
    caseMeta: { fontSize: 11, color: color.textFaint, marginTop: 3 },
    overdueBadge: { backgroundColor: color.dangerTint, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9 },
    overdueBadgeText: { fontSize: 10.5, color: color.danger, fontWeight: "700" },
  });
}
