import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import type { ComponentProps, FormEventHandler, ReactNode } from "react";
import close from "@/assets/auth/close.svg";
import facebook from "@/assets/auth/facebook.svg";
import google1 from "@/assets/auth/google-1.svg";
import google2 from "@/assets/auth/google-2.svg";
import google3 from "@/assets/auth/google-3.svg";
import google4 from "@/assets/auth/google-4.svg";
import google5 from "@/assets/auth/google-5.svg";
import google6 from "@/assets/auth/google-6.svg";
import google7 from "@/assets/auth/google-7.svg";
import hide from "@/assets/auth/hide.svg";

type Mode = "login" | "register";

type AuthCardProps = {
  mode: Mode;
  title: string;
  subtitle: string;
  redirect?: string;
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  footerLink: ReactNode;
};

const tabBase = "text-xl font-medium";

/** Card de acesso. No desktop segue o modal (500px); no mobile vira página corrida. */
export function AuthCard({ mode, title, subtitle, redirect, children, onSubmit, footerLink }: AuthCardProps) {
  return (
    <div className="flex justify-center py-8 sm:py-0">
      <section
        aria-labelledby="auth-title"
        className="relative flex w-full max-w-[500px] flex-col gap-10 sm:gap-0 sm:bg-surface-card sm:pb-12"
      >
        <Link
          to="/"
          aria-label="Fechar"
          className="hidden"
        >
          <img src={close} alt="" width={18} height={18} className="block" />
        </Link>

        <div className="hidden flex-col items-center gap-10 px-12 pt-12 sm:flex">
          <nav aria-label="Acesso" className="flex items-center gap-2">
            <Link
              to="/login"
              search={{ redirect }}
              aria-current={mode === "login" ? "page" : undefined}
              className={`${tabBase} ${mode === "login" ? "text-text-accent" : "text-foreground"}`}
            >
              Entrar
            </Link>
            <span aria-hidden="true" className="h-5 w-px bg-text-coral" />
            <Link
              to="/register"
              search={{ redirect }}
              aria-current={mode === "register" ? "page" : undefined}
              className={`${tabBase} ${mode === "register" ? "text-text-accent" : "text-foreground"}`}
            >
              Criar conta
            </Link>
          </nav>
          <p className="text-center text-[13px] leading-4 text-foreground">{subtitle}</p>
        </div>

        <h1
          id="auth-title"
          className="text-center text-xl font-bold leading-4 text-foreground sm:sr-only"
        >
          {title}
        </h1>

        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-10 sm:gap-0">
          {children}
          <SocialBlock />
        </form>

        <p className="text-center text-[15px] text-text-secondary sm:hidden">{footerLink}</p>
      </section>
    </div>
  );
}

const inputClass =
  "h-[50px] w-full rounded-[10px] border border-border bg-transparent px-4 text-sm text-foreground placeholder:text-kurio-secondary focus:border-primary focus:outline-none aria-[invalid=true]:border-destructive sm:h-10 sm:rounded-[5px]";

type FieldShared = {
  label: string;
  error?: string;
  /** ids adicionais (por exemplo, o erro geral do formulário) ligados ao campo. */
  describedBy?: string;
};

type FieldProps = FieldShared & Omit<ComponentProps<"input">, "id" | "aria-describedby">;

export function Field({ label, error, describedBy, name, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const described = [error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        {...props}
        id={id}
        name={name}
        placeholder={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={`${inputClass} ${props.className ?? ""}`}
      />
      {error ? (
        <p id={errorId} className="text-xs leading-4 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({ label, error, describedBy, name, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);
  const described = [error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center"
        >
          <img
            src={hide}
            alt=""
            width={19}
            height={15}
            className={`block max-w-none ${visible ? "opacity-100" : "opacity-60"}`}
          />
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-xs leading-4 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-sm leading-5 text-destructive">
      {children}
    </p>
  );
}

export function FormFields({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:px-20 sm:pt-6">{children}</div>;
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <div className="sm:px-20 sm:pt-6">
      <button
        type="submit"
        disabled={pending}
        className="flex h-[60px] w-full items-center justify-center rounded-[10px] bg-primary text-base font-bold text-ink disabled:opacity-60 sm:h-[45px] sm:rounded-[5px]"
      >
        {children}
      </button>
    </div>
  );
}

const socialButtonClass =
  "flex h-10 w-full items-center justify-center gap-3 rounded-[5px] border border-border text-[13px] font-medium leading-4 text-text-secondary disabled:cursor-not-allowed";

function GooglePiece({ src, position }: { src: string; position: string }) {
  return (
    <span className={`absolute ${position}`}>
      <img src={src} alt="" className="absolute inset-0 block size-full max-w-none" />
    </span>
  );
}

function GoogleMark() {
  return (
    <span aria-hidden="true" className="relative block size-5 shrink-0 overflow-clip">
      <GooglePiece src={google1} position="inset-[57.68%_17.83%_0_7.11%]" />
      <GooglePiece src={google2} position="bottom-0 left-1/2 right-[17.83%] top-[71.33%]" />
      <GooglePiece src={google3} position="inset-[24.69%_75.25%_24.69%_0]" />
      <GooglePiece src={google4} position="inset-[38.28%_0_11.97%_47.07%]" />
      <GooglePiece src={google5} position="bottom-[11.97%] left-1/2 right-0 top-[38.28%]" />
      <GooglePiece src={google6} position="inset-[0_17.01%_57.68%_7.11%]" />
      <GooglePiece src={google7} position="bottom-[70.51%] left-1/2 right-[17.01%] top-0" />
    </span>
  );
}

/** Login social ainda não existe no backend simulado: os botões ficam desabilitados. */
function SocialBlock() {
  return (
    <div className="flex flex-col gap-3 sm:pt-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <p className="whitespace-nowrap text-[13px] leading-4 text-foreground">Ou continue com</p>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-4 sm:px-20">
        <button type="button" disabled title="Em breve" className={socialButtonClass}>
          <GoogleMark />
          Continuar com Google
        </button>
        <button type="button" disabled title="Em breve" className={socialButtonClass}>
          <img src={facebook} alt="" width={20} height={20} className="block shrink-0" />
          Continuar com Facebook
        </button>
      </div>
    </div>
  );
}
