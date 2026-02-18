import { NextResponse } from "next/server";

import { ApiError, toErrorResponse } from "@/lib/api/errors";
import { logError, logInfo } from "@/lib/observability/logger";
import { createRequestContext } from "@/lib/observability/request-context";

export async function withApiHandler<T>(
  request: Request,
  handler: (context: { requestId: string; route: string; startedAt: number }) => Promise<T>,
): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const data = await handler(context);
    const latency = Date.now() - context.startedAt;

    logInfo("request_completed", {
      request_id: context.requestId,
      route: context.route,
      status_code: 200,
      latency_ms: latency,
    });

    return NextResponse.json(data, {
      headers: {
        "x-request-id": context.requestId,
      },
    });
  } catch (error) {
    const latency = Date.now() - context.startedAt;
    const response = toErrorResponse(error, context.requestId);

    logError("request_failed", {
      request_id: context.requestId,
      route: context.route,
      status_code: response.status,
      latency_ms: latency,
      error_code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
      error,
    });

    response.headers.set("x-request-id", context.requestId);
    return response;
  }
}
