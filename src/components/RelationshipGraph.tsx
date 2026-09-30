import React, { useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated, PanResponder } from "react-native";

// Grafo leve, sem biblioteca nativa nova: nós dispostos em círculo,
// arrastáveis com o dedo (Animated + PanResponder, já embutidos no React
// Native — nenhuma dependência nova, nenhum build novo exigido). Linhas
// desenhadas como Views finas giradas (trigonometria pura), que seguem os
// nós quando arrastados.

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

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 105;
const NODE_SIZE = 54;

function useNodePosition(initial: { x: number; y: number }) {
  const pan = useRef(new Animated.ValueXY(initial)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => pan.flattenOffset(),
    })
  ).current;
  return { pan, panResponder };
}

function GraphNode({ node, initial, color, onMove }: { node: Node; initial: { x: number; y: number }; color: string; onMove: (id: string, pos: { x: number; y: number }) => void }) {
  const { pan, panResponder } = useNodePosition(initial);

  React.useEffect(() => {
    const id = pan.addListener((value) => onMove(node.id, value));
    return () => pan.removeListener(id);
  }, [pan, node.id, onMove]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.node,
        {
          backgroundColor: color,
          transform: pan.getTranslateTransform(),
          left: initial.x - NODE_SIZE / 2,
          top: initial.y - NODE_SIZE / 2,
        },
      ]}
    >
      <Text style={styles.nodeText} numberOfLines={2}>
        {node.name}
      </Text>
    </Animated.View>
  );
}

export function RelationshipGraph({ nodes, edges, color }: { nodes: Node[]; edges: Edge[]; color: string }) {
  const initialPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
      map.set(n.id, { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) });
    });
    return map;
  }, [nodes]);

  // Posição "ao vivo" de cada nó (começa igual à inicial, atualizada pelo
  // arrasto) — guardada fora de state pra não re-renderizar tudo a cada
  // frame; as linhas são forçadas a redesenhar via forceUpdate leve.
  const livePositions = useRef(new Map(initialPositions)).current;
  const [, forceTick] = React.useReducer((n) => n + 1, 0);

  const handleMove = (id: string, delta: { x: number; y: number }) => {
    const base = initialPositions.get(id);
    if (!base) return;
    livePositions.set(id, { x: base.x + delta.x, y: base.y + delta.y });
    forceTick();
  };

  if (nodes.length === 0) return null;

  return (
    <View style={{ width: SIZE, height: SIZE, alignSelf: "center" }}>
      {edges.map((e, i) => {
        const a = livePositions.get(e.fromId as any) || initialPositions.get(e.fromId as any);
        const b = livePositions.get(e.toId as any) || initialPositions.get(e.toId as any);
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
      {nodes.map((n) => (
        <GraphNode key={n.id} node={n} initial={initialPositions.get(n.id)!} color={color} onMove={handleMove} />
      ))}
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
