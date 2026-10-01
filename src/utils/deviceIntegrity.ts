import { Platform } from "react-native";

export interface DeviceIntegrityReport {
  checked: boolean;
  isCompromised: boolean;
  findings: string[];
}

// Checagem de postura do próprio aparelho — roda só no app nativo (não
// existe equivalente confiável pra web/Windows). Root/jailbreak é o sinal
// mais forte de comprometimento: indica que alguém (ou algum malware) tem
// controle além do que o sistema operacional normalmente permite,
// incluindo potencialmente ler dados de outros apps.
export async function checkDeviceIntegrity(): Promise<DeviceIntegrityReport> {
  if (Platform.OS === "web") {
    return { checked: false, isCompromised: false, findings: [] };
  }

  try {
    // Import local pra não quebrar o bundle web (módulo nativo).
    const JailMonkey = require("jail-monkey").default;
    const findings: string[] = [];

    if (JailMonkey.isJailBroken()) {
      findings.push(Platform.OS === "ios" ? "Dispositivo com jailbreak detectado" : "Dispositivo com root detectado");
    }
    if (JailMonkey.hookDetected()) {
      findings.push("Framework de hooking/instrumentação detectado (ex.: Frida, Xposed)");
    }
    if (JailMonkey.canMockLocation()) {
      findings.push("Localização falsa (mock location) está habilitada no sistema");
    }
    if (Platform.OS === "android" && JailMonkey.AdbEnabled()) {
      findings.push("Depuração ADB habilitada");
    }

    return { checked: true, isCompromised: findings.length > 0, findings };
  } catch {
    return { checked: false, isCompromised: false, findings: [] };
  }
}
