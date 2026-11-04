import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { readApiError } from "@/shared/api/errors";
import { AuthCard, Field, FormError, FormFields, PasswordField, SubmitButton } from "./auth-card";
import { AuthDesktopDialog, useDesktopAuthLayout } from "./auth-dialog";
import { safeRedirect, useRegister } from "./session";

const FORM_ERROR_ID = "register-form-error";

export function RegisterPage() {
  const router = useRouter();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const register = useRegister();
  const desktop = useDesktopAuthLayout();
  const [mismatch, setMismatch] = useState(false);

  const error = register.error ? readApiError(register.error) : null;
  const fields = error?.code === "validation" ? (error.fields ?? {}) : {};
  const formError = error && error.code !== "validation" && error.code !== "conflict" ? error.message : null;
  const emailError = fields.email ?? (error?.code === "conflict" ? error.message : undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirmPassword") ?? "")) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    register.mutate(
      {
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        password,
      },
      {
        onSuccess: () => {
          router.history.push(safeRedirect(redirect) ?? "/");
        },
      },
    );
  }

  const card = (
    <AuthCard
      mode="register"
      title="Criar perfil de colecionador"
      subtitle="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      redirect={redirect}
      onSubmit={handleSubmit}
      footerLink={
        <Link to="/login" search={{ redirect }}>
          Já tem uma conta? Entre
        </Link>
      }
    >
      <FormFields>
        <Field label="Nome de usuário" name="name" autoComplete="nickname" error={fields.name} />
        <Field label="Digite seu e-mail" name="email" type="email" autoComplete="email" error={emailError} />
        <PasswordField label="Senha" name="password" autoComplete="new-password" error={fields.password} />
        <PasswordField
          label="Confirmar senha"
          name="confirmPassword"
          autoComplete="new-password"
          error={mismatch ? "As senhas não conferem." : undefined}
        />
        {formError ? <FormError id={FORM_ERROR_ID}>{formError}</FormError> : null}
      </FormFields>
      <SubmitButton pending={register.isPending}>Criar conta</SubmitButton>
    </AuthCard>
  );

  if (desktop) {
    return (
      <AuthDesktopDialog
        title="Criar perfil de colecionador"
        description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
        redirect={redirect}
      >
        {card}
      </AuthDesktopDialog>
    );
  }

  return card;
}
