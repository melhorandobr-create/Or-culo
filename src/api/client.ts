import * as SecureStore from "expo-secure-store";

// Backend real do ORÁCULO (vigia-svin), lido diretamente do código-fonte do
// servidor em produção (/opt/vigia-svin) em 2026-09-24.
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

// Mensagem exata devolvida pelo backend (src/routes/auth.js) quando falta
// OTP/recovery code válido — usada pro client saber que precisa desafiar MFA
// em vez de mostrar "usuário ou senha inválidos".
export const MFA_REQUIRED_MESSAGE =
  "Código MFA ou código de recuperação obrigatório é válido.";

export const api = {
  async login(
    username: string,
    password: string,
    otp?: string,
    recoveryCode?: string
  ): Promise<LoginResult> {
    return request<LoginResult>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password, otp, recoveryCode }),
    });
  },

  async me(): Promise<{ user: PublicUser }> {
    return request("/me");
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return request<LoginResult>("/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async mfaStepUp(currentPassword: string, code: string) {
    return request<{ stepUpToken: string; expiresInSeconds: number }>(
      "/mfa/step-up",
      { method: "POST", body: JSON.stringify({ currentPassword, code }) }
    );
  },

  async mfaDisable(currentPassword: string, code?: string, recoveryCode?: string) {
    return request<LoginResult>("/mfa/disable", {
      method: "POST",
      body: JSON.stringify({ currentPassword, code, recoveryCode }),
    });
  },
};
