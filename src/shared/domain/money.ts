import Decimal from "decimal.js";

function decimalPlacesOf(value: string): number {
  const separator = value.indexOf(".");
  if (separator === -1) {
    return 0;
  }

  return value.length - separator - 1;
}

export function addEth(a: string, b: string): string {
  const places = Math.max(decimalPlacesOf(a), decimalPlacesOf(b));
  return new Decimal(a).plus(b).toFixed(places);
}

export function subEth(a: string, b: string): string {
  const places = Math.max(decimalPlacesOf(a), decimalPlacesOf(b));
  return new Decimal(a).minus(b).toFixed(places);
}

export function mulEth(amount: string, quantity: number): string {
  return new Decimal(amount).times(quantity).toFixed(decimalPlacesOf(amount));
}

export function cmpEth(a: string, b: string): -1 | 0 | 1 {
  const result = new Decimal(a).comparedTo(new Decimal(b));
  if (result !== -1 && result !== 0 && result !== 1) {
    throw new Error("Invalid ETH amount");
  }

  return result;
}

export function formatEth(amount: string): string {
  const fixed = new Decimal(amount).toFixed(4);
  const stripped = fixed.replace(/0+$/, "").replace(/\.$/, "");
  return `${stripped} ETH`;
}
