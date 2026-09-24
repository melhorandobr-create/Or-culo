import React, { createContext, useContext, useEffect, useState } from "react";
import {
  api,
  saveToken,
  getToken,
  clearToken,
  setOnSessionExpired,
  MFA_REQUIRED_MESSAGE,
  ApiError,
  PublicUser,
} from "../api/client";

interface AuthContextValue {
  isLoading: boolean;
  isLoggedIn: boolean;
  sessionExpired: boolean;
  user: PublicUser | null;
  /** desafio de MFA pendente: username/senha já validados, falta otp ou recoveryCode */
  mfaChallenge: { username: string; password: string } | null;
  login: (username: string, password: string) => Promise<void>;
  submitMfaChallenge: (params: { otp?: string; recoveryCode?: string }) => Promise<void>;
  cancelMfaChallenge: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<
    { username: string; password: string } | null
  >(null);

  useEffect(() => {
    getToken().then(async (token) => {
      if (token) {
        try {
          const { user: me } = await api.me();
          setUser(me);
          setIsLoggedIn(true);
        } catch {
          await clearToken();
          setIsLoggedIn(false);
        }
      }
      setIsLoading(false);
    });
    setOnSessionExpired(() => {
      setSessionExpired(true);
      setIsLoggedIn(false);
      setUser(null);
    });
  }, []);

  // Primeira etapa: usuário + senha. Se a conta tem MFA ativo e nenhum
  // otp/recoveryCode foi enviado, o backend responde com a mensagem
  // MFA_REQUIRED_MESSAGE — nesse caso abrimos o desafio em vez de mostrar erro.
  async function login(username: string, password: string) {
    try {
      const { token, user: loggedUser } = await api.login(username, password);
      await saveToken(token);
      setUser(loggedUser);
      setSessionExpired(false);
      setIsLoggedIn(true);
      setMfaChallenge(null);
    } catch (err) {
      if (err instanceof ApiError && err.message === MFA_REQUIRED_MESSAGE) {
        setMfaChallenge({ username, password });
        return;
      }
      throw err;
    }
  }

  // Segunda etapa: usuário digitou o código do authenticator OU um recovery
  // code. Reenvia usuário+senha (o backend exige os dois de novo) junto com
  // o que foi preenchido.
  async function submitMfaChallenge({
    otp,
    recoveryCode,
  }: {
    otp?: string;
    recoveryCode?: string;
  }) {
    if (!mfaChallenge) throw new Error("Nenhum desafio de MFA pendente.");
    const { token, user: loggedUser } = await api.login(
      mfaChallenge.username,
      mfaChallenge.password,
      otp,
      recoveryCode
    );
    await saveToken(token);
    setUser(loggedUser);
    setSessionExpired(false);
    setIsLoggedIn(true);
    setMfaChallenge(null);
  }

  function cancelMfaChallenge() {
    setMfaChallenge(null);
  }

  async function logout() {
    await clearToken();
    setSessionExpired(false);
    setIsLoggedIn(false);
    setUser(null);
    setMfaChallenge(null);
  }

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isLoggedIn,
        sessionExpired,
        user,
        mfaChallenge,
        login,
        submitMfaChallenge,
        cancelMfaChallenge,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return ctx;
}
