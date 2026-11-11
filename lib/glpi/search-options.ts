import "server-only";
import { AppError } from "./errors";
import { glpiRequest } from "./client";

export type SearchMap = {
  id: string;
  title: string;
  opened: string;
  updated: string;
  status: string;
  priority: string;
  requester: string;
  technician: string;
  location: string;
};
export type TicketSearchFilters = {
  status: "open" | "all" | "new" | "processing" | "planned" | "pending" | "solved" | "closed";
  priority: "all" | "very-low" | "low" | "medium" | "high" | "very-high" | "major";
  openedFrom?: string;
  openedTo?: string;
  query: string;
};
type Option = { field?: string; name?: string; table?: string };
let cache: { expires: number; value: SearchMap } | undefined;

export function resolveSearchOptions(raw: Record<string, Option>): SearchMap {
  const entries = Object.entries(raw);
  const find = (test: (option: Option) => boolean, label: string) => {
    const result = entries.find(([, option]) => test(option));
    if (!result)
      throw new AppError("CONFIGURATION", `GLPI no publica la opcion de busqueda: ${label}`, 503);
    return result[0];
  };
  const ticket = (field: string) => (option: Option) =>
    option.table === "glpi_tickets" && option.field === field;
  return {
    id: find(ticket("id"), "ID"),
    title: find(ticket("name"), "titulo"),
    opened: find(ticket("date"), "fecha de apertura"),
    updated: find(ticket("date_mod"), "ultima actualizacion"),
    status: find(ticket("status"), "estado"),
    priority: find(ticket("priority"), "prioridad"),
    requester: find(
      (o) => o.table === "glpi_users" && o.field === "name" && /solicitante/i.test(o.name ?? ""),
      "solicitante",
    ),
    technician: find(
      (o) => o.table === "glpi_users" && o.field === "name" && /^t[eé]cnico$/i.test(o.name ?? ""),
      "tecnico",
    ),
    location: find((o) => o.table === "glpi_locations" && o.field === "completename", "ubicacion"),
  };
}

export async function getSearchOptions(token: string): Promise<SearchMap> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const { data } = await glpiRequest<Record<string, Option>>("listSearchOptions/Ticket", { token });
  const value = resolveSearchOptions(data);
  cache = { value, expires: Date.now() + 60 * 60 * 1000 };
  return value;
}

const statusIds = {
  new: "1",
  processing: "2",
  planned: "3",
  pending: "4",
  solved: "5",
  closed: "6",
};
const priorityIds = {
  "very-low": "1",
  low: "2",
  medium: "3",
  high: "4",
  "very-high": "5",
  major: "6",
};

export function buildTicketSearch(
  map: SearchMap,
  userId: number,
  start: number,
  size: number,
  filters: TicketSearchFilters = { status: "open", priority: "all", query: "" },
) {
  const params = new URLSearchParams({
    range: `${start}-${start + size - 1}`,
    sort: map.opened,
    order: "ASC",
  });
  params.set("criteria[0][field]", map.technician);
  params.set("criteria[0][searchtype]", "equals");
  params.set("criteria[0][value]", String(userId));
  let criterion = 1;
  const add = (field: string, searchtype: string, value: string) => {
    const prefix = `criteria[${criterion++}]`;
    params.set(`${prefix}[link]`, "AND");
    params.set(`${prefix}[field]`, field);
    params.set(`${prefix}[searchtype]`, searchtype);
    params.set(`${prefix}[value]`, value);
  };
  if (filters.status === "open") {
    const prefix = `criteria[${criterion++}]`;
    params.set(`${prefix}[link]`, "AND");
    ["1", "2", "3", "4"].forEach((status, index) => {
      const nested = `${prefix}[criteria][${index}]`;
      if (index) params.set(`${nested}[link]`, "OR");
      params.set(`${nested}[field]`, map.status);
      params.set(`${nested}[searchtype]`, "equals");
      params.set(`${nested}[value]`, status);
    });
  } else if (filters.status !== "all") {
    add(map.status, "equals", statusIds[filters.status]);
  }
  if (filters.priority !== "all") add(map.priority, "equals", priorityIds[filters.priority]);
  if (filters.openedFrom) add(map.opened, "morethan", `${filters.openedFrom} 00:00:00`);
  if (filters.openedTo) add(map.opened, "lessthan", `${filters.openedTo} 23:59:59`);
  if (filters.query) {
    if (/^\d+$/.test(filters.query)) add(map.id, "equals", filters.query);
    else add(map.title, "contains", filters.query);
  }
  Object.values(map).forEach((field, index) => params.append(`forcedisplay[${index}]`, field));
  return params;
}
