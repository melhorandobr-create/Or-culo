import React, { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { useSystemAlerts } from "../hooks/useSystemAlerts";

// Ponto de entrada único pras telas "de sistema" (antes espalhadas como
// botões soltos no Dashboard) — resolve o problema de produto de "parede
// de botões" e dá um lugar natural pro resumo de alertas viver.
export default function IntelligenceHubScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();
  const alerts = useSystemAlerts();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={color.text} />
        </Pressable>
        <Text style={styles.headerTitle}>NÚCLEO</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {alerts.total > 0 && (
          <View style={styles.alertCard}>
            <Ionicons name="notifications" size={18} color={color.danger} />
            <Text style={styles.alertText}>
              {alerts.total} ponto(s) de atenção: {alerts.overdueTasks} tarefa(s) atrasada(s), {alerts.watchlistHits} alerta(s) de
              vigilância, {alerts.nearDuplicates} possível(is) duplicata(s).
            </Text>
          </View>
        )}

        <HubCard
          theme={theme}
          icon="speedometer-outline"
          iconColor={color.primary}
          tint={color.infoTint}
          title="C2"
          subtitle="Risco, fase, tarefas e Prognose (parecer + previsão)"
          badge={alerts.overdueTasks > 0 ? alerts.overdueTasks : undefined}
          onPress={() => navigation.navigate("CommandCenter")}
        />
        <HubCard
          theme={theme}
          icon="git-network-outline"
          iconColor={color.warning}
          tint={color.warningTint}
          title="NODAL"
          subtitle="Entidades repetidas e possíveis duplicatas"
          badge={alerts.nearDuplicates > 0 ? alerts.nearDuplicates : undefined}
          onPress={() => navigation.navigate("Correlation")}
        />
        <HubCard
          theme={theme}
          icon="time-outline"
          iconColor={color.success}
          tint={color.successTint}
          title="CRONOS"
          subtitle="Todos os eventos, de todos os casos, em ordem"
          onPress={() => navigation.navigate("SystemTimeline")}
        />
        <HubCard
          theme={theme}
          icon="sparkles-outline"
          iconColor={color.primary}
          tint={color.infoTint}
          title="DELPHI"
          subtitle="Pergunte algo que cruze vários casos ao mesmo tempo"
          onPress={() => navigation.navigate("CrossCaseAi")}
        />
        <HubCard
          theme={theme}
          icon="eye-outline"
          iconColor={color.danger}
          tint={color.dangerTint}
          title="SENTINELA"
          subtitle="Termos de interesse cruzados com todos os casos"
          badge={alerts.watchlistHits > 0 ? alerts.watchlistHits : undefined}
          onPress={() => navigation.navigate("Watchlist")}
        />
      </ScrollView>
    </View>
  );
}

function HubCard({
  theme,
  icon,
  iconColor,
  tint,
  title,
  subtitle,
  badge,
  onPress,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  tint: string;
  title: string;
  subtitle: string;
  badge?: number;
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
        marginBottom: space.md,
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
      {badge != null && (
        <View style={{ backgroundColor: color.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
    </Pressable>
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
    alertCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: color.dangerTint, borderRadius: radius.lg, padding: 14, marginBottom: space.xl },
    alertText: { flex: 1, fontSize: 12, color: color.danger, lineHeight: 17 },
  });
}
