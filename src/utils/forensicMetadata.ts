import * as Location from "expo-location";

// Metadata forense gerada pelo PRÓPRIO app no momento do anexo — GPS e
// timestamp capturados ali, não lidos do EXIF do arquivo original (que
// pode ser removido ou forjado antes de chegar no app). O hash SHA-256
// já é calculado pelo servidor no recebimento e mostrado separadamente
// no visualizador de evidências, então não precisa duplicar aqui.
export async function captureForensicMetadata(): Promise<string> {
  const timestamp = new Date().toLocaleString("pt-BR");
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== "granted") {
      return `Metadata forense: capturado em ${timestamp} (localização não autorizada).`;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = loc.coords.latitude.toFixed(5);
    const lng = loc.coords.longitude.toFixed(5);
    const acc = loc.coords.accuracy ? `${Math.round(loc.coords.accuracy)}m` : "?";
    return `Metadata forense: GPS ${lat}, ${lng} (precisão ${acc}) · capturado em ${timestamp}.`;
  } catch {
    return `Metadata forense: capturado em ${timestamp} (localização indisponível).`;
  }
}
