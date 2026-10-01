import React, { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, ApiError } from "../api/client";

type Kind = "company" | "sanctions" | "court" | "cep" | "whois" | "wayback";

// company/sanctions/court exigem finalidade (auditada, servidor exige mín.
// 10 caracteres). cep/whois/wayback são consultas genuinamente públicas e
// sem exigência de finalidade no backend (routes/osintExtra.js).
const REQUIRES_PURPOSE: Kind[] = ["company", "sanctions", "court"];

export default function IntelligenceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);

  const [kind, setKind] = useState<Kind>("company");
  const [query, setQuery] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  function selectKind(k: Kind) {
    setKind(k);
    setResult(null);
    setError(null);
  }

  async function handleQuery() {
    setError(null);
    setResult(null);
    if (REQUIRES_PURPOSE.includes(kind) && purpose.trim().length < 10) {
      setError("Descreva a finalidade legítima da consulta (mín. 10 caracteres).");
      return;
    }
    if (!query.trim()) {
      setError("Preencha o campo de busca.");
      return;
    }
    setLoading(true);
    try {
      let res: unknown;
      if (kind === "company") res = await api.queryCompany(query.trim(), purpose.trim());
      else if (kind === "sanctions") res = await api.querySanctions(query.trim(), purpose.trim());
      else if (kind === "court") res = await api.queryCourtCase(query.trim(), tribunal.trim(), purpose.trim());
      else if (kind === "cep") res = await api.queryCep(query.trim());
      else if (kind === "whois") res = await api.queryWhois(query.trim());
      else res = await api.queryWayback(query.trim());
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  const placeholders: Record<Kind, string> = {
    company: "CNPJ (14 dígitos)",
    sanctions: "Nome ou razão social",
    court: "Número CNJ (20 dígitos)",
    cep: "CEP (8 dígitos)",
    whois: "Domínio (ex.: exemplo.com.br)",
    wayback: "URL completa (https://...)",
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>SONDA</Text>
        <Text style={styles.subtitle}>Consulta avulsa em fontes públicas oficiais</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.kindGrid}>
          <KindChip theme={theme} active={kind === "company"} label="CNPJ" onPress={() => selectKind("company")} />
          <KindChip theme={theme} active={kind === "sanctions"} label="Sanções" onPress={() => selectKind("sanctions")} />
          <KindChip theme={theme} active={kind === "court"} label="Processo" onPress={() => selectKind("court")} />
          <KindChip theme={theme} active={kind === "cep"} label="CEP" onPress={() => selectKind("cep")} />
          <KindChip theme={theme} active={kind === "whois"} label="WHOIS" onPress={() => selectKind("whois")} />
          <KindChip theme={theme} active={kind === "wayback"} label="Wayback" onPress={() => selectKind("wayback")} />
        </View>

        <TextInput
          style={styles.input}
          placeholder={placeholders[kind]}
          placeholderTextColor={color.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          keyboardType={kind === "company" || kind === "court" || kind === "cep" ? "number-pad" : "default"}
        />

        {kind === "court" && (
          <TextInput
            style={styles.input}
            placeholder="Sigla do tribunal (ex.: TJBA)"
            placeholderTextColor={color.textFaint}
            value={tribunal}
            onChangeText={setTribunal}
            autoCapitalize="characters"
          />
        )}

        {REQUIRES_PURPOSE.includes(kind) && (
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
            placeholder="Finalidade legítima da consulta (mín. 10 caracteres) — fica registrada em auditoria"
            placeholderTextColor={color.textFaint}
            value={purpose}
            onChangeText={setPurpose}
            multiline
          />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable style={[styles.queryButton, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleQuery}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="search" size={15} color="#fff" />
              <Text style={styles.queryButtonText}>Consultar</Text>
            </>
          )}
        </Pressable>

        {result != null && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Resultado</Text>
            <Text style={styles.resultBody}>{JSON.stringify(result, null, 2)}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function KindChip({ theme, active, label, onPress }: { theme: Theme; active: boolean; label: string; onPress: () => void }) {
  const { color } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: "31%",
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
        backgroundColor: active ? color.primary : color.surface,
        borderWidth: 1,
        borderColor: active ? color.primary : color.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : color.textMuted }}>{label}</Text>
    </Pressable>
  );
}

function buildStyles(theme: Theme) {
  const { color, space, radius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg, paddingTop: 44 },
    header: { paddingHorizontal: space.xl, paddingTop: space.md },
    title: { fontSize: 23, fontWeight: "700", color: color.text, letterSpacing: -0.4 },
    subtitle: { fontSize: 12.5, color: color.textMuted, marginTop: 4 },
    list: { padding: space.xl, gap: 10 },
    kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: "3.5%" as any, rowGap: 8, marginTop: space.lg, marginBottom: 4 },
    input: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: 13, fontSize: 13.5, color: color.text },
    errorText: { color: color.danger, fontSize: 12.5 },
    queryButton: { backgroundColor: color.primary, borderRadius: radius.lg, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    queryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    resultCard: { backgroundColor: color.surface, borderRadius: radius.xl, padding: 14, ...theme.shadow.card },
    resultLabel: { fontSize: 11.5, fontWeight: "700", color: color.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
    resultBody: { fontSize: 12, color: "#344054", fontFamily: "monospace", lineHeight: 17 },
  });
}
