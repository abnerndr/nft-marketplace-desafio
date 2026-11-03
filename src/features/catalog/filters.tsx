import Decimal from "decimal.js";
import { useState } from "react";
import {
  COLLECTION_OPTIONS,
  DEFAULT_MAX_PRICE,
  DEFAULT_MIN_PRICE,
  NETWORK_OPTIONS,
  type CatalogSearch,
} from "./search";
import type { NftList } from "./api";

type FiltersProps = {
  search: CatalogSearch;
  facets: NftList["facets"] | undefined;
  onChange: (patch: Partial<CatalogSearch>) => void;
};

const MIN = Number(DEFAULT_MIN_PRICE);
const MAX = Number(DEFAULT_MAX_PRICE);

function formatPtBr(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toggle<T extends string>(list: readonly T[] | undefined, id: T): T[] {
  const current = list ?? [];
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

type OptionListProps<T extends string> = {
  title: string;
  options: readonly { id: T; label: string }[];
  selected: readonly T[] | undefined;
  counts: Record<string, number> | undefined;
  onToggle: (id: T) => void;
};

function OptionList<T extends string>({
  title,
  options,
  selected,
  counts,
  onToggle,
}: OptionListProps<T>) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-bold leading-4 text-foreground">
        {title}
      </legend>
      <ul className="flex flex-col px-3">
        {options.map((option) => {
          const checked = selected?.includes(option.id) ?? false;
          const count = counts?.[option.id];
          return (
            <li key={option.id}>
              <label
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 text-[15px] ${
                  checked ? "text-text-accent" : "text-text-secondary"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(option.id)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  {option.label}
                </span>
                <span className="font-bold" aria-label={count === undefined ? undefined : `${count} itens`}>
                  ({count ?? "–"})
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function PriceFilter({
  appliedMin,
  appliedMax,
  onApply,
}: {
  appliedMin: string | undefined;
  appliedMax: string | undefined;
  onApply: (min: string | undefined, max: string | undefined) => void;
}) {
  // Rascunho local: a URL só muda no botão "Aplicar".
  const [min, setMin] = useState(Number(appliedMin ?? DEFAULT_MIN_PRICE));
  const [max, setMax] = useState(Number(appliedMax ?? DEFAULT_MAX_PRICE));
  const span = MAX - MIN;
  const left = ((min - MIN) / span) * 100;
  const right = ((max - MIN) / span) * 100;

  function apply() {
    const lo = new Decimal(min).toFixed(2);
    const hi = new Decimal(max).toFixed(2);
    onApply(lo === DEFAULT_MIN_PRICE ? undefined : lo, hi === DEFAULT_MAX_PRICE ? undefined : hi);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-bold leading-4 text-foreground">Faixa de preço</legend>
      <div className="flex flex-col gap-3 pl-3">
        <div className="relative h-[21px] w-full">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border-soft" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${left}%`, right: `${100 - right}%` }}
          />
          <input
            type="range"
            aria-label="Preço mínimo em ETH"
            className="range-thumb"
            min={MIN}
            max={MAX}
            step={0.01}
            value={min}
            onChange={(event) => setMin(Math.min(Number(event.target.value), max))}
          />
          <input
            type="range"
            aria-label="Preço máximo em ETH"
            className="range-thumb"
            min={MIN}
            max={MAX}
            step={0.01}
            value={max}
            onChange={(event) => setMax(Math.max(Number(event.target.value), min))}
          />
        </div>
        <p className="text-[15px] text-foreground">
          Preço: {formatPtBr(min)} - {formatPtBr(max)} ETH
        </p>
        <button
          type="button"
          onClick={apply}
          className="w-fit rounded-md bg-primary px-3 py-2 text-base font-bold leading-5 text-ink hover:bg-text-accent"
        >
          Aplicar
        </button>
      </div>
    </fieldset>
  );
}

export function Filters({ search, facets, onChange }: FiltersProps) {
  return (
    <form
      aria-label="Filtros do catálogo"
      onSubmit={(event) => event.preventDefault()}
      className="flex w-full flex-col gap-10 bg-surface-card p-5 lg:w-[310px]"
    >
      <OptionList
        title="Coleções"
        options={COLLECTION_OPTIONS}
        selected={search.collection}
        counts={facets?.collection}
        onToggle={(id) => onChange({ collection: toggle(search.collection, id) })}
      />
      {/* key: quando minPrice/maxPrice mudam pela URL, o rascunho recomeça deles. */}
      <PriceFilter
        key={`${search.minPrice ?? ""}-${search.maxPrice ?? ""}`}
        appliedMin={search.minPrice}
        appliedMax={search.maxPrice}
        onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
      />
      <OptionList
        title="Rede"
        options={NETWORK_OPTIONS}
        selected={search.network}
        counts={facets?.network}
        onToggle={(id) => onChange({ network: toggle(search.network, id) })}
      />
    </form>
  );
}
