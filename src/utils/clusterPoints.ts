// Agrupamento simples por proximidade (sem biblioteca externa) — junta
// pontos a menos de ~35km um do outro (0.3 grau ≈ 33km no equador,
// aproximação suficiente pra visualização, não pra medição precisa).
export interface ClusterInput {
  id: string;
  lat: number;
  lng: number;
}

export interface Cluster<T extends ClusterInput> {
  lat: number;
  lng: number;
  items: T[];
}

export function clusterPoints<T extends ClusterInput>(points: T[], thresholdDegrees = 0.3): Cluster<T>[] {
  const clusters: Cluster<T>[] = [];
  for (const p of points) {
    const existing = clusters.find((c) => Math.hypot(c.lat - p.lat, c.lng - p.lng) < thresholdDegrees);
    if (existing) {
      existing.items.push(p);
      existing.lat = existing.items.reduce((s, i) => s + i.lat, 0) / existing.items.length;
      existing.lng = existing.items.reduce((s, i) => s + i.lng, 0) / existing.items.length;
    } else {
      clusters.push({ lat: p.lat, lng: p.lng, items: [p] });
    }
  }
  return clusters;
}
