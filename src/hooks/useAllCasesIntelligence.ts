// Fonte única de casos + inteligência combinada agora vive em
// CasesContext (montado uma vez no App.tsx, compartilhado com o Dashboard
// também — antes cada tela, incluindo essa, refazia a mesma busca sozinha).
// Este arquivo só existe pra não precisar mudar o import em cada tela que
// já usava esse nome.
export { useCases as useAllCasesIntelligence } from "../contexts/CasesContext";
