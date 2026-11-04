import facebook from "@/assets/footer/facebook.svg";
import instagram from "@/assets/footer/instagram.svg";
import linkedin from "@/assets/footer/linkedin.svg";
import twitter from "@/assets/footer/twitter.svg";
import youtube from "@/assets/footer/youtube.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { useId, useState, type FormEvent, type ReactNode } from "react";

const features = [
	{
		letter: "W",
		title: "Segurança da carteira",
		text: "Proteja sua carteira e colecione arte digital verificada com confiança.",
	},
	{
		letter: "C",
		title: "Criadores em destaque",
		text: "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.",
	},
	{
		letter: "D",
		title: "Alertas de lançamentos",
		text: "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
	},
];

const PROFILE_LINK = "Meu perfil";

const linkColumns = [
	{
		title: "Meu perfil",
		links: ["Meu perfil", "Minha coleção", "Estúdio do criador"],
	},
	{
		title: "Central de ajuda",
		links: ["Central de ajuda", "Como comprar NFTs", "Carteira e segurança", "Política do mercado", "Denunciar item"],
	},
	{
		title: "Coleções",
		links: ["Arte digital", "Fotografia", "Música", "Arte 3D", "Utilidade"],
	},
];

const socials = [
	{ label: "Facebook", icon: facebook },
	{ label: "Instagram", icon: instagram },
	{ label: "Twitter", icon: twitter },
	{ label: "LinkedIn", icon: linkedin },
	{ label: "YouTube", icon: youtube },
];

/** Ações editoriais/sociais fora do escopo: comunicam indisponibilidade, sem falso sucesso. */
function UnavailableAction({ children, className, label, onAnnounce }: { children: ReactNode; className?: string; label?: string; onAnnounce: (message: string) => void }) {
	const name = label ?? (typeof children === "string" ? children : "Esta ação");
	return (
		<button type="button" aria-label={`${name} (indisponível nesta demonstração)`} className={className} onClick={() => onAnnounce(`${name} não está disponível nesta demonstração.`)}>
			{children}
		</button>
	);
}

export function SiteFooter() {
	const statusId = useId();
	const [status, setStatus] = useState("");

	function handleNewsletter(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("Inscrição na lista de lançamentos não está disponível nesta demonstração.");
	}

	return (
		<footer className="mx-auto w-full max-w-[1200px]">
			{/* Faixa de features + newsletter — Figma 1:1152 */}
			<div className="bg-surface-card">
				<div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-5 py-8 sm:px-6 lg:h-[250px] lg:flex-row lg:items-end lg:justify-between lg:gap-0 lg:px-8 lg:py-8">
					{features.map((feature, index) => (
						<div key={feature.title} className="contents">
							{index > 0 ? <div aria-hidden="true" className="hidden w-px shrink-0 self-stretch bg-primary lg:block" /> : null}
							<div className={`flex flex-col gap-3 px-0 lg:px-4 ${index === 0 ? "lg:min-w-0 lg:flex-1" : "lg:w-[264.667px] lg:shrink-0"}`}>
								<span className="flex size-[74px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-ink">{feature.letter}</span>
								<p className="text-[17px] font-bold leading-4 text-foreground">{feature.title}</p>
								<p className="max-w-[204px] text-sm leading-[22px] text-text-secondary">{feature.text}</p>
							</div>
						</div>
					))}
					<div aria-hidden="true" className="hidden w-px shrink-0 self-stretch bg-primary lg:block" />
					<div className="flex flex-col gap-3 lg:w-[357px] lg:shrink-0 lg:px-4">
						<p className="text-lg font-bold leading-4 text-foreground">Antecipe-se ao próximo lançamento</p>
						<form onSubmit={handleNewsletter} className="flex h-10 items-stretch overflow-hidden rounded-md bg-surface-dark shadow-[0_0_10px_rgba(10,6,4,0.45)]" aria-describedby={statusId}>
							<Input
								type="email"
								name="email"
								placeholder="digite seu e-mail..."
								aria-label="E-mail"
								className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-sm text-kurio-secondary placeholder:text-kurio-secondary focus-visible:outline-none"
							/>
							<Button type="submit" className="h-full w-[85px] shrink-0 rounded-none rounded-r-md pl-4 pr-1 text-lg font-bold">
								Enviar
							</Button>
						</form>
						<p className="text-[13px] leading-[22px] text-text-secondary lg:h-[89px]">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
						<p id={statusId} role="status" className="text-[13px] text-text-accent">
							{status}
						</p>
					</div>
				</div>
			</div>

			{/* Faixa da marca */}
			<div className="bg-surface-dark">
				<div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-5 py-6 text-sm leading-[22px] text-foreground sm:px-6 md:grid md:grid-cols-2 lg:h-[88px] lg:grid-cols-[1fr_1fr_1fr_228px] lg:items-center lg:gap-[92px] lg:px-8 lg:py-0">
					<span className="py-2 text-sm font-bold tracking-[0.1em]">KURIO</span>
					<p>
						Feito para colecionadores,
						<br />
						criadores e cultura
					</p>
					<a href="mailto:contato@email.com" className="hover:text-text-accent">
						contato@email.com
					</a>
					<p>+55 11 4002 8922</p>
				</div>
			</div>

			{/* Colunas de links */}
			<div className="bg-surface-card">
				<div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-8 text-foreground sm:px-6 md:grid-cols-2 lg:h-[236px] lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[124px] lg:px-8">
					{linkColumns.map((column) => (
						<div key={column.title} className="flex flex-col gap-2">
							<p className="text-lg font-bold leading-4">{column.title}</p>
							<ul className="text-sm leading-[30px]">
								{column.links.map((label) => (
									<li key={label}>
										{label === PROFILE_LINK ? (
											<Link to="/account/profile" className="hover:text-text-accent">
												{label}
											</Link>
										) : (
											<UnavailableAction className="hover:text-text-accent" onAnnounce={setStatus}>
												{label}
											</UnavailableAction>
										)}
									</li>
								))}
							</ul>
						</div>
					))}
					<div className="flex flex-col gap-8">
						<div className="flex w-[190px] flex-col gap-5">
							<p className="text-lg font-bold leading-4">Redes sociais</p>
							<div className="flex items-center gap-2.5">
								{socials.map((social) => (
									<UnavailableAction key={social.label} label={social.label} className="relative block size-[30px] shrink-0" onAnnounce={setStatus}>
										<img src={social.icon} alt="" width={32} height={32} className="-m-px block max-w-none" />
									</UnavailableAction>
								))}
							</div>
						</div>
						<div className="flex flex-col gap-3">
							<p className="text-lg font-bold leading-4">Carteiras compatíveis</p>
							<p className="flex h-[26px] items-center justify-center whitespace-pre rounded-md border border-border-soft bg-surface-dark pl-2 text-[9px] font-bold tracking-[0.1px] text-text-accent">
								{"METAMASK  •  WALLETCONNECT  •  COINBASE"}
							</p>
						</div>
					</div>
				</div>
			</div>

			<p className="bg-ink py-1.5 text-center text-sm leading-[30px] text-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
		</footer>
	);
}
