import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import avatarPlaceholder from "@/assets/account/avatar-placeholder.svg";
import { AccountLayout } from "@/features/account/account-layout";
import { EnsField, PasswordField, PrimaryButton, TextField } from "@/features/account/fields";
import { readApiError } from "@/shared/api/errors";
import { useChangePassword, useProfile, useUpdateAvatar, useUpdateProfile } from "./api";
import { MAX_AVATAR_BYTES, MIN_PASSWORD_LENGTH, type Profile } from "./types";

type Fields = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldsOf(error: unknown): Fields {
  const { code, fields } = readApiError(error);
  return code === "validation" ? (fields ?? {}) : {};
}

/** Confere o que dá para saber sem o servidor. O servidor confere de novo. */
function validateProfile(values: { name: string; username: string; email: string }): Fields {
  const fields: Fields = {};
  if (!values.name.trim()) fields.name = "Informe seu nome de exibição.";
  if (!values.username.trim()) fields.username = "Informe seu nome de usuário.";
  const email = values.email.trim();
  if (!email) fields.email = "Informe seu e-mail.";
  else if (!EMAIL_PATTERN.test(email)) fields.email = "Digite um e-mail válido.";
  return fields;
}

function validatePassword(values: { current: string; next: string; confirm: string }): Fields {
  const fields: Fields = {};
  if (!values.current) fields.currentPassword = "Informe sua senha atual.";
  if (!values.next) fields.newPassword = "Informe a nova senha.";
  else if (values.next.length < MIN_PASSWORD_LENGTH) {
    fields.newPassword = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (values.confirm !== values.next) fields.confirmPassword = "A confirmação não confere com a nova senha.";
  return fields;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AvatarControls({ profile }: { profile: Profile }) {
  const input = useRef<HTMLInputElement>(null);
  const update = useUpdateAvatar();
  const [localError, setLocalError] = useState<string | null>(null);
  const message = localError ?? fieldsOf(update.error).avatar ?? (update.error ? readApiError(update.error).message : null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLocalError(null);
    if (!file.type.startsWith("image/")) {
      setLocalError("Envie um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setLocalError(`A imagem pode ter no máximo ${MAX_AVATAR_BYTES / 1024} KB.`);
      return;
    }
    try {
      update.mutate(await readAsDataUrl(file));
    } catch {
      setLocalError("Não foi possível ler a imagem.");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <p id="avatar-label" className="text-[15px] leading-[15px] text-foreground">
        Avatar
      </p>
      <div className="flex items-center gap-6">
        <div className="flex size-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-[#2f1d15]">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={`Avatar de ${profile.name}`} className="size-full object-cover" />
          ) : (
            <img src={avatarPlaceholder} alt="" aria-hidden="true" className="block size-6" />
          )}
        </div>
        <div className="flex items-center gap-5">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-labelledby="avatar-label"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "avatar-error" : undefined}
            onChange={handleFile}
            className="sr-only"
            tabIndex={-1}
          />
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => input.current?.click()}
            className="h-10 w-[98px] rounded-[3px] bg-primary text-sm font-bold leading-4 text-ink disabled:opacity-60"
          >
            Alterar
          </button>
          <button
            type="button"
            disabled={update.isPending || !profile.avatarUrl}
            onClick={() => {
              setLocalError(null);
              update.mutate(null);
            }}
            className="text-sm leading-4 text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remover
          </button>
        </div>
      </div>
      {message ? (
        <p id="avatar-error" role="alert" className="text-xs leading-4 text-text-coral">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [ens, setEns] = useState(profile.ens);
  const [walletNickname, setWalletNickname] = useState(profile.walletNickname);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localErrors, setLocalErrors] = useState<Fields>({});
  const [saved, setSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const serverErrors: Fields = {
    ...fieldsOf(changePassword.error),
    ...fieldsOf(updateProfile.error),
  };
  const errors = { ...serverErrors, ...localErrors };
  const failure = [updateProfile.error, changePassword.error]
    .filter((error) => error !== null && readApiError(error).code !== "validation")
    .map((error) => readApiError(error).message)[0];
  const pending = updateProfile.isPending || changePassword.isPending;
  const wantsPasswordChange = currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setPasswordSaved(false);
    updateProfile.reset();
    changePassword.reset();

    const found = {
      ...validateProfile({ name, username, email }),
      ...(wantsPasswordChange
        ? validatePassword({ current: currentPassword, next: newPassword, confirm: confirmPassword })
        : {}),
    };
    setLocalErrors(found);
    if (Object.keys(found).length > 0) return;

    // A senha vai primeiro: se a senha atual estiver errada, nada foi gravado e a tela diz isso.
    if (wantsPasswordChange) {
      try {
        await changePassword.mutateAsync({ currentPassword, newPassword, confirmPassword });
      } catch {
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    }

    try {
      await updateProfile.mutateAsync({ name, username, email, ens, walletNickname });
      setSaved(true);
    } catch {
      // O erro do perfil aparece nos campos ou na mensagem geral; a senha já trocada fica avisada à parte.
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby="profile-title" className="flex flex-col gap-8">
      <h1 id="profile-title" className="text-base font-bold leading-4 text-foreground">
        Perfil do colecionador
      </h1>

      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <TextField
          label="Nome de exibição"
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <TextField
          label="Nome de usuário"
          name="username"
          required
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={errors.username}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <EnsField label="Nome ENS" value={ens} onChange={setEns} error={errors.ens} />
        <TextField
          label="Apelido da carteira"
          name="walletNickname"
          autoComplete="off"
          value={walletNickname}
          onChange={(event) => setWalletNickname(event.target.value)}
          error={errors.walletNickname}
        />
        <AvatarControls profile={profile} />
      </div>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-6 text-base font-medium leading-4 text-foreground">Alterar senha</legend>
        <div className="grid max-w-[417px] gap-6">
          <PasswordField
            label="Senha atual"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            error={errors.currentPassword}
          />
          <PasswordField
            label="Nova senha"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            error={errors.newPassword}
          />
          <PasswordField
            label="Confirmar nova senha"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={errors.confirmPassword}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <PrimaryButton disabled={pending} className="w-[131px]">
          {pending ? "Salvando…" : "Salvar"}
        </PrimaryButton>
        {failure ? (
          <p role="alert" className="text-sm text-text-coral">
            {failure}
          </p>
        ) : null}
        {changePassword.error ? (
          <p role="alert" className="text-sm text-text-coral">
            Nenhuma alteração foi salva: corrija os campos de senha e salve de novo.
          </p>
        ) : null}
        {passwordSaved && !saved ? (
          <p role="status" className="text-sm text-text-secondary">
            Senha alterada. Os dados do perfil não foram salvos: corrija os campos indicados e salve de novo.
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-text-secondary">
            {passwordSaved ? "Perfil e senha salvos." : "Alterações salvas."}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function ProfilePage() {
  const profile = useProfile();

  return (
    <AccountLayout active="profile">
      {profile.data ? (
        // A chave recarrega o formulário se o perfil vier de outra conta.
        <ProfileForm key={profile.data.id} profile={profile.data} />
      ) : profile.isError ? (
        <p role="alert" className="text-sm text-text-coral">
          Não foi possível carregar seu perfil. Tente novamente.
        </p>
      ) : (
        <p role="status" className="text-sm text-text-secondary">
          Carregando perfil…
        </p>
      )}
    </AccountLayout>
  );
}
