import { describe, expect, it } from "vitest";
import { canTransitionOrder } from "./transitions";

describe("canTransitionOrder", () => {
  it("só permite pending → confirmed|declined", () => {
    expect(canTransitionOrder("pending", "confirmed")).toBe(true);
    expect(canTransitionOrder("pending", "declined")).toBe(true);
    expect(canTransitionOrder("confirmed", "pending")).toBe(false);
    expect(canTransitionOrder("declined", "confirmed")).toBe(false);
    expect(canTransitionOrder("confirmed", "declined")).toBe(false);
  });
});
