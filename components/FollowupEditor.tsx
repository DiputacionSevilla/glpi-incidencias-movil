"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { joinTranscript, useSpeechRecognition } from "./useSpeechRecognition";

export function FollowupEditor({
  ticketId,
  onClose,
  onSaved,
}: {
  ticketId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const speech = useSpeechRecognition((segment) =>
    setContent((value) => joinTranscript(value, segment)),
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function close() {
    if (content.trim() && !window.confirm("¿Descartar la anotacion no guardada?")) return;
    speech.stop();
    onClose();
  }
  async function save() {
    setBusy(true);
    setError("");
    speech.stop();
    try {
      await api(`/api/tickets/${ticketId}/followups`, {
        method: "POST",
        body: JSON.stringify({ content, isPrivate: false }),
      });
      setContent("");
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialog} className="fullDialog" aria-labelledby="followup-title">
      <div className="dialogHeader">
        <button className="iconButton" onClick={close} aria-label="Cerrar editor">
          ×
        </button>
        <div>
          <p className="eyebrow">INCIDENCIA #{ticketId}</p>
          <h2 id="followup-title">Nueva anotacion</h2>
        </div>
      </div>
      <div className="dialogBody">
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <label htmlFor="followup-content">Anotacion publica</label>
        <textarea
          id="followup-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={8000}
          rows={10}
          autoFocus
        />
        {speech.interim && (
          <p className="interim" aria-live="polite">
            {speech.interim}
          </p>
        )}
        <div className="editorMeta">
          <span className={content.length > 7500 ? "nearLimit" : ""}>{content.length} / 8000</span>
          {speech.supported ? (
            <button
              className={`micButton ${speech.listening ? "listening" : ""}`}
              onClick={speech.toggle}
              type="button"
            >
              {speech.listening ? "Pausar dictado" : "Iniciar dictado"}
            </button>
          ) : (
            <span>Dictado no disponible</span>
          )}
        </div>
        {speech.message && (
          <p className="speechNote" aria-live="polite">
            {speech.message}
          </p>
        )}
      </div>
      <div className="dialogActions">
        <button
          className="primaryButton"
          onClick={() => void save()}
          disabled={busy || !content.trim()}
        >
          {busy ? "Guardando..." : "Guardar anotacion"}
        </button>
      </div>
    </dialog>
  );
}
