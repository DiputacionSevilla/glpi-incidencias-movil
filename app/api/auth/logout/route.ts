import { assertSameOrigin, errorResponse, json } from "@/lib/auth/request";
import { destroySession, getSession } from "@/lib/auth/session";
import { killSession } from "@/lib/glpi/client";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession().catch(() => undefined);
    if (session) await killSession(session.glpiToken).catch(() => undefined);
    await destroySession();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
