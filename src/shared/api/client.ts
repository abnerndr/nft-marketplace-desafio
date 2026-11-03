import axios, { isAxiosError } from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

api.interceptors.request.use((config) => {
  const token =
    typeof localStorage === "undefined"
      ? null
      : localStorage.getItem("kurio.session");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

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

api.interceptors.response.use(undefined, (error: unknown) => {
  if (isAxiosError(error) && error.config) {
    const sentToken = Boolean(error.config.headers?.Authorization);
    if (isSessionExpiry(error.response?.status, error.config.url, sentToken)) {
      unauthorizedHandler?.({ url: error.config.url ?? "" });
    }
  }
  return Promise.reject(error);
});
