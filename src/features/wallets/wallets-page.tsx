import { useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import { AccountLayout } from "@/features/account/account-layout";
import { EnsField, PrimaryButton, SelectField, TextField } from "@/features/account/fields";
import { readApiError } from "@/shared/api/errors";
import { useAddWallet, useUpdateWallet, useWalletAction, useWallets } from "./api";
import {
  NETWORK_LABELS,
  PROVIDER_LABELS,
  WALLET_NETWORKS,
  WALLET_PROVIDERS,
  isWalletNetwork,
  isWalletProvider,
  shortAddress,
  type Wallet,
} from "./types";

type Fields = Record<string, string>;

type FormState = {
  label: string;
  alias: string;
  network: string;
  profileName: string;
  address: string;
  secondaryAddress: string;
  provider: string;
  referralCode: string;
  email: string;
  ens: string;
};

const EMPTY_FORM: FormState = {
  label: "",
  alias: "",
  network: "",
  profileName: "",
  address: "",
  secondaryAddress: "",
  provider: "",
  referralCode: "",
  email: "",
  ens: "",
};

/** Presença dos campos obrigatórios. Formato do endereço e dos opcionais fica com o servidor. */
function validateWallet(form: FormState): Fields {
  const fields: Fields = {};
  if (!form.label.trim()) fields.label = "Informe um nome para a carteira.";
  if (!isWalletNetwork(form.network)) fields.network = "Escolha uma rede.";
  if (!form.address.trim()) fields.address = "Informe o endereço da carteira.";
  if (!isWalletProvider(form.provider)) fields.provider = "Escolha uma carteira.";
  return fields;
}

type WalletRowProps = {
  wallet: Wallet;
  busy: boolean;
  /** Erro da última ação desta carteira, mostrado junto dela. */
  error: string | null;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSetPrimary: () => void;
};

function WalletRow({
  wallet,
  busy,
  error,
  editing,
  onToggle,
  onEdit,
  onCancelEdit,
  onSetPrimary,
}: WalletRowProps) {
  const errorId = `wallet-${wallet.id}-error`;
  return (
    <li className="flex flex-col gap-3 bg-surface-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="truncate text-base font-bold leading-4 text-foreground">
            {wallet.label}
            {wallet.primary ? <span className="ml-2 text-xs font-medium text-text-accent">Principal</span> : null}
          </p>
          <p className="text-sm leading-[22px] text-text-secondary">
            {shortAddress(wallet.address)} · {NETWORK_LABELS[wallet.network]} · {PROVIDER_LABELS[wallet.provider]} ·{" "}
            {wallet.connected ? "Conectada" : "Desconectada"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {wallet.primary ? null : (
            <button
              type="button"
              disabled={busy}
              onClick={onSetPrimary}
              className="text-sm font-bold leading-4 text-text-accent underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Definir como principal
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={editing ? onCancelEdit : onEdit}
            aria-label={`${editing ? "Cancelar edição de" : "Editar"} ${wallet.label}`}
            className="text-sm font-bold leading-4 text-text-accent underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onToggle}
            aria-label={`${wallet.connected ? "Desconectar" : "Conectar"} ${wallet.label}`}
            aria-describedby={error ? errorId : undefined}
            className="shrink-0 text-sm font-bold leading-4 text-text-accent underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {wallet.connected ? "Desconectar" : "Conectar"}
          </button>
        </div>
      </div>
      {editing ? <EditWalletForm wallet={wallet} onDone={onCancelEdit} /> : null}
      {error ? (
        <p id={errorId} role="alert" className="w-full text-xs leading-4 text-text-coral">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function EditWalletForm({ wallet, onDone }: { wallet: Wallet; onDone: () => void }) {
  const update = useUpdateWallet();
  const [label, setLabel] = useState(wallet.label);
  const [address, setAddress] = useState(wallet.address);
  const [network, setNetwork] = useState(wallet.network);
  const [alias, setAlias] = useState(wallet.alias ?? "");
  const [profileName, setProfileName] = useState(wallet.profileName ?? "");
  const [secondaryAddress, setSecondaryAddress] = useState(wallet.secondaryAddress ?? "");
  const [referralCode, setReferralCode] = useState(wallet.referralCode ?? "");
  const [email, setEmail] = useState(wallet.email ?? "");
  const [ens, setEns] = useState(wallet.ens ?? "");
  const [localErrors, setLocalErrors] = useState<Fields>({});

  const error = update.error ? readApiError(update.error) : null;
  const errors = { ...(error?.fields ?? {}), ...localErrors };
  const formError = error && !error.fields ? error.message : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.reset();
    const found: Fields = {};
    if (!label.trim()) found.label = "Informe um nome para a carteira.";
    if (!isWalletNetwork(network)) found.network = "Escolha uma rede.";
    if (!address.trim()) found.address = "Informe o endereço da carteira.";
    setLocalErrors(found);
    if (Object.keys(found).length > 0 || !isWalletNetwork(network)) return;

    update.mutate(
      {
        id: wallet.id,
        label,
        address,
        network,
        alias: alias.trim() || undefined,
        profileName: profileName.trim() || undefined,
        secondaryAddress: secondaryAddress.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
        email: email.trim() || undefined,
        ens: ens.trim() || undefined,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-label={`Editar ${wallet.label}`} className="flex flex-col gap-4">
      <div className="grid gap-x-7 gap-y-4 lg:grid-cols-2">
        <TextField
          label="Nome de exibição"
          name="edit-label"
          required
          maxLength={40}
          autoComplete="off"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          error={errors.label}
        />
        <TextField
          label="Apelido da carteira"
          name="edit-alias"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          error={errors.alias}
        />
        <SelectField
          label="Rede"
          name="edit-network"
          required
          value={network}
          onChange={(event) => {
            if (isWalletNetwork(event.target.value)) setNetwork(event.target.value);
          }}
          error={errors.network}
        >
          {WALLET_NETWORKS.map((option) => (
            <option key={option} value={option}>
              {NETWORK_LABELS[option]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Nome do perfil"
          name="edit-profileName"
          value={profileName}
          onChange={(event) => setProfileName(event.target.value)}
          error={errors.profileName}
        />
        <div className="lg:col-span-2">
          <TextField
            label="Endereço da carteira"
            name="edit-address"
            required
            autoComplete="off"
            spellCheck={false}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            error={errors.address}
          />
        </div>
        <TextField
          label="Endereço secundário"
          name="edit-secondaryAddress"
          value={secondaryAddress}
          onChange={(event) => setSecondaryAddress(event.target.value)}
          error={errors.secondaryAddress}
        />
        <TextField
          label="Código de indicação"
          name="edit-referralCode"
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value)}
          error={errors.referralCode}
        />
        <TextField
          label="E-mail"
          name="edit-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          label="ENS"
          name="edit-ens"
          value={ens}
          onChange={(event) => setEns(event.target.value)}
          error={errors.ens}
        />
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-text-coral">
          {formError}
        </p>
      ) : null}
      <PrimaryButton disabled={update.isPending} className="w-[131px] whitespace-nowrap">
        {update.isPending ? "Salvando…" : "Salvar alterações"}
      </PrimaryButton>
    </form>
  );
}

function WalletForm({ labelRef }: { labelRef: RefObject<HTMLDivElement | null> }) {
  const add = useAddWallet();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState<Fields>({});
  const [saved, setSaved] = useState(false);

  const error = add.error ? readApiError(add.error) : null;
  const errors = { ...(error?.fields ?? {}), ...localErrors };
  const formError = error && !error.fields ? error.message : null;

  function set<K extends keyof FormState>(key: K) {
    return (value: string) => setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    add.reset();
    const found = validateWallet(form);
    setLocalErrors(found);
    if (Object.keys(found).length > 0 || !isWalletNetwork(form.network) || !isWalletProvider(form.provider)) return;

    add.mutate(
      {
        label: form.label,
        address: form.address,
        network: form.network,
        provider: form.provider,
        alias: form.alias,
        profileName: form.profileName,
        secondaryAddress: form.secondaryAddress,
        referralCode: form.referralCode,
        email: form.email,
        ens: form.ens,
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setSaved(true);
        },
      },
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label="Adicionar carteira"
      className="flex flex-col gap-8"
    >
      <div ref={labelRef} className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <TextField
          label="Nome de exibição"
          name="label"
          required
          maxLength={40}
          autoComplete="off"
          value={form.label}
          onChange={(event) => set("label")(event.target.value)}
          error={errors.label}
        />
        <TextField
          label="Apelido da carteira"
          name="alias"
          autoComplete="off"
          value={form.alias}
          onChange={(event) => set("alias")(event.target.value)}
          error={errors.alias}
        />
        <SelectField
          label="Rede"
          name="network"
          required
          placeholder="Selecione uma rede"
          value={form.network}
          onChange={(event) => set("network")(event.target.value)}
          error={errors.network}
        >
          {WALLET_NETWORKS.map((network) => (
            <option key={network} value={network}>
              {NETWORK_LABELS[network]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Nome do perfil"
          name="profileName"
          autoComplete="off"
          value={form.profileName}
          onChange={(event) => set("profileName")(event.target.value)}
          error={errors.profileName}
        />
        <TextField
          label="Endereço da carteira"
          name="address"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="Endereço 0x da carteira"
          value={form.address}
          onChange={(event) => set("address")(event.target.value)}
          error={errors.address}
        />
        <div className="md:self-end">
          <TextField
            label="Carteira secundária (ENS ou endereço, opcional)"
            name="secondaryAddress"
            hideLabel
            autoComplete="off"
            spellCheck={false}
            placeholder="ENS ou carteira secundária (opcional)"
            value={form.secondaryAddress}
            onChange={(event) => set("secondaryAddress")(event.target.value)}
            error={errors.secondaryAddress}
          />
        </div>
        <SelectField
          label="Tipo de carteira"
          name="provider"
          required
          placeholder="Selecione uma carteira"
          value={form.provider}
          onChange={(event) => set("provider")(event.target.value)}
          error={errors.provider}
        >
          {WALLET_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Código de indicação"
          name="referralCode"
          autoComplete="off"
          value={form.referralCode}
          onChange={(event) => set("referralCode")(event.target.value)}
          error={errors.referralCode}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => set("email")(event.target.value)}
          error={errors.email}
        />
        <EnsField label="Nome ENS" value={form.ens} onChange={set("ens")} error={errors.ens} />
      </div>

      <div className="flex flex-col gap-3">
        <PrimaryButton disabled={add.isPending} className="w-[131px] whitespace-nowrap">
          {add.isPending ? "Salvando…" : "Salvar carteira"}
        </PrimaryButton>
        {formError ? (
          <p role="alert" className="text-sm text-text-coral">
            {formError}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-text-secondary">
            Carteira salva.
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function WalletsPage() {
  const wallets = useWallets();
  const act = useWalletAction();
  const formRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const actionError = act.error ? readApiError(act.error) : null;
  const errorWalletId = act.error ? act.variables?.id : undefined;
  const errorFor = (wallet: Wallet) => (wallet.id === errorWalletId ? (actionError?.message ?? null) : null);

  const list = wallets.data ?? [];
  const principal = list.find((wallet) => wallet.primary) ?? list[0];
  const secondary = list.filter((wallet) => wallet.id !== principal?.id);

  function toggle(wallet: Wallet) {
    act.mutate({ id: wallet.id, action: wallet.connected ? "disconnect" : "connect" });
  }

  function rowProps(wallet: Wallet) {
    return {
      wallet,
      busy: act.isPending,
      error: errorFor(wallet),
      editing: editingId === wallet.id,
      onToggle: () => toggle(wallet),
      onEdit: () => setEditingId(wallet.id),
      onCancelEdit: () => setEditingId(null),
      onSetPrimary: () => act.mutate({ id: wallet.id, action: "set-primary" }),
    };
  }

  function focusForm() {
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }

  return (
    <AccountLayout active="wallets">
      <section aria-labelledby="principal-title" className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <h1 id="principal-title" className="text-[17px] font-bold leading-4 text-foreground">
              Carteira principal
            </h1>
            <button type="button" onClick={focusForm} className="text-base font-medium leading-4 text-text-accent">
              Adicionar
            </button>
          </div>
          <p className="text-sm leading-[15px] text-text-secondary">
            Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
          </p>
        </div>

        {wallets.isError ? (
          <p role="alert" className="text-sm text-text-coral">
            Não foi possível carregar suas carteiras. Tente novamente.
          </p>
        ) : null}
        {principal ? (
          <ul aria-label="Carteira principal salva" className="flex flex-col gap-3">
            <WalletRow {...rowProps(principal)} />
          </ul>
        ) : wallets.isSuccess ? (
          <p className="text-sm text-text-secondary">Você ainda não adicionou uma carteira.</p>
        ) : null}

        <WalletForm labelRef={formRef} />
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-3">
        <h2 id="secondary-title" className="text-[17px] font-bold leading-4 text-foreground">
          Carteira secundária
        </h2>
        {secondary.length > 0 ? (
          <ul aria-label="Carteiras secundárias" className="flex flex-col gap-3">
              {secondary.map((wallet) => (
                <WalletRow key={wallet.id} {...rowProps(wallet)} />
              ))}
          </ul>
        ) : (
          <p className="text-sm leading-[15px] text-text-secondary">Você ainda não adicionou uma carteira secundária.</p>
        )}
      </section>
    </AccountLayout>
  );
}
