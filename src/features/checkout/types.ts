import { z } from "zod";

export const collectorInputSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome de exibição."),
  username: z.string().trim().min(1, "Informe o nome de usuário."),
  profileName: z.string().trim().min(1, "Informe o nome do perfil."),
  email: z.string().trim().email("Informe um e-mail válido."),
  referralCode: z.string().trim().min(1, "Informe o código de indicação."),
  ensName: z.string().trim().min(1, "Informe o nome ENS."),
  secondaryAddress: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export type CollectorInput = z.infer<typeof collectorInputSchema>;

export const emptyCollector = (): CollectorInput => ({
  displayName: "",
  username: "",
  profileName: "",
  email: "",
  referralCode: "",
  ensName: "",
  secondaryAddress: "",
  note: "",
});

const DRAFT_PREFIX = "kurio.collector-draft.";

export function readCollectorDraft(userId: string): CollectorInput | null {
  try {
    const raw = sessionStorage.getItem(`${DRAFT_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = collectorInputSchema.partial().safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { ...emptyCollector(), ...parsed.data };
  } catch {
    return null;
  }
}

export function writeCollectorDraft(userId: string, value: CollectorInput): void {
  try {
    sessionStorage.setItem(`${DRAFT_PREFIX}${userId}`, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}
