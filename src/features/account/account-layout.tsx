import divider from "@/assets/account/divider.svg";
import locationActive from "@/assets/account/location-active.svg";
import location from "@/assets/account/location.svg";
import logout from "@/assets/account/logout.svg";
import userActive from "@/assets/account/user-active.svg";
import user from "@/assets/account/user.svg";
import { useLogout } from "@/features/auth/session";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type AccountSection = "profile" | "wallets";

const baseItemClass = "flex items-center gap-3 border-l-[6px] px-4 text-[15px] leading-[45px] text-text-accent hover:bg-surface-dark/40";
const itemClass = `${baseItemClass} border-transparent`;
const activeItemClass = `${baseItemClass} border-primary`;

function Icon({ src }: { src: string }) {
	return (
		<span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
			<img src={src} alt="" className="block max-w-none" />
		</span>
	);
}

function AccountSidebar({ active }: { active: AccountSection }) {
	const navigate = useNavigate();
	const signOut = useLogout();

	function handleSignOut() {
		signOut.mutate(undefined, { onSettled: () => void navigate({ to: "/" }) });
	}

	return (
		<aside className="bg-surface-card py-2 md:w-[310px] md:shrink-0">
			<nav aria-labelledby="account-nav-title">
				<p id="account-nav-title" className="p-2.5 text-lg font-bold leading-4 text-foreground">
					Meu perfil
				</p>
				<ul>
					<li>
						<Link to="/account/profile" aria-current={active === "profile" ? "page" : undefined} className={active === "profile" ? activeItemClass : itemClass}>
							<Icon src={active === "profile" ? userActive : user} />
							Dados do perfil
						</Link>
					</li>
					<li>
						<Link to="/account/wallets" aria-current={active === "wallets" ? "page" : undefined} className={active === "wallets" ? activeItemClass : itemClass}>
							<Icon src={active === "wallets" ? locationActive : location} />
							Carteiras
						</Link>
					</li>
				</ul>
			</nav>
			<img src={divider} alt="" aria-hidden="true" className="block h-px w-full" />
			<button
				type="button"
				onClick={handleSignOut}
				disabled={signOut.isPending}
				className="flex h-10 w-full items-center gap-2 px-4 text-[15px] font-bold leading-[15px] text-text-accent disabled:opacity-60"
			>
				<Icon src={logout} />
				Sair
			</button>
		</aside>
	);
}

/** Menu da conta e conteúdo lado a lado a partir de 768 px; abaixo disso, empilhados. */
export function AccountLayout({ active, children }: { active: AccountSection; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-7 py-8 md:flex-row md:items-start">
			<AccountSidebar active={active} />
			<div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
		</div>
	);
}
