import { lazy } from "react";
import { LazyRoute } from "@/app/lazy-route";

const ProfilePage = lazy(() =>
  import("@/features/profile/profile-page").then((mod) => ({ default: mod.ProfilePage })),
);

const WalletsPage = lazy(() =>
  import("@/features/wallets/wallets-page").then((mod) => ({ default: mod.WalletsPage })),
);

export function AccountProfileRoute() {
  return (
    <LazyRoute>
      <ProfilePage />
    </LazyRoute>
  );
}

export function AccountWalletsRoute() {
  return (
    <LazyRoute>
      <WalletsPage />
    </LazyRoute>
  );
}
