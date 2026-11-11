"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

type SpeechResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type SpeechErrorEvent = Event & { error: string };
type Recognition = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export function joinTranscript(existing: string, segment: string) {
  const clean = segment.trim();
  if (!clean) return existing;
  return `${existing.trimEnd()}${existing.trim() ? " " : ""}${clean}`;
}

export function newTranscriptSegment(
  committed: string,
  previousResult: string,
  transcript: string,
) {
  const clean = transcript.trim();
  const previous = previousResult.trim();
  const complete = committed.trim();
  if (!clean || clean === previous) return "";
  if (previous && clean.startsWith(previous)) return clean.slice(previous.length).trim();
  if (complete && clean.startsWith(complete)) return clean.slice(complete.length).trim();
  if (complete && complete.endsWith(clean)) return "";
  return clean;
}

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const recognition = useRef<Recognition | null>(null);
  const finalResults = useRef(new Map<number, string>());
  const committedTranscript = useRef("");
  const onFinalEvent = useEffectEvent(onFinal);
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(
        (window.SpeechRecognition ?? window.webkitSpeechRecognition) && window.isSecureContext,
      ),
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) return;
    const instance = new Constructor();
    instance.lang = "es-ES";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let provisional = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          const segment = newTranscriptSegment(
            committedTranscript.current,
            finalResults.current.get(index) ?? "",
            transcript,
          );
          finalResults.current.set(index, transcript);
          if (segment) {
            committedTranscript.current = joinTranscript(committedTranscript.current, segment);
            onFinalEvent(segment);
          }
        } else provisional += result[0].transcript;
      }
      setInterim(provisional);
    };
    instance.onerror = (event) => {
      setListening(false);
      const messages: Record<string, string> = {
        "not-allowed": "Permiso de microfono denegado",
        "audio-capture": "No se detecta ningun microfono",
        "no-speech": "No se ha detectado voz",
        network: "El dictado no tiene conexion",
      };
      setMessage(messages[event.error] ?? "El dictado se ha detenido");
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    const stopWhenHidden = () => {
      if (document.hidden) instance.stop();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      instance.stop();
      recognition.current = null;
    };
  }, []);

  function toggle() {
    if (!recognition.current) return;
    if (listening) recognition.current.stop();
    else {
      setMessage("El reconocimiento puede ser procesado por el proveedor de tu navegador.");
      setInterim("");
      finalResults.current.clear();
      committedTranscript.current = "";
      try {
        recognition.current.start();
        setListening(true);
      } catch {
        setMessage("No se ha podido iniciar el dictado");
      }
    }
  }
  return {
    supported,
    listening,
    interim,
    message,
    toggle,
    stop: () => recognition.current?.stop(),
  };
}
