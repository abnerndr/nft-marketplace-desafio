import { useId, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import hide from "@/assets/auth/hide.svg";
import selectArrow from "@/assets/account/select-arrow.svg";

const controlClass =
  "h-10 w-full rounded-[3px] border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-kurio-secondary focus-visible:border-primary focus-visible:outline-none aria-[invalid=true]:border-text-coral";

type FieldFrameProps = {
  id: string;
  label: string;
  required?: boolean;
  /** Mantém o rótulo para leitores de tela quando o desenho mostra só o placeholder. */
  hideLabel?: boolean;
  error?: string;
  children: ReactNode;
};

/** Rótulo, controle e mensagem de erro. O controle recebe `id`, `aria-invalid` e `aria-describedby`. */
function FieldFrame({ id, label, required, hideLabel, error, children }: FieldFrameProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "flex items-center text-[15px] leading-[15px] text-foreground"}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-[22px] leading-[15px] text-text-coral">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs leading-4 text-text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = {
  label: string;
  error?: string;
  required?: boolean;
  hideLabel?: boolean;
} & Omit<ComponentProps<"input">, "id" | "aria-invalid" | "aria-describedby">;

export function TextField({ label, error, required, hideLabel, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} required={required} hideLabel={hideLabel} error={error}>
      <input
        {...props}
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${controlClass} ${className ?? ""}`}
      />
    </FieldFrame>
  );
}

export function PasswordField({ label, error, required, hideLabel, ...props }: TextFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldFrame id={id} label={label} required={required} hideLabel={hideLabel} error={error}>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${controlClass} pr-11`}
        />
        <button
          type="button"
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center"
        >
          <img src={hide} alt="" className={`block max-w-none ${visible ? "opacity-100" : "opacity-60"}`} />
        </button>
      </div>
    </FieldFrame>
  );
}

type SelectFieldProps = {
  label: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  children: ReactNode;
} & Omit<ComponentProps<"select">, "id" | "aria-invalid" | "aria-describedby" | "children">;

export function SelectField({ label, error, required, placeholder, children, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} required={required} error={error}>
      <div className="relative">
        <select
          {...props}
          id={id}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${controlClass} appearance-none bg-ink pr-10 ${props.value === "" ? "text-kurio-secondary" : ""}`}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {children}
        </select>
        <img
          src={selectArrow}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        />
      </div>
    </FieldFrame>
  );
}

/** Nome ENS: sufixo `.eth` em seletor e o nome em campo ao lado. */
export function EnsField({
  label,
  error,
  value,
  onChange,
}: {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const suffixId = `${id}-suffix`;
  return (
    <FieldFrame id={id} label={label} error={error}>
      <div className="flex gap-2.5">
        <div className="relative w-[78px] shrink-0">
          <select
            id={suffixId}
            aria-label="Domínio do nome ENS"
            defaultValue=".eth"
            className={`${controlClass} appearance-none bg-ink pl-2.5 pr-6`}
          >
            <option value=".eth">.eth</option>
          </select>
          <img
            src={selectArrow}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2"
          />
        </div>
        <input
          id={id}
          name="ens"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${controlClass} min-w-0 flex-1`}
        />
      </div>
    </FieldFrame>
  );
}

export function PrimaryButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="submit"
      {...props}
      className={`flex h-10 items-center justify-center rounded-[3px] bg-primary px-6 text-sm font-bold leading-4 text-ink disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
    />
  );
}
