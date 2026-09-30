// Código Admiralty (NATO STANAG 2511 / padrão de tradecraft de inteligência):
// duas escalas independentes — confiabilidade da FONTE (A-F) e credibilidade
// da INFORMAÇÃO em si (1-6). O backend só aceita confidence em
// BAIXA|MEDIA|ALTA (enum fixo em store.js), então isso não substitui esse
// campo — é gravado como prefixo legível em "notes"/"source", e o par
// A-F/1-6 também é usado aqui pra sugerir automaticamente o BAIXA/MEDIA/ALTA
// mais próximo.

export const RELIABILITY_CODES = [
  { code: "A", label: "Totalmente confiável" },
  { code: "B", label: "Geralmente confiável" },
  { code: "C", label: "Razoavelmente confiável" },
  { code: "D", label: "Geralmente não confiável" },
  { code: "E", label: "Não confiável" },
  { code: "F", label: "Não avaliável" },
] as const;

export const CREDIBILITY_CODES = [
  { code: "1", label: "Confirmado por outras fontes" },
  { code: "2", label: "Provavelmente verdadeiro" },
  { code: "3", label: "Possivelmente verdadeiro" },
  { code: "4", label: "Duvidoso" },
  { code: "5", label: "Improvável" },
  { code: "6", label: "Não avaliável" },
] as const;

export type ReliabilityCode = (typeof RELIABILITY_CODES)[number]["code"];
export type CredibilityCode = (typeof CREDIBILITY_CODES)[number]["code"];

export function admiraltyLabel(reliability: ReliabilityCode, credibility: CredibilityCode): string {
  return `${reliability}${credibility}`;
}

// Sugestão de confidence (BAIXA|MEDIA|ALTA) a partir do código Admiralty —
// só um ponto de partida; o operativo pode mudar manualmente depois.
export function admiraltyToConfidence(reliability: ReliabilityCode, credibility: CredibilityCode): "BAIXA" | "MEDIA" | "ALTA" {
  const relScore = "ABCDEF".indexOf(reliability); // 0 (melhor) .. 5 (pior)
  const credScore = Number(credibility) - 1; // 0 (melhor) .. 5 (pior)
  const avg = (relScore + credScore) / 2;
  if (avg <= 1) return "ALTA";
  if (avg <= 3) return "MEDIA";
  return "BAIXA";
}
