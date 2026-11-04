import { useState } from "react";

/** Só existe com o backend simulado ativo: `window.__kurio` é criado por `enableMocks`. */
function mockControls() {
  return typeof window === "undefined" ? undefined : window.__kurio;
}

/**
 * Painel de cenários do mock. O botão emite `nft.updated` pelo transporte Socket.IO mock:
 * o mock sobe 10% no preço do primeiro item do carrinho (versão + 1) e o cliente recebe o evento
 * pelo mesmo socket que usa em produção. Não escreve no cache.
 */
export function ScenarioPanel() {
  const [open, setOpen] = useState(false);
  const controls = mockControls();
  if (!controls) return null;

  return (
    <aside
      aria-label="Painel de cenários"
      className="fixed bottom-24 left-4 z-50 flex flex-col items-start gap-2 text-sm lg:bottom-4 lg:right-4 lg:left-auto lg:items-end"
    >
      {open ? (
        <div className="flex w-72 flex-col gap-3 rounded-lg border border-white/20 bg-ink p-4 shadow-lg">
          <p className="text-foreground/80">
            Entre e adicione um item ao carrinho. O botão muda o preço do primeiro item pelo Socket.IO.
          </p>
          <button
            type="button"
            className="rounded-md border border-text-accent px-3 py-2 text-text-accent transition-colors hover:bg-text-accent hover:text-ink"
            onClick={() => controls.emit("nft.updated")}
          >
            Mudar preço do 1º item (+10%)
          </button>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        className="rounded-full border border-white/20 bg-ink px-3 py-1.5 text-foreground/80 hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        Cenários
      </button>
    </aside>
  );
}
