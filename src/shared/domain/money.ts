import Decimal from "decimal.js";

/** Precisão máxima de transporte ETH (wei-scale). Acima disso rejeitamos em vez de truncar. */
export const MAX_ETH_SCALE = 18;

function assertEthAmount(value: string): Decimal {
  let decimal: Decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new Error("Invalid ETH amount");
  }
  if (!decimal.isFinite()) {
    throw new Error("Invalid ETH amount");
  }
  if (decimal.decimalPlaces() > MAX_ETH_SCALE) {
    throw new Error(`ETH amount exceeds ${MAX_ETH_SCALE} decimal places`);
  }
  return decimal;
}

function decimalPlacesOf(value: string): number {
  const separator = value.indexOf(".");
  if (separator === -1) {
    return 0;
  }

  return value.length - separator - 1;
}

export function addEth(a: string, b: string): string {
  assertEthAmount(a);
  assertEthAmount(b);
  const places = Math.max(decimalPlacesOf(a), decimalPlacesOf(b));
  return new Decimal(a).plus(b).toFixed(places);
}

export function subEth(a: string, b: string): string {
  assertEthAmount(a);
  assertEthAmount(b);
  const places = Math.max(decimalPlacesOf(a), decimalPlacesOf(b));
  return new Decimal(a).minus(b).toFixed(places);
}

/** Multiplica preço por quantidade inteira (≥0). Não usa taxa percentual. */
export function mulEth(amount: string, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("quantity must be a non-negative integer");
  }
  return assertEthAmount(amount).times(quantity).toFixed();
}

/** Aplica taxa/percentual decimal (ex.: cupom 0.10) sem arredondar à escala da entrada. */
export function mulEthRate(amount: string, rate: string): string {
  return assertEthAmount(amount).times(assertEthAmount(rate)).toFixed();
}

export function cmpEth(a: string, b: string): -1 | 0 | 1 {
  const result = assertEthAmount(a).comparedTo(assertEthAmount(b));
  if (result !== -1 && result !== 0 && result !== 1) {
    throw new Error("Invalid ETH amount");
  }

  return result;
}

/** Apresentação decimal completa, sem notação exponencial e sem cortar em 4 casas. */
export function formatEth(amount: string): string {
  return `${assertEthAmount(amount).toFixed()} ETH`;
}
