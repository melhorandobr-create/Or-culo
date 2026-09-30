import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { useAllCasesIntelligence } from "../hooks/useAllCasesIntelligence";
import { useWatchlist, matchWatchlist } from "../hooks/useWatchlist";

// Vigilância guardada só neste aparelho (não é um dado do servidor) — o
// cruzamento roda toda vez que a tela carrega, contra os casos visíveis
// pra esse usuário no momento.
export default function WatchlistScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { terms, loading: loadingTerms, addTerm, removeTerm } = useWatchlist();
  const { loading: loadingCases, reports, intelByReportId } = useAllCasesIntelligence();
  const [newTerm, setNewTerm] = useState("");

  const hits = useMemo(() => matchWatchlist(terms, reports, intelByReportId), [terms, reports, intelByReportId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Lista de vigilância</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Cadastre nomes ou termos de interesse. Toda vez que abrir esta tela, o app verifica se algum deles aparece
          como entidade em qualquer caso visível pra você.
        </Text>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Nome, empresa, apelido..."
            placeholderTextColor={color.textFaint}
            value={newTerm}
            onChangeText={setNewTerm}
          />
          <Pressable
            style={styles.addButton}
            onPress={() => {
              addTerm(newTerm);
              setNewTerm("");
            }}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        </View>

        {loadingTerms ? (
          <ActivityIndicator color={color.primary} />
        ) : terms.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum termo cadastrado ainda.</Text>
        ) : (
          <View style={styles.termsRow}>
            {terms.map((t) => (
              <View key={t} style={styles.termChip}>
                <Text style={styles.termChipText}>{t}</Text>
                <Pressable onPress={() => removeTerm(t)} hitSlop={6}>
                  <Ionicons name="close" size={13} color={color.textFaint} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: theme.space.xxl }]}>Alertas ({hits.length})</Text>
        {loadingCases ? (
          <ActivityIndicator color={color.primary} />
        ) : hits.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum termo vigiado apareceu em caso nenhum ainda.</Text>
        ) : (
          <View style={{ gap: theme.space.md }}>
            {hits.map((h, i) => (
              <Pressable key={i} style={styles.hitCard} onPress={() => navigation.navigate("ReportDetail", { reportId: h.reportId })}>
                <Ionicons name="alert-circle" size={18} color={color.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.hitTitle}>"{h.term}" encontrado em {h.entityName}</Text>
                  <Text style={styles.hitMeta}>{h.reportTitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={color.textFaint} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    subtitle: { fontSize: 12, color: color.textMuted, marginBottom: space.lg, lineHeight: 17 },
    addRow: { flexDirection: "row", gap: 8, marginBottom: space.md },
    input: { flex: 1, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: 12, fontSize: 13.5, color: color.text },
    addButton: { width: 44, backgroundColor: color.primary, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    emptyText: { color: color.textFaint, fontSize: 13 },
    termsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    termChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color.surface, borderRadius: 8, borderWidth: 1, borderColor: color.border, paddingVertical: 6, paddingHorizontal: 10 },
    termChipText: { fontSize: 12, fontWeight: "600", color: color.text },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    hitCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: color.dangerTint, borderRadius: radius.lg, padding: 12 },
    hitTitle: { fontSize: 12.5, fontWeight: "600", color: color.text },
    hitMeta: { fontSize: 11, color: color.textFaint, marginTop: 2 },
  });
}
