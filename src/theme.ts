// Paleta extraída do bundle compilado original (cores hex encontradas em
// index.android.bundle + backgroundColor/adaptiveIcon do app.config).
export const color = {
  primary: "#1B4B8F",
  bg: "#F2F5F9",
  surface: "#FFFFFF",
  border: "#D6DEE8",
  text: "#1A2433",
  textMuted: "#5B6B82",
  textFaint: "#8B98AC",
  danger: "#C0392B",
};

export const font = {
  display: "System",
  body: "System",
  bodyMedium: "System",
  bodyBold: "System",
};

export const radius = { sm: 6, md: 12, lg: 18 };

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export interface Theme {
  color: typeof color;
  font: typeof font;
  radius: typeof radius;
  space: typeof space;
}

export const theme: Theme = { color, font, radius, space };
