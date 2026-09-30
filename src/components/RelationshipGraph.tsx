import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";

// Grafo leve, sem biblioteca nativa nova: nós dispostos em círculo, linhas
// desenhadas como Views finas giradas (trigonometria pura). Suficiente pra
// visualizar poucas dezenas de entidades por caso sem exigir um build novo
// no EAS (uma lib de grafo de verdade teria módulo nativo).

interface Node {
  id: string;
  name: string;
  type?: string;
}

interface Edge {
  fromId: string;
  toId: string;
  label?: string;
}

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 105;
const NODE_SIZE = 54;

export function RelationshipGraph({ nodes, edges, color }: { nodes: Node[]; edges: Edge[]; color: string }) {
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
      map.set(n.id, { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) });
    });
    return map;
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <View style={{ width: SIZE, height: SIZE, alignSelf: "center" }}>
      {edges.map((e, i) => {
        const a = positions.get(e.fromId);
        const b = positions.get(e.toId);
        if (!a || !b) return null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: a.x,
              top: a.y,
              width: length,
              height: 1.5,
              backgroundColor: "#CBD5E1",
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: "0 0" as any,
            }}
          />
        );
      })}
      {nodes.map((n) => {
        const p = positions.get(n.id)!;
        return (
          <View
            key={n.id}
            style={[
              styles.node,
              {
                left: p.x - NODE_SIZE / 2,
                top: p.y - NODE_SIZE / 2,
                backgroundColor: color,
              },
            ]}
          >
            <Text style={styles.nodeText} numberOfLines={2}>
              {n.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  node: {
    position: "absolute",
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  nodeText: { fontSize: 8.5, fontWeight: "700", color: "#fff", textAlign: "center" },
});
