import type { Followup, TicketPriority, TicketStatus, TicketSummary } from "@/lib/contracts";
import type { SearchMap } from "./search-options";

const statuses: Record<number, TicketStatus> = {
  1: "new",
  2: "processing",
  3: "planned",
  4: "pending",
  5: "solved",
  6: "closed",
};
const priorities: Record<number, TicketPriority> = {
  1: "very-low",
  2: "low",
  3: "medium",
  4: "high",
  5: "very-high",
  6: "major",
};

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  let decoded = value;
  for (let pass = 0; pass < 3; pass++) {
    const next = decoded.replace(
      /&(?:#(x[\da-f]+|\d+)|(amp|apos|gt|lt|nbsp|quot));/gi,
      (entity, numeric: string | undefined, name: string | undefined) => {
        if (name) return named[name.toLowerCase()] ?? entity;
        const codePoint = numeric?.toLowerCase().startsWith("x")
          ? Number.parseInt(numeric.slice(1), 16)
          : Number.parseInt(numeric ?? "", 10);
        if (!Number.isInteger(codePoint) || codePoint < 1 || codePoint > 0x10ffff) return entity;
        return String.fromCodePoint(codePoint);
      },
    );
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function htmlToText(value: unknown): string {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isoDate(value: unknown): string {
  const parsed = new Date(String(value ?? "").replace(" ", "T"));
  return Number.isNaN(parsed.valueOf()) ? new Date(0).toISOString() : parsed.toISOString();
}

export function ageLabel(openedAt: string, now = new Date()): string {
  const days = Math.max(0, Math.floor((now.valueOf() - new Date(openedAt).valueOf()) / 86_400_000));
  if (days === 0) return "Abierta hoy";
  return `Abierta hace ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function normalizeSummary(row: Record<string, unknown>, map: SearchMap): TicketSummary {
  const openedAt = isoDate(row[map.opened]);
  return {
    id: Number(row[map.id]),
    title: htmlToText(row[map.title]) || "Sin titulo",
    openedAt,
    updatedAt: isoDate(row[map.updated]),
    status: statuses[Number(row[map.status])] ?? "new",
    priority: priorities[Number(row[map.priority])] ?? "medium",
    ...(htmlToText(row[map.requester]) ? { requesterName: htmlToText(row[map.requester]) } : {}),
    ...(htmlToText(row[map.location]) ? { locationName: htmlToText(row[map.location]) } : {}),
    ageLabel: ageLabel(openedAt),
  };
}

export function normalizeFollowup(raw: Record<string, unknown>, authorName: string): Followup {
  return {
    id: Number(raw.id),
    authorName,
    createdAt: isoDate(raw.date ?? raw.date_creation),
    contentText: htmlToText(raw.content),
    isPrivate: Number(raw.is_private) === 1,
  };
}

export const statusName: Record<TicketStatus, string> = {
  new: "Nueva",
  processing: "En curso",
  planned: "Planificada",
  pending: "En espera",
  solved: "Resuelta",
  closed: "Cerrada",
};
export const priorityName: Record<TicketPriority, string> = {
  "very-low": "Muy baja",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  "very-high": "Muy alta",
  major: "Critica",
};
