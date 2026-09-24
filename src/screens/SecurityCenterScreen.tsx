import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Switch, Alert, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { Theme } from "../theme";
import { api, SecurityIncident, ApiError } from "../api/client";

type Panel = "none" | "mfaSetup" | "mfaDisable" | "changePassword" | "incident";

export default function SecurityCenterScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { user, refreshUser, applyNewToken, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posture, setPosture] = useState<{ mfaCoverage: number; mfaTotal: number; mfaMissing: number } | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  // MFA setup
  const [setupInfo, setSetupInfo] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // MFA disable
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // Trocar senha
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Incidente
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [postureRes, incidentsRes, sessionsRes, auditRes] = await Promise.all([
        api.getSecurityPosture().catch(() => null),
        api.listIncidents().catch(() => ({ incidents: [] })),
        api.listSessions().catch(() => ({ sessions: [] })),
        api.listAuditEvents().catch(() => ({ events: [] })),
      ]);
      setPosture(postureRes);
      setIncidents((incidentsRes as any).incidents || []);
      setSessions((sessionsRes as any).sessions || []);
      setAudit(((auditRes as any).events || []).slice(0, 10));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function closePanel() {
    setPanel("none");
    setPanelError(null);
    setSetupInfo(null);
    setSetupCode("");
    setRecoveryCodes(null);
    setDisablePassword("");
    setDisableCode("");
    setCurrentPassword("");
    setNewPassword("");
    setIncidentTitle("");
    setIncidentDescription("");
  }

  async function startMfaSetup() {
    setPanel("mfaSetup");
    setPanelError(null);
    setBusy(true);
    try {
      const info = await api.mfaSetup();
      setSetupInfo(info);
    } catch (err) {
      setPanelError(err instanceof ApiError ? err.message : "Não foi possível iniciar a ativação do MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMfaSetup() {
    if (!setupCode.trim()) return;
    setBusy(true);
    setPanelError(null);
    try {
      const res = await api.mfaConfirm(setupCode.trim());
      await applyNewToken(res.token);
      setRecoveryCodes(res.recoveryCodes || []);
    } catch (err) {
      setPanelError(err instanceof ApiError ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMfaDisable() {
    if (!disablePassword.trim()) return;
    setBusy(true);
    setPanelError(null);
    try {
      const res = await api.mfaDisable(disablePassword, disableCode.trim() || undefined, undefined);
      await applyNewToken(res.token);
      closePanel();
      Alert.alert("MFA desativado", "A verificação em duas etapas foi desativada.");
    } catch (err) {
      setPanelError(err instanceof ApiError ? err.message : "Não foi possível desativar o MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function submitChangePassword() {
    if (!currentPassword || !newPassword) return;
    setBusy(true);
    setPanelError(null);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      await applyNewToken(res.token);
      closePanel();
      Alert.alert("Senha alterada", "Sua senha foi atualizada.");
    } catch (err) {
      setPanelError(err instanceof ApiError ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setBusy(false);
    }
  }

  async function submitIncident() {
    if (incidentTitle.trim().length < 3) {
      setPanelError("Descreva o incidente (mín. 3 caracteres).");
      return;
    }
    setBusy(true);
    setPanelError(null);
    try {
      await api.createIncident({ title: incidentTitle.trim(), description: incidentDescription.trim() });
      closePanel();
      await load();
    } catch (err) {
      setPanelError(err instanceof ApiError ? err.message : "Não foi possível registrar o incidente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeSession(id: string) {
    try {
      await api.revokeSession(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível encerrar a sessão.");
    }
  }

  function handleRevokeAllSessions() {
    Alert.alert(
      "Encerrar todas as sessões?",
      "Você também será desconectado deste dispositivo e precisará entrar de novo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Encerrar todas",
          style: "destructive",
          onPress: async () => {
            try {
              await api.revokeSessions();
            } catch {
              // a própria sessão atual já é revogada — erro aqui é esperado.
            }
            await logout();
          },
        },
      ]
    );
  }

  function handleRecoveryCodesRow() {
    if (!user?.mfaEnabled) {
      Alert.alert("MFA desativado", "Ative a verificação em duas etapas para gerar códigos de recuperação.");
      return;
    }
    Alert.alert(
      "Códigos de recuperação",
      "Os códigos foram exibidos uma única vez quando você ativou o MFA. Não é possível revê-los — se você os perdeu, desative e reative a verificação em duas etapas para gerar um novo lote."
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  const coverage = posture?.mfaCoverage ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Central de segurança</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Cobertura de MFA da equipe</Text>
            <Text style={styles.coverageValue}>{coverage}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${coverage}%` }]} />
          </View>
          {posture && (
            <Text style={styles.progressCaption}>
              {posture.mfaMissing} de {posture.mfaTotal} operativos sem verificação em duas etapas
            </Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>Sua conta</Text>
        <View style={[styles.card, { padding: 0, marginBottom: theme.space.xxl }]}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: color.successTint }]}>
              <Ionicons name="lock-closed-outline" size={16} color={color.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Verificação em duas etapas</Text>
              <Text style={[styles.rowSubtitle, { color: user?.mfaEnabled ? color.success : color.danger }]}>
                {user?.mfaEnabled ? "MFA ativo" : "MFA desativado"}
              </Text>
            </View>
            <Switch value={!!user?.mfaEnabled} onValueChange={() => (user?.mfaEnabled ? setPanel("mfaDisable") : startMfaSetup())} />
          </View>
          <Pressable style={[styles.row, styles.rowBorder]} onPress={() => setPanel("changePassword")}>
            <View style={[styles.rowIcon, { backgroundColor: color.infoTint }]}>
              <Ionicons name="key-outline" size={16} color={color.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Alterar senha</Text>
              <Text style={styles.rowSubtitle}>Gerenciar credencial de acesso</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={color.textFaint} />
          </Pressable>
          <Pressable style={styles.row} onPress={handleRecoveryCodesRow}>
            <View style={[styles.rowIcon, { backgroundColor: color.warningTint }]}>
              <Ionicons name="document-lock-outline" size={16} color={color.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Códigos de recuperação</Text>
              <Text style={styles.rowSubtitle}>Uso único cada</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={color.textFaint} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Sessões ativas</Text>
        <View style={[styles.card, { padding: 0, marginBottom: theme.space.md }]}>
          {sessions.length === 0 ? (
            <Text style={[styles.emptyText, { padding: 14 }]}>Nenhuma sessão listada.</Text>
          ) : (
            sessions.map((s, i) => (
              <View key={s.id || i} style={[styles.row, i < sessions.length - 1 && styles.rowBorder]}>
                <Ionicons name="phone-portrait-outline" size={16} color="#475569" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.rowTitle}>{s.deviceName || "Dispositivo não identificado"}</Text>
                  <Text style={styles.rowSubtitle}>{s.ip || ""}</Text>
                </View>
                <Pressable onPress={() => handleRevokeSession(s.id)}>
                  <Text style={styles.revokeText}>Encerrar</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
        {sessions.length > 0 && (
          <Pressable style={[styles.dangerLink, { marginBottom: theme.space.xxl }]} onPress={handleRevokeAllSessions}>
            <Text style={styles.dangerLinkText}>Encerrar todas as sessões</Text>
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>Incidentes registrados</Text>
        <View style={[styles.card, { padding: 0, marginBottom: theme.space.md }]}>
          {incidents.length === 0 ? (
            <Text style={[styles.emptyText, { padding: 14 }]}>Nenhum incidente registrado.</Text>
          ) : (
            incidents.slice(0, 6).map((inc, i) => (
              <View key={inc.id || i} style={[styles.row, i < incidents.length - 1 && styles.rowBorder]}>
                <View style={[styles.rowIcon, { backgroundColor: color.dangerTint }]}>
                  <Ionicons name="alert-circle-outline" size={14} color={color.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{inc.title}</Text>
                  <Text style={styles.rowSubtitle}>
                    {inc.createdAt ? new Date(inc.createdAt).toLocaleString("pt-BR") : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
        <Pressable style={[styles.secondaryButton, { marginBottom: theme.space.xxl }]} onPress={() => setPanel("incident")}>
          <Ionicons name="add" size={15} color={color.text} />
          <Text style={styles.secondaryButtonText}>Registrar incidente</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Log de auditoria</Text>
        <View style={[styles.card, { padding: 0 }]}>
          {audit.length === 0 ? (
            <Text style={[styles.emptyText, { padding: 14 }]}>Nenhum evento registrado.</Text>
          ) : (
            audit.map((a, i) => (
              <View key={a.id || i} style={[styles.auditRow, i < audit.length - 1 && styles.rowBorder]}>
                <Text style={styles.auditTime}>
                  {a.createdAt ? new Date(a.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                </Text>
                <Text style={styles.auditAction}>{a.action}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {panel !== "none" && (
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {panel === "mfaSetup" && (
              <>
                <Text style={styles.sheetTitle}>Ativar verificação em duas etapas</Text>
                {busy && !setupInfo ? (
                  <ActivityIndicator color={color.primary} style={{ marginVertical: 20 }} />
                ) : recoveryCodes ? (
                  <>
                    <Text style={styles.sheetHint}>
                      MFA ativado. Guarde estes códigos de recuperação — cada um funciona uma única vez e não serão mostrados de novo:
                    </Text>
                    <View style={styles.codesBox}>
                      {recoveryCodes.map((c) => (
                        <Text key={c} style={styles.codeText}>{c}</Text>
                      ))}
                    </View>
                    <Pressable style={styles.primaryButton} onPress={closePanel}>
                      <Text style={styles.primaryButtonText}>Concluído</Text>
                    </Pressable>
                  </>
                ) : setupInfo ? (
                  <>
                    <Text style={styles.sheetHint}>Cadastre no seu app autenticador (Google Authenticator, Authy etc.):</Text>
                    <Text selectable style={styles.secretText}>{setupInfo.secret}</Text>
                    <TextInput
                      style={styles.sheetInput}
                      placeholder="Código de 6 dígitos do autenticador"
                      placeholderTextColor={color.textFaint}
                      value={setupCode}
                      onChangeText={setSetupCode}
                      keyboardType="number-pad"
                    />
                    {panelError && <Text style={styles.errorText}>{panelError}</Text>}
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable style={[styles.primaryButton, { flex: 1 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={confirmMfaSetup}>
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirmar</Text>}
                      </Pressable>
                      <Pressable style={styles.secondaryButton} onPress={closePanel}>
                        <Text style={styles.secondaryButtonText}>Cancelar</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    {panelError && <Text style={styles.errorText}>{panelError}</Text>}
                    <Pressable style={styles.secondaryButton} onPress={closePanel}>
                      <Text style={styles.secondaryButtonText}>Fechar</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {panel === "mfaDisable" && (
              <>
                <Text style={styles.sheetTitle}>Desativar verificação em duas etapas</Text>
                <TextInput
                  style={styles.sheetInput}
                  placeholder="Senha atual"
                  placeholderTextColor={color.textFaint}
                  value={disablePassword}
                  onChangeText={setDisablePassword}
                  secureTextEntry
                />
                <TextInput
                  style={styles.sheetInput}
                  placeholder="Código do autenticador (ou deixe em branco e use recuperação)"
                  placeholderTextColor={color.textFaint}
                  value={disableCode}
                  onChangeText={setDisableCode}
                  keyboardType="number-pad"
                />
                {panelError && <Text style={styles.errorText}>{panelError}</Text>}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable style={[styles.primaryButton, { flex: 1 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={confirmMfaDisable}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Desativar</Text>}
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={closePanel}>
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </Pressable>
                </View>
              </>
            )}

            {panel === "changePassword" && (
              <>
                <Text style={styles.sheetTitle}>Alterar senha</Text>
                <TextInput
                  style={styles.sheetInput}
                  placeholder="Senha atual"
                  placeholderTextColor={color.textFaint}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                />
                <TextInput
                  style={styles.sheetInput}
                  placeholder="Nova senha"
                  placeholderTextColor={color.textFaint}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                {panelError && <Text style={styles.errorText}>{panelError}</Text>}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable style={[styles.primaryButton, { flex: 1 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={submitChangePassword}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Salvar</Text>}
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={closePanel}>
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </Pressable>
                </View>
              </>
            )}

            {panel === "incident" && (
              <>
                <Text style={styles.sheetTitle}>Registrar incidente</Text>
                <TextInput
                  style={styles.sheetInput}
                  placeholder="Título do incidente"
                  placeholderTextColor={color.textFaint}
                  value={incidentTitle}
                  onChangeText={setIncidentTitle}
                />
                <TextInput
                  style={[styles.sheetInput, { minHeight: 80, textAlignVertical: "top" }]}
                  placeholder="Descrição (opcional)"
                  placeholderTextColor={color.textFaint}
                  value={incidentDescription}
                  onChangeText={setIncidentDescription}
                  multiline
                />
                {panelError && <Text style={styles.errorText}>{panelError}</Text>}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable style={[styles.primaryButton, { flex: 1 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={submitIncident}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Registrar</Text>}
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={closePanel}>
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function buildStyles(theme: Theme) {
  const { color, space, radius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    header: { paddingTop: 54, paddingHorizontal: space.xl, paddingBottom: 4 },
    title: { fontSize: 23, fontWeight: "700", color: color.text, letterSpacing: -0.4 },
    scroll: { padding: space.xl, paddingBottom: 60 },
    errorText: { color: color.danger, fontSize: 12.5, marginBottom: 8 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 18, marginBottom: space.md, ...theme.shadow.card },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitle: { fontSize: 13, fontWeight: "700", color: color.text },
    coverageValue: { fontSize: 12.5, fontWeight: "700", color: color.warning },
    progressTrack: { height: 6, backgroundColor: "#F2F4F7", borderRadius: 3, marginTop: 10, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: color.warning, borderRadius: 3 },
    progressCaption: { fontSize: 11.5, color: color.textFaint, marginTop: 8 },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },
    emptyText: { color: color.textFaint, fontSize: 13 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
    rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    rowTitle: { fontSize: 13.5, fontWeight: "600", color: color.text },
    rowSubtitle: { fontSize: 11.5, color: color.textFaint, marginTop: 1 },
    revokeText: { fontSize: 11.5, color: color.danger, fontWeight: "600" },
    dangerLink: { alignItems: "center", padding: 8 },
    dangerLinkText: { fontSize: 12.5, color: color.danger, fontWeight: "600" },
    secondaryButton: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    secondaryButtonText: { fontSize: 13, fontWeight: "600", color: color.text },
    auditRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    auditTime: { fontSize: 10.5, color: color.textFaint, width: 50 },
    auditAction: { fontSize: 11.5, color: "#344054", flex: 1 },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space.xl, gap: 10 },
    sheetTitle: { fontSize: 16, fontWeight: "700", color: color.text, marginBottom: 4 },
    sheetHint: { fontSize: 12.5, color: color.textMuted, lineHeight: 18 },
    sheetInput: { backgroundColor: color.bg, borderRadius: 10, borderWidth: 1, borderColor: color.border, padding: 12, fontSize: 14, color: color.text },
    secretText: { fontSize: 13, fontFamily: "monospace", color: color.text, backgroundColor: color.bg, padding: 12, borderRadius: 10 },
    codesBox: { backgroundColor: color.bg, borderRadius: 10, padding: 12, gap: 4 },
    codeText: { fontSize: 13, fontFamily: "monospace", color: color.text },
    primaryButton: { backgroundColor: color.primary, borderRadius: radius.md, padding: 13, alignItems: "center" },
    primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
}
