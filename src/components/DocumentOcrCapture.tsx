import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, TextInput, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Theme } from "../theme";
import { api, ApiError, Evidence } from "../api/client";
import { recognizeTextFromImage } from "../utils/ocr";
import { captureForensicMetadata } from "../utils/forensicMetadata";

type Stage = "idle" | "scanning" | "review";

// Digitaliza um documento físico (RG, ofício, nota, etc.) com a câmera,
// extrai o texto via OCR no próprio aparelho (ML Kit — nada sai do
// dispositivo só pra ler o texto) e deixa revisar/editar antes de anexar
// como evidência, já com a metadata forense de captura.
export function DocumentOcrCapture({
  reportId,
  theme,
  onUploaded,
}: {
  reportId: string;
  theme: Theme;
  onUploaded: (evidence: Evidence) => void;
}) {
  const { color } = theme;
  const [stage, setStage] = useState<Stage>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);

  if (Platform.OS === "web") return null;

  async function pickAndScan(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", fromCamera ? "Autorize a câmera pra digitalizar o documento." : "Autorize a galeria pra escolher a foto do documento.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setImageUri(uri);
    setStage("scanning");
    try {
      const recognized = await recognizeTextFromImage(uri);
      setText(recognized || "");
      setStage("review");
    } catch (err) {
      Alert.alert("OCR indisponível", err instanceof Error ? err.message : "Não foi possível extrair o texto da imagem.");
      setStage("idle");
      setImageUri(null);
    }
  }

  async function attachAsEvidence() {
    if (!imageUri) return;
    setUploading(true);
    try {
      const meta = await captureForensicMetadata();
      const caption = `[Documento digitalizado via OCR]\n${text.slice(0, 1800)}\n\n${meta}`;
      const res = await api.uploadEvidence(reportId, {
        kind: "photo",
        file: { uri: imageUri, name: `documento-${Date.now()}.jpg`, type: "image/jpeg" },
        caption,
      });
      onUploaded(res.evidence);
      setStage("idle");
      setImageUri(null);
      setText("");
    } catch (err) {
      Alert.alert("Erro ao anexar", err instanceof ApiError ? err.message : "Não foi possível enviar o documento.");
    } finally {
      setUploading(false);
    }
  }

  if (stage === "idle") {
    return (
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable style={[localStyles.button, { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, flex: 1 }]} onPress={() => pickAndScan(true)}>
          <Ionicons name="scan-outline" size={15} color={color.text} />
          <Text style={[localStyles.buttonText, { color: color.text }]}>Digitalizar documento (OCR)</Text>
        </Pressable>
      </View>
    );
  }

  if (stage === "scanning") {
    return (
      <View style={[localStyles.button, { backgroundColor: color.bg, borderWidth: 1, borderColor: color.border }]}>
        <ActivityIndicator color={color.primary} size="small" />
        <Text style={[localStyles.buttonText, { color: color.text }]}>Lendo texto do documento…</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: theme.radius.lg, padding: theme.space.md, borderWidth: 1, borderColor: color.border, gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: color.text }}>Texto reconhecido (revise antes de anexar)</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        style={{ minHeight: 100, fontSize: 12.5, color: color.text, backgroundColor: color.bg, borderRadius: 8, padding: 10, textAlignVertical: "top" }}
        placeholder="Nenhum texto reconhecido — pode editar manualmente."
        placeholderTextColor={color.textFaint}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          style={[localStyles.button, { backgroundColor: color.bg, borderWidth: 1, borderColor: color.border, flex: 1 }]}
          onPress={() => {
            setStage("idle");
            setImageUri(null);
            setText("");
          }}
          disabled={uploading}
        >
          <Text style={[localStyles.buttonText, { color: color.textMuted }]}>Cancelar</Text>
        </Pressable>
        <Pressable style={[localStyles.button, { backgroundColor: color.primary, flex: 1 }]} onPress={attachAsEvidence} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={localStyles.buttonText}>Anexar como evidência</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 11 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
});
