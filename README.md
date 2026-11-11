# Incidencias GLPI

Aplicacion Next.js mobile-first para que cada tecnico consulte y gestione sus incidencias GLPI asignadas. El navegador solo habla con el BFF; las credenciales se descartan tras `initSession` y el `session_token` permanece en Redis asociado a una cookie opaca `HttpOnly`.

## Requisitos

- Node.js 20.9 o posterior y npm 10 o posterior.
- Redis 7 o posterior.
- GLPI con la API REST historica habilitada.
- HTTPS en produccion para la aplicacion y GLPI. Una instalacion HTTP interna se habilita explicitamente con `GLPI_ALLOW_HTTP=true`; no se desactiva la validacion TLS.

## Configuracion

Copiar las variables documentadas en `.env.example` a un gestor de secretos o a `.env` para Compose. Generar `SESSION_SECRET` con al menos 32 caracteres aleatorios. `GLPI_BASE_URL` no incluye `/apirest.php`.

`GLPI_CLOSE_STRATEGY` controla la accion final expuesta:

- `disabled`: oculta la accion.
- `solution`: crea `ITILSolution` y solicita texto; GLPI deja la incidencia resuelta.
- `status-solved`: actualiza el estado a resuelta, solo si la politica de GLPI lo permite.
- `status-closed`: actualiza el estado a cerrada, solo si el perfil lo permite.

El despliegue usa `status-closed` por defecto. El tecnico debe escribir una anotacion de cierre; el backend crea el seguimiento publico y despues cambia el estado. Si GLPI rechaza el cambio, conserva la anotacion y muestra el error para no ocultar un resultado parcial.

La aplicacion nunca lee `GLPI_USER` ni `GLPI_PASS`. Esas variables se usan exclusivamente al ejecutar manualmente `npm run probe:glpi`, un diagnostico de conectividad de solo lectura que siempre finaliza con `killSession` y solo imprime metadatos saneados.

## Desarrollo y calidad

```sh
npm ci
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

La aplicacion queda en `http://localhost:3000`. Para desarrollo local, ajustar `REDIS_URL=redis://localhost:6379` y `APP_ORIGIN=http://localhost:3000`. Para probar desde otros equipos de la red se pueden indicar varios origenes exactos separados por comas, por ejemplo `APP_ORIGIN=http://localhost:3000,http://10.0.0.20:3000`. La cookie marca `Secure` cuando todos los origenes usan HTTPS; el HTTP local debe habilitarse de forma deliberada mediante esos origenes.

## Contenedores

La guia completa de despliegue productivo en Ubuntu esta en [DEPLOYMENT.md](DEPLOYMENT.md). Compose no carga `.env.local`, evitando pasar las credenciales administrativas del script al contenedor.

```sh
docker compose build
docker compose up -d
docker compose ps
curl https://incidencias.example.internal/api/health/live
curl https://incidencias.example.internal/api/health/ready
docker compose down
```

La imagen multi-stage ejecuta Next.js standalone como usuario no root. Solo Caddy publica los puertos `80` y `443`; Redis no persiste sesiones. `/api/health/live` no usa dependencias; `/api/health/ready` comprueba Redis y conectividad GLPI sin autenticarse.

## Seguridad y operacion

- Las rutas autenticadas y respuestas GLPI usan `Cache-Control: no-store`.
- El service worker no tiene manejador `fetch` ni Cache Storage: no guarda HTML, API, tickets ni borradores.
- Las escrituras requieren origen coincidente, `SameSite=Strict`, validacion Zod y autorizacion efectiva en GLPI.
- Los detalles y escrituras vuelven a comprobar que el tecnico esta asignado directamente al ticket.
- Los logs omiten credenciales, tokens y contenido; los errores incluyen un identificador de correlacion.
- Rotar `SESSION_SECRET` invalida todas las sesiones. Rotar `GLPI_APP_TOKEN` en GLPI y actualizar el secreto de despliegue. No hay datos de aplicacion que migrar o restaurar.

El dictado usa Web Speech API solo por gesto del usuario, en `es-ES`, y no envia audio al BFF. El navegador o su proveedor puede procesarlo; requiere HTTPS, permiso y aprobacion de privacidad. El teclado siempre sigue disponible.

## Despliegue y rollback

Desplegar detras de un proxy HTTPS que preserve `Host`/`X-Forwarded-Proto`, limite cuerpos y no almacene respuestas autenticadas. Fijar una etiqueta de imagen por version. Para rollback, restaurar la etiqueta anterior y recrear solo `app`; Redis puede conservar o descartar las sesiones.

Antes de usar el cierre en produccion, validar con una incidencia desechable los permisos, transiciones de estado y campos obligatorios del perfil tecnico.
