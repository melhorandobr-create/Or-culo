import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, Report, ApiError } from "../api/client";

type Tab = "timeline" | "evidence" | "hypotheses";

export default function ReportDetailScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const reportId: string | undefined = route.params?.reportId;
  const isCreate = !reportId;

  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("timeline");

  // formulário de criação
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const load = useCallback(async () => {
    if (!reportId) return;
    setError(null);
    try {
      const [reportRes, intelRes] = await Promise.all([
        api.getReport(reportId),
        api.getCaseIntelligence(reportId),
      ]);
      setReport(reportRes.report);
      setTimeline(intelRes.timeline || []);
      setHypotheses(intelRes.hypotheses || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.createReport({ title: newTitle.trim(), description: newDescription.trim() });
      navigation.replace("ReportDetail", { reportId: res.report.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o caso.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!reportId) return;
    Alert.alert("Apagar caso?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteReport(reportId);
            navigation.goBack();
          } catch (err) {
            Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível apagar.");
          }
        },
      },
    ]);
  }

  const evidence: any[] = (report as any)?.evidence || [];

  if (isCreate) {
    return (
      <View style={styles.container}>
        <Header theme={theme} onBack={() => navigation.goBack()} title="Novo caso" />
        <ScrollView contentContainerStyle={{ padding: theme.space.xl }}>
          <Text style={styles.formLabel}>Título</Text>
          <TextInputLike theme={theme} value={newTitle} onChangeText={setNewTitle} placeholder="Ex.: Monitoramento — Setor Norte" />
          <Text style={[styles.formLabel, { marginTop: theme.space.lg }]}>Descrição</Text>
          <TextInputLike theme={theme} value={newDescription} onChangeText={setNewDescription} placeholder="Resumo do caso" multiline />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Pressable
            style={[styles.primaryButton, (!newTitle.trim() || saving) && { opacity: 0.6 }]}
            disabled={!newTitle.trim() || saving}
            onPress={handleCreate}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Criar caso</Text>}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        theme={theme}
        onBack={() => navigation.goBack()}
        subtitle={`CASO #${reportId?.slice(0, 6).toUpperCase()}`}
        onShare={() => {}}
        onExport={() => {}}
      />
      <ScrollView contentContainerStyle={{ padding: theme.space.xl }}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.title}>{report?.title || report?.displayName || "Sem título"}</Text>

        <View style={styles.chipRow}>
          {report?.classification === "SECRETO" && (
            <View style={[styles.chip, { backgroundColor: color.dangerTint }]}>
              <Ionicons name="shield-outline" size={12} color={color.danger} />
              <Text style={[styles.chipText, { color: color.danger }]}>SECRETO</Text>
            </View>
          )}
          <View style={[styles.chip, { backgroundColor: color.successTint }]}>
            <View style={styles.statusDot} />
            <Text style={[styles.chipText, { color: color.success }]}>{report?.status || "Caso aberto"}</Text>
          </View>
        </View>

        {report?.description ? <Text style={styles.summary}>{String(report.description)}</Text> : null}

        <View style={styles.segmented}>
          <SegButton theme={theme} active={tab === "timeline"} label="Cronologia" onPress={() => setTab("timeline")} />
          <SegButton theme={theme} active={tab === "evidence"} label="Evidências" onPress={() => setTab("evidence")} />
          <SegButton theme={theme} active={tab === "hypotheses"} label="Hipóteses" onPress={() => setTab("hypotheses")} />
        </View>

        {tab === "timeline" && (
          <View style={{ marginTop: theme.space.xl }}>
            {timeline.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum evento registrado ainda.</Text>
            ) : (
              timeline.map((ev, i) => (
                <View key={ev.id || i} style={styles.timelineRow}>
                  <View style={styles.timelineDotCol}>
                    <View style={styles.timelineDot} />
                    {i < timeline.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 20 }}>
                    <Text style={styles.timelineTitle}>{ev.title}</Text>
                    <Text style={styles.timelineMeta}>
                      {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString("pt-BR") : ""}
                      {ev.factType ? ` · ${ev.factType}` : ""}
                    </Text>
                    {ev.description ? <Text style={styles.timelineDetail}>{ev.description}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "evidence" && (
          <View style={{ marginTop: theme.space.xl, gap: theme.space.md }}>
            {evidence.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma evidência anexada ainda.</Text>
            ) : (
              evidence.map((ev, i) => (
                <View key={ev.id || i} style={styles.card}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={styles.evidenceIcon}>
                      <Ionicons name="document-outline" size={16} color={color.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evidenceFileName}>{ev.fileName || ev.caption || "Anexo"}</Text>
                      {ev.caption ? <Text style={styles.evidenceCaption}>{ev.caption}</Text> : null}
                      <Text style={styles.evidenceMeta}>
                        {ev.sha256 ? `${String(ev.sha256).slice(0, 8)}…` : ""} {ev.uploadedBy ? `· ${ev.uploadedBy}` : ""}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "hypotheses" && (
          <View style={{ marginTop: theme.space.xl, gap: theme.space.md }}>
            {hypotheses.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma hipótese registrada ainda.</Text>
            ) : (
              hypotheses.map((h, i) => (
                <View key={h.id || i} style={styles.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[styles.hypothesisTitle, { flex: 1 }]}>{h.statement}</Text>
                    {h.confidence ? (
                      <View style={[styles.chip, { backgroundColor: color.infoTint }]}>
                        <Text style={[styles.chipText, { color: color.primary }]}>{h.confidence}</Text>
                      </View>
                    ) : null}
                  </View>
                  {h.supportingEvidence ? <Text style={styles.hypothesisDesc}>{h.supportingEvidence}</Text> : null}
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton}>
            <Ionicons name="download-outline" size={14} color={color.text} />
            <Text style={styles.secondaryButtonText}>Exportar PDF</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={15} color={color.danger} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Header({
  theme,
  onBack,
  title,
  subtitle,
  onShare,
  onExport,
}: {
  theme: Theme;
  onBack: () => void;
  title?: string;
  subtitle?: string;
  onShare?: () => void;
  onExport?: () => void;
}) {
  const { color, space } = theme;
  return (
    <View style={{ paddingTop: 6, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Pressable
        onPress={onBack}
        style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", ...theme.shadow.card }}
      >
        <Ionicons name="chevron-back" size={18} color={color.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {subtitle && <Text style={{ fontSize: 11, color: color.textFaint, fontWeight: "600" }}>{subtitle}</Text>}
        {title && <Text style={{ fontSize: 17, fontWeight: "700", color: color.text }}>{title}</Text>}
      </View>
      {onShare && (
        <Pressable onPress={onShare} style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", ...theme.shadow.card }}>
          <Ionicons name="share-social-outline" size={15} color={color.text} />
        </Pressable>
      )}
      {onExport && (
        <Pressable onPress={onExport} style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", ...theme.shadow.card }}>
          <Ionicons name="download-outline" size={15} color={color.text} />
        </Pressable>
      )}
    </View>
  );
}

function SegButton({ theme, active, label, onPress }: { theme: Theme; active: boolean; label: string; onPress: () => void }) {
  const { color, radius } = theme;
  return (
    <Pressable
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 9,
        borderRadius: radius.sm + 2,
        backgroundColor: active ? color.surface : "transparent",
        ...(active ? theme.shadow.card : {}),
      }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: active ? color.text : color.textMuted }}>{label}</Text>
    </Pressable>
  );
}

function TextInputLike(props: { theme: Theme; value: string; onChangeText: (v: string) => void; placeholder: string; multiline?: boolean }) {
  // Import local pra evitar puxar TextInput no topo do arquivo duas vezes.
  const { TextInput } = require("react-native");
  const { theme, ...rest } = props;
  const { color, radius, space } = theme;
  return (
    <TextInput
      {...rest}
      placeholderTextColor={color.textFaint}
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.border,
        padding: space.md,
        fontSize: 14,
        color: color.text,
        minHeight: rest.multiline ? 90 : undefined,
        textAlignVertical: rest.multiline ? "top" : "center",
      }}
    />
  );
}

function buildStyles(theme: Theme) {
  const { color, space, radius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    title: { fontSize: 21, fontWeight: "700", color: color.text, letterSpacing: -0.3, lineHeight: 27, marginTop: 6 },
    chipRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
    chipText: { fontSize: 11.5, fontWeight: "700" },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.success },
    summary: { fontSize: 13, color: color.textMuted, marginTop: 14, lineHeight: 20 },
    segmented: { flexDirection: "row", gap: 6, backgroundColor: "#EEF1F5", padding: 4, borderRadius: radius.md + 1, marginTop: space.xl },
    emptyText: { fontSize: 13, color: color.textFaint, textAlign: "center", paddingVertical: 24 },
    card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 14, ...theme.shadow.card },
    timelineRow: { flexDirection: "row", gap: 12 },
    timelineDotCol: { width: 14, alignItems: "center" },
    timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.primary, marginTop: 4 },
    timelineLine: { flex: 1, width: 1.5, backgroundColor: color.border, marginTop: 4 },
    timelineTitle: { fontSize: 13.5, fontWeight: "600", color: color.text },
    timelineMeta: { fontSize: 11, color: color.textFaint, marginTop: 2 },
    timelineDetail: { fontSize: 12.5, color: color.textMuted, marginTop: 4, lineHeight: 18 },
    evidenceIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: color.infoTint, alignItems: "center", justifyContent: "center" },
    evidenceFileName: { fontSize: 13, fontWeight: "600", color: color.text },
    evidenceCaption: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
    evidenceMeta: { fontSize: 10, color: color.textFaint, marginTop: 6 },
    hypothesisTitle: { fontSize: 13.5, fontWeight: "700", color: color.text },
    hypothesisDesc: { fontSize: 12.5, color: color.textMuted, marginTop: 8, lineHeight: 18 },
    actionsRow: { flexDirection: "row", gap: 10, marginTop: space.xxl },
    secondaryButton: { flex: 1, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    secondaryButtonText: { fontSize: 13, fontWeight: "600", color: color.text },
    dangerButton: { width: 48, backgroundColor: color.surface, borderWidth: 1, borderColor: "#FBD5D5", borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    formLabel: { fontSize: 12.5, fontWeight: "600", color: color.textMuted, marginBottom: 6 },
    primaryButton: { backgroundColor: color.primary, borderRadius: radius.lg, padding: 14, alignItems: "center", marginTop: space.xxl },
    primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14.5 },
    errorText: { color: color.danger, fontSize: 12.5, marginTop: 8, marginBottom: 8 },
  });
}
