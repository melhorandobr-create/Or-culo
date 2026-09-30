import { useCallback, useEffect, useState } from "react";
import { useAllCasesIntelligence } from "./useAllCasesIntelligence";
import { api, ApiError } from "../api/client";
import { getJson, setJson } from "../utils/deviceStorage";

export interface PrognoseEntry {
  id: string;
  text: string;
  generatedAt: number;
  auto: boolean;
  caseCount: number;
}

const HISTORY_KEY = "oraculo_prognose_history_v1";
const LAST_AUTO_KEY = "oraculo_prognose_last_auto_v1";
const MAX_HISTORY = 10;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Guarda em memória do processo (não persistida) — evita gerar duas vezes
// no mesmo dia quando Dashboard e Central de Comando montam quase juntos
// (ambos chamam este hook e checariam a mesma chave antes de qualquer um
// ter tido chance de gravá-la).
let autoGenerateInFlightToday: string | null = null;

// Extraído do CommandCenterScreen pra virar um hook único, compartilhado —
// antes só a Central de Comando sabia gerar/guardar Prognose, então o
// Dashboard (tela mais visitada, aberta todo dia) não conseguia disparar a
// geração automática diária sozinho. Agora os dois usam a mesma fonte.
export function usePrognose() {
  const { loading, reports, intelByReportId } = useAllCasesIntelligence();
  const [history, setHistory] = useState<PrognoseEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoChecked, setAutoChecked] = useState(false);

  useEffect(() => {
    getJson<PrognoseEntry[]>(HISTORY_KEY, []).then((h) => {
      setHistory(h);
      setHistoryLoaded(true);
    });
  }, []);

  function buildDenseContext(targetIds: string[]): string {
    const parts: string[] = [];
    for (const id of targetIds) {
      const report = reports.find((r) => r.id === id);
      const intel = intelByReportId[id] as any;
      if (!report) continue;
      const entities = (intel?.entities || []).map((e: any) => `${e.name} (${e.type}${e.confidence ? `, confiança ${e.confidence}` : ""})`).join("; ");
      const timeline = (intel?.timeline || [])
        .slice(0, 10)
        .map((t: any) => `${t.occurredAt ? new Date(t.occurredAt).toLocaleDateString("pt-BR") : "?"}: ${t.title}`)
        .join(" | ");
      const hypotheses = (intel?.hypotheses || []).map((h: any) => `"${h.statement}" (${h.confidence || "?"})`).join("; ");
      parts.push(
        `## ${report.title}\nRisco: ${intel?.command?.riskLevel || report.riskLevel || "?"} | Fase: ${intel?.command?.operationPhase || report.operationPhase || "?"} | Tarefas atrasadas: ${intel?.command?.overdueTasks ?? 0}\nEntidades: ${entities || "(nenhuma registrada)"}\nCronologia: ${timeline || "(nenhum evento registrado)"}\nHipóteses: ${hypotheses || "(nenhuma registrada)"}`
      );
    }
    return parts.join("\n\n");
  }

  const generate = useCallback(
    async (auto = false) => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = reports.filter((r) => (r.updatedAt || 0) >= weekAgo);
      const targetIds = (recent.length > 0 ? recent : reports).map((r) => r.id).slice(0, 15);
      if (targetIds.length === 0) return { ok: false as const, error: "Nenhum caso disponível pra gerar briefing." };
      setGenerating(true);
      try {
        const monitorsRes = await api.listSourceMonitors().catch(() => ({ monitors: [] }));
        const monitorsContext = (monitorsRes.monitors || [])
          .map((m) => `${m.kind}: ${m.query}${m.tribunal ? ` (${m.tribunal})` : ""} — ${m.purpose || "sem finalidade registrada"}`)
          .join("\n");
        const instructions =
          "Atue como consultor de inteligência autônomo. Com base em TODO o contexto abaixo (entidades, cronologia, hipóteses e status de cada caso, mais as fontes públicas já monitoradas), produza um parecer denso e completo em 4 partes: " +
          "(1) Briefing executivo — prioridade por risco/urgência e o que mudou recentemente; " +
          "(2) Tendência de escalada — cruzando as datas da cronologia de todos os casos, aponte se a atividade está intensificando, estável ou arrefecendo, e em quais casos especificamente; " +
          "(3) Expectativa/previsão — o que é razoável esperar acontecer a seguir em cada caso de risco alto, com base só no padrão observado, deixando claro que é inferência, não fato; " +
          "(4) Próximas ações recomendadas — as 5 mais importantes, priorizadas, incluindo se alguma fonte monitorada merece atenção reforçada. Não invente fatos além do que está nos dados abaixo.\n\n" +
          buildDenseContext(targetIds) +
          (monitorsContext ? `\n\n## Fontes públicas monitoradas\n${monitorsContext}` : "");
        const res = await api.aiCrossCaseAssist(targetIds, instructions);
        const entry: PrognoseEntry = {
          id: `${Date.now()}`,
          text: res.text,
          generatedAt: Date.now(),
          auto,
          caseCount: targetIds.length,
        };
        setHistory((prev) => {
          const next = [entry, ...prev].slice(0, MAX_HISTORY);
          setJson(HISTORY_KEY, next);
          return next;
        });
        if (auto) setJson(LAST_AUTO_KEY, todayKey());
        return { ok: true as const, entry };
      } catch (err) {
        return { ok: false as const, error: err instanceof ApiError ? err.message : "BlindAI/Grok indisponível." };
      } finally {
        setGenerating(false);
      }
    },
    [reports, intelByReportId]
  );

  // Gera Prognose sozinho uma vez por dia (quando há casos carregados),
  // disparado por QUALQUER tela que monte este hook — Dashboard incluso,
  // já que é a tela mais visitada e não depende do usuário lembrar de
  // abrir a Central de Comando.
  useEffect(() => {
    if (autoChecked || loading || reports.length === 0 || !historyLoaded) return;
    setAutoChecked(true);
    const today = todayKey();
    if (autoGenerateInFlightToday === today) return;
    getJson<string | null>(LAST_AUTO_KEY, null).then((last) => {
      if (last !== today && autoGenerateInFlightToday !== today) {
        autoGenerateInFlightToday = today;
        generate(true);
      }
    });
  }, [autoChecked, loading, reports.length, historyLoaded, generate]);

  return { history, latest: history[0] ?? null, generating, generate };
}
