import { http, HttpResponse } from "msw";
import {
  isValidWalletAddress,
  isWalletNetwork,
  isWalletProvider,
  type Wallet as PublicWallet,
} from "@/features/wallets/types";
import { getDatabase, saveDatabase } from "../db";
import type { Wallet } from "../seed";
import { userFromRequest } from "./auth";

function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

function unauthorized() {
  return errorResponse(401, "unauthorized", "Entre para usar a carteira.");
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function walletsOf(userId: string): Wallet[] {
  const db = getDatabase();
  db.wallets[userId] ??= [];
  return db.wallets[userId];
}

/** Carteiras do seed não têm `provider` nem `connected`: valem MetaMask e desconectada. */
export function toPublicWallet(wallet: Wallet): PublicWallet {
  return {
    id: wallet.id,
    label: wallet.label,
    address: wallet.address,
    network: wallet.network,
    provider: wallet.provider ?? "metamask",
    connected: wallet.connected === true,
  };
}

const MAX_LABEL_LENGTH = 40;

/**
 * Carteiras simuladas, sem extensão do navegador. `PATCH` recebe `action`:
 * `connect` conecta (e desconecta as outras), `reject` simula o usuário recusando no
 * app da carteira (409 `wallet-connect-rejected`) e `disconnect` desconecta.
 */
export const walletHandlers = [
  http.get("/api/wallets", ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();
    return HttpResponse.json({ wallets: walletsOf(user.id).map(toPublicWallet) });
  }),

  http.post("/api/wallets", async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const body = await readBody(request);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const provider = body.provider === undefined ? "metamask" : body.provider;

    const fields: Record<string, string> = {};
    if (label === "") fields.label = "Informe um nome para a carteira.";
    else if (label.length > MAX_LABEL_LENGTH) fields.label = `Use até ${MAX_LABEL_LENGTH} caracteres.`;
    if (!isWalletNetwork(body.network)) fields.network = "Escolha uma rede.";
    else if (address === "") fields.address = "Informe o endereço da carteira.";
    else if (!isValidWalletAddress(body.network, address)) fields.address = "Endereço inválido para esta rede.";
    if (!isWalletProvider(provider)) fields.provider = "Escolha uma carteira.";
    if (Object.keys(fields).length > 0 || !isWalletNetwork(body.network) || !isWalletProvider(provider)) {
      return errorResponse(422, "validation", "Confira os campos destacados.", fields);
    }

    const wallets = walletsOf(user.id);
    const duplicated = wallets.some(
      (wallet) => wallet.network === body.network && wallet.address.toLowerCase() === address.toLowerCase(),
    );
    if (duplicated) {
      return errorResponse(409, "wallet_exists", "Esta carteira já está cadastrada.", {
        address: "Esta carteira já está cadastrada.",
      });
    }

    const wallet: Wallet = {
      id: `wallet-${crypto.randomUUID()}`,
      label,
      address,
      network: body.network,
      provider,
      connected: false,
    };
    wallets.push(wallet);
    saveDatabase();
    return HttpResponse.json({ wallet: toPublicWallet(wallet) }, { status: 201 });
  }),

  http.patch("/api/wallets/:id", async ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const wallets = walletsOf(user.id);
    const wallet = wallets.find((candidate) => candidate.id === params.id);
    if (!wallet) return errorResponse(404, "not_found", "Carteira não encontrada.");

    const { action } = await readBody(request);
    if (action === "reject") {
      return errorResponse(409, "wallet-connect-rejected", "A conexão foi recusada na carteira.");
    }
    if (action === "connect") {
      for (const other of wallets) other.connected = other.id === wallet.id;
    } else if (action === "disconnect") {
      wallet.connected = false;
    } else {
      return errorResponse(422, "validation", "Ação inválida.", { action: "Use connect, reject ou disconnect." });
    }
    saveDatabase();
    return HttpResponse.json({ wallet: toPublicWallet(wallet) });
  }),
];
