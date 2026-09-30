import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";

export const PROXIMITY_TASK_NAME = "ORACULO_PROXIMITY_GEOFENCE";

// Alerta de proximidade: quando o próprio aparelho do operativo entra no
// raio de um caso ativo, dispara uma notificação local no dispositivo.
// Não monitora terceiros — só a posição do próprio aparelho comparada com
// coordenadas de casos que o usuário já tem acesso. Funciona mesmo com o
// app em segundo plano (API de geofencing nativa do SO), mas nunca com o
// app desinstalado ou o serviço de localização do sistema desligado.
//
// defineTask precisa rodar no carregamento do módulo (fora de componentes)
// pra o SO conseguir chamar de volta mesmo depois do app reiniciar.
TaskManager.defineTask(PROXIMITY_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = (data as { eventType: number; region: Location.LocationRegion }) || {};
  if (eventType === Location.GeofencingEventType.Enter && region) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Proximidade de ponto de interesse",
        body: `Você está próximo de: ${region.identifier || "um caso monitorado"}.`,
        data: { regionIdentifier: region.identifier },
      },
      trigger: null,
    }).catch(() => {});
  }
});

export interface ProximityRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export async function startProximityAlerts(regions: ProximityRegion[]): Promise<{ ok: boolean; reason?: string }> {
  if (regions.length === 0) return { ok: false, reason: "Nenhum caso georreferenciado pra monitorar." };
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return { ok: false, reason: "Permissão de localização negada." };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    return { ok: false, reason: "Permissão de localização em segundo plano negada — o alerta só funciona com o app aberto." };
  }
  await Notifications.requestPermissionsAsync();
  await Location.startGeofencingAsync(
    PROXIMITY_TASK_NAME,
    regions.map((r) => ({ identifier: r.identifier, latitude: r.latitude, longitude: r.longitude, radius: r.radiusMeters }))
  );
  return { ok: true };
}

export async function stopProximityAlerts() {
  const started = await Location.hasStartedGeofencingAsync(PROXIMITY_TASK_NAME).catch(() => false);
  if (started) await Location.stopGeofencingAsync(PROXIMITY_TASK_NAME);
}

export async function isProximityAlertsActive() {
  return Location.hasStartedGeofencingAsync(PROXIMITY_TASK_NAME).catch(() => false);
}
