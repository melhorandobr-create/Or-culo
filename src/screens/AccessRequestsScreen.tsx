import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, AccessRequest, ApiError } from "../api/client";

export default function AccessRequestsScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<AccessRequest[]>([]);
  const [outgoing, setOutgoing] = useState<AccessRequest[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [incomingRes, outgoingRes] = await Promise.all([
        api.listIncomingAccessRequests(),
        api.listOutgoingAccessRequests().catch(() => ({ requests: [] })),
      ]);
      setIncoming(incomingRes.requests || []);
      setOutgoing(outgoingRes.requests || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "deny") {
    try {
      if (action === "approve") await api.approveAccessRequest(id);
      else await api.denyAccessRequest(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível processar o pedido.");
    }
  }

  const pending = incoming.filter((r) => !r.status || r.status === "pending");
  const granted = incoming.filter((r) => r.status === "approved" || r.status === "granted");
  const denied = incoming.filter((r) => r.status === "denied");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Pedidos de acesso</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.sectionLabel}>Pendentes · {pending.length}</Text>
          <View style={{ gap: theme.space.md, marginBottom: theme.space.xxl }}>
            {pending.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum pedido pendente.</Text>
            ) : (
              pending.map((r) => (
                <View key={r.id} style={styles.card}>
                  <Text style={styles.requester}>Caso #{String(r.reportId).slice(0, 6).toUpperCase()}</Text>
                  {r.justification ? <Text style={styles.justification}>"{r.justification}"</Text> : null}
                  <View style={styles.metaBox}>
                    {r.scope ? (
                      <View style={{ marginBottom: 8 }}>
                        <Text style={styles.metaLabel}>Escopo solicitado</Text>
                        <Text style={styles.metaValue}>{r.scope}</Text>
                      </View>
                    ) : null}
                    {r.durationDays ? (
                      <View>
                        <Text style={styles.metaLabel}>Prazo solicitado</Text>
                        <Text style={styles.metaValue}>{r.durationDays} dias</Text>
                      </View>
                    ) : null}
                  </View>
                  {r.handlingCommitment ? (
                    <View style={styles.commitmentBox}>
                      <Ionicons name="alert-circle-outline" size={14} color={color.warning} />
                      <Text style={styles.commitmentText}>Compromisso: {r.handlingCommitment}</Text>
                    </View>
                  ) : null}
                  <View style={styles.buttonRow}>
                    <Pressable style={styles.approveButton} onPress={() => act(r.id, "approve")}>
                      <Text style={styles.approveText}>Autorizar</Text>
                    </Pressable>
                    <Pressable style={styles.denyButton} onPress={() => act(r.id, "deny")}>
                      <Text style={styles.denyText}>Negar</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionLabel}>Autorizados</Text>
          <View style={[styles.card, { marginBottom: theme.space.xxl }]}>
            {granted.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum acesso autorizado ainda.</Text>
            ) : (
              granted.map((r, i) => (
                <View key={r.id} style={[styles.listRow, i < granted.length - 1 && styles.listRowBorder]}>
                  <Text style={styles.listRowTitle}>Caso #{String(r.reportId).slice(0, 6).toUpperCase()}</Text>
                  <Pressable onPress={() => api.revokeAccessRequest(r.id).then(load)}>
                    <Text style={styles.revokeText}>Revogar</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionLabel}>Negados</Text>
          <View style={[styles.card, { marginBottom: theme.space.xxl }]}>
            {denied.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum pedido negado.</Text>
            ) : (
              denied.map((r, i) => (
                <View key={r.id} style={[styles.listRow, i < denied.length - 1 && styles.listRowBorder, { opacity: 0.65 }]}>
                  <Text style={styles.listRowTitle}>Caso #{String(r.reportId).slice(0, 6).toUpperCase()}</Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionLabel}>Meus pedidos enviados</Text>
          <View style={styles.card}>
            {outgoing.length === 0 ? (
              <Text style={styles.emptyText}>Você não solicitou acesso a nenhum caso ainda. Peça pela tela do próprio caso, quando ele estiver bloqueado.</Text>
            ) : (
              outgoing.map((r, i) => (
                <View key={r.id} style={[styles.listRow, i < outgoing.length - 1 && styles.listRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listRowTitle}>Caso #{String(r.reportId).slice(0, 6).toUpperCase()}</Text>
                    {r.justification ? <Text style={styles.metaValue} numberOfLines={1}>{r.justification}</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.revokeText,
                      { color: r.status === "denied" ? color.danger : r.status === "approved" || r.status === "granted" ? color.success : color.textMuted },
                    ]}
                  >
                    {r.status === "denied" ? "Negado" : r.status === "approved" || r.status === "granted" ? "Autorizado" : "Pendente"}
                  </Text>
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
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    emptyText: { color: color.textFaint, fontSize: 13 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 16, ...theme.shadow.card },
    requester: { fontSize: 13.5, fontWeight: "600", color: color.text },
    justification: { fontSize: 12.5, color: "#344054", marginTop: 12, lineHeight: 18, backgroundColor: color.bg, borderRadius: 10, padding: 10 },
    metaBox: { backgroundColor: color.bg, borderRadius: 10, padding: 10, marginTop: 8 },
    metaLabel: { fontSize: 10.5, color: color.textFaint, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
    metaValue: { fontSize: 12.5, color: "#344054", marginTop: 3 },
    commitmentBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10, backgroundColor: color.warningTint, borderRadius: 10, padding: 9 },
    commitmentText: { flex: 1, fontSize: 11.5, color: color.warning, lineHeight: 16 },
    buttonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    approveButton: { flex: 1, backgroundColor: color.primary, borderRadius: 10, padding: 11, alignItems: "center" },
    approveText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    denyButton: { flex: 1, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 10, padding: 11, alignItems: "center" },
    denyText: { color: "#344054", fontSize: 13, fontWeight: "600" },
    listRow: { paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    listRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
    listRowTitle: { fontSize: 13, fontWeight: "600", color: color.text },
    revokeText: { fontSize: 11.5, color: color.danger, fontWeight: "600" },
  });
}
