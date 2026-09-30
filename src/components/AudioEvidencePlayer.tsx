import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Theme } from "../theme";
import { api, getToken } from "../api/client";

// Player de evidências de áudio — como o backend só aceita kind
// "video"/"photo"/"link", uma gravação de áudio sobe como kind "video"
// com mimeType real "audio/mp4"; aqui a UI decide pelo mimeType, não pelo
// kind, então toca certo mesmo com essa limitação de schema.
export function AudioEvidencePlayer({ theme, reportId, evidenceId }: { theme: Theme; reportId: string; evidenceId: string }) {
  const { color } = theme;
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    getToken().then((token) => setHeaders(token ? { Authorization: `Bearer ${token}` } : {}));
  }, []);

  const player = useAudioPlayer(headers ? { uri: api.evidenceFileUrl(reportId, evidenceId), headers } : null);
  const status = useAudioPlayerStatus(player);

  if (!headers) {
    return <ActivityIndicator color={color.primary} size="small" />;
  }

  const seconds = Math.floor((status.currentTime || 0));
  const total = Math.floor(status.duration || 0);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={status.playing ? "pause" : "play"} size={14} color="#fff" />
      </Pressable>
      <Text style={{ fontSize: 11, color: color.textMuted }}>
        {fmt(seconds)} / {total ? fmt(total) : "--:--"}
      </Text>
    </View>
  );
}
