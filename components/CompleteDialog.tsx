"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { joinTranscript, useSpeechRecognition } from "./useSpeechRecognition";

export function CompleteDialog({
  ticketId,
  title,
  action,
  onClose,
}: {
  ticketId: number;
  title: string;
  action: "resolve" | "close";
  onClose: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [solution, setSolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const speech = useSpeechRecognition((segment) =>
    setSolution((value) => joinTranscript(value, segment)),
  );
  const verb = action === "close" ? "Cerrar" : "Resolver";

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function close() {
    if (solution.trim() && !window.confirm("¿Descartar el texto no guardado?")) return;
    speech.stop();
    onClose();
  }

  async function submit() {
    setBusy(true);
    setError("");
    speech.stop();
    try {
      await api(`/api/tickets/${ticketId}/close`, {
        method: "POST",
        body: JSON.stringify({ solution }),
      });
      router.replace("/incidencias?completada=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar");
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="fullDialog closeDialog" aria-labelledby="complete-title">
      <div className="dialogHeader">
        <button className="iconButton" onClick={close} aria-label="Cerrar dialogo">
          ×
        </button>
        <div>
          <p className="eyebrow">INCIDENCIA #{ticketId}</p>
          <h2 id="complete-title">{verb} incidencia</h2>
        </div>
      </div>
      <div className="dialogBody">
        <p className="dialogTicketTitle">{title}</p>
        <p className="muted">
          Se guardara esta anotacion y la incidencia pasara a estado{" "}
          {action === "close" ? "cerrada" : "resuelta"}.
        </p>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <label htmlFor="complete-solution">
          {action === "close" ? "Anotacion de cierre" : "Solucion"}
        </label>
        <textarea
          id="complete-solution"
          value={solution}
          onChange={(event) => setSolution(event.target.value)}
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
          <span className={solution.length > 7500 ? "nearLimit" : ""}>
            {solution.length} / 8000
          </span>
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
          className="dangerButton fullWidthButton"
          onClick={() => void submit()}
          disabled={busy || !solution.trim()}
        >
          {busy ? "Procesando..." : `${verb} incidencia`}
        </button>
      </div>
    </dialog>
  );
}
