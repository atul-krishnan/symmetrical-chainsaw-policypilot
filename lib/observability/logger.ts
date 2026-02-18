import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type LogContext = {
  request_id: string;
  route: string;
  org_id?: string;
  user_id?: string;
  event?: string;
  status_code?: number;
  latency_ms?: number;
  error_code?: string;
};

export function logInfo(message: string, context: LogContext): void {
  logger.info(context, message);
}

export function logError(message: string, context: LogContext & { error?: unknown }): void {
  logger.error(context, message);
}
