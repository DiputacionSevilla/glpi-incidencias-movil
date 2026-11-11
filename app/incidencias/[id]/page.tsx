"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TicketDetail, TicketSummary } from "@/lib/contracts";
import { priorityName, statusName } from "@/lib/glpi/normalizers";
import { api } from "@/components/api";
import { FollowupEditor } from "@/components/FollowupEditor";
import { CompleteDialog } from "@/components/CompleteDialog";
import { TicketEditor } from "@/components/TicketEditor";

type TicketNavigation = {
  previous?: { id: number; index: number };
  next?: { id: number; index: number };
};

function navigationSearchParams(searchParams: URLSearchParams, index: number) {
  const params = new URLSearchParams({ index: String(index) });
  for (const name of ["status", "priority", "openedFrom", "openedTo", "query"]) {
    const value = searchParams.get(name);
    if (value) params.set(name, value);
  }
  return params;
}

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [ticket, setTicket] = useState<TicketDetail>();
  const [navigation, setNavigation] = useState<TicketNavigation>();
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(false);
  const [complete, setComplete] = useState<"resolve" | "close">();
  const [editing, setEditing] = useState(false);
  async function load() {
    setError("");
    try {
      setTicket(await api<TicketDetail>(`/api/tickets/${id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la incidencia");
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const selectedIndex = Number(searchParams.get("index"));
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
      return;
    }
    // Keep entries on both sides of the selected ticket, including page boundaries.
    const start = Math.max(0, selectedIndex - 25);
    const requestParams = navigationSearchParams(searchParams, selectedIndex);
    requestParams.set("start", String(start));
    requestParams.set("size", "50");
    let cancelled = false;
    void api<{ tickets: TicketSummary[] }>(`/api/tickets?${requestParams}`)
      .then(({ tickets }) => {
        if (cancelled) return;
        const currentIndex = tickets.findIndex((candidate) => candidate.id === Number(id));
        if (currentIndex === -1) return setNavigation(undefined);
        setNavigation({
          previous:
            currentIndex > 0
              ? { id: tickets[currentIndex - 1].id, index: start + currentIndex - 1 }
              : undefined,
          next:
            currentIndex < tickets.length - 1
              ? { id: tickets[currentIndex + 1].id, index: start + currentIndex + 1 }
              : undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setNavigation(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);
  if (error)
    return (
      <main className="appShell">
        <header className="detailHeader">
          <Link href="/incidencias" className="backLink">
            ‹ Volver
          </Link>
        </header>
        <div className="content">
          <div className="alert" role="alert">
            {error}
          </div>
          <button className="primaryButton" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      </main>
    );
  if (!ticket)
    return (
      <main className="appShell">
        <div className="loadingState" role="status">
          Cargando incidencia...
        </div>
      </main>
    );
  const action = ticket.allowedActions.close
    ? "close"
    : ticket.allowedActions.resolve
      ? "resolve"
      : undefined;
  return (
    <main className="appShell detailShell">
      <header className="detailHeader">
        <Link href="/incidencias" className="backLink">
          ‹ Volver
        </Link>
        <div className="ticketNavigator" aria-label="Navegacion entre incidencias">
          {navigation ? (
            navigation.previous ? (
              <Link
                className="ticketNavigationButton"
                href={`/incidencias/${navigation.previous.id}?${navigationSearchParams(searchParams, navigation.previous.index)}`}
                aria-label="Incidencia anterior"
              >
                ‹
              </Link>
            ) : (
              <span className="ticketNavigationButton" aria-hidden="true">
                ‹
              </span>
            )
          ) : null}
          <strong>#{ticket.id}</strong>
          {navigation ? (
            navigation.next ? (
              <Link
                className="ticketNavigationButton"
                href={`/incidencias/${navigation.next.id}?${navigationSearchParams(searchParams, navigation.next.index)}`}
                aria-label="Siguiente incidencia"
              >
                ›
              </Link>
            ) : (
              <span className="ticketNavigationButton" aria-hidden="true">
                ›
              </span>
            )
          ) : null}
        </div>
        <span className={`status status-${ticket.status}`}>{statusName[ticket.status]}</span>
      </header>
      <article className="content detailContent">
        <p className="eyebrow">{ticket.ageLabel.toUpperCase()}</p>
        <h1>{ticket.title}</h1>
        <dl className="metadata">
          <div>
            <dt>Prioridad</dt>
            <dd>{priorityName[ticket.priority]}</dd>
          </div>
          {ticket.locationName && (
            <div>
              <dt>Ubicacion</dt>
              <dd>{ticket.locationName}</dd>
            </div>
          )}
          {ticket.requesterName && (
            <div>
              <dt>Solicitante</dt>
              <dd>{ticket.requesterName}</dd>
            </div>
          )}
          {ticket.categoryName && (
            <div>
              <dt>Categoria</dt>
              <dd>{ticket.categoryName}</dd>
            </div>
          )}
          {ticket.assignedTechnicians.length > 0 && (
            <div>
              <dt>Tecnicos asignados</dt>
              <dd>{ticket.assignedTechnicians.map((technician) => technician.name).join(", ")}</dd>
            </div>
          )}
        </dl>
        <section className="description">
          <h2>Descripcion</h2>
          <p>{ticket.descriptionText || "Sin descripcion"}</p>
        </section>
        <section className="timeline" aria-labelledby="timeline-title">
          <div className="sectionHeading">
            <h2 id="timeline-title">Cronologia</h2>
            <span>
              {ticket.followups.length}{" "}
              {ticket.followups.length === 1 ? "anotacion" : "anotaciones"}
            </span>
          </div>
          {ticket.followups.length === 0 ? (
            <p className="muted">Todavia no hay anotaciones.</p>
          ) : (
            <ol>
              {ticket.followups.map((followup) => (
                <li key={followup.id}>
                  <div className="timelineDot" aria-hidden="true" />
                  <div>
                    <div className="followupMeta">
                      <strong>{followup.authorName}</strong>
                      {followup.isPrivate && <span>Privada</span>}
                    </div>
                    <time dateTime={followup.createdAt}>
                      {new Date(followup.createdAt).toLocaleString("es-ES", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    <p>{followup.contentText}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </article>
      <nav className="bottomBar" aria-label="Acciones de incidencia">
        {ticket.allowedActions.addFollowup && (
          <button className="primaryButton" onClick={() => setEditor(true)}>
            Anotar
          </button>
        )}
        {ticket.allowedActions.edit && (
          <button className="secondaryButton" onClick={() => setEditing(true)}>
            Editar
          </button>
        )}
        {action && (
          <button className="secondaryButton" onClick={() => setComplete(action)}>
            {action === "close" ? "Cerrar" : "Resolver"}
          </button>
        )}
      </nav>
      {editor && (
        <FollowupEditor
          ticketId={ticket.id}
          onClose={() => setEditor(false)}
          onSaved={() => {
            setEditor(false);
            void load();
          }}
        />
      )}
      {complete && (
        <CompleteDialog
          ticketId={ticket.id}
          title={ticket.title}
          action={complete}
          onClose={() => setComplete(undefined)}
        />
      )}
      {editing && (
        <TicketEditor
          ticket={ticket}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
    </main>
  );
}
