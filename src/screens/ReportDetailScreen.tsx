import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Share,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, getToken, Report, Evidence, ApiError } from "../api/client";

type Tab = "timeline" | "entities" | "hypotheses" | "evidence" | "tasks";

const STATUS_OPTIONS: Array<Report["status"]> = ["RASCUNHO", "EM_REVISAO", "FINALIZADO", "ARQUIVADO"];
const ENTITY_TYPES = ["PESSOA", "EMPRESA", "VEICULO", "TELEFONE", "ENDERECO", "CONTA", "DOCUMENTO", "EVENTO", "OUTRO"];
const CONFIDENCE_OPTIONS = ["BAIXA", "MEDIA", "ALTA"];

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
  const [accessDenied, setAccessDenied] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [uploading, setUploading] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [command, setCommand] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("timeline");

  // formulário de criação
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // edição do caso existente
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  // solicitar acesso (quando canView é falso)
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessJustification, setAccessJustification] = useState("");
  const [accessSent, setAccessSent] = useState(false);

  const load = useCallback(async () => {
    if (!reportId) return;
    setError(null);
    setAccessDenied(false);
    try {
      const [reportRes, intelRes, tasksRes] = await Promise.all([
        api.getReport(reportId),
        api.getCaseIntelligence(reportId),
        api.listReportTasks(reportId).catch(() => ({ tasks: [] })),
      ]);
      setReport(reportRes.report);
      setEvidence(reportRes.evidence || []);
      setIsOwner(Boolean(reportRes.isOwner));
      setTimeline(intelRes.timeline || []);
      setHypotheses(intelRes.hypotheses || []);
      setEntities((intelRes as any).entities || []);
      setCommand((intelRes as any).command || null);
      setTasks((tasksRes as any).tasks || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAccessDenied(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
      }
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

  async function handleSaveEdit() {
    if (!reportId) return;
    setSavingEdit(true);
    try {
      const res = await api.updateReport(reportId, { title: editTitle.trim(), description: editDescription.trim() });
      setReport(res.report);
      setEditing(false);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleChangeStatus(status: Report["status"]) {
    if (!reportId || !status) return;
    setStatusSaving(true);
    try {
      const res = await api.setReportStatus(reportId, status as any);
      setReport(res.report);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível mudar o estado do caso.");
    } finally {
      setStatusSaving(false);
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

  async function handleRequestAccess() {
    if (!reportId) return;
    if (accessJustification.trim().length < 10) {
      Alert.alert("Justificativa obrigatória", "Descreva o motivo do pedido (mín. 10 caracteres).");
      return;
    }
    try {
      await api.createAccessRequest({
        reportId,
        purpose: "Acesso ao caso",
        justification: accessJustification.trim(),
        scope: "leitura",
        durationDays: 30,
        handlingCommitment: "Uso restrito à investigação em curso.",
      });
      setAccessSent(true);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível enviar o pedido.");
    }
  }

  async function handleShare() {
    if (!report) return;
    try {
      await Share.share({
        title: report.title || "Caso ORÁCULO",
        message: `${report.title || "Caso"}\nProtocolo: ${(report as any).protocolNumber || reportId}\nStatus: ${report.status}\nClassificação: ${report.classification}`,
      });
    } catch {
      // usuário cancelou o share sheet — sem ação necessária.
    }
  }

  async function handleExportPdf() {
    if (!report) return;
    try {
      const html = `
        <html><body style="font-family: -apple-system, sans-serif; padding: 24px;">
          <h1>${escapeHtml(report.title || "Caso sem título")}</h1>
          <p><strong>Protocolo:</strong> ${escapeHtml((report as any).protocolNumber || "")}</p>
          <p><strong>Classificação:</strong> ${escapeHtml(report.classification || "")}</p>
          <p><strong>Status:</strong> ${escapeHtml(report.status || "")}</p>
          <p><strong>Descrição:</strong> ${escapeHtml(report.description || "")}</p>
          <h2>Cronologia</h2>
          <ul>${timeline.map((e) => `<li>${escapeHtml(e.title || "")} — ${e.occurredAt ? new Date(e.occurredAt).toLocaleDateString("pt-BR") : ""}</li>`).join("")}</ul>
          <h2>Hipóteses</h2>
          <ul>${hypotheses.map((h) => `<li>${escapeHtml(h.statement || "")}</li>`).join("")}</ul>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      }
    } catch (err) {
      Alert.alert("Erro ao exportar", "Não foi possível gerar o PDF.");
    }
  }

  async function handleAttach(kind: "photo" | "video") {
    if (!reportId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize o acesso à galeria para anexar evidências.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "video" ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      const fileName = asset.fileName || `${kind === "video" ? "video" : "foto"}-${Date.now()}.${kind === "video" ? "mp4" : "jpg"}`;
      const res = await api.uploadEvidence(reportId, {
        kind,
        file: { uri: asset.uri, name: fileName, type: asset.mimeType || (kind === "video" ? "video/mp4" : "image/jpeg") },
      });
      setEvidence((prev) => [res.evidence, ...prev]);
    } catch (err) {
      Alert.alert("Erro ao anexar", err instanceof ApiError ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteEvidence(evidenceId: string) {
    if (!reportId) return;
    Alert.alert("Remover evidência?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteEvidence(reportId, evidenceId);
            setEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
          } catch (err) {
            Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível remover.");
          }
        },
      },
    ]);
  }

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

  if (accessDenied) {
    return (
      <View style={styles.container}>
        <Header theme={theme} onBack={() => navigation.goBack()} subtitle={`CASO #${reportId?.slice(0, 6).toUpperCase()}`} />
        <View style={{ padding: theme.space.xl }}>
          <View style={styles.card}>
            <Ionicons name="lock-closed-outline" size={22} color={color.danger} />
            <Text style={[styles.title, { fontSize: 16, marginTop: 10 }]}>Sem acesso a este caso</Text>
            <Text style={styles.summary}>
              Este caso é sigiloso e você não tem permissão para vê-lo. Você pode solicitar acesso ao responsável.
            </Text>
            {accessSent ? (
              <Text style={[styles.summary, { color: color.success, marginTop: 12 }]}>Pedido enviado. Aguarde a autorização do responsável.</Text>
            ) : requestingAccess ? (
              <View style={{ marginTop: 14, gap: 10 }}>
                <TextInputLike
                  theme={theme}
                  value={accessJustification}
                  onChangeText={setAccessJustification}
                  placeholder="Justifique o motivo do pedido"
                  multiline
                />
                <Pressable style={styles.primaryButton} onPress={handleRequestAccess}>
                  <Text style={styles.primaryButtonText}>Enviar pedido</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.primaryButton, { marginTop: 14 }]} onPress={() => setRequestingAccess(true)}>
                <Text style={styles.primaryButtonText}>Solicitar acesso</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        theme={theme}
        onBack={() => navigation.goBack()}
        subtitle={`CASO #${reportId?.slice(0, 6).toUpperCase()}`}
        onShare={handleShare}
        onExport={handleExportPdf}
      />
      <ScrollView contentContainerStyle={{ padding: theme.space.xl }}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {editing ? (
          <View style={{ gap: 10 }}>
            <TextInputLike theme={theme} value={editTitle} onChangeText={setEditTitle} placeholder="Título" />
            <TextInputLike theme={theme} value={editDescription} onChangeText={setEditDescription} placeholder="Descrição" multiline />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.primaryButton, { flex: 1 }, savingEdit && { opacity: 0.6 }]} disabled={savingEdit} onPress={handleSaveEdit}>
                {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Salvar</Text>}
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setEditing(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            disabled={!isOwner}
            onPress={() => {
              if (!isOwner) return;
              setEditTitle(report?.title || "");
              setEditDescription(report?.description || "");
              setEditing(true);
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <Text style={[styles.title, { flex: 1 }]}>{report?.title || report?.displayName || "Sem título"}</Text>
              {isOwner && <Ionicons name="pencil-outline" size={16} color={color.textFaint} />}
            </View>
          </Pressable>
        )}

        <View style={styles.chipRow}>
          {report?.classification === "SECRETO" && (
            <View style={[styles.chip, { backgroundColor: color.dangerTint }]}>
              <Ionicons name="shield-outline" size={12} color={color.danger} />
              <Text style={[styles.chipText, { color: color.danger }]}>SECRETO</Text>
            </View>
          )}
          {command?.riskLevel && (
            <View style={[styles.chip, { backgroundColor: color.warningTint }]}>
              <Text style={[styles.chipText, { color: color.warning }]}>RISCO {command.riskLevel}</Text>
            </View>
          )}
        </View>

        {isOwner ? (
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((s) => (
              <Pressable
                key={s}
                disabled={statusSaving}
                style={[styles.statusChip, report?.status === s && styles.statusChipActive]}
                onPress={() => handleChangeStatus(s)}
              >
                <Text style={[styles.statusChipText, report?.status === s && styles.statusChipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: color.successTint }]}>
              <View style={styles.statusDot} />
              <Text style={[styles.chipText, { color: color.success }]}>{report?.status || "Caso aberto"}</Text>
            </View>
          </View>
        )}

        {report?.description ? <Text style={styles.summary}>{String(report.description)}</Text> : null}

        {command && (
          <View style={styles.commandCard}>
            <CommandStat label="Fase" value={command.operationPhase || "—"} />
            <CommandStat label="Tarefas pendentes" value={String(command.pendingTasks ?? 0)} />
            <CommandStat label="Tarefas atrasadas" value={String(command.overdueTasks ?? 0)} />
            <CommandStat label="Hipóteses em aberto" value={String(command.openHypotheses ?? 0)} />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmented}>
          <SegButton theme={theme} active={tab === "timeline"} label="Cronologia" onPress={() => setTab("timeline")} />
          <SegButton theme={theme} active={tab === "entities"} label="Entidades" onPress={() => setTab("entities")} />
          <SegButton theme={theme} active={tab === "hypotheses"} label="Hipóteses" onPress={() => setTab("hypotheses")} />
          <SegButton theme={theme} active={tab === "evidence"} label="Evidências" onPress={() => setTab("evidence")} />
          <SegButton theme={theme} active={tab === "tasks"} label="Tarefas" onPress={() => setTab("tasks")} />
        </ScrollView>

        {tab === "timeline" && (
          <TimelineTab theme={theme} reportId={reportId!} timeline={timeline} isOwner={isOwner} onCreated={load} />
        )}

        {tab === "entities" && (
          <EntitiesTab theme={theme} reportId={reportId!} entities={entities} isOwner={isOwner} onCreated={load} />
        )}

        {tab === "evidence" && (
          <View style={{ marginTop: theme.space.xl, gap: theme.space.md }}>
            {isOwner && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={[styles.secondaryButton, { flex: 1 }]} disabled={uploading} onPress={() => handleAttach("photo")}>
                  <Ionicons name="image-outline" size={15} color={color.text} />
                  <Text style={styles.secondaryButtonText}>Anexar foto</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, { flex: 1 }]} disabled={uploading} onPress={() => handleAttach("video")}>
                  <Ionicons name="videocam-outline" size={15} color={color.text} />
                  <Text style={styles.secondaryButtonText}>Anexar vídeo</Text>
                </Pressable>
              </View>
            )}
            {uploading && <ActivityIndicator color={color.primary} />}
            {evidence.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma evidência anexada ainda.</Text>
            ) : (
              evidence.map((ev) => (
                <View key={ev.id} style={styles.card}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {ev.kind === "photo" ? (
                      <AuthenticatedThumbnail reportId={reportId!} evidenceId={ev.id} />
                    ) : (
                      <View style={styles.evidenceIcon}>
                        <Ionicons
                          name={ev.kind === "video" ? "videocam-outline" : ev.kind === "link" ? "link-outline" : "document-outline"}
                          size={16}
                          color={color.textMuted}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evidenceFileName}>{ev.originalName || ev.caption || "Anexo"}</Text>
                      {ev.caption ? <Text style={styles.evidenceCaption}>{ev.caption}</Text> : null}
                      <Text style={styles.evidenceMeta}>
                        {ev.sha256 ? `${String(ev.sha256).slice(0, 8)}…` : ""}
                        {ev.size ? ` · ${Math.round(ev.size / 1024)} KB` : ""}
                      </Text>
                    </View>
                    {isOwner && (
                      <Pressable onPress={() => handleDeleteEvidence(ev.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={color.danger} />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "hypotheses" && (
          <HypothesesTab theme={theme} reportId={reportId!} hypotheses={hypotheses} isOwner={isOwner} onCreated={load} />
        )}

        {tab === "tasks" && (
          <TasksTab theme={theme} reportId={reportId!} tasks={tasks} isOwner={isOwner} onCreated={load} />
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={handleExportPdf}>
            <Ionicons name="download-outline" size={14} color={color.text} />
            <Text style={styles.secondaryButtonText}>Exportar PDF</Text>
          </Pressable>
          {isOwner && (
            <Pressable style={styles.dangerButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={15} color={color.danger} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function CommandStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: "#1B4B8F" }}>{value}</Text>
      <Text style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function TimelineTab({
  theme,
  reportId,
  timeline,
  isOwner,
  onCreated,
}: {
  theme: Theme;
  reportId: string;
  timeline: any[];
  isOwner: boolean;
  onCreated: () => void;
}) {
  const { color } = theme;
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createCaseTimelineEvent(reportId, { occurredAt: Date.now(), title: title.trim(), description: description.trim() });
      setTitle("");
      setDescription("");
      setAdding(false);
      onCreated();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível registrar o evento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginTop: theme.space.xl }}>
      {isOwner && <AddToggle theme={theme} adding={adding} label="Registrar evento" onToggle={() => setAdding((v) => !v)} />}
      {adding && (
        <View style={{ marginBottom: theme.space.lg, gap: 8 }}>
          <TextInputLike theme={theme} value={title} onChangeText={setTitle} placeholder="Título do evento" />
          <TextInputLike theme={theme} value={description} onChangeText={setDescription} placeholder="Descrição" multiline />
          <Pressable style={[stylesShared.primaryButton, saving && { opacity: 0.6 }]} disabled={saving} onPress={submit}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={stylesShared.primaryButtonText}>Salvar evento</Text>}
          </Pressable>
        </View>
      )}
      {timeline.length === 0 ? (
        <Text style={stylesShared.emptyText}>Nenhum evento registrado ainda.</Text>
      ) : (
        timeline.map((ev, i) => (
          <View key={ev.id || i} style={stylesShared.timelineRow}>
            <View style={stylesShared.timelineDotCol}>
              <View style={stylesShared.timelineDot} />
              {i < timeline.length - 1 && <View style={stylesShared.timelineLine} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 20 }}>
              <Text style={stylesShared.timelineTitle}>{ev.title}</Text>
              <Text style={stylesShared.timelineMeta}>
                {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString("pt-BR") : ""}
                {ev.factType ? ` · ${ev.factType}` : ""}
              </Text>
              {ev.description ? <Text style={stylesShared.timelineDetail}>{ev.description}</Text> : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function EntitiesTab({
  theme,
  reportId,
  entities,
  isOwner,
  onCreated,
}: {
  theme: Theme;
  reportId: string;
  entities: any[];
  isOwner: boolean;
  onCreated: () => void;
}) {
  const { color } = theme;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState(ENTITY_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState(CONFIDENCE_OPTIONS[1]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createCaseEntity(reportId, { name: name.trim(), type, notes: notes.trim(), confidence });
      setName("");
      setNotes("");
      setAdding(false);
      onCreated();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível registrar a entidade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginTop: theme.space.xl }}>
      {isOwner && <AddToggle theme={theme} adding={adding} label="Registrar entidade" onToggle={() => setAdding((v) => !v)} />}
      {adding && (
        <View style={{ marginBottom: theme.space.lg, gap: 8 }}>
          <TextInputLike theme={theme} value={name} onChangeText={setName} placeholder="Nome / identificador" />
          <PillRow theme={theme} options={ENTITY_TYPES} value={type} onChange={setType} />
          <PillRow theme={theme} options={CONFIDENCE_OPTIONS} value={confidence} onChange={setConfidence} />
          <TextInputLike theme={theme} value={notes} onChangeText={setNotes} placeholder="Notas (opcional)" multiline />
          <Pressable style={[stylesShared.primaryButton, saving && { opacity: 0.6 }]} disabled={saving} onPress={submit}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={stylesShared.primaryButtonText}>Salvar entidade</Text>}
          </Pressable>
        </View>
      )}
      {entities.length === 0 ? (
        <Text style={stylesShared.emptyText}>Nenhuma entidade registrada ainda.</Text>
      ) : (
        <View style={{ gap: theme.space.md }}>
          {entities.map((e, i) => (
            <View key={e.id || i} style={stylesShared.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={stylesShared.hypothesisTitle}>{e.name}</Text>
                {e.confidence && (
                  <View style={[stylesShared.chip, { backgroundColor: color.infoTint }]}>
                    <Text style={[stylesShared.chipText, { color: color.primary }]}>{e.confidence}</Text>
                  </View>
                )}
              </View>
              <Text style={stylesShared.evidenceMeta}>{e.type}</Text>
              {e.notes ? <Text style={stylesShared.hypothesisDesc}>{e.notes}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function HypothesesTab({
  theme,
  reportId,
  hypotheses,
  isOwner,
  onCreated,
}: {
  theme: Theme;
  reportId: string;
  hypotheses: any[];
  isOwner: boolean;
  onCreated: () => void;
}) {
  const { color } = theme;
  const [adding, setAdding] = useState(false);
  const [statement, setStatement] = useState("");
  const [confidence, setConfidence] = useState(CONFIDENCE_OPTIONS[1]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!statement.trim()) return;
    setSaving(true);
    try {
      await api.createCaseHypothesis(reportId, { statement: statement.trim(), confidence });
      setStatement("");
      setAdding(false);
      onCreated();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível registrar a hipótese.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginTop: theme.space.xl }}>
      {isOwner && <AddToggle theme={theme} adding={adding} label="Nova hipótese" onToggle={() => setAdding((v) => !v)} />}
      {adding && (
        <View style={{ marginBottom: theme.space.lg, gap: 8 }}>
          <TextInputLike theme={theme} value={statement} onChangeText={setStatement} placeholder="Enunciado da hipótese" multiline />
          <PillRow theme={theme} options={CONFIDENCE_OPTIONS} value={confidence} onChange={setConfidence} />
          <Pressable style={[stylesShared.primaryButton, saving && { opacity: 0.6 }]} disabled={saving} onPress={submit}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={stylesShared.primaryButtonText}>Salvar hipótese</Text>}
          </Pressable>
        </View>
      )}
      {hypotheses.length === 0 ? (
        <Text style={stylesShared.emptyText}>Nenhuma hipótese registrada ainda.</Text>
      ) : (
        <View style={{ gap: theme.space.md }}>
          {hypotheses.map((h, i) => (
            <View key={h.id || i} style={stylesShared.card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[stylesShared.hypothesisTitle, { flex: 1 }]}>{h.statement}</Text>
                {h.confidence ? (
                  <View style={[stylesShared.chip, { backgroundColor: color.infoTint }]}>
                    <Text style={[stylesShared.chipText, { color: color.primary }]}>{h.confidence}</Text>
                  </View>
                ) : null}
              </View>
              {h.supportingEvidence ? <Text style={stylesShared.hypothesisDesc}>{h.supportingEvidence}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TasksTab({
  theme,
  reportId,
  tasks,
  isOwner,
  onCreated,
}: {
  theme: Theme;
  reportId: string;
  tasks: any[];
  isOwner: boolean;
  onCreated: () => void;
}) {
  const { color } = theme;
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createReportTask(reportId, { title: title.trim() });
      setTitle("");
      setAdding(false);
      onCreated();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível criar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(task: any) {
    try {
      await api.updateReportTaskStatus(reportId, task.id, task.status === "CONCLUIDA" ? "PENDENTE" : "CONCLUIDA");
      onCreated();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível atualizar a tarefa.");
    }
  }

  return (
    <View style={{ marginTop: theme.space.xl }}>
      {isOwner && <AddToggle theme={theme} adding={adding} label="Nova tarefa" onToggle={() => setAdding((v) => !v)} />}
      {adding && (
        <View style={{ marginBottom: theme.space.lg, gap: 8 }}>
          <TextInputLike theme={theme} value={title} onChangeText={setTitle} placeholder="O que precisa ser feito" />
          <Pressable style={[stylesShared.primaryButton, saving && { opacity: 0.6 }]} disabled={saving} onPress={submit}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={stylesShared.primaryButtonText}>Salvar tarefa</Text>}
          </Pressable>
        </View>
      )}
      {tasks.length === 0 ? (
        <Text style={stylesShared.emptyText}>Nenhuma tarefa registrada ainda.</Text>
      ) : (
        <View style={{ gap: theme.space.md }}>
          {tasks.map((t, i) => (
            <Pressable key={t.id || i} style={stylesShared.card} onPress={() => toggle(t)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons
                  name={t.status === "CONCLUIDA" ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={t.status === "CONCLUIDA" ? color.success : color.textFaint}
                />
                <Text style={[stylesShared.hypothesisTitle, t.status === "CONCLUIDA" && { textDecorationLine: "line-through", color: color.textFaint }]}>
                  {t.title}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function AddToggle({ theme, adding, label, onToggle }: { theme: Theme; adding: boolean; label: string; onToggle: () => void }) {
  const { color } = theme;
  return (
    <Pressable style={[stylesShared.secondaryButton, { marginBottom: theme.space.lg }]} onPress={onToggle}>
      <Ionicons name={adding ? "close" : "add"} size={15} color={color.text} />
      <Text style={stylesShared.secondaryButtonText}>{adding ? "Cancelar" : label}</Text>
    </Pressable>
  );
}

function PillRow({ theme, options, value, onChange }: { theme: Theme; options: string[]; value: string; onChange: (v: string) => void }) {
  const { color } = theme;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row" }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: value === opt ? color.primary : color.surface,
              borderWidth: 1,
              borderColor: value === opt ? color.primary : color.border,
            }}
          >
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: value === opt ? "#fff" : color.textMuted }}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// Evidência é servida por um endpoint autenticado (não uma URL pública),
// então o RN Image precisa mandar o Bearer token junto via `headers`.
function AuthenticatedThumbnail({ reportId, evidenceId }: { reportId: string; evidenceId: string }) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    getToken().then((token) => setHeaders(token ? { Authorization: `Bearer ${token}` } : {}));
  }, []);
  if (!headers) return <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#EEF1F5" }} />;
  return (
    <Image
      source={{ uri: api.evidenceFileUrl(reportId, evidenceId), headers }}
      style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#EEF1F5" }}
    />
  );
}

function escapeHtml(s: string) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
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
        alignItems: "center",
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: radius.sm + 2,
        backgroundColor: active ? color.surface : "transparent",
        marginRight: 6,
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

// Estilos compartilhados pelos subcomponentes de abas (fora de buildStyles
// porque não dependem de re-render do componente principal).
const stylesShared = StyleSheet.create({
  emptyText: { fontSize: 13, color: "#98A2B3", textAlign: "center", paddingVertical: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, shadowColor: "#0F2A4D", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineDotCol: { width: 14, alignItems: "center" },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#1B4B8F", marginTop: 4 },
  timelineLine: { flex: 1, width: 1.5, backgroundColor: "#E4E7EC", marginTop: 4 },
  timelineTitle: { fontSize: 13.5, fontWeight: "600", color: "#101828" },
  timelineMeta: { fontSize: 11, color: "#98A2B3", marginTop: 2 },
  timelineDetail: { fontSize: 12.5, color: "#475569", marginTop: 4, lineHeight: 18 },
  hypothesisTitle: { fontSize: 13.5, fontWeight: "700", color: "#101828" },
  hypothesisDesc: { fontSize: 12.5, color: "#475569", marginTop: 8, lineHeight: 18 },
  evidenceMeta: { fontSize: 10, color: "#98A2B3", marginTop: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 11.5, fontWeight: "700" },
  primaryButton: { backgroundColor: "#1B4B8F", borderRadius: 12, padding: 13, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  secondaryButton: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 10, padding: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryButtonText: { fontSize: 13, fontWeight: "600", color: "#101828" },
});

function buildStyles(theme: Theme) {
  const { color, font, radius, space } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    title: { fontSize: 21, fontWeight: "700", color: color.text, letterSpacing: -0.3, lineHeight: 27, marginTop: 6 },
    chipRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
    chipText: { fontSize: 11.5, fontWeight: "700" },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.success },
    statusRow: { flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" },
    statusChip: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
    statusChipActive: { backgroundColor: color.primary, borderColor: color.primary },
    statusChipText: { fontSize: 11, fontWeight: "700", color: color.textMuted },
    statusChipTextActive: { color: "#fff" },
    summary: { fontSize: 13, color: color.textMuted, marginTop: 14, lineHeight: 20 },
    commandCard: { flexDirection: "row", backgroundColor: color.surface, borderRadius: radius.lg, padding: 14, marginTop: space.lg, ...theme.shadow.card },
    segmented: { flexDirection: "row", backgroundColor: "#EEF1F5", padding: 4, borderRadius: radius.md + 1, marginTop: space.xl },
    emptyText: { fontSize: 13, color: color.textFaint, textAlign: "center", paddingVertical: 24 },
    card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 14, ...theme.shadow.card },
    evidenceIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: color.infoTint, alignItems: "center", justifyContent: "center" },
    evidenceFileName: { fontSize: 13, fontWeight: "600", color: color.text },
    evidenceCaption: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
    evidenceMeta: { fontSize: 10, color: color.textFaint, marginTop: 6 },
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
