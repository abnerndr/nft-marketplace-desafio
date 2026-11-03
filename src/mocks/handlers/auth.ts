import { http, HttpResponse } from "msw";
import { getDatabase, saveDatabase } from "../db";
import { getScenario } from "../scenarios";
import type { UserRecord } from "../seed";

type Fields = Record<string, string>;

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorResponse(status: number, code: string, message: string, fields?: Fields) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

function validationError(fields: Fields) {
  return errorResponse(422, "validation", "Confira os campos destacados.", fields);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function publicUser({ id, name, email }: UserRecord) {
  return { id, name, email };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function readText(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function sessionsOf(db: ReturnType<typeof getDatabase>): Record<string, string> {
  // Bancos gravados antes desta task não têm `sessions`.
  db.sessions ??= {};
  return db.sessions;
}

function openSession(user: UserRecord): string {
  const db = getDatabase();
  const token = newToken();
  sessionsOf(db)[token] = user.id;
  saveDatabase();
  return token;
}

/** Usuário dono do token do request, ou `null`. Reutilizável pelos handlers privados. */
export function userFromRequest(request: Request): UserRecord | null {
  if (getScenario() === "session-expired") return null;
  const token = bearerToken(request);
  if (!token) return null;
  const db = getDatabase();
  const userId = sessionsOf(db)[token];
  return db.users.find((user) => user.id === userId) ?? null;
}

export const authHandlers = [
  http.post("/api/auth/register", async ({ request }) => {
    const body = await readBody(request);
    const name = readText(body, "name").trim();
    const email = normalizeEmail(readText(body, "email"));
    const password = readText(body, "password");

    const fields: Fields = {};
    if (!name) fields.name = "Informe seu nome de usuário.";
    if (!email) fields.email = "Informe seu e-mail.";
    else if (!EMAIL_PATTERN.test(email)) fields.email = "Digite um e-mail válido.";
    if (!password) fields.password = "Informe uma senha.";
    else if (password.length < MIN_PASSWORD_LENGTH) {
      fields.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (Object.keys(fields).length > 0) return validationError(fields);

    const db = getDatabase();
    if (db.users.some((user) => normalizeEmail(user.email) === email)) {
      return errorResponse(409, "conflict", "Já existe uma conta com este e-mail.");
    }

    const user: UserRecord = {
      id: `user-${newToken().slice(0, 12)}`,
      name,
      email,
      passwordHash: await sha256Hex(password),
    };
    db.users.push(user);
    db.carts[user.id] = { items: [], couponCode: null };
    db.favorites[user.id] = [];
    db.wallets[user.id] = [];
    const token = openSession(user);

    return HttpResponse.json({ user: publicUser(user), token }, { status: 201 });
  }),

  http.post("/api/auth/login", async ({ request }) => {
    const body = await readBody(request);
    const email = normalizeEmail(readText(body, "email"));
    const password = readText(body, "password");

    const fields: Fields = {};
    if (!email) fields.email = "Informe seu e-mail.";
    if (!password) fields.password = "Informe sua senha.";
    if (Object.keys(fields).length > 0) return validationError(fields);

    const user = getDatabase().users.find((candidate) => normalizeEmail(candidate.email) === email);
    const hash = await sha256Hex(password);
    if (!user || user.passwordHash !== hash) {
      return errorResponse(401, "unauthorized", "E-mail ou senha incorretos.");
    }

    const token = openSession(user);
    return HttpResponse.json({ user: publicUser(user), token });
  }),

  http.get("/api/auth/session", ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return errorResponse(401, "unauthorized", "Sua sessão expirou. Entre novamente.");
    return HttpResponse.json({ user: publicUser(user) });
  }),

  http.post("/api/auth/logout", ({ request }) => {
    const token = bearerToken(request);
    if (token) {
      delete sessionsOf(getDatabase())[token];
      saveDatabase();
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
