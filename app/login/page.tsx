"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/components/api";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    search.has("caducada") ? "Tu sesion ha caducado. Vuelve a entrar." : "",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      router.replace("/incidencias");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se ha podido iniciar sesion");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="loginShell">
      <section className="loginCard" aria-labelledby="login-title">
        <div className="brandMark" aria-hidden="true">
          I
        </div>
        <p className="eyebrow">AYUNTAMIENTO</p>
        <h1 id="login-title">Incidencias</h1>
        <p className="intro">Accede a tus incidencias asignadas desde el movil.</p>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="formStack">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            maxLength={128}
            autoFocus
          />
          <div className="labelRow">
            <label htmlFor="password">Contrasena</label>
            <button
              className="textButton"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-controls="password"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={512}
          />
          <button className="primaryButton" type="submit" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="privacyNote">
          Tus credenciales de GLPI se usan solo para iniciar esta sesion y no se almacenan.
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="loginShell" aria-busy="true" />}>
      <LoginForm />
    </Suspense>
  );
}
