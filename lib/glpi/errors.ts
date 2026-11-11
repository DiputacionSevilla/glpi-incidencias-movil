export type ErrorCode =
  | "AUTH_INVALID"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "CONFIGURATION";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public correlationId = crypto.randomUUID(),
  ) {
    super(message);
  }
}

export function publicError(error: unknown) {
  const known =
    error instanceof AppError
      ? error
      : new AppError("UNAVAILABLE", "Servicio temporalmente no disponible", 503);
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_failed",
      code: known.code,
      status: known.status,
      correlationId: known.correlationId,
    }),
  );
  return {
    error: { code: known.code, message: known.message, correlationId: known.correlationId },
  };
}
