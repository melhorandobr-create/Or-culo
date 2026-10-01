import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "../api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Registra o token de push no backend assim que o usuário está logado —
// é o gancho que faz o monitoramento 24/7 do servidor (checkDueSourceMonitors,
// que já roda de hora em hora) conseguir avisar o operador quando encontra
// uma mudança numa fonte monitorada.
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let cancelled = false;

    async function register() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted" || cancelled) return;

      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const token = tokenResponse.data;
        if (cancelled || !token) return;
        await api.registerPushToken(token);
      } catch {
        // Falha silenciosa — notificação não é crítica pro uso do app.
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
