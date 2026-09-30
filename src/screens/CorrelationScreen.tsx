import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { useAllCasesIntelligence } from "../hooks/useAllCasesIntelligence";
import { useWatchlist } from "../hooks/useWatchlist";
import { useDismissedDuplicates } from "../hooks/useDismissedDuplicates";
import { OfflineBanner } from "../components/OfflineBanner";
import { similarity } from "../utils/fuzzyMatch";

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function CorrelationScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { loading, error, reports, intelByReportId, offline, cachedAt } = useAllCasesIntelligence();
  const { terms: watchTerms, addTerm } = useWatchlist();
  const isWatched = (name: string) => watchTerms.some((t) => t.toLowerCase() === name.toLowerCase());
  const { dismissed, dismiss } = useDismissedDuplicates();

  const groups = useMemo(() => {
    const byName = new Map<string, { display: string; type: string; hits: Array<{ reportId: string; reportTitle: string }> }>();
    for (const r of reports) {
      const entities = (intelByReportId[r.id] as any)?.entities || [];
      for (const e of entities) {
        if (!e?.name) continue;
        const key = normalize(String(e.name));
        if (!byName.has(key)) byName.set(key, { display: e.name, type: e.type, hits: [] });
        const group = byName.get(key)!;
        if (!group.hits.some((h) => h.reportId === r.id)) {
          group.hits.push({ reportId: r.id, reportTitle: r.title || "Sem título" });
        }
      }
    }
    return Array.from(byName.values())
      .filter((g) => g.hits.length > 1)
      .sort((a, b) => b.hits.length - a.hits.length);
  }, [reports, intelByReportId]);

  // Nomes parecidos mas não idênticos (ex.: "José da Silva" vs "Jose
  // Silva") — mesma provável entidade grafada diferente entre casos, algo
  // que o cruzamento por nome exato acima não pega.
  const nearDuplicates = useMemo(() => {
    const allNames = new Map<string, string>(); // normalizado -> display
    for (const r of reports) {
      const entities = (intelByReportId[r.id] as any)?.entities || [];
      for (const e of entities) {
        if (e?.name) allNames.set(normalize(String(e.name)), e.name);
      }
    }
    const keys = Array.from(allNames.keys());
    const pairs: Array<{ a: string; b: string; score: number }> = [];
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (keys[i] === keys[j]) continue;
        const score = similarity(keys[i], keys[j]);
        if (score >= 0.72 && score < 1) {
          pairs.push({ a: allNames.get(keys[i])!, b: allNames.get(keys[j])!, score });
        }
      }
    }
    return pairs.sort((x, y) => y.score - x.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, intelByReportId]);

  const visibleNearDuplicates = useMemo(
    () => nearDuplicates.filter((p) => !dismissed.has([p.a.trim().toLowerCase(), p.b.trim().toLowerCase()].sort().join("::"))).slice(0, 20),
    [nearDuplicates, dismissed]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Correlação entre casos</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {offline && <OfflineBanner cachedAt={cachedAt} />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.subtitle}>
            Entidades (pessoas, empresas, veículos...) que aparecem em mais de um caso — cruzamento automático por nome.
          </Text>

          {groups.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma entidade repetida entre casos ainda.</Text>
          ) : (
            <View style={{ gap: theme.space.md }}>
              {groups.map((g) => (
                <View key={g.display} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.entityName}>{g.display}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{g.hits.length} casos</Text>
                    </View>
                  </View>
                  {g.type && <Text style={styles.entityType}>{g.type}</Text>}
                  <Pressable
                    style={styles.watchButton}
                    disabled={isWatched(g.display)}
                    onPress={() => addTerm(g.display)}
                  >
                    <Ionicons name={isWatched(g.display) ? "eye" : "eye-outline"} size={13} color={isWatched(g.display) ? color.textFaint : color.danger} />
                    <Text style={[styles.watchButtonText, isWatched(g.display) && { color: color.textFaint }]}>
                      {isWatched(g.display) ? "Na lista de vigilância" : "Adicionar à vigilância"}
                    </Text>
                  </Pressable>
                  <View style={{ marginTop: 10, gap: 6 }}>
                    {g.hits.map((h) => (
                      <Pressable key={h.reportId} style={styles.hitRow} onPress={() => navigation.navigate("ReportDetail", { reportId: h.reportId })}>
                        <Ionicons name="folder-outline" size={13} color={color.primary} />
                        <Text style={styles.hitTitle} numberOfLines={1}>{h.reportTitle}</Text>
                        <Ionicons name="chevron-forward" size={13} color={color.textFaint} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {visibleNearDuplicates.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: theme.space.xxl }]}>Possíveis duplicatas (nomes parecidos)</Text>
              <View style={{ gap: theme.space.md }}>
                {visibleNearDuplicates.map((p, i) => (
                  <View key={i} style={styles.dupCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dupText}>"{p.a}" ≈ "{p.b}"</Text>
                      <Text style={styles.dupScore}>{Math.round(p.score * 100)}% parecido</Text>
                    </View>
                    <Pressable
                      style={styles.watchIconButton}
                      disabled={isWatched(p.a) && isWatched(p.b)}
                      onPress={() => {
                        if (!isWatched(p.a)) addTerm(p.a);
                        if (!isWatched(p.b)) addTerm(p.b);
                      }}
                    >
                      <Ionicons
                        name={isWatched(p.a) && isWatched(p.b) ? "eye" : "eye-outline"}
                        size={16}
                        color={isWatched(p.a) && isWatched(p.b) ? color.textFaint : color.danger}
                      />
                    </Pressable>
                    <Pressable style={styles.dismissButton} onPress={() => dismiss(p.a, p.b)}>
                      <Ionicons name="close" size={16} color={color.textFaint} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}
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
    subtitle: { fontSize: 12, color: color.textMuted, marginBottom: space.lg, lineHeight: 17 },
    emptyText: { color: color.textFaint, fontSize: 13, textAlign: "center", paddingVertical: 30 },
    card: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, ...theme.shadow.card },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    entityName: { fontSize: 14, fontWeight: "700", color: color.text, flex: 1 },
    entityType: { fontSize: 11, color: color.textFaint, marginTop: 2 },
    countBadge: { backgroundColor: color.warningTint, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
    countBadgeText: { fontSize: 10.5, color: color.warning, fontWeight: "700" },
    hitRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: color.bg, borderRadius: 9, padding: 9 },
    hitTitle: { flex: 1, fontSize: 12, color: color.text, fontWeight: "600" },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    dupCard: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...theme.shadow.card },
    dupText: { fontSize: 12.5, color: color.text, marginRight: 8 },
    dupScore: { fontSize: 11, color: color.warning, fontWeight: "700", marginTop: 2 },
    watchButton: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, alignSelf: "flex-start", backgroundColor: color.dangerTint, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 9 },
    watchButtonText: { fontSize: 11, color: color.danger, fontWeight: "700" },
    watchIconButton: { width: 28, height: 28, borderRadius: 9, backgroundColor: color.dangerTint, alignItems: "center", justifyContent: "center" },
    dismissButton: { width: 28, height: 28, borderRadius: 9, backgroundColor: color.bg, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  });
}
