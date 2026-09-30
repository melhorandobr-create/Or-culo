// Paleta baseada nos tokens oficiais do gov.br Design System (Padrão
// Digital de Governo) — azul institucional #1351B4 e cores de estado
// verificadas em @govbr-ds/core, não em material vazado ou aproximado.
// Cantos mais retos e sombra quase plana (em vez de cards flutuantes estilo
// app de consumo), buscando a densidade/sobriedade de portal institucional.
export const color = {
  primary: "#1351B4",
  bg: "#F5F6F7",
  surface: "#FFFFFF",
  border: "#CCCCCC",
  text: "#1A1A1A",
  textMuted: "#4B5563",
  textFaint: "#767676",
  danger: "#E52207",
  dangerTint: "#FCEAE8",
  warning: "#B45309",
  warningTint: "#FFF3D6",
  success: "#168821",
  successTint: "#E6F4E8",
  infoTint: "#E8F0FB",
};

// Noto Sans é a tipografia oficial do gov.br Design System — carregada via
// @expo-google-fonts/noto-sans e aplicada globalmente em App.tsx.
export const font = {
  display: "NotoSans_700Bold",
  body: "NotoSans_400Regular",
  bodyMedium: "NotoSans_500Medium",
  bodyBold: "NotoSans_700Bold",
  mono: "System",
};

export const radius = { sm: 4, md: 6, lg: 8, xl: 10, pill: 20 };

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
};

export interface Theme {
  color: typeof color;
  font: typeof font;
  radius: typeof radius;
  space: typeof space;
  shadow: typeof shadow;
}

export const theme: Theme = { color, font, radius, space, shadow };
