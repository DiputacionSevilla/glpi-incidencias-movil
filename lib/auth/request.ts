import "server-only";
import { getConfig } from "@/lib/config";
import { AppError, publicError } from "@/lib/glpi/errors";
import { ZodError } from "zod";
import { destroySession } from "./session";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new AppError("FORBIDDEN", "Origen de solicitud no valido", 403);
  const configured = getConfig()
    .APP_ORIGIN?.split(",")
    .map((value) => new URL(value.trim()).origin)
    .filter(Boolean);
  const expected = configured ?? [
    `${request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host")}`,
  ];
  if (!URL.canParse(origin) || !expected.includes(new URL(origin).origin))
    throw new AppError("FORBIDDEN", "Origen de solicitud no valido", 403);
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json");
  return Response.json(data, { ...init, headers });
}

export async function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return json(
      { error: { code: "VALIDATION", message: error.issues[0]?.message ?? "Datos no validos" } },
      { status: 400 },
    );
  }
  if (error instanceof AppError && error.code === "SESSION_EXPIRED") {
    await destroySession().catch(() => undefined);
  }
  const status = error instanceof AppError ? error.status : 503;
  return json(publicError(error), { status });
}
