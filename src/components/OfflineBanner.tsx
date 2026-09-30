import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

export function OfflineBanner({ cachedAt }: { cachedAt: number | null }) {
  const { color, radius, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: color.warningTint,
        borderRadius: radius.md,
        padding: 10,
        marginBottom: space.lg,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={15} color={color.warning} />
      <Text style={{ fontSize: 11.5, color: color.warning, flex: 1 }}>
        Sem conexão — mostrando dados salvos {cachedAt ? `de ${new Date(cachedAt).toLocaleString("pt-BR")}` : "localmente"}.
      </Text>
    </View>
  );
}
