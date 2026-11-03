import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { readApiError } from "./errors";

describe("readApiError", () => {
  it("lê code e message de data.error", () => {
    const error = new AxiosError("Request failed");
    error.response = {
      data: { error: { code: "unauthorized", message: "sessão inválida" } },
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config: error.config!,
    };

    expect(readApiError(error)).toEqual({
      code: "unauthorized",
      message: "sessão inválida",
    });
  });

  it("devolve unknown para Error comum", () => {
    expect(readApiError(new Error("boom"))).toMatchObject({ code: "unknown" });
  });
});
