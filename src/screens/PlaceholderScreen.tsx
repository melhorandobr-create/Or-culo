import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// Placeholder temporário: esta tela ainda não foi reconstruída.
// Ver README.md — reconstrução em andamento, tela por tela.
export default function PlaceholderScreen({ route }: { route?: { name?: string } }) {
  const { color, space } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: color.bg }]}>
      <Text style={{ color: color.textMuted, fontSize: 15, textAlign: "center", padding: space.xl }}>
        {route?.name ?? "Esta tela"} ainda está sendo reconstruída.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
