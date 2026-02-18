import { ApiError } from "@/lib/api/errors";

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Invalid JSON payload", 400);
  }
}
