import { NextResponse } from "next/server";

import type { ApiErrorCode } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse<{ error: { code: ApiErrorCode; message: string; requestId: string } }> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
        },
      },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
        requestId,
      },
    },
    { status: 500 },
  );
}
