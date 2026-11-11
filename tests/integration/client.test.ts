import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.GLPI_BASE_URL = "https://glpi.test/glpi";
  process.env.GLPI_ALLOW_HTTP = "false";
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
});

afterEach(() => vi.unstubAllGlobals());

describe("GLPI HTTP adapter", () => {
  it("uses Basic auth at initSession without exposing credentials in URL or body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ session_token: "opaque" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { initSession } = await import("@/lib/glpi/client");
    await expect(initSession("tecnico", "clave")).resolves.toBe("opaque");
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://glpi.test/glpi/apirest.php/initSession");
    expect(request.body).toBeUndefined();
    expect(request.headers.Authorization).toMatch(/^Basic /);
    expect(JSON.stringify(request)).not.toContain("clave");
  });

  it("maps an invalid GLPI session to a safe application error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(["ERROR_SESSION_TOKEN_INVALID", "sensitive detail"]), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { glpiRequest } = await import("@/lib/glpi/client");
    await expect(glpiRequest("getFullSession", { token: "hidden" })).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
      status: 401,
      message: "La sesion ha caducado",
    });
  });
});
