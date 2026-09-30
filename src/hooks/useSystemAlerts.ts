import { useMemo } from "react";
import { useCases } from "../contexts/CasesContext";
import { useWatchlist, matchWatchlist } from "./useWatchlist";
import { useDismissedDuplicates } from "./useDismissedDuplicates";
import { similarity } from "../utils/fuzzyMatch";

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

// Um único número de "coisas que precisam da sua atenção", cruzando dados
// que já existem em subsistemas diferentes (tarefas, vigilância,
// duplicatas prováveis) — visão de produto: o app deveria avisar, não só
// responder quando perguntado.
export function useSystemAlerts() {
  const { reports, intelByReportId } = useCases();
  const { terms } = useWatchlist();
  const { dismissed } = useDismissedDuplicates();

  const overdueTasks = useMemo(
    () => reports.reduce((sum, r) => sum + (((intelByReportId[r.id] as any)?.command?.overdueTasks) ?? 0), 0),
    [reports, intelByReportId]
  );

  const watchlistHits = useMemo(() => matchWatchlist(terms, reports, intelByReportId).length, [terms, reports, intelByReportId]);

  const nearDuplicates = useMemo(() => {
    const allNames = new Set<string>();
    for (const r of reports) {
      const entities = (intelByReportId[r.id] as any)?.entities || [];
      for (const e of entities) if (e?.name) allNames.add(normalize(String(e.name)));
    }
    const keys = Array.from(allNames);
    let count = 0;
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (keys[i] !== keys[j] && similarity(keys[i], keys[j]) >= 0.72 && !dismissed.has(pairKey(keys[i], keys[j]))) count++;
      }
    }
    return count;
  }, [reports, intelByReportId, dismissed]);

  const total = overdueTasks + watchlistHits + nearDuplicates;

  return { overdueTasks, watchlistHits, nearDuplicates, total };
}
