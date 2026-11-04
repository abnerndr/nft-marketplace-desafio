import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { NETWORK_LABELS, PROVIDER_LABELS, shortAddress, type Wallet } from "@/features/wallets/types";
import { cn } from "@/lib/utils";
import {
  collectorInputSchema,
  emptyCollector,
  readCollectorDraft,
  writeCollectorDraft,
  type CollectorInput,
} from "./types";

const fieldClass =
  "h-10 w-full rounded-[3px] border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-kurio-secondary focus-visible:border-primary focus-visible:outline-none aria-[invalid=true]:border-text-coral";

function Labeled({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center text-[15px] leading-[15px] text-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-[22px] leading-[29px] text-text-coral">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs leading-4 text-text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type CollectorFieldsProps = {
  userId: string;
  wallet: Wallet | null;
  apiErrors?: Record<string, string>;
  onValidityChange: (valid: boolean, value: CollectorInput) => void;
};

export function CollectorFields({ userId, wallet, apiErrors = {}, onValidityChange }: CollectorFieldsProps) {
  const [value, setValue] = useState<CollectorInput>(() => readCollectorDraft(userId) ?? emptyCollector());
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    writeCollectorDraft(userId, value);
  }, [userId, value]);

  const parsed = useMemo(() => collectorInputSchema.safeParse(value), [value]);
  const fieldErrors = parsed.success ? {} : Object.fromEntries(
    parsed.error.issues.map((issue) => [String(issue.path[0] ?? ""), issue.message]),
  );

  useEffect(() => {
    onValidityChange(parsed.success, value);
  }, [parsed.success, value, onValidityChange]);

  function patch(partial: Partial<CollectorInput>) {
    setTouched(true);
    setValue((prev) => ({ ...prev, ...partial }));
  }

  function errorFor(key: keyof CollectorInput): string | undefined {
    return apiErrors[key] ?? (touched ? fieldErrors[key] : undefined);
  }

  return (
    <section aria-labelledby="collector-heading" className="flex flex-col gap-6">
      <h2 id="collector-heading" className="text-[17px] font-bold leading-4 text-foreground">
        Perfil do colecionador
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Labeled id="collector-displayName" label="Nome de exibição" required error={errorFor("displayName")}>
            <Input
              id="collector-displayName"
              name="displayName"
              value={value.displayName}
              aria-invalid={Boolean(errorFor("displayName"))}
              aria-describedby={errorFor("displayName") ? "collector-displayName-error" : undefined}
              className={fieldClass}
              onChange={(event) => patch({ displayName: event.target.value })}
            />
          </Labeled>
          <Labeled id="collector-network" label="Rede" required>
            <Input
              id="collector-network"
              readOnly
              value={wallet ? NETWORK_LABELS[wallet.network] : "Selecione uma carteira"}
              className={cn(fieldClass, "text-kurio-secondary")}
            />
          </Labeled>
          <Labeled id="collector-address" label="Endereço da carteira" required>
            <Input
              id="collector-address"
              readOnly
              value={wallet ? shortAddress(wallet.address) : "Endereço 0x da carteira"}
              className={cn(fieldClass, "text-kurio-secondary")}
            />
          </Labeled>
          <Labeled id="collector-provider" label="Tipo de carteira" required>
            <Input
              id="collector-provider"
              readOnly
              value={wallet ? PROVIDER_LABELS[wallet.provider ?? "metamask"] : "Selecione uma carteira"}
              className={cn(fieldClass, "text-kurio-secondary")}
            />
          </Labeled>
          <Labeled id="collector-email" label="E-mail" required error={errorFor("email")}>
            <Input
              id="collector-email"
              name="email"
              type="email"
              autoComplete="email"
              value={value.email}
              aria-invalid={Boolean(errorFor("email"))}
              className={fieldClass}
              onChange={(event) => patch({ email: event.target.value })}
            />
          </Labeled>
        </div>

        <div className="flex flex-col gap-3">
          <Labeled id="collector-username" label="Nome de usuário" required error={errorFor("username")}>
            <Input
              id="collector-username"
              name="username"
              value={value.username}
              aria-invalid={Boolean(errorFor("username"))}
              className={fieldClass}
              onChange={(event) => patch({ username: event.target.value })}
            />
          </Labeled>
          <Labeled id="collector-profileName" label="Nome do perfil" required error={errorFor("profileName")}>
            <Input
              id="collector-profileName"
              name="profileName"
              value={value.profileName}
              aria-invalid={Boolean(errorFor("profileName"))}
              className={fieldClass}
              onChange={(event) => patch({ profileName: event.target.value })}
            />
          </Labeled>
          <Labeled id="collector-secondary" label="ENS ou carteira secundária (opcional)" error={errorFor("secondaryAddress")}>
            <Input
              id="collector-secondary"
              name="secondaryAddress"
              placeholder="ENS ou carteira secundária (opcional)"
              value={value.secondaryAddress ?? ""}
              className={fieldClass}
              onChange={(event) => patch({ secondaryAddress: event.target.value })}
            />
          </Labeled>
          <Labeled id="collector-referral" label="Código de indicação" required error={errorFor("referralCode")}>
            <Input
              id="collector-referral"
              name="referralCode"
              value={value.referralCode}
              aria-invalid={Boolean(errorFor("referralCode"))}
              className={fieldClass}
              onChange={(event) => patch({ referralCode: event.target.value })}
            />
          </Labeled>
          <Labeled id="collector-ens" label="Nome ENS" required error={errorFor("ensName")}>
            <div className="flex items-center gap-2">
              <Input
                id="collector-ens"
                name="ensName"
                value={value.ensName}
                aria-invalid={Boolean(errorFor("ensName"))}
                className={cn(fieldClass, "max-w-[120px]")}
                onChange={(event) => patch({ ensName: event.target.value })}
              />
              <span className="text-[15px] text-foreground">.eth</span>
            </div>
          </Labeled>
        </div>
      </div>

      <Labeled id="collector-note" label="Observação do colecionador (opcional)">
        <textarea
          id="collector-note"
          name="note"
          rows={5}
          value={value.note ?? ""}
          className="min-h-[152px] w-full max-w-[350px] rounded-[3px] border border-border bg-transparent px-3 py-3 text-sm text-foreground placeholder:text-kurio-secondary focus-visible:border-primary focus-visible:outline-none"
          onChange={(event) => patch({ note: event.target.value })}
        />
      </Labeled>
    </section>
  );
}
