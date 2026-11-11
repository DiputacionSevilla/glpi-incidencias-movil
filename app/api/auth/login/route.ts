import { initSession, glpiRequest, killSession } from "@/lib/glpi/client";
import { createSession } from "@/lib/auth/session";
import { assertSameOrigin, errorResponse, json } from "@/lib/auth/request";
import { redis } from "@/lib/auth/redis";
import { loginSchema } from "@/lib/validation/schemas";
import { AppError } from "@/lib/glpi/errors";
import { getGlpiUserId } from "@/lib/glpi/session-context";

export async function POST(request: Request) {
  let token: string | undefined;
  try {
    assertSameOrigin(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const client = await redis();
    const rateKey = `login-rate:${ip}`;
    const attempts = await client.incr(rateKey);
    if (attempts === 1) await client.expire(rateKey, 60);
    if (attempts > 8) throw new AppError("FORBIDDEN", "Demasiados intentos. Espera un minuto", 429);
    const body = loginSchema.parse(await request.json());
    token = await initSession(body.username, body.password);
    const { data } = await glpiRequest<{ session?: Record<string, unknown> }>("getFullSession", {
      token,
    });
    const session = (data.session ?? data) as Record<string, unknown>;
    const profile = session.glpiactiveprofile as Record<string, unknown> | undefined;
    const userId = getGlpiUserId(session);
    if (!profile) throw new AppError("INVALID_RESPONSE", "GLPI no devolvio el perfil activo", 502);
    await createSession({
      glpiToken: token,
      userId,
      displayName: body.username,
      profileName: String(profile.name ?? "Perfil GLPI"),
      entityName: String(session.glpiactive_entity_name ?? "Entidad GLPI"),
      rights: { ticket: Number(profile.ticket ?? 0), followup: Number(profile.followup ?? 0) },
    });
    token = undefined;
    await client.del(rateKey);
    return json({ ok: true });
  } catch (error) {
    if (token) await killSession(token).catch(() => undefined);
    return errorResponse(error);
  }
}
