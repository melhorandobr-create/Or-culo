import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getJson, setJson } from "../utils/deviceStorage";

// Backend real do ORÁCULO (vigia-svin), lido diretamente do código-fonte do
// servidor em produção (/opt/vigia-svin) em 2026-09-24. Prefixos de rota
// conferidos em server.js (app.use('/auth', ...), etc.) — nenhum chutado.
const PUBLIC_URL = "https://vigia.85-155-182-151.nip.io";
// Endereço privado via Tailscale (tailscale serve) — só acessível pelos
// aparelhos autorizados na tailnet do usuário, mesmo sabendo o endereço.
const PRIVATE_URL = "https://servidor-omni.tail449b1c.ts.net";
const TOKEN_KEY = "oraculo_session_token";
const NETWORK_MODE_KEY = "oraculo_network_mode";

export type NetworkMode = "public" | "private";

// Cache em memória pra `evidenceFileUrl` poder continuar síncrona (é usada
// direto como `uri` de <Image>/player de áudio). Carregado do storage uma
// vez no início do app; até isso resolver, usa o padrão público, que é o
// comportamento de sempre — sem regressão.
let currentNetworkMode: NetworkMode = "public";

export async function initNetworkMode() {
  currentNetworkMode = await getJson<NetworkMode>(NETWORK_MODE_KEY, "public");
}

export function getNetworkMode(): NetworkMode {
  return currentNetworkMode;
}

export async function setNetworkMode(mode: NetworkMode) {
  currentNetworkMode = mode;
  await setJson(NETWORK_MODE_KEY, mode);
}

export function getBaseUrl(): string {
  return currentNetworkMode === "private" ? PRIVATE_URL : PUBLIC_URL;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let onSessionExpiredCallback: (() => void) | null = null;
export function setOnSessionExpired(cb: () => void) {
  onSessionExpiredCallback = cb;
}

// expo-secure-store não existe na web (usa keychain/keystore nativo) — na
// web guardamos no localStorage do navegador. É menos seguro que o
// keychain nativo, mas é o mesmo modelo de qualquer app web comum.
export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function clearToken() {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    // Sessão expirada/token revogado (ex.: sessionVersion mudou após reset de senha).
    await clearToken();
    onSessionExpiredCallback?.();
  }

  if (!res.ok) {
    throw new ApiError(body?.error || "Erro inesperado.", res.status);
  }
  return body as T;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName?: string;
  role: string;
  mfaEnabled: boolean;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

// Campos confirmados direto em routes/reports.js (2026-09-24):
// - classification: 'SIGILOSO' (default) | 'RESERVADO' | 'SECRETO' — só
//   'SECRETO' é tratado como especial em canView.
// - status: 'RASCUNHO' (default) | 'EM_REVISAO' | 'FINALIZADO' | 'ARQUIVADO'
//   (únicos aceitos por POST /reports/:id/status).
// - coordenadas do mapa são operationLatitude/operationLongitude, NUNCA
//   lat/lng — o GET /reports (lista) só expõe esses nomes.
export interface Report {
  id: string;
  ownerId: string;
  ownerDisplayName?: string;
  displayName?: string;
  title?: string;
  description?: string;
  body?: string;
  summary?: string;
  recordType?: string;
  status?: string;
  classification?: string;
  riskLevel?: string;
  operationPhase?: string;
  authorizationStatus?: string;
  operationAddress?: string;
  operationLatitude?: number;
  operationLongitude?: number;
  stagingLatitude?: number;
  stagingLongitude?: number;
  perimeterKm?: number;
  scheduledAt?: number;
  confirmedFacts?: string;
  hypotheses?: string;
  informationGaps?: string;
  redactedIndices?: number[];
  canView?: boolean;
  canRequestAccess?: boolean;
  createdAt?: number;
  updatedAt?: number;
  protocolNumber?: string;
  // Campos confirmados por inspeção direta dos 12 casos reais já existentes
  // no banco (ARCO, TUCANO, LASTRO...), via script de diagnóstico rodado no
  // servidor em 2026-09-24 — schema mais rico que o usado nos casos que eu
  // semeei, então precisa ser exibido também para esses casos aparecerem
  // com conteúdo (e não só o título) no app.
  subject?: string;
  eventDate?: string | number;
  location?: string;
  sourceReliability?: string;
  informationCredibility?: string;
  recommendations?: string;
  tags?: string[] | string;
  sourceNotes?: string;
  legalBasis?: string;
  mapNotes?: string;
  operative?: string;
  parecer?: string;
  authorizationReference?: string;
  [key: string]: unknown;
}

// Confirmado em routes/reports.js: evidencePublic() e POST /reports/:id/evidence.
export interface Evidence {
  id: string;
  kind: "photo" | "video" | "link" | "document";
  url?: string | null;
  mimeType?: string | null;
  caption?: string;
  originalName?: string | null;
  size?: number;
  sha256?: string | null;
  captureMetadata?: { title?: string; author?: string; capturedAt?: number; sourceUrl?: string } | null;
  createdAt?: number;
}

export interface CaseIntelligence {
  entities: unknown[];
  relationships: unknown[];
  timeline: unknown[];
  hypotheses: unknown[];
  command: {
    riskLevel: string;
    operationPhase: string;
    authorizationStatus: string;
    pendingTasks: number;
    overdueTasks: number;
    evidenceCount: number;
    evidenceIntegrityCoverage: number;
    lastUpdatedAt?: number;
    openHypotheses: number;
  };
}

export interface AccessRequest {
  id: string;
  requesterId: string;
  reportId: string;
  purpose?: string;
  justification?: string;
  scope?: string;
  durationDays?: number;
  handlingCommitment?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ActivationCode {
  id: string;
  code: string;
  linkedName?: string;
  secretClearance?: boolean;
  role?: string;
  usedByUserId?: string | null;
  createdAt?: number;
  [key: string]: unknown;
}

export interface SourceMonitor {
  id: string;
  ownerId: string;
  kind?: string;
  query?: string;
  tribunal?: string;
  purpose?: string;
  createdAt?: number;
  [key: string]: unknown;
}

export interface SecurityIncident {
  id: string;
  title?: string;
  createdAt?: number;
  reportedBy?: string;
  [key: string]: unknown;
}

// Mensagem devolvida pelo backend (src/routes/auth.js) quando falta
// OTP/recovery code válido — usada pro client saber que precisa desafiar MFA
// em vez de mostrar "usuário ou senha inválidos". Comparação por conteúdo
// (não igualdade exata) porque já houve divergência de um caractere entre
// o texto real do servidor e o que foi transcrito aqui (é vs e).
export const MFA_REQUIRED_MESSAGE =
  "Código MFA ou código de recuperação obrigatório e válido.";

export function isMfaRequiredError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("mfa") && normalized.includes("recupera");
}

export const api = {
  // ---- /auth ----
  async register(username: string, password: string, displayName: string, inviteCode: string) {
    return request<LoginResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, displayName, inviteCode }),
    });
  },

  async login(
    username: string,
    password: string,
    otp?: string,
    recoveryCode?: string
  ): Promise<LoginResult> {
    return request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, otp, recoveryCode }),
    });
  },

  async me(): Promise<{ user: PublicUser }> {
    return request("/auth/me");
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return request<LoginResult>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async revokeSessions() {
    return request<void>("/auth/revoke-sessions", { method: "POST" });
  },

  async mfaSetup(): Promise<{ secret: string; otpauthUrl: string }> {
    return request("/auth/mfa/setup", { method: "POST" });
  },

  async mfaConfirm(code: string) {
    return request<{ token: string; user: PublicUser; recoveryCodes: string[] }>(
      "/auth/mfa/confirm",
      { method: "POST", body: JSON.stringify({ code }) }
    );
  },

  async mfaDisable(currentPassword: string, code?: string, recoveryCode?: string) {
    return request<LoginResult>("/auth/mfa/disable", {
      method: "POST",
      body: JSON.stringify({ currentPassword, code, recoveryCode }),
    });
  },

  async mfaStepUp(currentPassword: string, code: string) {
    return request<{ stepUpToken: string; expiresInSeconds: number }>(
      "/auth/step-up",
      { method: "POST", body: JSON.stringify({ currentPassword, code }) }
    );
  },

  async listSessions() {
    return request<{ sessions: unknown[] }>("/auth/sessions");
  },

  async revokeSession(id: string) {
    return request<void>(`/auth/sessions/${id}`, { method: "DELETE" });
  },

  // ---- /reports ----
  async listReports() {
    return request<{ reports: Report[] }>("/reports");
  },

  async createReport(fields: Partial<Report>) {
    return request<{ report: Report }>("/reports", {
      method: "POST",
      body: JSON.stringify(fields),
    });
  },

  // Confirmado: a evidência vem como campo irmão de "report", não dentro dele.
  async getReport(id: string) {
    return request<{ report: Report; evidence: Evidence[]; isOwner: boolean }>(`/reports/${id}`);
  },

  async updateReport(id: string, patch: Partial<Report>) {
    return request<{ report: Report }>(`/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  async setReportStatus(id: string, status: "RASCUNHO" | "EM_REVISAO" | "FINALIZADO" | "ARQUIVADO") {
    return request<{ report: Report }>(`/reports/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  async deleteReport(id: string) {
    return request<void>(`/reports/${id}`, { method: "DELETE" });
  },

  // Fluxo de assinatura ICP-Brasil via Safeweb: o app manda o PDF já
  // gerado localmente, recebe um signId, abre o navegador do sistema pra
  // autorização com o e-CPF, e depois consulta o resultado por esse id.
  async stageReportForSignature(id: string, pdfBase64: string) {
    return request<{ signId: string }>(`/reports/${id}/sign/stage`, {
      method: "POST",
      body: JSON.stringify({ pdfBase64 }),
    });
  },

  async registerPushToken(token: string) {
    return request<{ ok: true }>("/push/register", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async getSignatureResult(id: string, signId: string) {
    return request<{ status: "pending" | "done" | "error"; pdfBase64?: string; message?: string }>(
      `/reports/${id}/sign/result?signId=${encodeURIComponent(signId)}`
    );
  },

  // Upload multipart real — confirmado em routes/reports.js (multer, 60MB,
  // kind: 'photo'|'video'|'link'). Para 'link' não há arquivo, só { url }.
  async uploadEvidence(
    reportId: string,
    params:
      | { kind: "photo" | "video"; file: { uri: string; name: string; type: string }; caption?: string }
      | { kind: "link"; url: string; caption?: string }
  ): Promise<{ evidence: Evidence }> {
    const token = await getToken();
    const form = new FormData();
    form.append("kind", params.kind);
    if (params.caption) form.append("caption", params.caption);
    if (params.kind === "link") {
      form.append("url", params.url);
    } else if (Platform.OS === "web") {
      // No navegador, FormData.append espera um Blob/File de verdade — o
      // objeto {uri,name,type} é um polyfill exclusivo do React Native.
      const blob = await (await fetch(params.file.uri)).blob();
      form.append("file", blob, params.file.name);
    } else {
      form.append("file", params.file as any);
    }
    const res = await fetch(`${getBaseUrl()}/reports/${reportId}/evidence`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body?.error || "Não foi possível enviar o anexo.", res.status);
    return body as { evidence: Evidence };
  },

  async deleteEvidence(reportId: string, evidenceId: string) {
    return request<void>(`/reports/${reportId}/evidence/${evidenceId}`, { method: "DELETE" });
  },

  // Retorna a URL autenticada do binário — o app precisa mandar o header
  // Authorization junto (RN Image aceita via `source={{uri, headers}}`).
  evidenceFileUrl(reportId: string, evidenceId: string) {
    return `${getBaseUrl()}/reports/${reportId}/evidence/${evidenceId}`;
  },

  async listReportTasks(id: string) {
    return request<{ tasks: unknown[] }>(`/reports/${id}/tasks`);
  },

  async createReportTask(id: string, fields: { title: string; notes?: string; dueAt?: number; assignedUserId?: string }) {
    return request<{ task: any }>(`/reports/${id}/tasks`, { method: "POST", body: JSON.stringify(fields) });
  },

  async updateReportTaskStatus(id: string, taskId: string, status: "PENDENTE" | "CONCLUIDA") {
    return request<{ task: any }>(`/reports/${id}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async deleteReportTask(id: string, taskId: string) {
    return request<void>(`/reports/${id}/tasks/${taskId}`, { method: "DELETE" });
  },

  // Confirmado em routes/reports.js: devolve { checkedAt, valid, checks[] }
  // — cada item de "checks" tem { evidenceId, expectedSha256, actualSha256,
  // valid }, recalculado na hora a partir do arquivo decriptado no disco.
  async getReportIntegrity(id: string) {
    return request<{
      checkedAt: number;
      valid: boolean;
      checks: Array<{ evidenceId: string; expectedSha256: string | null; actualSha256: string | null; valid: boolean }>;
    }>(`/reports/${id}/integrity`);
  },

  async getEvidenceCustody(reportId: string, evidenceId: string) {
    return request<{ events: Array<{ id: string; action: string; actorId?: string; metadata?: any; createdAt: number }> }>(
      `/reports/${reportId}/evidence/${evidenceId}/custody`
    );
  },

  async listReportRevisions(id: string) {
    return request<{
      revisions: Array<{ id: string; version: number; actorId?: string; createdAt: number; status?: string; classification?: string; title?: string }>;
    }>(`/reports/${id}/revisions`);
  },

  // Trilha de auditoria filtrada só pra este caso — diferente da cronologia
  // de fatos (CaseTimelineEvent) da aba "Cronologia".
  async getReportAuditTrail(id: string) {
    return request<{ events: Array<{ id: string; action: string; targetType: string; actorDisplayName: string; metadata?: any; createdAt: number }> }>(
      `/reports/${id}/timeline`
    );
  },

  // Dono do caso autoriza um operativo específico direto, sem esperar pedido.
  async grantReportAccess(reportId: string, userId: string) {
    return request<{ granted: { userId: string; displayName: string } }>(`/reports/${reportId}/grant`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  // Assistente do BlindAI/Grok — confirmado em routes/reports.js. Exige
  // consent:true; includeSensitive controla se CPF/CNPJ/e-mail são
  // suprimidos do texto enviado antes de sair do servidor.
  async aiAssist(reportId: string, mode: "resumo" | "parecer" | "hipoteses" | "revisao", includeSensitive = false) {
    return request<{ text: string; provider: string; humanReviewRequired: boolean }>(`/reports/${reportId}/ai/assist`, {
      method: "POST",
      body: JSON.stringify({ mode, consent: true, includeSensitive }),
    });
  },

  // Rota nova (routes/crossCaseAi.js, mesma base /reports): pergunta livre
  // cruzando vários casos de uma vez, em vez de um caso por vez.
  async aiCrossCaseAssist(reportIds: string[], question: string) {
    return request<{ text: string; provider: string; humanReviewRequired: boolean }>("/reports/ai/cross-case", {
      method: "POST",
      body: JSON.stringify({ reportIds, question }),
    });
  },

  // ---- /case-intelligence/:reportId ----
  // Endpoint único e combinado — confirmado no código real: devolve entidades,
  // relacionamentos, cronologia, hipóteses e um resumo "command" (riskLevel,
  // operationPhase, tarefas pendentes/atrasadas, cobertura de integridade
  // de evidências, hipóteses em aberto). Não existem GETs separados.
  async getCaseIntelligence(reportId: string) {
    return request<CaseIntelligence>(`/case-intelligence/${reportId}`);
  },

  async createCaseEntity(reportId: string, fields: { name: string; type: string; aliases?: string; notes?: string; source?: string; confidence?: string }) {
    return request(`/case-intelligence/${reportId}/entities`, {
      method: "POST",
      body: JSON.stringify(fields),
    });
  },

  async lookupOsint(reportId: string, sourceType: "cnpj" | "domain" | "ctlogs" | "shodan", target: string) {
    return request<{ entity: any; raw: any }>(`/case-intelligence/${reportId}/osint`, {
      method: "POST",
      body: JSON.stringify({ sourceType, target }),
    });
  },

  async createCaseTimelineEvent(reportId: string, fields: { occurredAt: number; title: string; description?: string; source?: string; confidence?: string; factType?: string }) {
    return request(`/case-intelligence/${reportId}/timeline`, {
      method: "POST",
      body: JSON.stringify(fields),
    });
  },

  async createCaseHypothesis(reportId: string, fields: { statement: string; supportingEvidence?: string; contraryEvidence?: string; missingInformation?: string; confidence?: string; status?: string }) {
    return request(`/case-intelligence/${reportId}/hypotheses`, {
      method: "POST",
      body: JSON.stringify(fields),
    });
  },

  // ---- /access-requests ----
  async createAccessRequest(fields: { reportId: string; purpose: string; justification: string; scope: string; durationDays: number; handlingCommitment: string }) {
    return request("/access-requests", { method: "POST", body: JSON.stringify(fields) });
  },

  async listIncomingAccessRequests() {
    return request<{ requests: AccessRequest[] }>("/access-requests/incoming");
  },

  async listOutgoingAccessRequests() {
    return request<{ requests: AccessRequest[] }>("/access-requests/outgoing");
  },

  async approveAccessRequest(id: string) {
    return request(`/access-requests/${id}/approve`, { method: "POST" });
  },

  async denyAccessRequest(id: string) {
    return request(`/access-requests/${id}/deny`, { method: "POST" });
  },

  async revokeAccessRequest(id: string) {
    return request(`/access-requests/${id}/revoke`, { method: "POST" });
  },

  // ---- /activation-codes ----
  async listActivationCodes() {
    return request<{ codes: ActivationCode[] }>("/activation-codes");
  },

  async createActivationCode(fields: { linkedName?: string; secretClearance?: boolean; role?: string }) {
    return request<{ code: ActivationCode }>("/activation-codes", {
      method: "POST",
      body: JSON.stringify(fields),
    });
  },

  async revokeActivationCode(id: string) {
    return request(`/activation-codes/${id}/revoke`, { method: "POST" });
  },

  // ---- /public-data ----
  async listSourceMonitors() {
    return request<{ monitors: SourceMonitor[] }>("/public-data/monitors");
  },

  async createSourceMonitor(fields: { kind: string; query: string; tribunal?: string; purpose?: string }) {
    return request<{ monitor: SourceMonitor }>("/public-data/monitors", {
      method: "POST",
      body: JSON.stringify(fields),
    });
  },

  async checkSourceMonitor(id: string) {
    return request(`/public-data/monitors/${id}/check`, { method: "POST" });
  },

  async deleteSourceMonitor(id: string) {
    return request(`/public-data/monitors/${id}`, { method: "DELETE" });
  },

  // Rastreamento de voo — proxy pro backend, que usa openSkyClientId/Secret
  // (nunca expostos ao app). Bounding box em graus decimais. A finalidade
  // é gerada automaticamente pelo próprio app (a camada de voos é uma
  // visão geral de tráfego aéreo na área do mapa, não ligada a um caso
  // específico) — evita perguntar isso ao usuário toda vez que ele só
  // quer ver a camada de voos ao vivo.
  async getFlights(bbox: { lamin: number; lomin: number; lamax: number; lomax: number }) {
    const q = new URLSearchParams({
      lamin: String(bbox.lamin),
      lomin: String(bbox.lomin),
      lamax: String(bbox.lamax),
      lomax: String(bbox.lomax),
      purpose: "Monitoramento de tráfego aéreo na área do mapa operacional",
    });
    return request<{ flights: unknown[] }>(`/public-data/flights?${q.toString()}`);
  },

  // Consultas avulsas confirmadas em routes/publicData.js — todas exigem
  // "purpose" (finalidade, mín. 10 caracteres) e ficam auditadas no servidor.
  async queryCompany(cnpj: string, purpose: string) {
    const digits = cnpj.replace(/\D/g, "");
    const q = new URLSearchParams({ purpose });
    return request<Record<string, unknown>>(`/public-data/company/${digits}?${q.toString()}`);
  },

  async querySanctions(name: string, purpose: string) {
    const q = new URLSearchParams({ query: name, purpose });
    return request<Record<string, unknown>>(`/public-data/sanctions?${q.toString()}`);
  },

  async queryCourtCase(processNumber: string, tribunal: string, purpose: string) {
    const q = new URLSearchParams({ number: processNumber, tribunal, purpose });
    return request<Record<string, unknown>>(`/public-data/court-case?${q.toString()}`);
  },

  // Rotas novas (routes/osintExtra.js, mesma base /public-data): fontes
  // públicas adicionais, sem chave/custo — ViaCEP, WHOIS (protocolo porta
  // 43) e Wayback Machine (archive.org).
  async queryCep(cep: string) {
    return request<{ cep: string; logradouro: string; bairro: string; localidade: string; uf: string }>(
      `/public-data/cep/${cep.replace(/\D/g, "")}`
    );
  },

  async queryWhois(domain: string) {
    return request<{ domain: string; raw: string }>(`/public-data/whois?${new URLSearchParams({ domain })}`);
  },

  async queryWayback(url: string) {
    return request<{ url: string; archived_snapshots?: { closest?: { url: string; timestamp: string; status: string } } }>(
      `/public-data/wayback?${new URLSearchParams({ url })}`
    );
  },

  // ---- /security ----
  async getSecurityPosture() {
    return request<{ mfaCoverage: number; mfaTotal: number; mfaMissing: number }>(
      "/security/posture"
    );
  },

  async listIncidents() {
    return request<{ incidents: SecurityIncident[] }>("/security/incidents");
  },

  async createIncident(fields: { title: string; description?: string }) {
    return request("/security/incidents", { method: "POST", body: JSON.stringify(fields) });
  },

  // ---- /users ----
  async listUsers() {
    return request<{ users: PublicUser[] }>("/users");
  },

  // ---- /audit ----
  async listAuditEvents() {
    return request<{ events: unknown[] }>("/audit");
  },
};
