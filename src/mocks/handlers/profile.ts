import { http, HttpResponse } from "msw";
import { MAX_AVATAR_BYTES, MIN_PASSWORD_LENGTH, type Profile } from "@/features/profile/types";
import { getDatabase, saveDatabase } from "../db";
import { getScenario } from "../scenarios";
import type { UserRecord } from "../seed";
import { sha256Hex, userFromRequest } from "./auth";

type Fields = Record<string, string>;

const MAX_NAME_LENGTH = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/i;
const ENS_PATTERN = /^[a-z0-9-]{3,63}$/i;
// Avatar simulado: imagem pequena como data URL, para caber no localStorage.
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

function errorResponse(status: number, code: string, message: string, fields?: Fields) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

function validationError(fields: Fields) {
  return errorResponse(422, "validation", "Confira os campos destacados.", fields);
}

function unauthorized() {
  return errorResponse(401, "unauthorized", "Entre para editar seu perfil.");
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Sem `username` gravado, o nome de usuário vale a parte local do e-mail. */
function usernameOf(user: UserRecord): string {
  return user.username ?? user.email.split("@")[0];
}

export function toProfile(user: UserRecord): Profile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: usernameOf(user),
    ens: user.ens ?? "",
    walletNickname: user.walletNickname ?? "",
    avatarUrl: user.avatarUrl ?? null,
  };
}

/** Bytes decodificados de um data URL base64, sem alocar o buffer. */
function base64Bytes(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

/**
 * Perfil do colecionador. `PATCH` aceita só os campos enviados. A senha nunca volta nas
 * respostas e é guardada como SHA-256 em hex, como no cadastro.
 */
export const profileHandlers = [
  http.get("/api/profile", ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();
    return HttpResponse.json({ profile: toProfile(user) });
  }),

  http.patch("/api/profile", async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();
    if (getScenario() === "validation-conflict") {
      return validationError({ name: "Nome em conflito com outro colecionador.", email: "E-mail já em uso neste cenário." });
    }
    if (getScenario() === "forbidden") {
      return errorResponse(403, "forbidden", "Você não tem permissão para alterar este perfil.");
    }

    const body = await readBody(request);
    const db = getDatabase();
    const fields: Fields = {};
    const next: Partial<UserRecord> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) fields.name = "Informe seu nome de exibição.";
      else if (name.length > MAX_NAME_LENGTH) fields.name = `Use até ${MAX_NAME_LENGTH} caracteres.`;
      else next.name = name;
    }

    if (body.username !== undefined) {
      const username = typeof body.username === "string" ? body.username.trim() : "";
      if (!username) fields.username = "Informe seu nome de usuário.";
      else if (!USERNAME_PATTERN.test(username)) {
        fields.username = "Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.";
      } else if (
        db.users.some(
          (other) => other.id !== user.id && usernameOf(other).toLowerCase() === username.toLowerCase(),
        )
      ) {
        fields.username = "Este nome de usuário já está em uso.";
      } else next.username = username;
    }

    if (body.email !== undefined) {
      const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
      if (!email) fields.email = "Informe seu e-mail.";
      else if (!EMAIL_PATTERN.test(email)) fields.email = "Digite um e-mail válido.";
      else if (db.users.some((other) => other.id !== user.id && normalizeEmail(other.email) === email)) {
        fields.email = "Já existe uma conta com este e-mail.";
      } else next.email = email;
    }

    if (body.ens !== undefined) {
      const ens = typeof body.ens === "string" ? body.ens.trim() : "";
      if (ens && !ENS_PATTERN.test(ens)) fields.ens = "Use de 3 a 63 letras, números ou hífen.";
      else next.ens = ens;
    }

    if (body.walletNickname !== undefined) {
      const nickname = typeof body.walletNickname === "string" ? body.walletNickname.trim() : "";
      if (nickname.length > MAX_NAME_LENGTH) fields.walletNickname = `Use até ${MAX_NAME_LENGTH} caracteres.`;
      else next.walletNickname = nickname;
    }

    if (Object.keys(fields).length > 0) return validationError(fields);

    Object.assign(user, next);
    saveDatabase();
    return HttpResponse.json({ profile: toProfile(user) });
  }),

  http.post("/api/profile/password", async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const body = await readBody(request);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : null;

    const fields: Fields = {};
    if (!currentPassword) fields.currentPassword = "Informe sua senha atual.";
    else if ((await sha256Hex(currentPassword)) !== user.passwordHash) {
      fields.currentPassword = "A senha atual está incorreta.";
    }
    if (!newPassword) fields.newPassword = "Informe a nova senha.";
    else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      fields.newPassword = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    } else if (!fields.currentPassword && newPassword === currentPassword) {
      fields.newPassword = "A nova senha precisa ser diferente da atual.";
    }
    if (confirmPassword !== null && confirmPassword !== newPassword) {
      fields.confirmPassword = "A confirmação não confere com a nova senha.";
    }
    if (Object.keys(fields).length > 0) return validationError(fields);

    user.passwordHash = await sha256Hex(newPassword);
    saveDatabase();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/profile/avatar", async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const { dataUrl } = await readBody(request);
    // `null` remove o avatar.
    if (dataUrl === null) {
      delete user.avatarUrl;
      saveDatabase();
      return HttpResponse.json({ profile: toProfile(user) });
    }
    if (typeof dataUrl !== "string" || !AVATAR_PATTERN.test(dataUrl)) {
      return validationError({ avatar: "Envie uma imagem PNG, JPEG, WebP ou GIF." });
    }
    if (base64Bytes(dataUrl) > MAX_AVATAR_BYTES) {
      return validationError({ avatar: `A imagem pode ter no máximo ${MAX_AVATAR_BYTES / 1024} KB.` });
    }

    user.avatarUrl = dataUrl;
    saveDatabase();
    return HttpResponse.json({ profile: toProfile(user) });
  }),
];
