"use client";

import { useEffect, useRef, useState } from "react";
import type { GlpiUser, TicketDetail } from "@/lib/contracts";
import { api } from "./api";
import { UserPicker } from "./UserPicker";
import { joinTranscript, useSpeechRecognition } from "./useSpeechRecognition";

export function TicketEditor({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: TicketDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(ticket.title);
  const [content, setContent] = useState(ticket.descriptionText);
  const [priority, setPriority] = useState(
    String(
      ["very-low", "low", "medium", "high", "very-high", "major"].indexOf(ticket.priority) + 1,
    ),
  );
  const [requesters, setRequesters] = useState<GlpiUser[]>(
    ticket.requester ? [ticket.requester] : [],
  );
  const [technicians, setTechnicians] = useState(ticket.assignedTechnicians);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleSpeech = useSpeechRecognition((segment) =>
    setTitle((value) => joinTranscript(value, segment)),
  );
  const contentSpeech = useSpeechRecognition((segment) =>
    setContent((value) => joinTranscript(value, segment)),
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function close() {
    titleSpeech.stop();
    contentSpeech.stop();
    onClose();
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requesters[0] || technicians.length === 0) {
      setError("Selecciona solicitante y al menos un tecnico asignado");
      return;
    }
    setBusy(true);
    setError("");
    titleSpeech.stop();
    contentSpeech.stop();
    try {
      await api(`/api/tickets/${ticket.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          content,
          priority: Number(priority),
          requesterId: requesters[0].id,
          technicianIds: technicians.map((technician) => technician.id),
        }),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la incidencia");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialog} className="fullDialog" aria-labelledby="ticket-editor-title">
      <div className="dialogHeader">
        <button className="iconButton" onClick={close} aria-label="Cerrar editor">
          ×
        </button>
        <div>
          <p className="eyebrow">INCIDENCIA #{ticket.id}</p>
          <h2 id="ticket-editor-title">Editar incidencia</h2>
        </div>
      </div>
      <form className="dialogForm" onSubmit={save}>
        <div className="dialogBody ticketEditor">
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <label htmlFor="edit-title">Titulo</label>
          <input
            id="edit-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={255}
            required
            autoFocus
          />
          <SpeechControl speech={titleSpeech} />
          <label htmlFor="edit-priority">Prioridad</label>
          <select
            id="edit-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="1">Muy baja</option>
            <option value="2">Baja</option>
            <option value="3">Media</option>
            <option value="4">Alta</option>
            <option value="5">Muy alta</option>
            <option value="6">Critica</option>
          </select>
          <label htmlFor="edit-content">Descripcion</label>
          <textarea
            id="edit-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={8000}
            required
          />
          <SpeechControl speech={contentSpeech} />
          <UserPicker label="Solicitante" users={requesters} onChange={setRequesters} />
          <UserPicker
            label="Tecnicos asignados"
            users={technicians}
            onChange={setTechnicians}
            multiple
          />
        </div>
        <div className="dialogActions">
          <button className="primaryButton" disabled={busy}>
            {busy ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function SpeechControl({ speech }: { speech: ReturnType<typeof useSpeechRecognition> }) {
  return (
    <div className="editorMeta">
      {speech.supported ? (
        <button
          className={`micButton ${speech.listening ? "listening" : ""}`}
          onClick={speech.toggle}
          type="button"
        >
          {speech.listening ? "Pausar dictado" : "Dictar texto"}
        </button>
      ) : (
        <span>Dictado no disponible: requiere HTTPS</span>
      )}
    </div>
  );
}
