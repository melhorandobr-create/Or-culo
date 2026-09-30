import { useCallback, useEffect, useState } from "react";
import { getJson, setJson } from "../utils/deviceStorage";

const KEY = "oraculo_dismissed_duplicates_v1";

function pairKey(a: string, b: string) {
  return [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join("::");
}

// Duplicatas prováveis (Correlação) reapareciam pra sempre, mesmo depois
// do usuário já ter confirmado que "José da Silva" e "Jose Silva" não são
// a mesma pessoa — sem forma de descartar um falso positivo. Persistido
// no dispositivo, cruzado tanto na tela de Correlação quanto no contador
// de alertas (useSystemAlerts), pra não voltar a contar o que já foi
// descartado.
export function useDismissedDuplicates() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<string[]>(KEY, []).then((list) => {
      setDismissed(new Set(list));
      setLoading(false);
    });
  }, []);

  const dismiss = useCallback((a: string, b: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(pairKey(a, b));
      setJson(KEY, Array.from(next));
      return next;
    });
  }, []);

  const isDismissed = useCallback((a: string, b: string) => dismissed.has(pairKey(a, b)), [dismissed]);

  return { dismissed, loading, dismiss, isDismissed };
}

export function filterDismissed<T extends { a: string; b: string }>(pairs: T[], dismissed: Set<string>): T[] {
  return pairs.filter((p) => !dismissed.has(pairKey(p.a, p.b)));
}
