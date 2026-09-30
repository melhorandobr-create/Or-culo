// Cabeçalho/rodapé padrão dos PDFs exportados — mesma logo do app (Cruzeiro
// do Sul, símbolo nacional público) ao lado do nome ORÁCULO, desenhada em
// SVG inline (sem depender de asset binário embutido no HTML do PDF).
const LOGO_SVG = `
  <svg width="26" height="26" viewBox="0 0 100 100" style="vertical-align:middle">
    <rect x="0" y="0" width="100" height="100" rx="30" fill="#1351B4"/>
    <g fill="#fff">
      <polygon points="50,14 54,24 65,24 56,31 59,42 50,35 41,42 44,31 35,24 46,24" />
      <polygon points="82,42 86,52 97,52 88,59 91,70 82,63 73,70 76,59 67,52 78,52" />
      <polygon points="18,42 22,52 33,52 24,59 27,70 18,63 9,70 12,59 3,52 14,52" />
      <polygon points="38,66 41,74 50,74 43,79 46,87 38,82 30,87 33,79 26,74 35,74" />
      <polygon points="55,50 57,55 62,55 58,58 60,63 55,60 50,63 52,58 48,55 53,55" />
    </g>
  </svg>`;

export function pdfHeaderHtml(subtitle?: string): string {
  return `
    <div style="display:flex; align-items:center; gap:10px; border-bottom:2px solid #1351B4; padding-bottom:10px; margin-bottom:18px;">
      ${LOGO_SVG}
      <div>
        <div style="font-size:16px; font-weight:700; color:#1A1A1A; letter-spacing:0.5px;">ORÁCULO</div>
        ${subtitle ? `<div style="font-size:10.5px; color:#4B5563;">${subtitle}</div>` : ""}
      </div>
    </div>`;
}

export function pdfFooterHtml(): string {
  const now = new Date().toLocaleString("pt-BR");
  return `
    <div style="display:flex; align-items:center; gap:8px; border-top:1px solid #CCCCCC; padding-top:8px; margin-top:24px; font-size:9.5px; color:#767676;">
      <svg width="14" height="14" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" rx="30" fill="#1351B4"/><g fill="#fff">
        <polygon points="50,14 54,24 65,24 56,31 59,42 50,35 41,42 44,31 35,24 46,24" />
        <polygon points="82,42 86,52 97,52 88,59 91,70 82,63 73,70 76,59 67,52 78,52" />
        <polygon points="18,42 22,52 33,52 24,59 27,70 18,63 9,70 12,59 3,52 14,52" />
        <polygon points="38,66 41,74 50,74 43,79 46,87 38,82 30,87 33,79 26,74 35,74" />
        <polygon points="55,50 57,55 62,55 58,58 60,63 55,60 50,63 52,58 48,55 53,55" />
      </g></svg>
      <span>ORÁCULO — documento gerado em ${now}. Exige revisão humana antes de qualquer uso oficial.</span>
    </div>`;
}

export function wrapPdfHtml(bodyHtml: string, subtitle?: string): string {
  return `<html><body style="font-family: -apple-system, 'Noto Sans', sans-serif; padding: 28px; color:#1A1A1A;">
    ${pdfHeaderHtml(subtitle)}
    ${bodyHtml}
    ${pdfFooterHtml()}
  </body></html>`;
}
