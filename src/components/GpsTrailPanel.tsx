import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme";
import { useGpsTrail } from "../hooks/useGpsTrail";

// Trilha de campo do próprio operativo, por caso — usa a localização do
// próprio aparelho, só enquanto o usuário liga o rastreamento aqui.
// Nada de coleta de terceiros ou rastreamento passivo/em segundo plano
// sem o usuário ter ligado explicitamente.
export function GpsTrailPanel({ theme, reportId }: { theme: Theme; reportId: string }) {
  const { color, space, radius } = theme;
  const { points, tracking, permissionDenied, start, stop, clear, totalMeters } = useGpsTrail(reportId);
  const [busy, setBusy] = React.useState(false);

  async function handleToggle() {
    if (tracking) {
      stop();
      return;
    }
    setBusy(true);
    await start();
    setBusy(false);
  }

  const last = points[points.length - 1];

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.xl, padding: space.lg, marginBottom: space.lg, ...theme.shadow.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: color.text }}>Trilha de campo (GPS)</Text>
        {tracking && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.danger }} />
            <Text style={{ fontSize: 11, color: color.danger, fontWeight: "700" }}>gravando</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 11.5, color: color.textMuted, marginBottom: 10, lineHeight: 16 }}>
        Registra a posição do seu próprio aparelho enquanto você estiver em campo neste caso. Fica salvo só no
        dispositivo, nada é enviado automaticamente.
      </Text>

      {points.length > 0 && (
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: color.text }}>{points.length}</Text>
            <Text style={{ fontSize: 10.5, color: color.textFaint }}>pontos</Text>
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: color.text }}>{(totalMeters / 1000).toFixed(2)} km</Text>
            <Text style={{ fontSize: 10.5, color: color.textFaint }}>percorridos</Text>
          </View>
          {last && (
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10.5, color: color.textFaint }}>último ponto</Text>
              <Text style={{ fontSize: 11, color: color.textMuted }}>{new Date(last.timestamp).toLocaleTimeString("pt-BR")}</Text>
            </View>
          )}
        </View>
      )}

      {permissionDenied && (
        <Text style={{ fontSize: 11.5, color: color.danger, marginBottom: 8 }}>
          Permissão de localização negada — autorize nas configurações do sistema pra usar a trilha.
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          style={[localStyles.button, { backgroundColor: tracking ? color.danger : color.primary, flex: 1 }]}
          onPress={handleToggle}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name={tracking ? "stop-circle-outline" : "play-circle-outline"} size={15} color="#fff" />
              <Text style={localStyles.buttonText}>{tracking ? "Parar trilha" : "Iniciar trilha"}</Text>
            </>
          )}
        </Pressable>
        {points.length > 0 && !tracking && (
          <Pressable style={[localStyles.button, { backgroundColor: color.bg, borderWidth: 1, borderColor: color.border }]} onPress={clear}>
            <Ionicons name="trash-outline" size={15} color={color.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 11 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
});
