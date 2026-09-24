import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Switch, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { Theme } from "../theme";
import { api, SecurityIncident, ApiError } from "../api/client";

export default function SecurityCenterScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posture, setPosture] = useState<{ mfaCoverage: number; mfaTotal: number; mfaMissing: number } | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

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

  function handleDisableMfa() {
    Alert.alert(
      "Desativar MFA",
      "Você precisará da senha atual e do código do autenticador (ou um código de recuperação).",
      [{ text: "Entendi" }]
    );
  }

  async function handleRevokeSession(id: string) {
    try {
      await api.revokeSession(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível encerrar a sessão.");
    }
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
            <Switch value={!!user?.mfaEnabled} onValueChange={handleDisableMfa} />
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: color.infoTint }]}>
              <Ionicons name="key-outline" size={16} color={color.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Alterar senha</Text>
              <Text style={styles.rowSubtitle}>Gerenciar credencial de acesso</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={color.textFaint} />
          </View>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: color.warningTint }]}>
              <Ionicons name="document-lock-outline" size={16} color={color.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Códigos de recuperação</Text>
              <Text style={styles.rowSubtitle}>Uso único cada</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={color.textFaint} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Sessões ativas</Text>
        <View style={[styles.card, { padding: 0, marginBottom: theme.space.xxl }]}>
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

        <Text style={styles.sectionLabel}>Incidentes registrados</Text>
        <View style={[styles.card, { padding: 0, marginBottom: theme.space.xxl }]}>
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
    auditRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    auditTime: { fontSize: 10.5, color: color.textFaint, width: 50 },
    auditAction: { fontSize: 11.5, color: "#344054", flex: 1 },
  });
}
