import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import { Theme } from "../theme";
import { api, ApiError, Evidence } from "../api/client";
import { captureForensicMetadata } from "../utils/forensicMetadata";

// Evidência de áudio — grava com o microfone do aparelho e sobe como
// evidência normal. O backend só aceita kind "photo"/"video"/"link", então
// o áudio sobe com kind "video" (aceito) mas mimeType real "audio/mp4";
// o visualizador de evidências decide como tocar pelo mimeType, não pelo
// kind, então isso não afeta a experiência de quem revisa depois.
export function AudioEvidenceRecorder({
  reportId,
  theme,
  onUploaded,
}: {
  reportId: string;
  theme: Theme;
  onUploaded: (evidence: Evidence) => void;
}) {
  const { color } = theme;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [uploading, setUploading] = useState(false);

  async function startRecording() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert("Permissão necessária", "Autorize o microfone para gravar evidência de áudio.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stopAndUpload() {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return;
    setUploading(true);
    try {
      const caption = await captureForensicMetadata();
      const fileName = `audio-${Date.now()}.m4a`;
      const res = await api.uploadEvidence(reportId, {
        kind: "video",
        file: { uri, name: fileName, type: "audio/mp4" },
        caption: `[Evidência de áudio] ${caption}`,
      });
      onUploaded(res.evidence);
    } catch (err) {
      Alert.alert("Erro ao enviar áudio", err instanceof ApiError ? err.message : "Não foi possível enviar a gravação.");
    } finally {
      setUploading(false);
    }
  }

  const seconds = Math.floor(recorderState.durationMillis / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (uploading) {
    return (
      <View style={[localStyles.button, { backgroundColor: color.bg, borderWidth: 1, borderColor: color.border }]}>
        <ActivityIndicator color={color.primary} size="small" />
        <Text style={[localStyles.buttonText, { color: color.text }]}>Enviando áudio…</Text>
      </View>
    );
  }

  if (recorderState.isRecording) {
    return (
      <Pressable style={[localStyles.button, { backgroundColor: color.danger, flex: 1 }]} onPress={stopAndUpload}>
        <Ionicons name="stop-circle-outline" size={15} color="#fff" />
        <Text style={localStyles.buttonText}>Parar e enviar ({mm}:{ss})</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={[localStyles.button, { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, flex: 1 }]} onPress={startRecording}>
      <Ionicons name="mic-outline" size={15} color={color.text} />
      <Text style={[localStyles.buttonText, { color: color.text }]}>Gravar áudio</Text>
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 11 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
});
