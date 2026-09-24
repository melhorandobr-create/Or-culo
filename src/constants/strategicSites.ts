// Infraestrutura estratégica nacional — instalações públicas e conhecidas
// (não são dados sigilosos; coordenadas aproximadas de domínio público,
// equivalentes às exibidas em mapas públicos como Google Maps/Wikipedia).
export type StrategicSiteKind = "nuclear" | "hydro" | "aerospace" | "naval";

export interface StrategicSite {
  id: string;
  name: string;
  kind: StrategicSiteKind;
  state: string;
  latitude: number;
  longitude: number;
  description: string;
}

export const STRATEGIC_SITES: StrategicSite[] = [
  {
    id: "inb-caetite",
    name: "INB Caetité — Unidade de Concentrado de Urânio",
    kind: "nuclear",
    state: "BA",
    latitude: -14.0658,
    longitude: -42.4914,
    description: "Mineração e beneficiamento de urânio (Indústrias Nucleares do Brasil), Lagoa Real.",
  },
  {
    id: "inb-resende",
    name: "INB Resende — Fábrica de Combustível Nuclear",
    kind: "nuclear",
    state: "RJ",
    latitude: -22.4707,
    longitude: -44.4703,
    description: "Enriquecimento e fabricação de combustível nuclear.",
  },
  {
    id: "angra-nuclear",
    name: "Central Nuclear Almirante Álvaro Alberto (Angra 1/2/3)",
    kind: "nuclear",
    state: "RJ",
    latitude: -23.0064,
    longitude: -44.4547,
    description: "Usinas nucleares de Angra dos Reis, Praia de Itaorna.",
  },
  {
    id: "aramar",
    name: "CTMSP Aramar",
    kind: "naval",
    state: "SP",
    latitude: -23.4189,
    longitude: -47.6122,
    description: "Centro Tecnológico da Marinha — programa do submarino nuclear brasileiro.",
  },
  {
    id: "itaipu",
    name: "Usina Hidrelétrica de Itaipu",
    kind: "hydro",
    state: "PR",
    latitude: -25.4082,
    longitude: -54.5892,
    description: "Uma das maiores hidrelétricas do mundo, fronteira Brasil-Paraguai.",
  },
  {
    id: "tucurui",
    name: "Usina Hidrelétrica de Tucuruí",
    kind: "hydro",
    state: "PA",
    latitude: -3.8283,
    longitude: -49.6442,
    description: "Maior hidrelétrica genuinamente brasileira.",
  },
  {
    id: "belo-monte",
    name: "Usina Hidrelétrica de Belo Monte",
    kind: "hydro",
    state: "PA",
    latitude: -3.0997,
    longitude: -51.7864,
    description: "Complexo hidrelétrico no rio Xingu.",
  },
  {
    id: "alcantara",
    name: "Centro de Lançamento de Alcântara",
    kind: "aerospace",
    state: "MA",
    latitude: -2.3736,
    longitude: -44.3959,
    description: "Base de lançamento de foguetes e satélites da Força Aérea Brasileira.",
  },
];

export const STRATEGIC_KIND_META: Record<StrategicSiteKind, { label: string; icon: string; color: string }> = {
  nuclear: { label: "Nuclear", icon: "radio-outline", color: "#C05621" },
  hydro: { label: "Hidrelétrica", icon: "water-outline", color: "#1B4B8F" },
  aerospace: { label: "Aeroespacial", icon: "rocket-outline", color: "#5B21B6" },
  naval: { label: "Naval/Defesa", icon: "boat-outline", color: "#12813D" },
};
