import * as SecureStore from "expo-secure-store";

// Backend real do ORÁCULO (vigia-svin), lido diretamente do código-fonte do
// servidor em produção (/opt/vigia-svin) em 2026-09-24. Prefixos de rota
// conferidos em server.js (app.use('/auth', ...), etc.) — nenhum chutado.
const BASE_URL = "https://vigia.85-155-182-151.nip.io";
const TOKEN_KEY = "oraculo_session_token";

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

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
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

export interface Report {
  id: string;
  ownerId: string;
  displayName?: string;
  title?: string;
  status?: string;
  secretClearance?: boolean;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
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

// Mensagem exata devolvida pelo backend (src/routes/auth.js) quando falta
// OTP/recovery code válido — usada pro client saber que precisa desafiar MFA
// em vez de mostrar "usuário ou senha inválidos".
export const MFA_REQUIRED_MESSAGE =
  "Código MFA ou código de recuperação obrigatório é válido.";

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

  async getReport(id: string) {
    return request<{ report: Report }>(`/reports/${id}`);
  },

  async updateReport(id: string, patch: Partial<Report>) {
    return request<{ report: Report }>(`/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  async deleteReport(id: string) {
    return request<void>(`/reports/${id}`, { method: "DELETE" });
  },

  async getReportTimeline(id: string) {
    return request<{ events: unknown[] }>(`/reports/${id}/timeline`);
  },

  async listReportTasks(id: string) {
    return request<{ tasks: unknown[] }>(`/reports/${id}/tasks`);
  },

  async createReportTask(id: string, fields: { title: string; notes?: string; dueAt?: number; assignedUserId?: string }) {
    return request(`/reports/${id}/tasks`, { method: "POST", body: JSON.stringify(fields) });
  },

  async getReportIntegrity(id: string) {
    return request<{ verified: boolean; checkedAt: number; evidenceCount: number }>(
      `/reports/${id}/integrity`
    );
  },

  // ---- /case-intelligence/:reportId/... ----
  async listCaseEntities(reportId: string) {
    return request<{ entities: unknown[] }>(`/case-intelligence/${reportId}/entities`);
  },

  async listCaseHypotheses(reportId: string) {
    return request<{ hypotheses: unknown[] }>(`/case-intelligence/${reportId}/hypotheses`);
  },

  async createCaseHypothesis(reportId: string, fields: { title: string; description?: string; confidence?: number }) {
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
  // (nunca expostos ao app). Bounding box em graus decimais.
  async getFlights(bbox: { lamin: number; lomin: number; lamax: number; lomax: number }) {
    const q = new URLSearchParams({
      lamin: String(bbox.lamin),
      lomin: String(bbox.lomin),
      lamax: String(bbox.lamax),
      lomax: String(bbox.lomax),
    });
    return request<{ flights: unknown[] }>(`/public-data/flights?${q.toString()}`);
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
