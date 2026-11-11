---
name: glpi-incidencias
description: Use when changing GLPI ticket, user search, login, session, followup, close, or creation behavior in this application. Covers the GLPI REST API and LDAP-synchronized users.
---

# GLPI Incidencias

## Architecture

- The browser only calls this Next.js BFF. Never call GLPI directly from client code.
- Each technician authenticates through `initSession`; the GLPI session token is stored server-side in Redis and associated with an opaque `HttpOnly` cookie.
- Never add `GLPI_USER` or `GLPI_PASS` to production environment files, container images, logs, tests, or documentation.
- `GLPI_BASE_URL` excludes `/apirest.php`.
- GLPI is currently reached through authorized internal HTTP. Keep `GLPI_ALLOW_HTTP=true` only where explicitly approved.

## Relevant Files

- `lib/glpi/client.ts`: authenticated REST client, headers, timeout and error mapping.
- `lib/glpi/tickets.ts`: ticket list, detail, user search, creation, followups and close.
- `lib/glpi/search-options.ts`: discovers Ticket search option IDs dynamically. Do not hardcode Ticket option IDs.
- `app/api/tickets/route.ts`: ticket list, user search and creation BFF routes.
- `app/api/auth/login/route.ts`: login and server-side GLPI session lifecycle.
- `lib/auth/request.ts`: origin validation for every write.
- `lib/validation/schemas.ts`: input validation.

## API Conventions

- Use `glpiRequest` for all GLPI calls; it adds `App-Token` and `Session-Token` correctly and avoids cached requests.
- Return sanitized application errors through `errorResponse`; do not expose GLPI bodies, tokens, credentials, ticket content, or raw upstream errors.
- Mutating requests require `assertSameOrigin`, `getSession`, Zod validation, and effective GLPI permissions.
- Keep `Cache-Control: no-store` for authenticated data.

## User Search and Active Directory

- The application must not query Active Directory directly.
- GLPI can select only users that GLPI has already synchronized/imported from LDAP/AD.
- Use `search/User`, not `GET /User?searchText=...`; on this GLPI instance `searchText` was ignored and returned initial local users.
- Search with `contains` criteria joined with `OR` on User search fields:

```text
1  login/name
9  firstname
34 surname
```

- Request the user ID via `forcedisplay[0]=2`; without that column, search results cannot be selected.
- Also request fields `1`, `9`, and `34`, then normalize display names from first name + surname, falling back to login.
- A missing municipal employee requires synchronization in GLPI, not an application-side AD integration.

## Ticket Creation

- `POST /api/tickets` validates `title`, `content`, `priority`, `requesterId`, and `technicianId`.
- The GLPI payload uses `POST /Ticket` and:

```text
_users_id_requester
_users_id_assign
```

- Check the effective `CREATE` ticket right before creating. Existing update and followup permission checks must remain unchanged.
- Test against a disposable authorized ticket when testing writes.

## Dictation

- Every user-content textarea must include the existing speech control pattern from `components/useSpeechRecognition.ts`.
- Use `joinTranscript` for final segments and call `speech.stop()` before saving or closing.
- The recognition language is `es-ES`.
- Web Speech requires a secure context: it does not work through direct HTTP/IP access. Do not fake support in insecure contexts.

## Verification

Run before deployment:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

For diagnostics, use temporary read-only probes that immediately call `killSession`; never print credentials or `session_token` values.
