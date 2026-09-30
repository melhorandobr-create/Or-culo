import { Platform } from "react-native";

// expo-media-library não tem suporte nenhum a web e seu módulo nativo
// lança exceção assim que é carregado (não só quando usado) — um import
// estático no topo do arquivo quebra o bundle inteiro no navegador antes
// até da tela de login renderizar. Isolado aqui com require() atrasado
// (só executa quando a função roda), assim o módulo nunca é avaliado do
// lado web.
export async function deleteOriginalAsset(assetId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const MediaLibrary = require("expo-media-library");
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (perm.granted) {
    await new MediaLibrary.Asset(assetId).delete();
  }
}
