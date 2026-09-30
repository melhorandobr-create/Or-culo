import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color as defaultColor } from "../theme";

// Cruzeiro do Sul — símbolo nacional público (parte da bandeira do
// Brasil), não uma insígnia de unidade específica. Desenhado como as 5
// estrelas do asterismo real: 4 pontas principais + a estrela menor
// (Épsilon Cruzeiro) deslocada perto do centro.
export function OraculoLogo({ size = 30, starColor = "#fff", circleColor = defaultColor.primary }: { size?: number; starColor?: string; circleColor?: string }) {
  const big = Math.round(size * 0.24);
  const small = Math.round(size * 0.14);
  const star = (top: number, left: number, s: number) => ({
    position: "absolute" as const,
    top: top * size - s / 2,
    left: left * size - s / 2,
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: circleColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: size, height: size }}>
        <Ionicons name="star" size={big} color={starColor} style={star(0.22, 0.5, big)} />
        <Ionicons name="star" size={big} color={starColor} style={star(0.5, 0.78, big)} />
        <Ionicons name="star" size={big} color={starColor} style={star(0.5, 0.24, big)} />
        <Ionicons name="star" size={big} color={starColor} style={star(0.8, 0.42, big)} />
        <Ionicons name="star" size={small} color={starColor} style={star(0.56, 0.52, small)} />
      </View>
    </View>
  );
}

// Logomark + nome juntos, prontos pra usar em qualquer header.
export function OraculoWordmark({
  size = 30,
  textSize = 17,
  textColor = "#101828",
  circleColor,
}: {
  size?: number;
  textSize?: number;
  textColor?: string;
  circleColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <OraculoLogo size={size} circleColor={circleColor} />
      <Text style={{ fontSize: textSize, fontWeight: "700", color: textColor, letterSpacing: 0.5 }}>ORÁCULO</Text>
    </View>
  );
}
