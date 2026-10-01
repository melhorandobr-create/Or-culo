import React, { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { useAllCasesIntelligence } from "../hooks/useAllCasesIntelligence";
import { usePrognose } from "../hooks/usePrognose";
import { OfflineBanner } from "../components/OfflineBanner";
import { wrapPdfHtml } from "../utils/pdfBranding";

// Visão de comando: cruza o "command" (risco, fase, tarefas) de TODOS os
// casos visíveis de uma vez, em vez de olhar caso por caso. É a diferença
// entre "gerenciador de casos" e "central de operações".
export default function CommandCenterScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { loading, error, reports, intelByReportId, offline, cachedAt } = useAllCasesIntelligence();

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

  const { history, latest, generating: generatingBriefing, generate: generateBriefing } = usePrognose();
  const [viewedText, setViewedText] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const briefing = viewedText ?? latest?.text ?? null;

  async function handleGenerate() {
    setViewedText(null);
    const res = await generateBriefing(false);
    if (!res.ok) Alert.alert(res.error === "Nenhum caso disponível pra gerar briefing." ? "Sem casos" : "Erro", res.error);
  }

  async function exportBriefingPdf() {
    if (!briefing) return;
    const html = wrapPdfHtml(
      `<h1 style="margin-top:0;">Prognose — ${new Date().toLocaleDateString("pt-BR")}</h1>
       <p style="white-space:pre-wrap;">${briefing.replace(/</g, "&lt;")}</p>
       <p style="font-size:11px; color:#767676; font-style:italic;">Gerado por IA a partir dos casos monitorados — exige revisão humana antes de qualquer decisão.</p>`,
      "Prognose — Central de Comando"
    );
    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } catch {
      Alert.alert("Erro ao exportar", "Não foi possível gerar o PDF.");
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          {offline && <OfflineBanner cachedAt={cachedAt} />}
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.statsGrid}>
            <StatBox theme={theme} value={reports.length} label="Casos ativos" />
            <StatBox theme={theme} value={totals.overdue} label="Tarefas atrasadas" danger={totals.overdue > 0} />
            <StatBox theme={theme} value={totals.pending} label="Tarefas pendentes" />
            <StatBox theme={theme} value={totals.openHypotheses} label="Hipóteses em aberto" />
            <StatBox theme={theme} value={totals.highRisk} label="Casos de risco alto" danger={totals.highRisk > 0} />
            <StatBox theme={theme} value={totals.secret} label="Casos SECRETO" />
          </View>

          <Pressable style={[styles.briefingButton, generatingBriefing && { opacity: 0.6 }]} disabled={generatingBriefing} onPress={handleGenerate}>
            {generatingBriefing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="sparkles-outline" size={15} color="#fff" />
                <Text style={styles.briefingButtonText}>Prognose (briefing + previsão)</Text>
              </>
            )}
          </Pressable>
          {briefing && (
            <View style={styles.briefingCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={styles.phaseLabel}>
                  Prognose · exige revisão humana{latest ? ` · ${new Date(latest.generatedAt).toLocaleString("pt-BR")}` : ""}
                </Text>
                <Pressable onPress={exportBriefingPdf}>
                  <Ionicons name="download-outline" size={16} color={color.primary} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 13, color: color.text, lineHeight: 20 }}>{briefing}</Text>
            </View>
          )}

          {history.length > 1 && (
            <Pressable style={styles.historyToggle} onPress={() => setShowHistory((v) => !v)}>
              <Ionicons name={showHistory ? "chevron-up" : "chevron-down"} size={14} color={color.textMuted} />
              <Text style={styles.historyToggleText}>
                {showHistory ? "Ocultar histórico" : `Ver histórico (${history.length - 1} anterior(es))`}
              </Text>
            </Pressable>
          )}
          {showHistory && (
            <View style={{ gap: theme.space.sm, marginBottom: theme.space.xxl }}>
              {history.slice(1).map((h) => (
                <Pressable key={h.id} style={styles.historyCard} onPress={() => setViewedText(h.text)}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.historyDate}>{new Date(h.generatedAt).toLocaleString("pt-BR")}</Text>
                    {h.auto && <Text style={styles.historyAuto}>automático</Text>}
                  </View>
                  <Text style={styles.historySnippet} numberOfLines={2}>{h.text}</Text>
                </Pressable>
              ))}
            </View>
          )}

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
    briefingButton: { backgroundColor: color.primary, borderRadius: radius.lg, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: space.md },
    briefingButtonText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
    briefingCard: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, marginBottom: space.xxl, ...theme.shadow.card },
    caseCard: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, ...theme.shadow.card },
    caseTitle: { fontSize: 13.5, fontWeight: "600", color: color.text },
    caseMeta: { fontSize: 11, color: color.textFaint, marginTop: 3 },
    overdueBadge: { backgroundColor: color.dangerTint, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9 },
    overdueBadgeText: { fontSize: 10.5, color: color.danger, fontWeight: "700" },
    historyToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.md, alignSelf: "flex-start" },
    historyToggleText: { fontSize: 12, color: color.textMuted, fontWeight: "600" },
    historyCard: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 12, ...theme.shadow.card },
    historyDate: { fontSize: 10.5, color: color.textFaint, fontWeight: "600" },
    historyAuto: { fontSize: 10, color: color.primary, fontWeight: "700" },
    historySnippet: { fontSize: 11.5, color: color.textMuted, marginTop: 5, lineHeight: 16 },
  });
}
