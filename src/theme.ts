// Paleta e tokens aprovados nos mockups (identidade "plataforma de segurança
// moderna" — cards brancos com elevação suave, fundo neutro claro).
export const color = {
  primary: "#1B4B8F",
  bg: "#F7F8FA",
  surface: "#FFFFFF",
  border: "#E4E7EC",
  text: "#101828",
  textMuted: "#667085",
  textFaint: "#98A2B3",
  danger: "#C0392B",
  dangerTint: "#FDF0F0",
  warning: "#C05621",
  warningTint: "#FDF2E9",
  success: "#12813D",
  successTint: "#ECF9F0",
  infoTint: "#EAF1FB",
};

export const font = {
  display: "System",
  body: "System",
  bodyMedium: "System",
  bodyBold: "System",
  mono: "System",
};

export const radius = { sm: 8, md: 12, lg: 14, xl: 16, pill: 20 };

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
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
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
