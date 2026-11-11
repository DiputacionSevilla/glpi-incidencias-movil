import { describe, expect, it } from "vitest";
import { buildTicketSearch, resolveSearchOptions } from "@/lib/glpi/search-options";

const fixture = {
  1: { field: "name", name: "Titulo", table: "glpi_tickets" },
  2: { field: "id", name: "ID", table: "glpi_tickets" },
  3: { field: "priority", name: "Prioridad", table: "glpi_tickets" },
  4: { field: "name", name: "Solicitante", table: "glpi_users" },
  5: { field: "name", name: "Tecnico", table: "glpi_users" },
  12: { field: "status", name: "Estado", table: "glpi_tickets" },
  15: { field: "date", name: "Fecha", table: "glpi_tickets" },
  19: { field: "date_mod", name: "Modificada", table: "glpi_tickets" },
  83: { field: "completename", name: "Ubicacion", table: "glpi_locations" },
};

describe("dynamic search options", () => {
  it("resolves fields by semantics, not assumed IDs", () => {
    expect(resolveSearchOptions(fixture)).toEqual({
      id: "2",
      title: "1",
      priority: "3",
      requester: "4",
      technician: "5",
      status: "12",
      opened: "15",
      updated: "19",
      location: "83",
    });
  });

  it("builds assigned, open, oldest-first pagination", () => {
    const query = buildTicketSearch(resolveSearchOptions(fixture), 42, 20, 20);
    expect(query.get("range")).toBe("20-39");
    expect(query.get("sort")).toBe("15");
    expect(query.get("order")).toBe("ASC");
    expect(query.get("criteria[0][field]")).toBe("5");
    expect(query.get("criteria[0][value]")).toBe("42");
    expect(query.get("criteria[1][link]")).toBe("AND");
    expect(query.get("criteria[1][criteria][0][value]")).toBe("1");
    expect(query.get("criteria[1][criteria][1][link]")).toBe("OR");
    expect(query.get("criteria[1][criteria][3][value]")).toBe("4");
    expect(query.get("criteria[2][value]")).toBeNull();
  });

  it("adds explicit status, priority, date and text filters", () => {
    const query = buildTicketSearch(resolveSearchOptions(fixture), 42, 0, 20, {
      status: "closed",
      priority: "high",
      openedFrom: "2026-01-01",
      openedTo: "2026-01-31",
      query: "impresora",
    });
    expect(query.get("criteria[1][value]")).toBe("6");
    expect(query.get("criteria[2][value]")).toBe("4");
    expect(query.get("criteria[3][searchtype]")).toBe("morethan");
    expect(query.get("criteria[4][searchtype]")).toBe("lessthan");
    expect(query.get("criteria[5][field]")).toBe("1");
    expect(query.get("criteria[5][searchtype]")).toBe("contains");
  });

  it("fails explicitly when required metadata is absent", () => {
    expect(() => resolveSearchOptions({})).toThrow(/ID/);
  });
});
