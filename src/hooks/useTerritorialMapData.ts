import { useCallback, useEffect, useMemo, useState } from "react";
import { api, SourceMonitor, ApiError } from "../api/client";
import { useCases } from "../contexts/CasesContext";

export type MapLayer = "cases" | "sources" | "flights" | "strategic";

// "reports" vem da mesma fonte compartilhada do resto do app (CasesContext)
// — antes o mapa fazia sua própria busca de listReports(), uma terceira
// cópia da mesma requisição (Dashboard e as telas de sistema já tinham
// cada uma a sua). Agora ganha cache offline de graça também.
// Coordenada só é válida se virar um número finito dentro do range
// geográfico real — casos antigos (schema pré-CaseEntity) às vezes têm
// lat/lng como string vazia, texto ou NaN, que passavam pelo filtro
// antigo (só checava != null) e chegavam até o Marker nativo. No Android,
// react-native-maps trava a view nativa inteira ao receber uma coordenada
// não-finita: a tela fica em branco e o app para de responder até forçar
// o fechamento — exatamente o crash que motivou este filtro mais rígido.
function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

export interface MapBounds {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

// Antes o bbox de voos era fixo (Nordeste do Brasil), então mudar de área
// no mapa — inclusive pra São Paulo, bem fora dessa caixa — nunca trazia
// nada, mesmo com tráfego aéreo real na região visível. O bbox agora
// acompanha a área que está de fato na tela.
export function useTerritorialMapData(layer: MapLayer, bounds: MapBounds) {
  const { loading, error, reports: allReports, offline, cachedAt } = useCases();
  const reports = useMemo(
    () =>
      allReports
        .filter((r) => isValidCoordinate(r.operationLatitude, r.operationLongitude))
        .map((r) => ({
          ...r,
          operationLatitude: Number(r.operationLatitude),
          operationLongitude: Number(r.operationLongitude),
        })),
    [allReports]
  );

  const [flights, setFlights] = useState<any[]>([]);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<SourceMonitor[]>([]);

  const loadFlights = useCallback(async () => {
    setFlightsError(null);
    try {
      const res = await api.getFlights(bounds);
      setFlights(res.flights || []);
    } catch (err) {
      setFlights([]);
      setFlightsError(err instanceof ApiError ? err.message : "Não foi possível carregar o tráfego aéreo.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.lamin, bounds.lomin, bounds.lamax, bounds.lomax]);

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
