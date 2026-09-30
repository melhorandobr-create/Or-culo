import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal, Linking, Alert } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, getBaseUrl, ApiError, Report } from "../api/client";

// Fluxo: gera o PDF localmente (igual ao rascunho), manda pro backend
// "guardar" temporariamente (stage), abre o navegador do sistema pra
// autorização com o e-CPF via Safeweb, e escuta o retorno via deep link
// oraculo://safeweb-signed. So então busca o PDF já assinado e abre o
// compartilhamento nativo.
type Phase = "idle" | "staging" | "waiting" | "fetching" | "error";

export function SignatureExportModal({
  visible,
  onClose,
  report,
  html,
}: {
  visible: boolean;
  onClose: () => void;
  report: Report;
  html: string;
}) {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemoStyles(theme);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    return () => {
      listenerRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setPhase("idle");
      setErrorMessage(null);
      listenerRef.current?.remove();
    }
  }, [visible]);

  async function handleExportSemAssinatura() {
    try {
      if (Platform_isWeb()) {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
        }
      }
      onClose();
    } catch {
      Alert.alert("Erro ao exportar", "Não foi possível gerar o PDF.");
    }
  }

  async function handleAssinarEExportar() {
    setErrorMessage(null);
    setPhase("staging");
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as FileSystem.EncodingType });
      const { signId } = await api.stageReportForSignature(report.id, base64);

      setPhase("waiting");
      listenerRef.current?.remove();
      listenerRef.current = Linking.addEventListener("url", async (event) => {
        const parsed = parseSafewebRedirect(event.url);
        if (!parsed || parsed.signId !== signId) return;
        listenerRef.current?.remove();
        listenerRef.current = null;

        if (parsed.status === "error") {
          setPhase("error");
          setErrorMessage(parsed.message || "A Safeweb recusou a assinatura.");
          return;
        }

        setPhase("fetching");
        try {
          const result = await api.getSignatureResult(report.id, signId);
          if (result.status !== "done" || !result.pdfBase64) {
            throw new Error(result.message || "Assinatura não concluída.");
          }
          const path = `${FileSystem.cacheDirectory}relatorio-assinado-${report.id}.pdf`;
          await FileSystem.writeAsStringAsync(path, result.pdfBase64, {
            encoding: "base64" as FileSystem.EncodingType,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(path, { mimeType: "application/pdf" });
          }
          onClose();
        } catch (err) {
          setPhase("error");
          setErrorMessage(err instanceof ApiError ? err.message : "Não foi possível obter o PDF assinado.");
        }
      });

      await Linking.openURL(`${getBaseUrl()}/auth/safeweb/start?signId=${signId}`);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof ApiError ? err.message : "Não foi possível iniciar a assinatura.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>EXPORTAR RELATÓRIO</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.docLabel}>Documento</Text>
          <Text style={styles.docTitle}>{report.title || "Sem título"}</Text>
          <Text style={styles.docProto}>{(report as any).protocolNumber || report.id}</Text>

          {phase === "idle" && (
            <>
              <View style={styles.sigLine}>
                <Text style={styles.sigText}>
                  Assinar digitalmente com seu certificado e-CPF cadastrado na Safeweb. Você vai autorizar no app
                  SafeID ou com sua senha de certificado.
                </Text>
              </View>
              <Text style={styles.finePrint}>
                O corpo do relatório mostra o codinome do operador quando preenchido; a assinatura sempre identifica
                o titular real do certificado.
              </Text>
            </>
          )}

          {(phase === "staging" || phase === "waiting" || phase === "fetching") && (
            <View style={styles.progressBox}>
              <ActivityIndicator color={color.text} />
              <Text style={styles.progressText}>
                {phase === "staging" && "Preparando documento..."}
                {phase === "waiting" && "Autorize no navegador que abriu — volte aqui depois."}
                {phase === "fetching" && "Buscando PDF assinado..."}
              </Text>
            </View>
          )}

          {phase === "error" && (
            <View style={styles.progressBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btnPrimary, phase !== "idle" && phase !== "error" && styles.btnDisabled]}
              disabled={phase !== "idle" && phase !== "error"}
              onPress={handleAssinarEExportar}
            >
              <Text style={styles.btnPrimaryText}>ASSINAR E EXPORTAR</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, phase !== "idle" && phase !== "error" && styles.btnDisabled]}
              disabled={phase !== "idle" && phase !== "error"}
              onPress={handleExportSemAssinatura}
            >
              <Text style={styles.btnSecondaryText}>EXPORTAR SEM ASSINATURA</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function parseSafewebRedirect(url: string): { signId: string; status: string; message?: string } | null {
  if (!url.startsWith("oraculo://safeweb-signed")) return null;
  const query = url.split("?")[1] || "";
  const params = new URLSearchParams(query);
  const signId = params.get("signId");
  const status = params.get("status");
  if (!signId || !status) return null;
  return { signId, status, message: params.get("message") || undefined };
}

function Platform_isWeb() {
  // Import local pra evitar puxar Platform duas vezes no topo do arquivo.
  const { Platform } = require("react-native");
  return Platform.OS === "web";
}

function useMemoStyles(theme: Theme) {
  const { color } = theme;
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: color.surface,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      padding: 22,
      paddingBottom: 34,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
    headerTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.6, color: color.text },
    close: { fontSize: 16, color: color.textFaint },
    docLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: color.textFaint, marginBottom: 4 },
    docTitle: { fontSize: 17, fontWeight: "700", color: color.text, marginBottom: 2 },
    docProto: { fontSize: 11.5, color: color.textMuted, fontFamily: "monospace", marginBottom: 20 },
    sigLine: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: color.border, paddingVertical: 14, marginBottom: 10 },
    sigText: { fontSize: 12.5, lineHeight: 19, color: color.textMuted },
    finePrint: { fontSize: 10.5, color: color.textFaint, lineHeight: 16, marginBottom: 20 },
    progressBox: { alignItems: "center", gap: 10, paddingVertical: 20, marginBottom: 10 },
    progressText: { fontSize: 12.5, color: color.textMuted, textAlign: "center" },
    errorText: { fontSize: 12.5, color: color.danger, textAlign: "center" },
    actions: { gap: 8, marginTop: 4 },
    btnPrimary: { backgroundColor: color.text, borderRadius: 3, paddingVertical: 13, alignItems: "center" },
    btnSecondary: { borderWidth: 1, borderColor: color.border, borderRadius: 3, paddingVertical: 12, alignItems: "center" },
    btnDisabled: { opacity: 0.5 },
    btnPrimaryText: { color: color.surface, fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
    btnSecondaryText: { color: color.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  });
}
