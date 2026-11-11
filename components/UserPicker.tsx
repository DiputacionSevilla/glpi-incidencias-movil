"use client";

import { useState } from "react";
import type { GlpiUser } from "@/lib/contracts";
import { api } from "./api";

export function UserPicker({
  label,
  users,
  onChange,
  multiple = false,
}: {
  label: string;
  users: GlpiUser[];
  onChange: (users: GlpiUser[]) => void;
  multiple?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlpiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (query.trim().length < 2) {
      setError("Escribe al menos dos caracteres");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<{ users: GlpiUser[] }>(
        `/api/tickets?users=1&query=${encodeURIComponent(query.trim())}`,
      );
      setResults(result.users.filter((user) => !users.some((selected) => selected.id === user.id)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron buscar usuarios");
    } finally {
      setLoading(false);
    }
  }

  function select(user: GlpiUser) {
    onChange(multiple ? [...users, user] : [user]);
    setResults([]);
    setQuery("");
  }

  return (
    <fieldset className="userPicker">
      <legend>{label}</legend>
      {users.map((user) => (
        <div className="selectedUser" key={user.id}>
          <span>{user.name}</span>
          <button
            type="button"
            className="textButton"
            onClick={() => onChange(users.filter((item) => item.id !== user.id))}
          >
            Quitar
          </button>
        </div>
      ))}
      {(multiple || users.length === 0) && (
        <div className="userSearch">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder="Nombre o usuario"
            maxLength={100}
            aria-label={`Buscar ${label.toLowerCase()}`}
          />
          <button
            type="button"
            className="secondaryButton"
            onClick={() => void search()}
            disabled={loading}
          >
            {loading ? "..." : "Buscar"}
          </button>
        </div>
      )}
      {error && <p className="fieldError">{error}</p>}
      {results.length > 0 && (
        <ul className="userResults">
          {results.map((user) => (
            <li key={user.id}>
              <button type="button" onClick={() => select(user)}>
                {user.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
