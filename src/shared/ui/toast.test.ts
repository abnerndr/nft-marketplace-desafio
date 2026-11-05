import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToasts, dismissToast, getToasts, pushToast } from "./toast";

afterEach(() => {
  clearToasts();
  vi.useRealTimers();
});

describe("pushToast", () => {
  it("guarda a mensagem e remove após o tempo", () => {
    vi.useFakeTimers();
    const id = pushToast("Olá", 1000);
    expect(getToasts()).toEqual([{ id, message: "Olá" }]);
    vi.advanceTimersByTime(1000);
    expect(getToasts()).toEqual([]);
  });

  it("mantém no máximo 3 toasts", () => {
    pushToast("a", 60_000);
    pushToast("b", 60_000);
    pushToast("c", 60_000);
    pushToast("d", 60_000);
    expect(getToasts().map((toast) => toast.message)).toEqual(["b", "c", "d"]);
  });

  it("dismiss remove o aviso imediatamente", () => {
    const id = pushToast("x", 60_000);
    dismissToast(id);
    expect(getToasts()).toEqual([]);
  });
});
