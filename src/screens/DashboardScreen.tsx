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
import { Theme } from "../theme";
import { api, Report, ApiError } from "../api/client";

interface Stats {
  pins: number;
  sources: number;
  pending: number;
  monitors: number;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({ pins: 0, sources: 0, pending: 0, monitors: 0 });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [reportsRes, monitorsRes, pendingRes] = await Promise.all([
        api.listReports(),
        api.listSourceMonitors().catch(() => ({ monitors: [] })),
        api.listIncomingAccessRequests().catch(() => ({ requests: [] })),
      ]);
      const allReports = reportsRes.reports || [];
      setReports(allReports);
      setStats({
        pins: allReports.length,
        sources: (monitorsRes as any).monitors?.length ?? 0,
        pending: (pendingRes as any).requests?.filter((r: any) => r.status === "pending" || !r.status).length ?? 0,
        monitors: (monitorsRes as any).monitors?.filter((m: any) => m.active !== false).length ?? 0,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

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
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
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

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard theme={theme} icon="location-outline" value={stats.pins} label="Casos georreferenciados" tint={color.infoTint} iconColor={color.primary} />
          <StatCard theme={theme} icon="radio-outline" value={stats.sources} label="Fontes monitoradas" tint={color.warningTint} iconColor={color.warning} />
          <StatCard theme={theme} icon="time-outline" value={stats.pending} label="Pedidos pendentes" tint={color.dangerTint} iconColor={color.danger} />
          <StatCard theme={theme} icon="checkmark-circle-outline" value={stats.monitors} label="Monitoramentos ativos" tint={color.successTint} iconColor={color.success} />
        </View>

        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("ReportDetail", { mode: "create" })}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Novo caso</Text>
        </Pressable>

        <View style={styles.quickAccess}>
          <QuickRow
            theme={theme}
            icon="map-outline"
            iconColor={color.primary}
            tint={color.infoTint}
            title="Acervo de casos no mapa"
            subtitle={`${stats.pins} casos georreferenciados`}
            onPress={() => navigation.navigate("TerritorialMap")}
          />
          <QuickRow
            theme={theme}
            icon="server-outline"
            iconColor={color.warning}
            tint={color.warningTint}
            title="Central de dados e fontes"
            subtitle={`${stats.sources} fontes monitoradas`}
            onPress={() => navigation.navigate("PublicSources")}
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

function QuickRow({
  theme,
  icon,
  iconColor,
  tint,
  title,
  subtitle,
  onPress,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  tint: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { color, space, radius } = theme;
  return (
    <Pressable
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.xl,
        padding: space.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        ...theme.shadow.card,
      }}
      onPress={onPress}
    >
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: color.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
    </Pressable>
  );
}

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
    logoDot: { width: 30, height: 30, borderRadius: 9, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" },
    logoText: { fontSize: 17, fontWeight: "700", color: color.text },
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
    quickAccess: { gap: space.md, marginBottom: space.xxl },
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
