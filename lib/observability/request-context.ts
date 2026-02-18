export function buildRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createRequestContext(request: Request): {
  requestId: string;
  route: string;
  startedAt: number;
} {
  return {
    requestId: request.headers.get("x-request-id") || buildRequestId(),
    route: new URL(request.url).pathname,
    startedAt: Date.now(),
  };
}
