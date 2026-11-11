"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TicketPriority, TicketStatus, TicketSummary } from "@/lib/contracts";
import { priorityName, statusName } from "@/lib/glpi/normalizers";
import { api } from "@/components/api";

type Me = { displayName: string; profileName: string; entityName: string };
type Filters = {
  status: "open" | "all" | TicketStatus;
  priority: "all" | TicketPriority;
  openedFrom: string;
  openedTo: string;
  query: string;
};

const initialFilters: Filters = {
  status: "open",
  priority: "all",
  openedFrom: "",
  openedTo: "",
  query: "",
};

function ticketPath(start: number, filters: Filters) {
  const params = new URLSearchParams({
    start: String(start),
    size: "20",
    status: filters.status,
    priority: filters.priority,
  });
  if (filters.openedFrom) params.set("openedFrom", filters.openedFrom);
  if (filters.openedTo) params.set("openedTo", filters.openedTo);
  if (filters.query.trim()) params.set("query", filters.query.trim());
  return `/api/tickets?${params}`;
}

function ticketDetailPath(id: number, index: number, filters: Filters) {
  const params = new URLSearchParams({
    index: String(index),
    status: filters.status,
    priority: filters.priority,
  });
  if (filters.openedFrom) params.set("openedFrom", filters.openedFrom);
  if (filters.openedTo) params.set("openedTo", filters.openedTo);
  if (filters.query.trim()) params.set("query", filters.query.trim());
  return `/incidencias/${id}?${params}`;
}

export default function TicketsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"list" | "filters">("list");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState<Me>();
  const [syncedAt, setSyncedAt] = useState<Date>();

  async function load(reset = true, selected = filters) {
    if (reset) setLoading(true);
    else setMoreLoading(true);
    setError("");
    try {
      const start = reset ? 0 : tickets.length;
      const [result, identity] = await Promise.all([
        api<{ tickets: TicketSummary[]; total: number }>(ticketPath(start, selected)),
        me ? Promise.resolve(me) : api<Me>("/api/me"),
      ]);
      setTickets((current) => (reset ? result.tickets : [...current, ...result.tickets]));
      setTotal(result.total);
      setMe(identity);
      setSyncedAt(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las incidencias");
    } finally {
      setLoading(false);
      setMoreLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    router.replace("/login");
  }

  function apply(selected: Filters) {
    setFilters(selected);
    setDraft(selected);
    setTab("list");
    void load(true, selected);
  }

  const activeFilterCount =
    Number(filters.status !== "open") +
    Number(filters.priority !== "all") +
    Number(Boolean(filters.openedFrom)) +
    Number(Boolean(filters.openedTo)) +
    Number(Boolean(filters.query));

  return (
    <main className="appShell">
      <header className="stickyHeader">
        <div>
          <p className="eyebrow">TRABAJO DE CAMPO</p>
          <h1>Mis incidencias</h1>
        </div>
        <button
          className="iconButton"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Actualizar incidencias"
          title="Actualizar"
        >
          ↻
        </button>
        <Link className="headerAction" href="/incidencias/nueva">
          Nueva
        </Link>
      </header>
      <nav className="tabs" role="tablist" aria-label="Incidencias y filtros">
        <button
          role="tab"
          aria-selected={tab === "list"}
          className={tab === "list" ? "active" : ""}
          onClick={() => setTab("list")}
        >
          Incidencias <span>{loading ? "..." : total}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "filters"}
          className={tab === "filters" ? "active" : ""}
          onClick={() => setTab("filters")}
        >
          Filtros {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </nav>
      {tab === "filters" ? (
        <section className="content filterPanel" role="tabpanel">
          <div className="filterIntro">
            <p className="eyebrow">ACOTAR EL TRABAJO</p>
            <h2>Filtrar incidencias</h2>
            <p className="muted">Todos los criterios se aplican sobre tus incidencias asignadas.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              apply(draft);
            }}
          >
            <div className="filterField fullWidth">
              <label htmlFor="filter-query">ID o texto del titulo</label>
              <input
                id="filter-query"
                type="search"
                value={draft.query}
                onChange={(event) => setDraft({ ...draft, query: event.target.value })}
                maxLength={100}
                placeholder="Ej. 1234 o impresora"
              />
            </div>
            <div className="filterField">
              <label htmlFor="filter-status">Estado</label>
              <select
                id="filter-status"
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value as Filters["status"] })
                }
              >
                <option value="open">Abiertas operativas</option>
                <option value="all">Todos los estados</option>
                {(Object.keys(statusName) as TicketStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusName[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="filterField">
              <label htmlFor="filter-priority">Prioridad</label>
              <select
                id="filter-priority"
                value={draft.priority}
                onChange={(event) =>
                  setDraft({ ...draft, priority: event.target.value as Filters["priority"] })
                }
              >
                <option value="all">Todas</option>
                {(Object.keys(priorityName) as TicketPriority[]).map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityName[priority]}
                  </option>
                ))}
              </select>
            </div>
            <div className="filterField">
              <label htmlFor="filter-from">Abierta desde</label>
              <input
                id="filter-from"
                type="date"
                value={draft.openedFrom}
                max={draft.openedTo || undefined}
                onChange={(event) => setDraft({ ...draft, openedFrom: event.target.value })}
              />
            </div>
            <div className="filterField">
              <label htmlFor="filter-to">Abierta hasta</label>
              <input
                id="filter-to"
                type="date"
                value={draft.openedTo}
                min={draft.openedFrom || undefined}
                onChange={(event) => setDraft({ ...draft, openedTo: event.target.value })}
              />
            </div>
            <div className="filterActions fullWidth">
              <button className="primaryButton" type="submit">
                Aplicar filtros
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => apply(initialFilters)}
              >
                Limpiar filtros
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="content" role="tabpanel">
          <details className="accountPanel">
            <summary>{me?.displayName ?? "Mi cuenta"}</summary>
            {me && (
              <p>
                {me.profileName} · {me.entityName}
              </p>
            )}
            <p>
              {syncedAt
                ? `Actualizado a las ${syncedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
                : "Sin actualizar"}
            </p>
            <button className="secondaryButton" onClick={() => void logout()}>
              Cerrar sesion
            </button>
          </details>
          <div className="listHeading">
            <div>
              <strong>{loading ? "..." : total} incidencias</strong>
              <p>Mayor prioridad y, a igualdad, mas antiguas primero</p>
            </div>
          </div>
          {error && (
            <div className="alert" role="alert">
              <p>{error}</p>
              <button className="textButton" onClick={() => void load()}>
                Reintentar
              </button>
            </div>
          )}
          {loading ? (
            <div className="loadingState" role="status">
              Cargando incidencias...
            </div>
          ) : tickets.length === 0 && !error ? (
            <div className="emptyState">
              <h2>Sin resultados</h2>
              <p>No hay incidencias que cumplan los filtros aplicados.</p>
              <button className="primaryButton" onClick={() => apply(initialFilters)}>
                Mostrar trabajo abierto
              </button>
            </div>
          ) : (
            <ol className="ticketList">
              {tickets.map((ticket, index) => (
                <li key={ticket.id}>
                  <Link className="ticketCard" href={ticketDetailPath(ticket.id, index, filters)}>
                    <div className="ticketTop">
                      <span className="ticketId">#{ticket.id}</span>
                      <span className={`status status-${ticket.status}`}>
                        {statusName[ticket.status]}
                      </span>
                    </div>
                    <h2>{ticket.title}</h2>
                    <p className="age">{ticket.ageLabel}</p>
                    {(ticket.priority === "high" ||
                      ticket.priority === "very-high" ||
                      ticket.priority === "major") && (
                      <p className="priority">Prioridad {priorityName[ticket.priority]}</p>
                    )}
                    {(ticket.locationName || ticket.requesterName) && (
                      <p className="secondaryLine">{ticket.locationName ?? ticket.requesterName}</p>
                    )}
                    <span className="cardArrow" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {tickets.length < total && (
            <button
              className="secondaryButton loadMore"
              onClick={() => void load(false)}
              disabled={moreLoading}
            >
              {moreLoading ? "Cargando..." : "Cargar mas"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
