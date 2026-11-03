import { describe, expect, it } from "vitest";
import { addEth, formatEth, mulEth } from "./money";

describe("money", () => {
  it("soma strings decimais sem perder precisão", () => {
    expect(addEth("0.10", "0.20")).toBe("0.30");
    expect(mulEth("1.19", 3)).toBe("3.57");
    expect(formatEth("1.1900")).toBe("1.19 ETH");
  });
});
