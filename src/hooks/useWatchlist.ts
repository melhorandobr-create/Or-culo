import { useCallback, useEffect, useState } from "react";
import { getJson, setJson } from "../utils/deviceStorage";

const KEY = "oraculo_watchlist_terms";

export function useWatchlist() {
  const [terms, setTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<string[]>(KEY, []).then((t) => {
      setTerms(t);
      setLoading(false);
    });
  }, []);

  const addTerm = useCallback(async (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;
    setTerms((prev) => {
      if (prev.some((t) => t.toLowerCase() === normalized.toLowerCase())) return prev;
      const next = [...prev, normalized];
      setJson(KEY, next);
      return next;
    });
  }, []);

  const removeTerm = useCallback(async (term: string) => {
    setTerms((prev) => {
      const next = prev.filter((t) => t !== term);
      setJson(KEY, next);
      return next;
    });
  }, []);

  return { terms, loading, addTerm, removeTerm };
}

// Cruza os termos de vigilância com as entidades de todos os casos
// visíveis — usado pela tela de vigilância e por um contador no Dashboard.
export function matchWatchlist(
  terms: string[],
  reports: Array<{ id: string; title?: string }>,
  intelByReportId: Record<string, { entities?: any[] }>
) {
  if (terms.length === 0) return [];
  const lowerTerms = terms.map((t) => t.toLowerCase());
  const hits: Array<{ term: string; entityName: string; reportId: string; reportTitle: string }> = [];
  for (const r of reports) {
    const entities = intelByReportId[r.id]?.entities || [];
    for (const e of entities) {
      if (!e?.name) continue;
      const name = String(e.name).toLowerCase();
      for (let i = 0; i < lowerTerms.length; i++) {
        if (name.includes(lowerTerms[i])) {
          hits.push({ term: terms[i], entityName: e.name, reportId: r.id, reportTitle: r.title || "Sem título" });
        }
      }
    }
  }
  return hits;
}
