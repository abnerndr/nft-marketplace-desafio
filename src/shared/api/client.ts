import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";
import {
  captureSessionIdentity,
  isCurrentSession,
  type SessionIdentity,
} from "@/features/auth/session-identity";
import { isSpaFallbackBody, reclaimMockClient } from "@/mocks/reclaim";
import { waitForMocks } from "@/mocks/ready";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

export type SessionStamp = { identity: SessionIdentity; token: string | null };

type StampedConfig = InternalAxiosRequestConfig & {
  kurioSession?: SessionStamp;
  /** Já tentamos de novo depois de um HTML no lugar do JSON. */
  kurioPassthroughRetry?: boolean;
};

function readToken(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem("kurio.session");
  } catch {
    return null;
  }
}

/** 401 só derruba a sessão se o request saiu com o token e a geração que ainda estão valendo. */
export function requestMatchesCurrentSession(stamp: SessionStamp | undefined, tokenNow: string | null): boolean {
  if (!stamp?.token || stamp.token !== tokenNow) return false;
  return isCurrentSession(stamp.identity);
}

api.interceptors.request.use(async (config) => {
  await waitForMocks();
  await reclaimMockClient();
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  (config as StampedConfig).kurioSession = { identity: captureSessionIdentity(), token };
  return config;
});

export type UnauthorizedInfo = {
  /** Caminho da requisição que recebeu 401, sem a base da API (`/orders`, `/auth/session`). */
  url: string;
};

type UnauthorizedHandler = (info: UnauthorizedInfo) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** O app registra aqui o que fazer com uma sessão vencida (limpar o token e ir para o login). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/** Nesses caminhos o 401 é resposta normal (senha errada, saída), não sessão vencida. */
const PUBLIC_AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/logout"];

/**
 * Um 401 só indica sessão vencida quando a requisição levou um token: sem token o servidor
 * recusaria de qualquer jeito e o usuário já está como visitante.
 */
export function isSessionExpiry(status: number | undefined, url: string | undefined, sentToken: boolean): boolean {
  if (status !== 401 || !sentToken) return false;
  const path = (url ?? "").split("?")[0];
  return !PUBLIC_AUTH_PATHS.includes(path);
}

api.interceptors.response.use(
  async (response) => {
    const config = response.config as StampedConfig;
    if (isSpaFallbackBody(response.data) && !config.kurioPassthroughRetry) {
      config.kurioPassthroughRetry = true;
      await reclaimMockClient();
      return api.request(config);
    }
    return response;
  },
  (error: unknown) => {
    if (isAxiosError(error) && error.config) {
      const stamped = error.config as StampedConfig;
      const sentToken = Boolean(stamped.kurioSession?.token ?? stamped.headers?.Authorization);
      if (
        isSessionExpiry(error.response?.status, error.config.url, sentToken) &&
        requestMatchesCurrentSession(stamped.kurioSession, readToken())
      ) {
        unauthorizedHandler?.({ url: error.config.url ?? "" });
      }
    }
    return Promise.reject(error);
  },
);
