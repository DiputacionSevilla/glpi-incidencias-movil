import { redis } from "@/lib/auth/redis";
import { getConfig } from "@/lib/config";
import { json } from "@/lib/auth/request";

export async function GET() {
  try {
    await (await redis()).ping();
    const config = getConfig();
    const response = await fetch(`${config.GLPI_BASE_URL.replace(/\/$/, "")}/apirest.php`, {
      signal: AbortSignal.timeout(config.GLPI_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("GLPI unavailable");
    return json({ status: "ready" });
  } catch {
    return json({ status: "not-ready" }, { status: 503 });
  }
}
