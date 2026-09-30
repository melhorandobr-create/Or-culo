import { useCallback, useEffect, useState } from "react";
import { api, Report, CaseIntelligence, ApiError } from "../api/client";

// Busca todos os casos que o usuário pode ver e, pra cada um, os dados
// combinados de inteligência (entidades, relacionamentos, cronologia,
// hipóteses, command). Usado pelas telas que precisam olhar o sistema
// inteiro de uma vez (correlação entre casos, central de comando, linha
// do tempo geral) — evita cada uma refazer a mesma bateria de requisições.
//
// Custo: 1 requisição de lista + 1 por caso visível. Em dezenas de casos
// isso é trivial pra uma VPS pequena; se o acervo crescer muito, o ponto
// certo de otimizar é um endpoint agregado no servidor, não aqui.
export function useAllCasesIntelligence() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [intelByReportId, setIntelByReportId] = useState<Record<string, CaseIntelligence>>({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.listReports();
      const viewable = (res.reports || []).filter((r) => r.canView !== false);
      setReports(viewable);

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
      setIntelByReportId(map);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, reports, intelByReportId, reload: load };
}
