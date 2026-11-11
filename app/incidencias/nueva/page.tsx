"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GlpiUser } from "@/lib/contracts";
import { api } from "@/components/api";
import { joinTranscript, useSpeechRecognition } from "@/components/useSpeechRecognition";
import { UserPicker } from "@/components/UserPicker";

export default function NewTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("3");
  const [requesters, setRequesters] = useState<GlpiUser[]>([]);
  const [technicians, setTechnicians] = useState<GlpiUser[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titleSpeech = useSpeechRecognition((segment) =>
    setTitle((value) => joinTranscript(value, segment)),
  );
  const contentSpeech = useSpeechRecognition((segment) =>
    setContent((value) => joinTranscript(value, segment)),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requesters[0] || technicians.length === 0) {
      setError("Selecciona solicitante y tecnico asignado");
      return;
    }
    setSaving(true);
    setError("");
    titleSpeech.stop();
    contentSpeech.stop();
    try {
      const ticket = await api<{ id: number }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          priority: Number(priority),
          requesterId: requesters[0].id,
          technicianIds: technicians.map((technician) => technician.id),
        }),
      });
      router.push(`/incidencias/${ticket.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la incidencia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="appShell">
      <header className="stickyHeader">
        <div>
          <p className="eyebrow">NUEVA SOLICITUD</p>
          <h1>Crear incidencia</h1>
        </div>
        <Link className="headerAction" href="/incidencias">
          Cancelar
        </Link>
      </header>
      <form className="content createTicketForm" onSubmit={submit}>
        <div className="filterField">
          <label htmlFor="title">Titulo</label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={255}
            required
          />
          <DictationControl speech={titleSpeech} />
        </div>
        <div className="filterField">
          <label htmlFor="priority">Prioridad</label>
          <select
            id="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="1">Muy baja</option>
            <option value="2">Baja</option>
            <option value="3">Media</option>
            <option value="4">Alta</option>
            <option value="5">Muy alta</option>
            <option value="6">Mayor</option>
          </select>
        </div>
        <div className="filterField fullWidth">
          <label htmlFor="content">Descripcion</label>
          <textarea
            id="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={8000}
            required
          />
          <DictationControl speech={contentSpeech} />
        </div>
        <div className="fullWidth">
          <UserPicker label="Solicitante" users={requesters} onChange={setRequesters} />
        </div>
        <div className="fullWidth">
          <UserPicker
            label="Tecnicos asignados"
            users={technicians}
            onChange={setTechnicians}
            multiple
          />
        </div>
        {error && (
          <div className="alert fullWidth" role="alert">
            <p>{error}</p>
          </div>
        )}
        <div className="fullWidth">
          <button className="primaryButton" disabled={saving}>
            {saving ? "Creando..." : "Crear incidencia"}
          </button>
        </div>
      </form>
    </main>
  );
}

function DictationControl({ speech }: { speech: ReturnType<typeof useSpeechRecognition> }) {
  return (
    <>
      {speech.interim && (
        <p className="interim" aria-live="polite">
          {speech.interim}
        </p>
      )}
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
      {speech.message && (
        <p className="speechNote" aria-live="polite">
          {speech.message}
        </p>
      )}
    </>
  );
}
