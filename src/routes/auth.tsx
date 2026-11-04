import { lazy } from "react";
import { LazyRoute } from "@/app/lazy-route";

const LoginPage = lazy(() =>
  import("@/features/auth/login-page").then((mod) => ({ default: mod.LoginPage })),
);

const RegisterPage = lazy(() =>
  import("@/features/auth/register-page").then((mod) => ({ default: mod.RegisterPage })),
);

export function LoginRoute() {
  return (
    <LazyRoute>
      <LoginPage />
    </LazyRoute>
  );
}

export function RegisterRoute() {
  return (
    <LazyRoute>
      <RegisterPage />
    </LazyRoute>
  );
}
