import "server-only";
import { getConfig } from "@/lib/config";
import { AppError } from "./errors";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  basic?: string;
  body?: unknown;
  retry?: boolean;
};

function classify(status: number, body: unknown): AppError {
  const text = JSON.stringify(body).toUpperCase();
  if (text.includes("LOGIN") || (status === 400 && text.includes("CREDENTIAL")))
    return new AppError("AUTH_INVALID", "Usuario o contrasena incorrectos", 401);
  if (status === 401 || text.includes("SESSION_TOKEN_INVALID"))
    return new AppError("SESSION_EXPIRED", "La sesion ha caducado", 401);
  if (status === 403)
    return new AppError("FORBIDDEN", "No tienes permiso para realizar esta accion", 403);
  if (status === 404) return new AppError("NOT_FOUND", "La incidencia no esta disponible", 404);
  return new AppError("UNAVAILABLE", "GLPI no esta disponible temporalmente", 503);
}

export async function glpiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const config = getConfig();
  const method = options.method ?? "GET";
  const execute = async () => {
    let response: Response;
    try {
      response = await fetch(`${config.GLPI_BASE_URL.replace(/\/$/, "")}/apirest.php/${path}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(config.GLPI_APP_TOKEN ? { "App-Token": config.GLPI_APP_TOKEN } : {}),
          ...(options.token ? { "Session-Token": options.token } : {}),
          ...(options.basic ? { Authorization: `Basic ${options.basic}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        signal: AbortSignal.timeout(config.GLPI_TIMEOUT_MS),
      });
    } catch (error) {
      console.error(JSON.stringify({ level: "error", event: "glpi_fetch_error", path, error: error instanceof Error ? error.message : String(error) }));
      throw new AppError("UNAVAILABLE", "No se ha podido conectar con GLPI", 503);
    }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(JSON.stringify({ level: "error", event: "glpi_response", path, status: response.status, body: data }));
      throw classify(response.status, data);
    }
    return { data: data as T, headers: response.headers };
  };
  try {
    return await execute();
  } catch (error) {
    if (
      method === "GET" &&
      options.retry !== false &&
      error instanceof AppError &&
      error.code === "UNAVAILABLE"
    )
      return execute();
    throw error;
  }
}

export async function initSession(username: string, password: string) {
  const basic = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  const { data } = await glpiRequest<{ session_token?: string }>("initSession", {
    basic,
    retry: false,
  });
  if (!data.session_token)
    throw new AppError("INVALID_RESPONSE", "GLPI devolvio una respuesta no valida", 502);
  return data.session_token;
}

export async function killSession(token: string) {
  await glpiRequest("killSession", { token, retry: false });
}
