export type ApiError = { error?: { message?: string; code?: string; correlationId?: string } };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.replace(new URL("/login?caducada=1", window.location.href));
    }
    throw new Error(data.error?.message ?? "No se ha podido completar la operacion");
  }
  return data;
}
