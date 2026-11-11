import "server-only";
import { createHash } from "node:crypto";
import { getConfig } from "@/lib/config";
import type { Session } from "@/lib/auth/session";
import { idempotencyKey } from "@/lib/auth/session";
import { redis } from "@/lib/auth/redis";
import type { GlpiUser, TicketDetail, TicketSummary } from "@/lib/contracts";
import { AppError } from "./errors";
import { glpiRequest } from "./client";
import { buildTicketSearch, getSearchOptions, type TicketSearchFilters } from "./search-options";
import { ageLabel, htmlToText, isoDate, normalizeFollowup, normalizeSummary } from "./normalizers";

type Raw = Record<string, unknown>;

async function itemName(type: string, id: number, token: string): Promise<string | undefined> {
  if (!id) return undefined;
  try {
    const { data } = await glpiRequest<Raw>(`${type}/${id}`, { token });
    return (
      htmlToText(
        data.completename ?? data.name ?? [data.firstname, data.realname].filter(Boolean).join(" "),
      ) || undefined
    );
  } catch {
    return undefined;
  }
}

async function ticketUsers(id: number, token: string) {
  const { data } = await glpiRequest<Raw[]>(`Ticket/${id}/Ticket_User`, { token });
  return Array.isArray(data) ? data : [];
}

export async function listTickets(
  session: Session,
  start: number,
  size: number,
  filters?: TicketSearchFilters,
) {
  const map = await getSearchOptions(session.glpiToken);
  const query = buildTicketSearch(map, session.userId, start, size, filters);
  const { data } = await glpiRequest<{ totalcount?: number; data?: Raw[] }>(
    `search/Ticket?${query}`,
    { token: session.glpiToken },
  );
  const tickets = (data.data ?? []).map((row) => normalizeSummary(row, map)).sort(ticketComparator);
  return {
    tickets,
    total: Number(data.totalcount ?? tickets.length),
    nextStart: start + tickets.length,
  };
}

export async function searchUsers(session: Session, query: string): Promise<GlpiUser[]> {
  const params = new URLSearchParams({ range: "0-19" });
  ["1", "9", "34"].forEach((field, index) => {
    const prefix = `criteria[${index}]`;
    if (index) params.set(`${prefix}[link]`, "OR");
    params.set(`${prefix}[field]`, field);
    params.set(`${prefix}[searchtype]`, "contains");
    params.set(`${prefix}[value]`, query);
  });
  ["2", "1", "9", "34"].forEach((field, index) => params.append(`forcedisplay[${index}]`, field));
  const { data } = await glpiRequest<{ data?: Raw[] }>(`search/User?${params}`, {
    token: session.glpiToken,
  });
  return (data.data ?? [])
    .map((user) => {
      const id = Number(user["2"] ?? user.id);
      const name = htmlToText(
        [user["9"], user["34"]].filter(Boolean).join(" ") || (user["1"] ?? user.name),
      );
      return id && name ? { id, name } : undefined;
    })
    .filter((user): user is GlpiUser => Boolean(user));
}

export async function createTicket(
  session: Session,
  input: {
    title: string;
    content: string;
    requesterId: number;
    technicianIds: number[];
    priority: number;
  },
) {
  if ((session.rights.ticket & 4) !== 4)
    throw new AppError("FORBIDDEN", "No tienes permiso para crear incidencias", 403);
  const { data } = await glpiRequest<{ id?: number }>("Ticket", {
    method: "POST",
    token: session.glpiToken,
    body: {
      input: {
        name: input.title,
        content: input.content,
        priority: input.priority,
        _users_id_requester: input.requesterId,
        _users_id_assign: input.technicianIds[0],
      },
    },
    retry: false,
  });
  const id = Number(data.id);
  if (!id)
    throw new AppError(
      "INVALID_RESPONSE",
      "GLPI no devolvio el identificador de la incidencia",
      502,
    );
  await addTechnicians(session, id, input.technicianIds.slice(1));
  return { id };
}

async function addTechnicians(session: Session, ticketId: number, technicianIds: number[]) {
  await Promise.all(
    technicianIds.map((users_id) =>
      glpiRequest("Ticket_User", {
        method: "POST",
        token: session.glpiToken,
        body: { input: { tickets_id: ticketId, users_id, type: 2 } },
        retry: false,
      }),
    ),
  );
}

export async function getTicket(session: Session, id: number): Promise<TicketDetail> {
  const [{ data: ticket }, users, { data: rawFollowups }] = await Promise.all([
    glpiRequest<Raw>(`Ticket/${id}`, { token: session.glpiToken }),
    ticketUsers(id, session.glpiToken),
    glpiRequest<Raw[]>(`Ticket/${id}/ITILFollowup`, { token: session.glpiToken }),
  ]);
  const technicians = users.filter((user) => Number(user.type) === 2);
  if (!technicians.some((user) => Number(user.users_id) === session.userId))
    throw new AppError("FORBIDDEN", "La incidencia no esta asignada a tu usuario", 403);
  const requester = users.find((user) => Number(user.type) === 1);
  const authorIds = [
    ...new Set((rawFollowups ?? []).map((followup) => Number(followup.users_id)).filter(Boolean)),
  ];
  const [requesterName, locationName, categoryName, entityName, technicianNames, authorNames] =
    await Promise.all([
      itemName("User", Number(requester?.users_id), session.glpiToken),
      itemName("Location", Number(ticket.locations_id), session.glpiToken),
      itemName("ITILCategory", Number(ticket.itilcategories_id), session.glpiToken),
      itemName("Entity", Number(ticket.entities_id), session.glpiToken),
      Promise.all(
        technicians.map((user) => itemName("User", Number(user.users_id), session.glpiToken)),
      ),
      Promise.all(authorIds.map((userId) => itemName("User", userId, session.glpiToken))),
    ]);
  const authors = new Map(
    authorIds.map((userId, index) => [userId, authorNames[index] ?? "Usuario GLPI"]),
  );
  const openedAt = isoDate(ticket.date);
  const statusValues = ["new", "processing", "planned", "pending", "solved", "closed"] as const;
  const priorityValues = ["very-low", "low", "medium", "high", "very-high", "major"] as const;
  const strategy = getConfig().GLPI_CLOSE_STRATEGY;
  const mayUpdate = (session.rights.ticket & 2) === 2;
  const mayFollowup = (session.rights.followup & 4) === 4;
  return {
    id: Number(ticket.id),
    title: htmlToText(ticket.name) || "Sin titulo",
    openedAt,
    updatedAt: isoDate(ticket.date_mod),
    status: statusValues[Math.max(0, Math.min(5, Number(ticket.status) - 1))],
    priority: priorityValues[Math.max(0, Math.min(5, Number(ticket.priority) - 1))],
    ...(requesterName ? { requesterName } : {}),
    ...(requesterName && requester
      ? { requester: { id: Number(requester.users_id), name: requesterName } }
      : {}),
    ...(locationName ? { locationName } : {}),
    ageLabel: ageLabel(openedAt),
    descriptionText: htmlToText(ticket.content),
    ...(categoryName ? { categoryName } : {}),
    ...(entityName ? { entityName } : {}),
    assignedTechnicians: technicians.map((user, index) => ({
      id: Number(user.users_id),
      name: technicianNames[index] ?? "Tecnico GLPI",
    })),
    followups: (rawFollowups ?? [])
      .map((followup) =>
        normalizeFollowup(followup, authors.get(Number(followup.users_id)) ?? "Usuario GLPI"),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
    allowedActions: {
      addFollowup: mayFollowup,
      addPrivateFollowup: false,
      resolve: mayUpdate && (strategy === "solution" || strategy === "status-solved"),
      close: mayUpdate && mayFollowup && strategy === "status-closed",
      edit: mayUpdate,
    },
  };
}

export async function updateTicket(
  session: Session,
  id: number,
  input: {
    title: string;
    content: string;
    requesterId: number;
    technicianIds: number[];
    priority: number;
  },
) {
  if ((session.rights.ticket & 2) !== 2)
    throw new AppError("FORBIDDEN", "No tienes permiso para editar incidencias", 403);
  const users = await ticketUsers(id, session.glpiToken);
  const currentTechnicians = users.filter((user) => Number(user.type) === 2);
  const desiredTechnicians = new Set(input.technicianIds);
  await glpiRequest(`Ticket/${id}`, {
    method: "PUT",
    token: session.glpiToken,
    body: {
      input: {
        id,
        name: input.title,
        content: input.content,
        priority: input.priority,
        _users_id_requester: input.requesterId,
      },
    },
    retry: false,
  });
  await Promise.all(
    currentTechnicians
      .filter((user) => !desiredTechnicians.has(Number(user.users_id)))
      .map((user) =>
        glpiRequest(`Ticket_User/${Number(user.id)}`, {
          method: "DELETE",
          token: session.glpiToken,
          retry: false,
        }),
      ),
  );
  const currentIds = new Set(currentTechnicians.map((user) => Number(user.users_id)));
  await addTechnicians(
    session,
    id,
    input.technicianIds.filter((technicianId) => !currentIds.has(technicianId)),
  );
  return { id };
}

export async function addFollowup(session: Session, id: number, content: string) {
  const detail = await getTicket(session, id);
  if (!detail.allowedActions.addFollowup)
    throw new AppError("FORBIDDEN", "No tienes permiso para anotar", 403);
  const digest = createHash("sha256").update(content).digest("hex");
  const key = await idempotencyKey(id, digest);
  const client = await redis();
  if (!(await client.set(key, "pending", { NX: true, EX: 30 })))
    throw new AppError("FORBIDDEN", "Esta anotacion ya se esta procesando", 409);
  try {
    const { data } = await glpiRequest<{ id?: number }>("ITILFollowup", {
      method: "POST",
      token: session.glpiToken,
      body: { input: { itemtype: "Ticket", items_id: id, content, is_private: 0 } },
      retry: false,
    });
    await client.set(key, "complete", { EX: 30 });
    return { id: Number(data.id) };
  } catch (error) {
    await client.del(key);
    throw error;
  }
}

export async function completeTicket(session: Session, id: number, solution: string) {
  const detail = await getTicket(session, id);
  const strategy = getConfig().GLPI_CLOSE_STRATEGY;
  if (!detail.allowedActions.resolve && !detail.allowedActions.close)
    throw new AppError("FORBIDDEN", "No tienes permiso para completar esta incidencia", 403);
  if (strategy === "solution") {
    if (!solution) throw new AppError("CONFIGURATION", "Es necesario escribir la solucion", 400);
    await glpiRequest("ITILSolution", {
      method: "POST",
      token: session.glpiToken,
      body: { input: { itemtype: "Ticket", items_id: id, content: solution } },
      retry: false,
    });
    return { status: "solved" as const };
  }
  if (!solution) throw new AppError("CONFIGURATION", "Es necesario escribir la anotacion", 400);
  await glpiRequest("ITILFollowup", {
    method: "POST",
    token: session.glpiToken,
    body: { input: { itemtype: "Ticket", items_id: id, content: solution, is_private: 0 } },
    retry: false,
  });
  const status = strategy === "status-closed" ? 6 : 5;
  await glpiRequest(`Ticket/${id}`, {
    method: "PUT",
    token: session.glpiToken,
    body: { input: { id, status } },
    retry: false,
  });
  return { status: status === 6 ? ("closed" as const) : ("solved" as const) };
}

export function sortTickets(tickets: TicketSummary[]) {
  return [...tickets].sort(ticketComparator);
}

function ticketComparator(a: TicketSummary, b: TicketSummary) {
  return (
    priorityOrder(b.priority) - priorityOrder(a.priority) ||
    a.openedAt.localeCompare(b.openedAt) ||
    a.id - b.id
  );
}

function priorityOrder(priority: TicketSummary["priority"]) {
  return ["very-low", "low", "medium", "high", "very-high", "major"].indexOf(priority);
}
