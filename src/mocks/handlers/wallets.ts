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
  const { alias, profileName, secondaryAddress, referralCode, email, ens } = wallet;
  return {
    id: wallet.id,
    label: wallet.label,
    address: wallet.address,
    network: wallet.network,
    provider: wallet.provider ?? "metamask",
    connected: wallet.connected === true,
    primary: wallet.primary === true,
    ...(alias ? { alias } : {}),
    ...(profileName ? { profileName } : {}),
    ...(secondaryAddress ? { secondaryAddress } : {}),
    ...(referralCode ? { referralCode } : {}),
    ...(email ? { email } : {}),
    ...(ens ? { ens } : {}),
  };
}

/** Marca a primeira como principal quando nenhuma tem a flag (bancos antigos). Principal vem primeiro. */
function publicList(wallets: Wallet[]): PublicWallet[] {
  const marked = wallets.some((wallet) => wallet.primary);
  const list = wallets.map((wallet, index) =>
    toPublicWallet({ ...wallet, primary: marked ? wallet.primary === true : index === 0 }),
  );
  return [...list.filter((wallet) => wallet.primary), ...list.filter((wallet) => !wallet.primary)];
}

const MAX_LABEL_LENGTH = 40;
const MAX_EXTRA_LENGTH = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ENS_PATTERN = /^[a-z0-9-]{3,63}$/i;
const ENS_FULL_PATTERN = /^[a-z0-9-]{3,63}\.eth$/i;
const REFERRAL_PATTERN = /^[A-Za-z0-9-]{3,20}$/;

function readText(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Carteiras simuladas, sem extensão do navegador. `PATCH` recebe `action`:
 * `connect` conecta (e desconecta as outras), `reject` simula o usuário recusando no
 * app da carteira (409 `wallet-connect-rejected`) e `disconnect` desconecta.
 */
export const walletHandlers = [
  http.get("/api/wallets", ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();
    return HttpResponse.json({ wallets: publicList(walletsOf(user.id)) });
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

    // Campos opcionais do formulário de carteiras: vazio vale "não informado".
    const alias = readText(body, "alias");
    const profileName = readText(body, "profileName");
    const secondaryAddress = readText(body, "secondaryAddress");
    const referralCode = readText(body, "referralCode");
    const email = readText(body, "email");
    const ens = readText(body, "ens");
    if (alias.length > MAX_EXTRA_LENGTH) fields.alias = `Use até ${MAX_EXTRA_LENGTH} caracteres.`;
    if (profileName.length > MAX_EXTRA_LENGTH) fields.profileName = `Use até ${MAX_EXTRA_LENGTH} caracteres.`;
    if (referralCode && !REFERRAL_PATTERN.test(referralCode)) {
      fields.referralCode = "Use de 3 a 20 letras, números ou hífen.";
    }
    if (email && !EMAIL_PATTERN.test(email)) fields.email = "Digite um e-mail válido.";
    if (ens && !ENS_PATTERN.test(ens)) fields.ens = "Use de 3 a 63 letras, números ou hífen.";
    if (
      secondaryAddress &&
      !ENS_FULL_PATTERN.test(secondaryAddress) &&
      !(isWalletNetwork(body.network) && isValidWalletAddress(body.network, secondaryAddress))
    ) {
      fields.secondaryAddress = "Informe um endereço válido ou um nome .eth.";
    }
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
      primary: wallets.length === 0,
      ...(alias ? { alias } : {}),
      ...(profileName ? { profileName } : {}),
      ...(secondaryAddress ? { secondaryAddress } : {}),
      ...(referralCode ? { referralCode } : {}),
      ...(email ? { email } : {}),
      ...(ens ? { ens } : {}),
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

    const body = await readBody(request);
    const { action } = body;
    if (action === "reject") {
      return errorResponse(409, "wallet-connect-rejected", "A conexão foi recusada na carteira.");
    }
    if (action === "connect") {
      for (const other of wallets) other.connected = other.id === wallet.id;
      saveDatabase();
      return HttpResponse.json({ wallet: toPublicWallet(wallet) });
    }
    if (action === "disconnect") {
      wallet.connected = false;
      saveDatabase();
      return HttpResponse.json({ wallet: toPublicWallet(wallet) });
    }
    if (action === "set-primary") {
      for (const other of wallets) other.primary = other.id === wallet.id;
    } else if (action !== undefined) {
      return errorResponse(422, "validation", "Ação inválida.", {
        action: "Use connect, reject, disconnect ou set-primary.",
      });
    }

    const editing =
      body.label !== undefined || body.address !== undefined || body.network !== undefined;
    if (!editing && action !== "set-primary") {
      return errorResponse(422, "validation", "Ação inválida.", {
        action: "Use connect, reject, disconnect ou set-primary.",
      });
    }

    if (editing) {
      const nextLabel = body.label === undefined ? wallet.label : readText(body, "label");
      const nextNetwork = body.network === undefined ? wallet.network : body.network;
      const nextAddress = body.address === undefined ? wallet.address : readText(body, "address");
      const fields: Record<string, string> = {};
      if (nextLabel === "") fields.label = "Informe um nome para a carteira.";
      else if (nextLabel.length > MAX_LABEL_LENGTH) fields.label = `Use até ${MAX_LABEL_LENGTH} caracteres.`;
      if (!isWalletNetwork(nextNetwork)) fields.network = "Escolha uma rede.";
      else if (nextAddress === "") fields.address = "Informe o endereço da carteira.";
      else if (!isValidWalletAddress(nextNetwork, nextAddress)) {
        fields.address = "Endereço inválido para esta rede.";
      }
      const duplicated = wallets.some(
        (candidate) =>
          candidate.id !== wallet.id &&
          isWalletNetwork(nextNetwork) &&
          candidate.network === nextNetwork &&
          candidate.address.toLowerCase() === nextAddress.toLowerCase(),
      );
      if (duplicated) {
        fields.address = "Esta carteira já está cadastrada.";
      }
      if (Object.keys(fields).length > 0 || !isWalletNetwork(nextNetwork)) {
        return errorResponse(422, "validation", "Confira os campos destacados.", fields);
      }
      wallet.label = nextLabel;
      wallet.address = nextAddress;
      wallet.network = nextNetwork;
    }

    saveDatabase();
    return HttpResponse.json({ wallet: toPublicWallet(wallet) });
  }),
];
