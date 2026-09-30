import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Armazenamento local simples, por dispositivo (não sincroniza entre
// aparelhos nem passa pelo servidor) — mesmo padrão usado pro token de
// sessão em api/client.ts. Usado pra preferências como a lista de
// vigilância, que não precisa (e não deveria) ser um dado do backend.
export async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = Platform.OS === "web" ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJson<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify(value);
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, raw);
  } else {
    await SecureStore.setItemAsync(key, raw);
  }
}

export async function removeJson(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // sem cache pra limpar — tudo bem.
  }
}
