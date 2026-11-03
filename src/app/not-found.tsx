import { Link } from "@tanstack/react-router";

/** Rota desconhecida: tela em português dentro do shell da Kurio, com saída para a home. */
export function NotFoundPage() {
  return (
    <section className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-[28px] font-bold text-foreground">Página não encontrada</h1>
      <p className="text-text-secondary">Esse endereço não existe na Kurio. Confira o link ou volte ao início.</p>
      <Link
        to="/"
        className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-bold text-ink transition-colors hover:bg-text-accent"
      >
        Voltar ao início
      </Link>
    </section>
  );
}
