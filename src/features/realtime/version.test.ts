import { describe, expect, it } from "vitest";
import { shouldApplyVersion } from "./socket";

describe("shouldApplyVersion", () => {
  it("aplica quando não há versão local", () => {
    expect(shouldApplyVersion(undefined, 1)).toBe(true);
  });

  it("aplica versão maior", () => {
    expect(shouldApplyVersion(1, 2)).toBe(true);
  });

  it("ignora versão igual (duplicata)", () => {
    expect(shouldApplyVersion(2, 2)).toBe(false);
  });

  it("ignora versão antiga", () => {
    expect(shouldApplyVersion(3, 2)).toBe(false);
  });
});
