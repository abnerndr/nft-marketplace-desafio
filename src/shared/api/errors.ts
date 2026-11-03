import { isAxiosError } from "axios";
import { apiErrorSchema, type ApiError } from "../domain/contracts";

export function readApiError(error: unknown): ApiError {
  if (isAxiosError(error)) {
    const parsed = apiErrorSchema.safeParse(error.response?.data);
    if (parsed.success) {
      return parsed.data;
    }
  }

  if (error instanceof Error) {
    return { code: "unknown", message: error.message };
  }

  return { code: "unknown", message: "Unexpected error" };
}
