import { Link, useRouter, useSearch } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { readApiError } from "@/shared/api/errors";
import { AuthCard, Field, FormError, FormFields, PasswordField, SubmitButton } from "./auth-card";
import { safeRedirect, useLogin } from "./session";

const FORM_ERROR_ID = "login-form-error";

export function LoginPage() {
  const router = useRouter();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const login = useLogin();

  const error = login.error ? readApiError(login.error) : null;
  const fields = error?.code === "validation" ? (error.fields ?? {}) : {};
  const formError = error && error.code !== "validation" ? error.message : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    login.mutate(
      { email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") },
      {
        onSuccess: () => {
          router.history.push(safeRedirect(redirect) ?? "/");
        },
      },
    );
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
