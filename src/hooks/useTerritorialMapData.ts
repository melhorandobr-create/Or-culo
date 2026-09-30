import { useCallback, useEffect, useMemo, useState } from "react";
import { api, SourceMonitor, ApiError } from "../api/client";
import { useCases } from "../contexts/CasesContext";

export type MapLayer = "cases" | "sources" | "flights" | "strategic";

// "reports" vem da mesma fonte compartilhada do resto do app (CasesContext)
// — antes o mapa fazia sua própria busca de listReports(), uma terceira
// cópia da mesma requisição (Dashboard e as telas de sistema já tinham
// cada uma a sua). Agora ganha cache offline de graça também.
export function useTerritorialMapData(layer: MapLayer) {
  const { loading, error, reports: allReports, offline, cachedAt } = useCases();
  const reports = useMemo(() => allReports.filter((r) => r.operationLatitude != null && r.operationLongitude != null), [allReports]);

  const [flights, setFlights] = useState<any[]>([]);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<SourceMonitor[]>([]);

  const loadFlights = useCallback(async () => {
    setFlightsError(null);
    try {
      const res = await api.getFlights({ lamin: -20, lomin: -48, lamax: -6.5, lomax: -35 });
      setFlights(res.flights || []);
    } catch (err) {
      setFlights([]);
      setFlightsError(err instanceof ApiError ? err.message : "Não foi possível carregar o tráfego aéreo.");
    }
  }, []);

  useEffect(() => {
    if (layer === "flights") loadFlights();
  }, [layer, loadFlights]);

  const loadMonitors = useCallback(async () => {
    try {
      const res = await api.listSourceMonitors();
      setMonitors(res.monitors || []);
    } catch {
      setMonitors([]);
    }
  }, []);

  useEffect(() => {
    if (layer === "sources") loadMonitors();
  }, [layer, loadMonitors]);

  return { loading, error, reports, flights, flightsError, monitors, offline, cachedAt };
}
