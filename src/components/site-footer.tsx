import { Link } from "@tanstack/react-router";
import type { FormEvent, ReactNode } from "react";
import facebook from "@/assets/footer/facebook.svg";
import instagram from "@/assets/footer/instagram.svg";
import linkedin from "@/assets/footer/linkedin.svg";
import twitter from "@/assets/footer/twitter.svg";
import youtube from "@/assets/footer/youtube.svg";

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

const linkColumns = [
  {
    title: "Meu perfil",
    links: [
      "Meu perfil",
      "Minha coleção",
      "Atividade",
      "Estúdio do criador",
      "Lista de interesse",
    ],
  },
  {
    title: "Central de ajuda",
    links: [
      "Central de ajuda",
      "Como comprar NFTs",
      "Carteira e segurança",
      "Política do mercado",
      "Denunciar item",
    ],
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

function DiaryLink({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <Link to="/" hash="diario" aria-label={label} className={className}>
      {children}
    </Link>
  );
}

export function SiteFooter() {
  function handleNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <footer className="w-full">
      <div className="bg-surface-card">
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-5 py-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 border-primary lg:border-r lg:px-4 lg:first:pl-4"
            >
              <span className="flex size-[74px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-ink">
                {feature.letter}
              </span>
              <p className="text-[17px] font-bold leading-4 text-foreground">
                {feature.title}
              </p>
              <p className="max-w-[204px] text-sm leading-[22px] text-text-secondary">
                {feature.text}
              </p>
            </div>
          ))}
          <div className="flex flex-col gap-3 lg:px-4">
            <p className="text-lg font-bold leading-4 text-foreground">
              Antecipe-se ao próximo lançamento
            </p>
            <form
              onSubmit={handleNewsletter}
              className="flex h-10 items-stretch overflow-hidden rounded-md bg-surface-dark shadow-[0_0_10px_rgba(10,6,4,0.45)]"
            >
              <input
                type="email"
                name="email"
                placeholder="digite seu e-mail..."
                aria-label="E-mail"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-kurio-secondary focus:outline-none"
              />
              <button
                type="submit"
                className="w-[85px] shrink-0 bg-primary pl-4 pr-1 text-lg font-bold text-ink"
              >
                Enviar
              </button>
            </form>
            <p className="text-[13px] leading-[22px] text-text-secondary">
              Receba lançamentos selecionados, histórias de criadores e novidades
              do mercado.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface-dark">
        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-4 px-5 py-6 text-sm leading-[22px] text-foreground md:grid-cols-2 lg:min-h-[88px] lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[92px] lg:py-0">
          <span className="font-bold tracking-[0.1em]">KURIO</span>
          <p>
            Feito para colecionadores,
            <br />
            criadores e cultura
          </p>
          <a href="mailto:contato@email.com">contato@email.com</a>
          <p>+55 11 4002 8922</p>
        </div>
      </div>

      <div className="bg-surface-card">
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-5 py-8 text-foreground md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[124px]">
          {linkColumns.map((column) => (
            <div key={column.title} className="flex flex-col gap-2">
              <p className="text-lg font-bold leading-4">{column.title}</p>
              <ul className="text-sm leading-[30px]">
                {column.links.map((label) => (
                  <li key={label}>
                    <DiaryLink className="hover:text-text-accent">
                      {label}
                    </DiaryLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <p className="text-lg font-bold leading-4">Redes sociais</p>
              <div className="flex items-center gap-2.5">
                {socials.map((social) => (
                  <DiaryLink
                    key={social.label}
                    label={social.label}
                    className="block size-[30px] shrink-0"
                  >
                    <img
                      src={social.icon}
                      alt=""
                      width={32}
                      height={32}
                      className="-m-px block max-w-none"
                    />
                  </DiaryLink>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-lg font-bold leading-4">Carteiras compatíveis</p>
              <p className="flex min-h-[26px] items-center justify-center whitespace-pre rounded-md border border-border-soft bg-surface-dark py-2 pl-2 text-[9px] font-bold tracking-[0.1px] text-text-accent">
                {"METAMASK  •  WALLETCONNECT  •  COINBASE"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="bg-ink py-1 text-center text-sm leading-[30px] text-foreground">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  );
}
