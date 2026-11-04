import { describe, expect, it } from "vitest";
import { addEth, formatEth, mulEth, mulEthRate, subEth } from "./money";

describe("money", () => {
  it("soma strings decimais sem perder precisão", () => {
    expect(addEth("0.10", "0.20")).toBe("0.30");
    expect(mulEth("1.19", 3)).toBe("3.57");
    expect(formatEth("1.1900")).toBe("1.19 ETH");
  });

  it("aplica taxa percentual e apresenta casas completas", () => {
    expect(mulEthRate("2.38", "0.10")).toBe("0.238");
    expect(subEth(addEth("2.38", "0.02"), "0.238")).toBe("2.162");
    expect(formatEth("0.00001")).toBe("0.00001 ETH");
    expect(mulEth("0.000000000000000001", 3)).toBe("0.000000000000000003");
  });

  it("rejeita quantidade fracionária e escala acima de 18 casas", () => {
    expect(() => mulEth("1.19", 1.1)).toThrow(/quantity/);
    expect(() => formatEth("0.1234567890123456789")).toThrow(/18/);
  });
});
