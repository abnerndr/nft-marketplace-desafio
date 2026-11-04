import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { consumeMergeFailure, syncGuestCart } from "@/features/cart/sync";
import { readApiError } from "@/shared/api/errors";
import { AuthCard, Field, FormError, FormFields, PasswordField, SubmitButton } from "./auth-card";
import { safeRedirect, useLogin } from "./session";

const FORM_ERROR_ID = "login-form-error";

export function LoginPage() {
  const router = useRouter();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const login = useLogin();
  const [mergeAlert, setMergeAlert] = useState<string | null>(null);
  const [mergeUserId, setMergeUserId] = useState<string | null>(null);
  const [retryingMerge, setRetryingMerge] = useState(false);

  const error = login.error ? readApiError(login.error) : null;
  const fields = error?.code === "validation" ? (error.fields ?? {}) : {};
  const formError = error && error.code !== "validation" ? error.message : null;

  function finishLogin() {
    router.history.push(safeRedirect(redirect) ?? "/");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    login.mutate(
      { email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") },
      {
        onSuccess: (user) => {
          const failure = consumeMergeFailure();
          if (failure) {
            setMergeAlert(failure);
            setMergeUserId(user.id);
            return;
          }
          finishLogin();
        },
      },
    );
  }

  async function retryMerge() {
    if (!mergeUserId || retryingMerge) return;
    setRetryingMerge(true);
    try {
      await syncGuestCart(mergeUserId);
      setMergeAlert(null);
      finishLogin();
    } catch {
      setMergeAlert(consumeMergeFailure() ?? "Não foi possível sincronizar o carrinho de visitante.");
    } finally {
      setRetryingMerge(false);
    }
  }

  return (
    <AuthCard
      mode="login"
      title="Entrar"
      subtitle="Entre para gerenciar sua carteira, coleção e perfil de criador."
      redirect={redirect}
      onSubmit={handleSubmit}
      footerLink={
        <Link to="/register" search={{ redirect }}>
          Novo na Kurio? Crie uma conta
        </Link>
      }
    >
      <FormFields>
        <Field
          label="contato@email.com"
          name="email"
          type="email"
          autoComplete="email"
          error={fields.email}
          describedBy={formError ? FORM_ERROR_ID : undefined}
        />
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="current-password"
          error={fields.password}
          describedBy={formError ? FORM_ERROR_ID : undefined}
        />
        {formError ? <FormError id={FORM_ERROR_ID}>{formError}</FormError> : null}
        {mergeAlert ? (
          <p role="alert" className="text-sm text-text-coral">
            {mergeAlert}{" "}
            <button type="button" className="underline" disabled={retryingMerge} onClick={() => void retryMerge()}>
              Tentar sincronizar novamente
            </button>
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            type="button"
            disabled
            title="Em breve"
            className="text-sm leading-4 text-text-accent disabled:cursor-not-allowed"
          >
            Esqueceu a senha?
          </button>
        </div>
      </FormFields>
      <SubmitButton pending={login.isPending}>Entrar</SubmitButton>
    </AuthCard>
  );
}
