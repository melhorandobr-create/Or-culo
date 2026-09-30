import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, Report, CaseIntelligence, ApiError } from "../api/client";
import { getJson, setJson, removeJson } from "../utils/deviceStorage";
import { useAuth } from "./AuthContext";

const CACHE_KEY = "oraculo_cases_cache_v1";

interface Cache {
  cachedAt: number;
  reports: Report[];
  intelByReportId: Record<string, CaseIntelligence>;
}

interface CasesContextValue {
  loading: boolean;
  error: string | null;
  reports: Report[];
  intelByReportId: Record<string, CaseIntelligence>;
  offline: boolean;
  cachedAt: number | null;
  reload: () => Promise<void>;
}

const CasesContext = createContext<CasesContextValue | undefined>(undefined);

// Fonte única de casos + inteligência combinada, compartilhada pelo app
// inteiro (Dashboard incluído) — antes cada tela refazia a mesma busca por
// conta própria. Busca uma vez por sessão de login, com cache offline no
// aparelho; qualquer tela pode pedir um reload (ex.: pull-to-refresh) sem
// duplicar a lógica.
export function CasesProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [intelByReportId, setIntelByReportId] = useState<Record<string, CaseIntelligence>>({});
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.listReports();
      const viewable = (res.reports || []).filter((r) => r.canView !== false);

      const entries = await Promise.all(
        viewable.map(async (r) => {
          try {
            const intel = await api.getCaseIntelligence(r.id);
            return [r.id, intel] as const;
          } catch {
            return null;
          }
        })
      );
      const map: Record<string, CaseIntelligence> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }

      setReports(viewable);
      setIntelByReportId(map);
      setOffline(false);
      setCachedAt(null);
      setJson<Cache>(CACHE_KEY, { cachedAt: Date.now(), reports: viewable, intelByReportId: map });
    } catch (err) {
      const cached = await getJson<Cache | null>(CACHE_KEY, null);
      if (cached) {
        setReports(cached.reports);
        setIntelByReportId(cached.intelByReportId);
        setOffline(true);
        setCachedAt(cached.cachedAt);
      } else {
        setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && !loadedOnce.current) {
      loadedOnce.current = true;
      load();
    }
    if (!isLoggedIn) {
      // Limpa o estado em memória (não o cache em disco) ao deslogar, pra
      // a tela não mostrar dados do usuário anterior por um instante caso
      // outro login aconteça no mesmo aparelho antes do primeiro load.
      loadedOnce.current = false;
      setReports([]);
      setIntelByReportId({});
      setLoading(true);
      removeJson(CACHE_KEY);
    }
  }, [isLoggedIn, load]);

  return (
    <CasesContext.Provider value={{ loading, error, reports, intelByReportId, offline, cachedAt, reload: load }}>
      {children}
    </CasesContext.Provider>
  );
}

export function useCases() {
  const ctx = useContext(CasesContext);
  if (!ctx) throw new Error("useCases precisa estar dentro de um CasesProvider");
  return ctx;
}
