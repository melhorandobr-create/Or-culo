import React, { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, ApiError } from "../api/client";
import { useAllCasesIntelligence } from "../hooks/useAllCasesIntelligence";
import { usePrognose } from "../hooks/usePrognose";

export default function CrossCaseAiScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const { loading: loadingCases, reports } = useAllCasesIntelligence();
  const { latest: latestPrognose } = usePrognose();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; provider: string } | null>(null);
  // Antes esta tela partia do zero a cada pergunta, sem enxergar o que o
  // Prognose (Central de Comando) já concluiu sobre os mesmos casos —
  // agora dá pra reaproveitar esse contexto em vez de repetir trabalho.
  const [usePrognoseContext, setUsePrognoseContext] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function ask() {
    if (selected.size === 0) {
      setError("Selecione ao menos um caso.");
      return;
    }
    if (question.trim().length < 5) {
      setError("Descreva a pergunta (mínimo 5 caracteres).");
      return;
    }
    setError(null);
    setResult(null);
    setAsking(true);
    try {
      const finalQuestion =
        usePrognoseContext && latestPrognose
          ? `Contexto (Prognose mais recente, gerado em ${new Date(latestPrognose.generatedAt).toLocaleString("pt-BR")}):\n${latestPrognose.text}\n\nPergunta: ${question.trim()}`
          : question.trim();
      const res = await api.aiCrossCaseAssist(Array.from(selected), finalQuestion);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "BlindAI/Grok indisponível.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>DELPHI</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Selecione os casos relevantes e pergunte algo que cruze todos eles. O BlindAI (Grok) responde só com base no
          que está escrito nos casos escolhidos, citando de qual caso vem cada elemento.
        </Text>

        <Text style={styles.sectionLabel}>Casos ({selected.size} selecionados)</Text>
        {loadingCases ? (
          <ActivityIndicator color={color.primary} />
        ) : (
          <View style={{ gap: 8, marginBottom: theme.space.xl }}>
            {reports.map((r) => {
              const active = selected.has(r.id);
              return (
                <Pressable key={r.id} style={[styles.caseRow, active && styles.caseRowActive]} onPress={() => toggle(r.id)}>
                  <Ionicons name={active ? "checkbox" : "square-outline"} size={18} color={active ? color.primary : color.textFaint} />
                  <Text style={[styles.caseRowTitle, active && { color: color.primary }]} numberOfLines={1}>{r.title || "Sem título"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {latestPrognose && (
          <Pressable
            style={[styles.prognoseToggle, usePrognoseContext && styles.prognoseToggleActive]}
            onPress={() => setUsePrognoseContext((v) => !v)}
          >
            <Ionicons
              name={usePrognoseContext ? "checkbox" : "square-outline"}
              size={16}
              color={usePrognoseContext ? color.primary : color.textFaint}
            />
            <Text style={[styles.prognoseToggleText, usePrognoseContext && { color: color.primary }]}>
              Incluir Prognose mais recente ({new Date(latestPrognose.generatedAt).toLocaleDateString("pt-BR")}) como contexto
            </Text>
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>Pergunta</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Existe padrão de horário entre os eventos desses casos?"
          placeholderTextColor={color.textFaint}
          value={question}
          onChangeText={setQuestion}
          multiline
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable style={[styles.askButton, asking && { opacity: 0.6 }]} disabled={asking} onPress={ask}>
          {asking ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="sparkles-outline" size={15} color="#fff" />
              <Text style={styles.askButtonText}>Perguntar</Text>
            </>
          )}
        </Pressable>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>{result.provider} · exige revisão humana</Text>
            <Text style={styles.resultBody}>{result.text}</Text>
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
    headerTitle: { fontSize: 16, fontWeight: "700", color: color.text, flex: 1 },
    scroll: { padding: space.xl },
    subtitle: { fontSize: 12, color: color.textMuted, marginBottom: space.xl, lineHeight: 17 },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    caseRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: color.surface, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: color.border },
    caseRowActive: { borderColor: color.primary, backgroundColor: color.infoTint },
    caseRowTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: color.text },
    input: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: 13, fontSize: 13.5, color: color.text, minHeight: 80, textAlignVertical: "top", marginBottom: 12 },
    prognoseToggle: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: 11, marginBottom: space.lg },
    prognoseToggleActive: { borderColor: color.primary, backgroundColor: color.infoTint },
    prognoseToggleText: { flex: 1, fontSize: 12, color: color.textMuted, fontWeight: "600" },
    errorText: { color: color.danger, fontSize: 12.5, marginBottom: 10 },
    askButton: { backgroundColor: color.primary, borderRadius: radius.lg, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    askButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    resultCard: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, marginTop: space.xl, ...theme.shadow.card },
    resultLabel: { fontSize: 10.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
    resultBody: { fontSize: 13, color: color.text, lineHeight: 20 },
  });
}
