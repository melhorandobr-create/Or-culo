import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useCases } from "../contexts/CasesContext";
import { getJson, setJson } from "../utils/deviceStorage";
import { startProximityAlerts, stopProximityAlerts, isProximityAlertsActive } from "../services/geofencing";

const ENABLED_KEY = "oraculo_proximity_alerts_enabled";
const RADIUS_METERS = 500;

// Liga/desliga o alerta de proximidade — a lista de regiões monitoradas é
// sempre recalculada a partir dos casos georreferenciados que o usuário já
// tem acesso (fonte única: CasesContext), nunca de terceiros.
export function useProximityAlerts() {
  const { reports } = useCases();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLoading(false);
      return;
    }
    (async () => {
      const stored = await getJson<boolean>(ENABLED_KEY, false);
      const active = await isProximityAlertsActive();
      setEnabled(stored && active);
      setLoading(false);
    })();
  }, []);

  const regions = reports
    .filter((r) => r.operationLatitude != null && r.operationLongitude != null)
    .map((r) => ({
      identifier: r.title || "Caso monitorado",
      latitude: Number(r.operationLatitude),
      longitude: Number(r.operationLongitude),
      radiusMeters: RADIUS_METERS,
    }));

  const toggle = useCallback(async () => {
    if (Platform.OS === "web") {
      setError("Alertas de proximidade não funcionam no navegador — use o app instalado no celular.");
      return;
    }
    setError(null);
    if (enabled) {
      await stopProximityAlerts();
      setEnabled(false);
      setJson(ENABLED_KEY, false);
      return;
    }
    const res = await startProximityAlerts(regions);
    if (res.ok) {
      setEnabled(true);
      setJson(ENABLED_KEY, true);
    } else {
      setError(res.reason || "Não foi possível ativar o alerta de proximidade.");
    }
  }, [enabled, regions]);

  return { enabled, loading, error, regionsCount: regions.length, toggle };
}
