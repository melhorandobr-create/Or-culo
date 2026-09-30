import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, ApiError } from "../api/client";
import { useAllCasesIntelligence } from "../hooks/useAllCasesIntelligence";
import { OfflineBanner } from "../components/OfflineBanner";

// Visão de comando: cruza o "command" (risco, fase, tarefas) de TODOS os
// casos visíveis de uma vez, em vez de olhar caso por caso. É a diferença
// entre "gerenciador de casos" e "central de operações".
export default function CommandCenterScreen() {
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

  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);

  // Monta um apêndice denso por caso (entidades, cronologia, hipóteses,
  // command) — tudo que já está carregado no hook compartilhado — e injeta
  // isso dentro do campo "question" do endpoint cross-case. O servidor já
  // soma título/resumo/relato de cada caso selecionado; esse apêndice dá à
  // IA o resto do quadro (quem, quando, o que se suspeita) sem precisar
  // mudar o backend de novo.
  function buildDenseContext(targetIds: string[]): string {
    const parts: string[] = [];
    for (const id of targetIds) {
      const report = reports.find((r) => r.id === id);
      const intel = intelByReportId[id] as any;
      if (!report) continue;
      const entities = (intel?.entities || []).map((e: any) => `${e.name} (${e.type}${e.confidence ? `, confiança ${e.confidence}` : ""})`).join("; ");
      const timeline = (intel?.timeline || [])
        .slice(0, 10)
        .map((t: any) => `${t.occurredAt ? new Date(t.occurredAt).toLocaleDateString("pt-BR") : "?"}: ${t.title}`)
        .join(" | ");
      const hypotheses = (intel?.hypotheses || []).map((h: any) => `"${h.statement}" (${h.confidence || "?"})`).join("; ");
      parts.push(
        `## ${report.title}\nRisco: ${intel?.command?.riskLevel || report.riskLevel || "?"} | Fase: ${intel?.command?.operationPhase || report.operationPhase || "?"} | Tarefas atrasadas: ${intel?.command?.overdueTasks ?? 0}\nEntidades: ${entities || "(nenhuma registrada)"}\nCronologia: ${timeline || "(nenhum evento registrado)"}\nHipóteses: ${hypotheses || "(nenhuma registrada)"}`
      );
    }
    return parts.join("\n\n");
  }

  async function generateBriefing() {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = reports.filter((r) => (r.updatedAt || 0) >= weekAgo);
    const targetIds = (recent.length > 0 ? recent : reports).map((r) => r.id).slice(0, 15);
    if (targetIds.length === 0) {
      Alert.alert("Sem casos", "Nenhum caso disponível pra gerar briefing.");
      return;
    }
    setGeneratingBriefing(true);
    setBriefing(null);
    try {
      const monitorsRes = await api.listSourceMonitors().catch(() => ({ monitors: [] }));
      const monitorsContext = (monitorsRes.monitors || [])
        .map((m) => `${m.kind}: ${m.query}${m.tribunal ? ` (${m.tribunal})` : ""} — ${m.purpose || "sem finalidade registrada"}`)
        .join("\n");
      const instructions =
        "Atue como consultor de inteligência autônomo. Com base em TODO o contexto abaixo (entidades, cronologia, hipóteses e status de cada caso, mais as fontes públicas já monitoradas), produza um parecer denso e completo em 4 partes: " +
        "(1) Briefing executivo — prioridade por risco/urgência e o que mudou recentemente; " +
        "(2) Tendência de escalada — cruzando as datas da cronologia de todos os casos, aponte se a atividade está intensificando, estável ou arrefecendo, e em quais casos especificamente; " +
        "(3) Expectativa/previsão — o que é razoável esperar acontecer a seguir em cada caso de risco alto, com base só no padrão observado, deixando claro que é inferência, não fato; " +
        "(4) Próximas ações recomendadas — as 5 mais importantes, priorizadas, incluindo se alguma fonte monitorada merece atenção reforçada. Não invente fatos além do que está nos dados abaixo.\n\n" +
        buildDenseContext(targetIds) +
        (monitorsContext ? `\n\n## Fontes públicas monitoradas\n${monitorsContext}` : "");
      const res = await api.aiCrossCaseAssist(targetIds, instructions);
      setBriefing(res.text);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "BlindAI/Grok indisponível.");
    } finally {
      setGeneratingBriefing(false);
    }
  }

  async function exportBriefingPdf() {
    if (!briefing) return;
    const html = `<html><body style="font-family: -apple-system, sans-serif; padding: 24px; white-space: pre-wrap;">
      <h1>Briefing — ${new Date().toLocaleDateString("pt-BR")}</h1>
      <p>${briefing.replace(/</g, "&lt;")}</p>
    </body></html>`;
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

          <Pressable style={[styles.briefingButton, generatingBriefing && { opacity: 0.6 }]} disabled={generatingBriefing} onPress={generateBriefing}>
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
                <Text style={styles.phaseLabel}>Prognose · exige revisão humana</Text>
                <Pressable onPress={exportBriefingPdf}>
                  <Ionicons name="download-outline" size={16} color={color.primary} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 13, color: color.text, lineHeight: 20 }}>{briefing}</Text>
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
  });
}
