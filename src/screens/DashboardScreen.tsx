import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCases } from "../contexts/CasesContext";
import { useSystemAlerts } from "../hooks/useSystemAlerts";
import { usePrognose } from "../hooks/usePrognose";
import { Theme } from "../theme";
import { api } from "../api/client";
import { OfflineBanner } from "../components/OfflineBanner";

interface ExtraStats {
  sources: number;
  pending: number;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  // Casos vêm da fonte compartilhada (CasesContext) — mesma que alimenta
  // Central de Comando/Correlação/Timeline, com o mesmo cache offline.
  // Antes o Dashboard refazia essa busca por conta própria, duplicando
  // requisições e sem cache nenhum.
  const { loading: loadingCases, error: casesError, reports, offline, cachedAt, reload: reloadCases } = useCases();
  const alerts = useSystemAlerts();
  // Dashboard é a tela mais visitada (home do app) — basta montar o hook
  // pra disparar a checagem diária do Prognose sozinho, sem depender do
  // usuário lembrar de abrir a Central de Comando.
  usePrognose();

  const [refreshing, setRefreshing] = useState(false);
  const [extraStats, setExtraStats] = useState<ExtraStats>({ sources: 0, pending: 0 });

  const loadExtras = useCallback(async () => {
    try {
      const [monitorsRes, pendingRes] = await Promise.all([
        api.listSourceMonitors().catch(() => ({ monitors: [] })),
        api.listIncomingAccessRequests().catch(() => ({ requests: [] })),
      ]);
      setExtraStats({
        sources: (monitorsRes as any).monitors?.length ?? 0,
        pending: (pendingRes as any).requests?.filter((r: any) => r.status === "pending" || !r.status).length ?? 0,
      });
    } catch {
      // estatísticas extras são só um plus visual — falha aqui não deve travar o dashboard.
    }
  }, []);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const stats = {
    pins: reports.length,
    sources: extraStats.sources,
    pending: extraStats.pending,
    secret: reports.filter((r) => r.classification === "SECRETO").length,
  };

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([reloadCases(), loadExtras()]);
    setRefreshing(false);
  }

  const loading = loadingCases && reports.length === 0;
  const error = casesError;

  const initials = (user?.displayName || user?.username || "??")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoDot}>
            <Ionicons name="compass-outline" size={15} color="#fff" />
          </View>
          <Text style={styles.logoText}>Oráculo</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.bellButton} onPress={() => navigation.navigate("IntelligenceHub")}>
            <Ionicons name={alerts.total > 0 ? "notifications" : "notifications-outline"} size={18} color={alerts.total > 0 ? color.danger : color.text} />
            {alerts.total > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{alerts.total > 9 ? "9+" : alerts.total}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={color.primary} />}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Visão geral</Text>
          <View style={styles.secureBadge}>
            <View style={styles.secureDot} />
            <Text style={styles.secureBadgeText}>Enlace criptografado ativo</Text>
          </View>
        </View>

        {offline && <OfflineBanner cachedAt={cachedAt} />}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard theme={theme} icon="location-outline" value={stats.pins} label="Casos georreferenciados" tint={color.infoTint} iconColor={color.primary} />
          <StatCard theme={theme} icon="radio-outline" value={stats.sources} label="Fontes monitoradas" tint={color.warningTint} iconColor={color.warning} />
          <StatCard theme={theme} icon="time-outline" value={stats.pending} label="Pedidos pendentes" tint={color.dangerTint} iconColor={color.danger} />
          <StatCard theme={theme} icon="shield-outline" value={stats.secret} label="Casos SECRETO" tint={color.successTint} iconColor={color.success} />
        </View>

        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("ReportDetail", { mode: "create" })}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Novo caso</Text>
        </Pressable>

        <Text style={styles.moduleGridLabel}>Módulos</Text>
        <View style={styles.moduleGrid}>
          <ModuleTile theme={theme} icon="map-outline" label="Mapa" onPress={() => navigation.navigate("TerritorialMap")} />
          <ModuleTile theme={theme} icon="server-outline" label="Fontes" onPress={() => navigation.navigate("PublicSources")} />
          <ModuleTile
            theme={theme}
            icon="speedometer-outline"
            label="Comando"
            badge={alerts.overdueTasks > 0 ? alerts.overdueTasks : undefined}
            onPress={() => navigation.navigate("CommandCenter")}
          />
          <ModuleTile
            theme={theme}
            icon="git-network-outline"
            label="Correlação"
            badge={alerts.nearDuplicates > 0 ? alerts.nearDuplicates : undefined}
            onPress={() => navigation.navigate("Correlation")}
          />
          <ModuleTile theme={theme} icon="time-outline" label="Timeline" onPress={() => navigation.navigate("SystemTimeline")} />
          <ModuleTile theme={theme} icon="sparkles-outline" label="Assistente IA" onPress={() => navigation.navigate("CrossCaseAi")} />
          <ModuleTile
            theme={theme}
            icon="eye-outline"
            label="Vigilância"
            badge={alerts.watchlistHits > 0 ? alerts.watchlistHits : undefined}
            onPress={() => navigation.navigate("Watchlist")}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Casos recentes</Text>
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhum caso registrado.</Text>
          </View>
        ) : (
          <View style={{ gap: theme.space.md }}>
            {reports.slice(0, 6).map((r) => (
              <Pressable
                key={r.id}
                style={styles.card}
                onPress={() => navigation.navigate("ReportDetail", { reportId: r.id })}
              >
                <View style={styles.caseRowTop}>
                  <Text style={styles.caseId}>CASO #{r.id.slice(0, 6).toUpperCase()}</Text>
                  {r.classification === "SECRETO" && (
                    <View style={styles.secretBadge}>
                      <Text style={styles.secretBadgeText}>SECRETO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.caseTitle}>{r.title || r.displayName || "Sem título"}</Text>
                <View style={styles.caseStatusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.caseStatus}>{r.status || "Aberto"}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  theme,
  icon,
  value,
  label,
  tint,
  iconColor,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tint: string;
  iconColor: string;
}) {
  const { color, space, radius } = theme;
  return (
    <View style={{ width: "48%", backgroundColor: color.surface, borderRadius: radius.xl, padding: space.lg, ...theme.shadow.card }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: tint, alignItems: "center", justifyContent: "center", marginBottom: space.md }}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={{ fontSize: 25, fontWeight: "700", color: color.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: color.textMuted, marginTop: 5, lineHeight: 16 }}>{label}</Text>
    </View>
  );
}

// Grade densa de módulos, acesso direto (um toque, sem hub intermediário)
// — linguagem visual mais próxima de portal institucional/governamental
// do que de lista de cards estilo app de consumo.
function ModuleTile({
  theme,
  icon,
  label,
  badge,
  onPress,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  const { color, radius } = theme;
  return (
    <Pressable style={styles_moduleTile.tile} onPress={onPress}>
      <View style={[styles_moduleTile.iconBox, { backgroundColor: color.bg, borderColor: color.border }]}>
        <Ionicons name={icon} size={19} color={color.text} />
        {badge != null && (
          <View style={[styles_moduleTile.badge, { backgroundColor: color.danger }]}>
            <Text style={styles_moduleTile.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles_moduleTile.label, { color: color.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles_moduleTile = StyleSheet.create({
  tile: { width: "23%", alignItems: "center", gap: 6, marginBottom: 14 },
  iconBox: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, borderRadius: 8, minWidth: 17, height: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 9.5, fontWeight: "700" },
  label: { fontSize: 10.5, fontWeight: "600", textAlign: "center" },
});

function buildStyles(theme: Theme) {
  const { color, font, radius, space } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    center: { alignItems: "center", justifyContent: "center" },
    header: {
      paddingTop: 6,
      paddingHorizontal: space.xl,
      paddingBottom: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    logoDot: { width: 30, height: 30, borderRadius: 9, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" },
    logoText: { fontSize: 17, fontWeight: "700", color: color.text },
    bellButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EBEFF4", alignItems: "center", justifyContent: "center" },
    bellBadge: { position: "absolute", top: -3, right: -3, backgroundColor: color.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
    bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EBEFF4", alignItems: "center", justifyContent: "center" },
    avatarText: { color: color.textMuted, fontWeight: "600", fontSize: 12 },
    scroll: { padding: space.xl, paddingTop: space.md, paddingBottom: 40, gap: 0 },
    titleBlock: { marginBottom: space.lg },
    title: { fontSize: 23, fontWeight: "700", color: color.text, letterSpacing: -0.4 },
    secureBadge: {
      marginTop: space.md,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: color.successTint,
      borderRadius: radius.pill,
      paddingVertical: 5,
      paddingHorizontal: 11,
    },
    secureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.success },
    secureBadgeText: { fontSize: 12, color: color.success, fontWeight: "600" },
    errorBanner: { backgroundColor: color.dangerTint, borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
    errorText: { color: color.danger, fontSize: 12.5 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: space.lg },
    primaryButton: {
      backgroundColor: color.primary,
      borderRadius: radius.lg,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: space.xxl,
    },
    primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 14.5 },
    moduleGridLabel: { fontSize: 11, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    moduleGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: space.md },
    sectionHeaderRow: { marginBottom: space.md },
    sectionHeader: { fontSize: 15, fontWeight: "700", color: color.text, letterSpacing: -0.2 },
    emptyCard: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 34, alignItems: "center" },
    emptyText: { color: color.textFaint, fontSize: 13 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: space.lg, ...theme.shadow.card },
    caseRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    caseId: { fontSize: 10.5, color: color.textFaint, fontWeight: "600" },
    secretBadge: { backgroundColor: color.dangerTint, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
    secretBadgeText: { fontSize: 10.5, color: color.danger, fontWeight: "700" },
    caseTitle: { fontSize: 13.5, fontWeight: "600", color: color.text, marginTop: 6, lineHeight: 18 },
    caseStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.success },
    caseStatus: { fontSize: 11.5, color: color.success, fontWeight: "600" },
  });
}
