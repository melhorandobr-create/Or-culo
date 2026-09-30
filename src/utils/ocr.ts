import { Platform } from "react-native";
import TextRecognition from "@react-native-ml-kit/text-recognition";

// OCR roda 100% no aparelho via Google ML Kit (Android) / Vision (iOS) —
// não depende do backend nem envia a imagem pra lugar nenhum só pra
// extrair o texto. Não existe suporte web pro ML Kit nativo.
export async function recognizeTextFromImage(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    throw new Error("OCR não está disponível na versão web — use o app instalado no celular.");
  }
  const result = await TextRecognition.recognize(uri);
  return result.text;
}
