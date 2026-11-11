import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { AppError } from "@/lib/glpi/errors";
import { redis } from "./redis";

export const COOKIE_NAME = "incidencias_session";
export type Session = {
  glpiToken: string;
  userId: number;
  displayName: string;
  profileName: string;
  entityName: string;
  rights: { ticket: number; followup: number };
  createdAt: number;
  absoluteExpiresAt: number;
};

function key(id: string) {
  return `session:${createHmac("sha256", getConfig().SESSION_SECRET).update(id).digest("hex")}`;
}

function isSecureCookie() {
  const config = getConfig();
  return config.APP_ORIGIN
    ? config.APP_ORIGIN.split(",").every((origin) => new URL(origin.trim()).protocol === "https:")
    : config.NODE_ENV === "production";
}

export async function createSession(data: Omit<Session, "createdAt" | "absoluteExpiresAt">) {
  const config = getConfig();
  const id = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: Session = {
    ...data,
    createdAt: now,
    absoluteExpiresAt: now + config.SESSION_ABSOLUTE_HOURS * 3_600_000,
  };
  await (
    await redis()
  ).set(key(id), JSON.stringify(session), { EX: config.SESSION_IDLE_MINUTES * 60 });
  (await cookies()).set(COOKIE_NAME, id, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "strict",
    path: "/",
    maxAge: config.SESSION_ABSOLUTE_HOURS * 3600,
  });
}

export async function getSession(): Promise<Session> {
  const id = (await cookies()).get(COOKIE_NAME)?.value;
  if (!id) throw new AppError("SESSION_EXPIRED", "Debes iniciar sesion", 401);
  const client = await redis();
  const raw = await client.get(key(id));
  if (!raw) throw new AppError("SESSION_EXPIRED", "La sesion ha caducado", 401);
  const session = JSON.parse(raw) as Session;
  const remaining = session.absoluteExpiresAt - Date.now();
  if (remaining <= 0) {
    await destroySession(false);
    throw new AppError("SESSION_EXPIRED", "La sesion ha caducado", 401);
  }
  const idle = getConfig().SESSION_IDLE_MINUTES * 60;
  await client.expire(key(id), Math.min(idle, Math.ceil(remaining / 1000)));
  return session;
}

export async function destroySession(clearCookie = true) {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;
  if (id) await (await redis()).del(key(id));
  if (clearCookie)
    store.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
}

export async function idempotencyKey(ticketId: number, digest: string) {
  const id = (await cookies()).get(COOKIE_NAME)?.value;
  if (!id) throw new AppError("SESSION_EXPIRED", "Debes iniciar sesion", 401);
  return `idempotency:${createHmac("sha256", getConfig().SESSION_SECRET).update(`${id}:${ticketId}:${digest}`).digest("hex")}`;
}
