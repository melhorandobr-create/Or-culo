import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { getJson, setJson } from "../utils/deviceStorage";

export interface TrailPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

function trailKey(reportId: string) {
  return `oraculo_gps_trail_${reportId}`;
}

// Distância aproximada em metros entre dois pontos (haversine) — só pra
// dar uma noção de "quanto o operativo andou", não é topografia de
// precisão.
function haversineMeters(a: TrailPoint, b: TrailPoint) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Trilha de campo do operativo, por caso — registrada só enquanto o
// próprio operativo liga o rastreamento nesta tela (sem coleta de
// terceiros, sem geolocalização passiva de outras pessoas). Guardada
// localmente no dispositivo; não é enviada a lugar nenhum automaticamente.
export function useGpsTrail(reportId: string) {
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [tracking, setTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    getJson<TrailPoint[]>(trailKey(reportId), []).then(setPoints);
    return () => {
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [reportId]);

  const persist = useCallback(
    (next: TrailPoint[]) => {
      setPoints(next);
      setJson(trailKey(reportId), next);
    },
    [reportId]
  );

  const start = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPermissionDenied(true);
      return false;
    }
    setPermissionDenied(false);
    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 },
      (loc) => {
        const point: TrailPoint = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
          timestamp: loc.timestamp,
        };
        setPoints((prev) => {
          const next = [...prev, point];
          setJson(trailKey(reportId), next);
          return next;
        });
      }
    );
    setTracking(true);
    return true;
  }, [reportId]);

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    setTracking(false);
  }, []);

  const clear = useCallback(() => {
    persist([]);
  }, [persist]);

  const totalMeters = points.reduce((sum, p, i) => (i === 0 ? 0 : sum + haversineMeters(points[i - 1], p)), 0);

  return { points, tracking, permissionDenied, start, stop, clear, totalMeters };
}
