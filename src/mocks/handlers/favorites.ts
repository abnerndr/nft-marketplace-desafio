import { http, HttpResponse } from "msw";
import { getDatabase, saveDatabase } from "../db";
import { userFromRequest } from "./auth";
import { findNftBySlug } from "./nfts";

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

/** Favoritos por usuário, na ordem em que foram marcados. */
export const favoriteHandlers = [
  http.get("/api/favorites", ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return errorResponse(401, "unauthorized", "Entre para ver seus favoritos.");
    return HttpResponse.json({ favorites: getDatabase().favorites[user.id] ?? [] });
  }),

  http.put("/api/favorites/:slug", ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return errorResponse(401, "unauthorized", "Entre para favoritar.");

    const slug = String(params.slug);
    if (!findNftBySlug(slug)) return errorResponse(404, "not_found", "NFT não encontrado.");

    const db = getDatabase();
    const list = (db.favorites[user.id] ??= []);
    if (!list.includes(slug)) list.push(slug);
    saveDatabase();
    return HttpResponse.json({ favorites: list });
  }),

  http.delete("/api/favorites/:slug", ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return errorResponse(401, "unauthorized", "Entre para favoritar.");

    const slug = String(params.slug);
    const db = getDatabase();
    db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((candidate) => candidate !== slug);
    saveDatabase();
    return HttpResponse.json({ favorites: db.favorites[user.id] });
  }),
];
