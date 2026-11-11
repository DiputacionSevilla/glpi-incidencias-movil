import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ticket = {
  id: 7,
  title: "Fallo en impresora",
  openedAt: "2026-08-01T08:00:00Z",
  updatedAt: "2026-08-02T08:00:00Z",
  status: "processing",
  priority: "high",
  locationName: "Casa consistorial",
  ageLabel: "Abierta hace 4 dias",
};

test("login, oldest-first list and detail annotation flow", async ({ page }) => {
  await page.addInitScript(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });
  await page.route("**/api/auth/login", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: { displayName: "tecnico", profileName: "Tecnico", entityName: "Ayuntamiento" },
    }),
  );
  let ticketQuery = "";
  await page.route("**/api/tickets?**", (route) => {
    ticketQuery = route.request().url();
    return route.fulfill({
      json: {
        tickets: [ticket, { ...ticket, id: 9, title: "Red", openedAt: "2026-08-03T08:00:00Z" }],
        total: 2,
      },
    });
  });
  await page.route("**/api/tickets/7", (route) =>
    route.fulfill({
      json: {
        ...ticket,
        descriptionText: "No imprime",
        assignedTechnicians: [{ id: 3, name: "Tecnico" }],
        followups: [],
        allowedActions: {
          addFollowup: true,
          addPrivateFollowup: false,
          resolve: true,
          close: true,
        },
      },
    }),
  );
  await page.route("**/api/tickets/9", (route) =>
    route.fulfill({
      json: {
        ...ticket,
        id: 9,
        title: "Red",
        descriptionText: "Sin conexion",
        assignedTechnicians: [{ id: 3, name: "Tecnico" }],
        followups: [],
        allowedActions: {
          addFollowup: true,
          addPrivateFollowup: false,
          resolve: true,
          close: true,
        },
      },
    }),
  );
  let followupPosts = 0;
  await page.route("**/api/tickets/7/followups", async (route) => {
    followupPosts++;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ status: 201, json: { id: 1 } });
  });
  let closePosts = 0;
  await page.route("**/api/tickets/7/close", async (route) => {
    closePosts++;
    await route.fulfill({ json: { status: "closed" } });
  });

  await page.goto("/login");
  await page.getByLabel("Usuario").fill("tecnico");
  await page.getByLabel("Contrasena").fill("clave");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/incidencias$/);
  await expect(page.locator(".ticketId")).toHaveText(["#7", "#9"]);
  await page.getByRole("tab", { name: /Filtros/ }).click();
  await page.getByLabel("Estado").selectOption("closed");
  await page.getByLabel("ID o texto del titulo").fill("impresora");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByRole("tab", { name: /Incidencias/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect.poll(() => ticketQuery).toContain("status=closed");
  expect(ticketQuery).toContain("query=impresora");
  await page.getByRole("link", { name: /Fallo en impresora/ }).click();
  await expect(page.getByRole("heading", { name: "Fallo en impresora" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Siguiente incidencia" })).toBeVisible();
  await page.getByRole("link", { name: "Siguiente incidencia" }).click();
  await expect(page).toHaveURL(/\/incidencias\/9\?.*status=closed.*query=impresora/);
  await expect(page.getByRole("heading", { name: "Red" })).toBeVisible();
  await page.getByRole("link", { name: "Incidencia anterior" }).click();
  await expect(page.getByRole("heading", { name: "Fallo en impresora" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Anotar" }).click();
  await expect(page.getByText("Dictado no disponible")).toBeVisible();
  await page.getByLabel("Anotacion publica").fill("Comprobada y reiniciada");
  const save = page.getByRole("button", { name: "Guardar anotacion" });
  await save.dblclick();
  await expect.poll(() => followupPosts).toBe(1);
  await expect(page.getByRole("dialog", { name: "Nueva anotacion" })).toBeHidden();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByLabel("Anotacion de cierre").fill("Trabajo completado");
  await page.getByRole("button", { name: "Cerrar incidencia" }).click();
  await expect.poll(() => closePosts).toBe(1);
  await expect(page).toHaveURL(/\/incidencias\?completada=1$/);
});

test("login is keyboard accessible at small viewport", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Usuario")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Mostrar" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Incidencias" })).toBeVisible();
});
