import { useCallback, useEffect, useState } from "react";
import { api, Report, SourceMonitor, ApiError } from "../api/client";

export type MapLayer = "cases" | "sources" | "flights" | "strategic";

export function useTerritorialMapData(layer: MapLayer) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<SourceMonitor[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listReports();
      // Confirmado em routes/reports.js: coordenadas vêm como
      // operationLatitude/operationLongitude, nunca lat/lng.
      setReports((res.reports || []).filter((r) => r.operationLatitude != null && r.operationLongitude != null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return { loading, error, reports, flights, flightsError, monitors };
}
