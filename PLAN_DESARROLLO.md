# Plan de desarrollo: panel movil de incidencias GLPI

## 1. Proposito del documento

Este documento es la especificacion ejecutable para que un agente de programacion implemente de una sola vez una aplicacion web movil para la gestion diaria de incidencias asignadas a tecnicos de GLPI.

La aplicacion debe ser deliberadamente pequena, rapida y operativa. No pretende sustituir GLPI: ofrece al tecnico los cuatro flujos que necesita sobre el terreno:

1. Iniciar sesion con sus credenciales de GLPI.
2. Consultar sus incidencias abiertas, de la mas antigua a la mas reciente.
3. Ver el detalle y el historial de una incidencia.
4. Registrar una anotacion, mediante teclado o dictado, y completar el flujo de cierre permitido por GLPI.

## 2. Resultado esperado del MVP

Una aplicacion web responsive instalable como PWA, optimizada primero para telefonos moviles y util tambien en escritorio. Debe conectarse a GLPI exclusivamente desde un backend intermediario, mantener las credenciales fuera del navegador y presentar una interfaz en espanol clara incluso con conectividad movil irregular.

### Incluido

- Inicio y cierre de sesion contra GLPI con usuario y contrasena.
- Sesion de aplicacion segura mediante cookie `HttpOnly`.
- Lista paginada de incidencias asignadas al tecnico autenticado.
- Orden ascendente por fecha de apertura: primero la incidencia mas antigua.
- Actualizacion manual de la lista mediante gesto/boton visible.
- Detalle de incidencia y cronologia de seguimientos.
- Alta de anotaciones publicas o privadas segun permisos y decision funcional.
- Dictado en espanol dentro del editor de anotaciones.
- Accion de resolver/cerrar adaptada al ciclo real configurado en GLPI.
- Estados de carga, vacio, error, sesion caducada y reintento.
- PWA basica, sin cachear datos sensibles para uso sin conexion.
- Pruebas unitarias, de integracion y E2E de los recorridos criticos.
- Contenedores y documentacion de despliegue.

### Fuera del MVP

- Alta de incidencias.
- Administracion de usuarios, grupos, entidades o inventario.
- Edicion general de todos los campos del ticket.
- Adjuntos, firma, geolocalizacion y notificaciones push.
- Funcionamiento offline con escritura diferida.
- Almacenamiento o analitica propia del contenido de incidencias.

Estos puntos deben quedar posibles mediante una capa GLPI desacoplada, pero no se implementaran anticipadamente.

## 3. Investigacion realizada sobre la instalacion

Pruebas no autenticadas realizadas el 5 de agosto de 2026 contra:

- URL facilitada: `http://soporte.mairenadelalcor.net/glpi`
- API REST: `http://soporte.mairenadelalcor.net/glpi/apirest.php`

### Resultados observados

| Prueba                                               | Resultado                                | Interpretacion                                                          |
| ---------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `GET /glpi/`                                         | `200`, pantalla de autenticacion         | GLPI accesible                                                          |
| `GET /glpi/apirest.php`                              | `200`, documentacion REST                | API REST historica habilitada                                           |
| `GET /glpi/apirest.php/initSession` sin credenciales | `400 ERROR_LOGIN_PARAMETERS_MISSING`     | Inicio de sesion disponible                                             |
| `GET /glpi/apirest.php/getFullSession` sin token     | `400 ERROR_SESSION_TOKEN_MISSING`        | Sesiones API activas                                                    |
| `GET /glpi/apirest.php/getMyProfiles` sin token      | `400 ERROR_SESSION_TOKEN_MISSING`        | Consulta de perfiles disponible                                         |
| `GET /glpi/apirest.php/search/Ticket` sin token      | `400 ERROR_SESSION_TOKEN_MISSING`        | Busqueda de tickets disponible                                          |
| `GET /glpi/apirest.php/Ticket/1` sin token           | `400 ERROR_SESSION_TOKEN_MISSING`        | Acceso generico a objetos disponible                                    |
| `GET /glpi/api.php`                                  | `404`                                    | No se expone aqui una API moderna                                       |
| `GET /glpi/api/graphql`                              | `404`                                    | No se expone GraphQL                                                    |
| Contenido de configuracion servido por GLPI          | version `11.0.8`                         | Version declarada por la instalacion                                    |
| HTTPS con validacion normal                          | error de confianza TLS desde este equipo | Certificado o cadena de confianza a corregir                            |
| HTTPS omitiendo la validacion                        | `200`                                    | El servicio escucha en TLS, pero no debe usarse omitiendo la validacion |

No se proporcionaron credenciales de prueba ni `app_token`. Por tanto, todavia no estan demostrados:

- La autenticacion correcta con el directorio real.
- El perfil y la entidad activos de un tecnico.
- Los identificadores de opciones de busqueda de `Ticket` en esta instalacion.
- La visibilidad de tickets y seguimientos segun permisos.
- El permiso de crear `ITILFollowup` y si puede marcarlo privado.
- El procedimiento permitido para resolver o cerrar una incidencia.
- Si GLPI exige solucion, categoria de solucion u otros campos obligatorios.
- Si se requiere `app_token`; el error sin credenciales no permite concluirlo.

### Bloqueo previo a produccion: TLS

Las credenciales de GLPI nunca deben viajar por HTTP. Antes de integrar cuentas reales hay que instalar en `soporte.mairenadelalcor.net` un certificado valido para el nombre, con su cadena completa y reconocido por los dispositivos y por el servidor de la aplicacion.

No se implementara `rejectUnauthorized: false`, `-k`, una excepcion permanente de certificado ni un retorno automatico a HTTP. En produccion, el backend rechazara un `GLPI_BASE_URL` que no use `https://`.

## 4. Decisiones de arquitectura

### Stack propuesto

- TypeScript estricto de extremo a extremo.
- Next.js con App Router para interfaz y Backend for Frontend (BFF) en un mismo repositorio.
- React y CSS Modules o Tailwind CSS, eligiendo solo uno; preferencia por Tailwind por velocidad y consistencia.
- Redis para sesiones opacas de servidor.
- Zod para validar configuracion, formularios y respuestas normalizadas.
- Cliente HTTP nativo `fetch` envuelto en un unico adaptador GLPI.
- Vitest y Testing Library para pruebas unitarias/de componentes.
- Playwright para pruebas E2E en viewport movil.
- Docker multi-stage y `docker compose` para aplicacion y Redis.
- ESLint, Prettier y gestor de paquetes con lockfile.

El agente debe usar las versiones estables compatibles mas recientes disponibles al generar el proyecto, fijarlas en el lockfile y no depender de versiones flotantes.

### Esquema

```text
Navegador movil
  -> HTTPS, cookie de sesion opaca HttpOnly
Next.js UI + BFF
  -> Redis: sesion de aplicacion y session_token de GLPI
  -> HTTPS validado, app-token solo en servidor
GLPI 11.0.8 / apirest.php
```

### Por que no conectar el navegador directamente a GLPI

- Expondria el `app_token` y el `session_token`.
- Acoplaria la UI al formato variable y a los IDs de busqueda de GLPI.
- Complicaria CORS; en las respuestas examinadas no se observo garantia de un origen permitido.
- Haría mas dificil invalidar sesiones, controlar errores y aplicar limites.
- Aumentaria el riesgo de conservar credenciales o tokens en almacenamiento web.

### Sesion

1. El navegador envia usuario y contrasena al BFF por HTTPS.
2. El BFF llama a `initSession` de GLPI mediante autenticacion Basic y `App-Token` si esta configurado.
3. La contrasena se descarta inmediatamente y nunca se registra ni persiste.
4. El BFF obtiene el contexto del usuario y guarda en Redis el `session_token`, ID de usuario, perfil, entidad y caducidad.
5. El navegador recibe solo un ID aleatorio en una cookie `HttpOnly`, `Secure`, `SameSite=Strict`, con ruta `/`.
6. Cada llamada valida la sesion de aplicacion y renueva su caducidad hasta un maximo absoluto configurable.
7. Al salir, el BFF llama a `killSession`, borra Redis e invalida la cookie.
8. Si GLPI devuelve sesion invalida, se destruye la sesion local y la UI vuelve al acceso con un mensaje claro.

No usar JWT legible con el token GLPI dentro, `localStorage` ni `sessionStorage` para autenticacion.

## 5. Estructura inicial del repositorio

```text
/
  app/
    (auth)/login/page.tsx
    (app)/incidencias/page.tsx
    (app)/incidencias/[id]/page.tsx
    api/auth/login/route.ts
    api/auth/logout/route.ts
    api/me/route.ts
    api/tickets/route.ts
    api/tickets/[id]/route.ts
    api/tickets/[id]/followups/route.ts
    api/tickets/[id]/close/route.ts
  components/
  lib/
    auth/
    glpi/
      client.ts
      contracts.ts
      search-options.ts
      normalizers.ts
      errors.ts
    validation/
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  public/
  middleware.ts
  Dockerfile
  compose.yaml
  .env.example
  README.md
```

No introducir una base de datos relacional en el MVP. GLPI es la fuente de verdad y Redis solo mantiene sesiones y, si resulta necesario, una cache breve de metadatos no sensibles.

## 6. Contrato interno de la aplicacion

La UI nunca consumira respuestas GLPI en bruto. El BFF devolvera contratos pequenos y estables.

```ts
type TicketSummary = {
  id: number;
  title: string;
  openedAt: string;
  updatedAt: string;
  status: "new" | "processing" | "planned" | "pending" | "solved" | "closed";
  priority: "very-low" | "low" | "medium" | "high" | "very-high" | "major";
  requesterName?: string;
  locationName?: string;
  ageLabel: string;
};

type TicketDetail = TicketSummary & {
  descriptionText: string;
  categoryName?: string;
  entityName?: string;
  assignedTechnicians: Array<{ id: number; name: string }>;
  followups: Array<{
    id: number;
    authorName: string;
    createdAt: string;
    contentText: string;
    isPrivate: boolean;
  }>;
  allowedActions: {
    addFollowup: boolean;
    addPrivateFollowup: boolean;
    resolve: boolean;
    close: boolean;
  };
};
```

Todo contenido HTML procedente de GLPI se convertira a texto seguro o se sanitizara con lista blanca antes de renderizar. Nunca usar `dangerouslySetInnerHTML` con contenido sin sanear.

## 7. Integracion con la API GLPI

### Configuracion

```dotenv
GLPI_BASE_URL=https://soporte.mairenadelalcor.net/glpi
GLPI_APP_TOKEN=
REDIS_URL=redis://redis:6379
SESSION_SECRET=
SESSION_IDLE_MINUTES=30
SESSION_ABSOLUTE_HOURS=8
```

Validar variables al arrancar. `SESSION_SECRET` debe tener entropia suficiente. No incluir secretos reales en Git.

### Cabeceras GLPI

- Inicio: `Authorization: Basic <base64(usuario:contrasena)>`.
- Si GLPI lo exige: `App-Token: <token>`, inyectado solo por el servidor.
- Resto: `Session-Token: <token>` y, cuando proceda, `App-Token`.
- Peticiones y respuestas: `Content-Type: application/json` y `Accept: application/json`.

### Descubrimiento obligatorio de campos

Los IDs numericos de `search/Ticket` pueden variar entre versiones y plugins. Tras la primera autenticacion valida, llamar a:

```text
GET /apirest.php/listSearchOptions/Ticket
```

Resolver y validar por nombre/campo las opciones necesarias: ID, titulo, fecha de apertura, ultima modificacion, estado, prioridad, solicitante, ubicacion y tecnico asignado. Guardar el mapa en memoria o Redis con TTL y clave ligada a la version GLPI. Si falta una opcion imprescindible, fallar con diagnostico explicito; no adivinar IDs.

### Listado asignado al tecnico

Usar `GET /apirest.php/search/Ticket` con:

- Criterio de tecnico asignado igual al ID del usuario autenticado.
- Estados operativos acordados; por defecto excluir `solved` y `closed`.
- Orden por fecha de apertura ascendente.
- Campos solicitados explicitamente.
- Paginacion mediante `range`, respetando `Content-Range`.

No confiar solo en un filtro posterior en el BFF: GLPI debe aplicar asignacion y permisos. El BFF normaliza, vuelve a ordenar establemente por `openedAt` y usa `id` como desempate.

Validar con una cuenta que tenga varios perfiles o entidades. Si el perfil activo no es el tecnico adecuado, obtener `getMyProfiles`/`getMyEntities` y aplicar `changeActiveProfile`/`changeActiveEntities` solo tras definir la regla funcional. No seleccionar silenciosamente un perfil con mas privilegios.

### Detalle e historial

Posibles llamadas, que deben confirmarse en la prueba autenticada:

```text
GET /apirest.php/Ticket/{id}
GET /apirest.php/Ticket/{id}/ITILFollowup
```

Pedir solo los campos necesarios cuando la API lo permita. Una respuesta `403` o un objeto no visible se presentara como incidencia no disponible, sin filtrar detalles.

Ordenar seguimientos del mas antiguo al mas reciente para leerlos como cronologia y llevar el foco visual al mas reciente sin desplazar bruscamente la pagina.

### Crear anotacion

Ruta prevista:

```text
POST /apirest.php/ITILFollowup
```

Entrada conceptual:

```json
{
  "input": {
    "itemtype": "Ticket",
    "items_id": 123,
    "content": "Texto de la anotacion",
    "is_private": 0
  }
}
```

Confirmar nombres y permisos con la instalacion. Escapar el texto para que se conserve como texto, mantener saltos de linea y limitar longitud tanto en cliente como en servidor. El servidor debe ignorar cualquier autor enviado por el navegador y dejar que GLPI asocie al usuario de sesion.

Evitar duplicados por doble toque: deshabilitar el envio mientras esta en curso y usar una clave de idempotencia local de corta duracion en Redis para `session + ticket + hash(contenido)`. Tras exito, limpiar el editor y refrescar detalle; tras error, conservar el borrador en memoria.

### Resolver o cerrar

No asumir que cambiar `status` a cerrado es el flujo correcto. GLPI distingue habitualmente entre resuelta y cerrada, puede exigir una `ITILSolution` y puede reservar el cierre al solicitante o a otro perfil.

Durante la prueba autenticada hay que determinar una de estas estrategias:

1. Crear `ITILSolution` y dejar el ticket como resuelto.
2. Actualizar `Ticket/{id}` al estado permitido si la politica no requiere solucion.
3. Crear solucion y despues cerrar solo si el perfil y las reglas lo permiten.

La UI mostrara la etiqueta real de la capacidad: `Resolver incidencia` o `Cerrar incidencia`; no prometera cerrar si el backend solo puede resolver. El endpoint interno `/api/tickets/{id}/close` abstraera la estrategia configurada y devolvera el estado final.

Si el proceso tiene dos llamadas y la segunda falla, no repetir automaticamente la primera. Devolver un estado parcial explicito y recargar el ticket desde GLPI.

### Errores, tiempos y limites

- Timeout por llamada GLPI: 10 segundos, configurable.
- Reintento automatico: solo una vez para `GET` ante fallo transitorio; nunca para escrituras sin idempotencia comprobada.
- Traducir errores GLPI a codigos internos y mensajes en espanol sin exponer tokens ni respuestas sensibles.
- Tratar `401/ERROR_SESSION_TOKEN_INVALID` como sesion caducada.
- Tratar `403` como falta de permiso, no como error generico.
- Tratar `429` y `5xx` como servicio temporalmente no disponible.
- Incluir un ID de correlacion en logs y respuesta de error.

## 8. Experiencia de usuario movil

### Principios visuales

- Una sola columna y ancho maximo moderado en escritorio.
- Fondo neutro, alto contraste y un unico color de accion.
- El color complementa texto e icono; nunca comunica un estado por si solo.
- Tipografia del sistema para cargar rapido y verse nativa.
- Objetivos tactiles de al menos 44 x 44 px; preferencia de 48 px.
- Texto base minimo de 16 px para evitar zoom en formularios iOS.
- Sin tablas, menus laterales, graficos, contadores decorativos ni sombras excesivas.
- Respetar areas seguras con `env(safe-area-inset-*)`.
- Transiciones breves y anuladas con `prefers-reduced-motion`.

### Pantalla de acceso

- Marca/nombre corto: `Incidencias`.
- Campos `Usuario` y `Contrasena` con etiquetas persistentes.
- Boton primario `Entrar` a ancho completo.
- Mostrar/ocultar contrasena mediante control accesible.
- Mensaje breve: se usan las credenciales de GLPI y no se almacenan.
- Error generico para credenciales invalidas, sin revelar si el usuario existe.
- No ofrecer recordar la contrasena desde codigo; permitir la gestion normal del navegador.

### Lista de incidencias

Cabecera compacta y fija:

- Titulo `Mis incidencias`.
- Numero de incidencias visibles.
- Boton de actualizar.
- Menu minimo con identidad, ultima sincronizacion y cerrar sesion.

Cada fila/tarjeta completa sera pulsable y mostrara solo:

- `#ID` y etiqueta de estado.
- Titulo, maximo dos lineas.
- Antiguedad destacada, por ejemplo `Abierta hace 3 dias`.
- Prioridad solo cuando sea alta o superior.
- Ubicacion o solicitante en una linea secundaria si existe.

La lista mostrara explicitamente `Mas antiguas primero`. Usar carga incremental con boton `Cargar mas`, mas predecible y accesible que un scroll infinito. Al volver del detalle, conservar posicion y datos mientras se revalidan.

Estado vacio: `No tienes incidencias abiertas asignadas` y boton `Actualizar`.

### Detalle

- Barra superior con volver, `#ID` y estado.
- Titulo y metadatos esenciales.
- Descripcion completa en bloque legible.
- Cronologia de anotaciones con autor y fecha.
- Barra inferior fija con `Anotar` como accion principal y `Resolver/Cerrar` como accion secundaria.
- Evitar pestanas; el desplazamiento vertical es mas directo en movil.
- Compensar la barra inferior con `safe-area` y espacio final para no tapar contenido.

### Editor de anotacion

Abrir como pagina/modal de pantalla completa en movil:

- Titulo `Nueva anotacion` y referencia del ticket.
- `textarea` grande que crece hasta un limite razonable.
- Boton circular de microfono junto al editor.
- Estado textual visible: `Iniciar dictado`, `Escuchando...`, `Pausar` o `Dictado no disponible`.
- Boton `Guardar anotacion`, deshabilitado si solo contiene espacios.
- Contador de caracteres cerca del limite.
- Confirmacion antes de descartar un borrador no enviado.
- Selector publica/privada solo si el usuario tiene permiso y el Ayuntamiento define que debe exponerse; por defecto, anotacion publica.

### Resolver/cerrar

- Dialogo de confirmacion con ID y titulo.
- Explicar el resultado exacto: resuelta o cerrada.
- Si GLPI exige solucion, pedir el texto en el propio dialogo y reutilizar el dictado.
- Boton destructivo con verbo concreto; no usar `Aceptar`.
- Bloquear doble envio y mostrar resultado con mensaje persistente.
- Al completar, volver a la lista y retirar el ticket si ya no pertenece a estados operativos.

## 9. Voz a texto

### Implementacion

Crear un hook/componente aislado sobre Web Speech API:

- Detectar `window.SpeechRecognition || window.webkitSpeechRecognition`.
- Configurar `lang = "es-ES"`, `continuous = true` e `interimResults = true` cuando el navegador lo soporte.
- Iniciar solo por gesto explicito del usuario.
- Mostrar texto provisional de forma diferenciada y consolidar solo resultados finales.
- Anexar al contenido existente sin sobrescribir lo escrito.
- Conservar puntuacion y espacios razonables entre segmentos.
- Detener al enviar, cerrar el editor, cambiar de pagina, ocultarse el documento o desmontarse el componente.
- Permitir detener manualmente y corregir el texto antes de guardar.
- Gestionar `not-allowed`, `audio-capture`, `no-speech`, `network` y finalizacion inesperada con mensajes comprensibles.

### Compatibilidad y privacidad

Web Speech API no tiene soporte uniforme y algunos navegadores envian audio a un servicio externo del proveedor. La funcionalidad es una mejora progresiva:

- Si no esta disponible, ocultar/deshabilitar el boton y mantener el teclado plenamente funcional.
- Recordar que los teclados moviles ya suelen ofrecer su propio dictado.
- Requiere contexto seguro HTTPS y permiso de microfono.
- No grabar, almacenar ni enviar audio al backend de esta aplicacion.
- Antes de produccion, validar con Delegado de Proteccion de Datos/seguridad el uso del reconocimiento del navegador para datos potencialmente personales.
- Mostrar una nota breve antes del primer uso y enlazar la politica de privacidad aprobada.

No incorporar un servicio de transcripcion de pago ni subir audio en el MVP.

## 10. Seguridad y proteccion de datos

- HTTPS valido de extremo a extremo.
- Credenciales procesadas solo en memoria durante `initSession`.
- Tokens GLPI almacenados exclusivamente en Redis con TTL.
- Cookies `HttpOnly`, `Secure`, `SameSite=Strict` y rotacion del ID tras login.
- Comprobar `Origin` en escrituras y aplicar proteccion CSRF adicional si el despliegue exige cookies menos restrictivas.
- Politica CSP estricta, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` y `Referrer-Policy` restrictiva.
- Rate limit por IP y usuario en login, con espera progresiva sin bloquear globalmente cuentas legitimas.
- Validacion server-side de ID, contenido, rangos y acciones.
- Autorizacion delegada a GLPI y comprobada tambien por `allowedActions`; nunca confiar en botones ocultos.
- Limitar tamano de cuerpos y longitud de anotaciones.
- Sanitizar contenido y evitar XSS almacenado procedente de GLPI.
- No cachear respuestas autenticadas en CDN; usar `Cache-Control: no-store`.
- El service worker no cacheara HTML/API de incidencias ni borradores.
- Logs estructurados sin contrasenas, tokens, contenido, nombres de solicitantes ni descripciones.
- Auditar solo metadatos necesarios: fecha, usuario interno pseudonimizado, accion, ticket ID, resultado y correlacion.
- Limpiar sesiones al cerrar y por expiracion; definir retencion de logs con el Ayuntamiento.
- Escanear dependencias y secretos en CI.

## 11. Accesibilidad

Objetivo WCAG 2.2 AA:

- HTML semantico, orden de encabezados y regiones claras.
- Etiquetas visibles en formularios; no depender de placeholders.
- Navegacion completa con teclado y foco muy visible.
- `aria-live` moderado para dictado, guardado y errores.
- Dialogos con foco confinado y retorno de foco al cerrarse.
- Iconos siempre con nombre accesible o texto visible.
- Contraste AA en texto, bordes y estados.
- Errores asociados al campo correspondiente.
- Fechas con elemento `time`, texto relativo visible y fecha absoluta accesible.
- Pruebas automaticas con axe y revision manual con lector de pantalla.

## 12. Pruebas

### Unitarias

- Normalizacion de estados, prioridades, fechas y contenido HTML.
- Construccion de consultas a `search/Ticket` usando opciones descubiertas.
- Orden estable de mas antigua a mas reciente.
- Traduccion de errores GLPI.
- Validacion y limite de anotaciones.
- Maquina de estados de dictado y union de segmentos finales/intermedios.
- Politica de expiracion de sesion.

### Integracion con GLPI simulado

Usar fixtures realistas y un servidor HTTP simulado para:

- Login correcto, credenciales invalidas y GLPI caido.
- Descubrimiento de opciones de busqueda.
- Paginacion y cabecera `Content-Range`.
- Ticket no visible o no asignado.
- Alta de seguimiento correcta, denegada y timeout.
- Sesion GLPI caducada.
- Resolver/cerrar con exito y resultado parcial.
- Respuestas HTML maliciosas sanitizadas.

No acoplar la suite normal a la instancia municipal.

### E2E Playwright

Ejecutar al menos en Chromium con viewport de telefono pequeno y escritorio:

1. Login y redireccion a lista.
2. Lista ordenada por antiguedad.
3. Abrir detalle, volver y conservar posicion.
4. Crear anotacion y verla en cronologia.
5. Evitar doble envio.
6. Resolver/cerrar y retirar de la lista.
7. Sesion caducada con retorno seguro al login.
8. Estados vacio, lento, sin red y error.
9. Dictado no compatible y dictado simulado mediante adaptador inyectable.
10. Navegacion por teclado y comprobacion axe sin fallos graves.

### Prueba autenticada previa a dar por terminada la integracion

Solicitar al administrador:

- Cuenta tecnica de pruebas con permisos equivalentes al usuario final.
- Varias incidencias de prueba antiguas y recientes asignadas a esa cuenta.
- Permiso para crear seguimientos y ejecutar el flujo de resolucion/cierre.
- `app_token` dedicado a esta aplicacion, si la configuracion lo exige.
- Entidad, perfil y reglas de privacidad esperados.

Ejecutar un script manual, nunca en CI publica, que compruebe:

1. `initSession` y `getFullSession`.
2. Perfil y entidad activos.
3. `listSearchOptions/Ticket` y mapeo de campos.
4. Busqueda asignada y orden.
5. Lectura de detalle y seguimientos.
6. Creacion de una anotacion identificable como prueba.
7. Procedimiento real de resolver/cerrar sobre un ticket desechable.
8. `killSession`.

Guardar solo resultados sanitizados, IDs de opciones y conclusiones tecnicas; nunca tokens ni contenido real.

## 13. Observabilidad y operacion

- Endpoint `/api/health/live` sin dependencias externas.
- Endpoint `/api/health/ready` que compruebe Redis y conectividad TLS a GLPI sin autenticarse.
- Logs JSON con nivel, evento, duracion, estado HTTP, ticket ID y correlacion.
- Metricas: latencia y tasa de error GLPI, logins fallidos, sesiones activas, listados, anotaciones y cierres; sin contenido personal.
- Alertas por aumento de errores GLPI, TLS, Redis o latencia.
- La interfaz mostrara ultima actualizacion y permitira reintentar.
- Despliegue detras de proxy inverso con TLS, limites de cuerpo y cabeceras seguras.
- Backups solo de configuracion/infraestructura; Redis de sesiones no necesita persistencia duradera.

## 14. CI/CD y calidad

En cada cambio ejecutar:

```text
format:check
lint
typecheck
test
test:e2e
build
```

La imagen se construira como usuario no root, con dependencias de produccion minimas y healthcheck. Publicar un `.env.example`, instrucciones de rotacion de secretos y procedimiento de rollback. No desplegar automaticamente a produccion municipal sin aprobacion.

## 15. Orden de implementacion para el agente

1. Inicializar repositorio, TypeScript estricto, estilos, calidad, pruebas y lockfile.
2. Crear configuracion validada, Dockerfile, Compose con Redis y `.env.example`.
3. Implementar cliente GLPI, errores tipados, sesiones Redis y rutas de login/logout.
4. Implementar descubrimiento de `listSearchOptions/Ticket` y normalizadores con fixtures.
5. Implementar BFF de lista, detalle y seguimientos con mocks completos.
6. Construir login y lista mobile-first con todos sus estados.
7. Construir detalle y cronologia.
8. Implementar editor, alta de anotacion e idempotencia.
9. Implementar dictado como mejora progresiva y sus pruebas.
10. Implementar estrategia configurable de resolver/cerrar, inicialmente respaldada por mock hasta completar la prueba autenticada.
11. Añadir PWA sin cache sensible, seguridad, accesibilidad y observabilidad.
12. Completar pruebas unitarias, integracion y E2E.
13. Ejecutar format, lint, typecheck, tests y build; corregir todos los fallos.
14. Documentar instalacion local, variables, despliegue, limites y prueba autenticada pendiente.
15. Con credenciales autorizadas y TLS corregido, ejecutar la validacion real y fijar el flujo de cierre definitivo.

El agente no debe simular como completada una integracion real si no dispone de credenciales autorizadas. La aplicacion debe quedar funcional con el servidor GLPI simulado y preparada para activar la instancia real solo mediante configuracion.

## 16. Criterios de aceptacion

- Un tecnico puede autenticarse sin que sus credenciales o tokens queden en navegador, logs o almacenamiento persistente.
- Un usuario no autenticado no puede acceder a ninguna ruta ni dato de incidencias.
- La lista contiene exclusivamente incidencias visibles y asignadas al tecnico en estados operativos.
- La incidencia mas antigua aparece siempre primero, incluida la paginacion.
- La lista es comprensible a 320 px de ancho y todas las acciones tactiles son accesibles.
- El detalle muestra descripcion e historial saneados y legibles.
- Una anotacion se puede dictar, revisar, editar y guardar cuando el navegador soporte reconocimiento.
- La ausencia o denegacion del microfono no impide escribir ni guardar.
- No se envia una anotacion duplicada por doble toque o reintento inmediato.
- La accion final refleja y ejecuta el ciclo permitido por GLPI: resolver o cerrar.
- Los errores conservan el texto no enviado y ofrecen una accion de recuperacion.
- El logout invalida tanto la sesion local como la sesion GLPI cuando este disponible.
- No se cachean datos de tickets en service worker, CDN ni almacenamiento web.
- No existen excepciones de validacion TLS en produccion.
- Lint, tipos, pruebas, E2E y build finalizan correctamente.
- Lighthouse movil y pruebas axe no presentan problemas criticos; el rendimiento se valida con una red movil simulada.

## 17. Decisiones que debe confirmar el responsable funcional

Estas decisiones no bloquean el esqueleto, pero si la puesta en produccion:

1. ¿La accion del tecnico debe dejar la incidencia `Resuelta` o realmente `Cerrada`?
2. ¿Es obligatorio escribir una solucion al resolver/cerrar?
3. ¿Las anotaciones son publicas por defecto? ¿Debe permitirse marcar una como privada?
4. ¿Que estados cuentan como trabajo diario: nueva, en curso, planificada y en espera?
5. ¿Deben incluirse tickets asignados al grupo del tecnico ademas de los asignados directamente?
6. ¿Que perfil y entidad se deben activar si el usuario dispone de varios?
7. ¿Solicitante y ubicacion pueden mostrarse en la lista o solo en el detalle?
8. ¿Cual es la longitud maxima autorizada para anotaciones y soluciones?
9. ¿Esta aprobado el dictado del navegador considerando que el proveedor puede procesar el audio externamente?
10. ¿Cual sera el dominio HTTPS definitivo de esta aplicacion?

## 18. Evolucion futura prevista

La capa BFF y los contratos internos deben permitir añadir, en iteraciones independientes:

- Filtros por estado, prioridad, grupo, entidad y vencimiento SLA.
- Tickets asignados a grupos con una regla clara de pertenencia.
- Cambio de estado: en curso, pendiente y planificada.
- Registro de tiempo empleado y tareas (`TicketTask`).
- Soluciones tipificadas y plantillas de texto.
- Fotografias y otros documentos adjuntos.
- Notificaciones push de nuevas asignaciones o vencimientos.
- Busqueda por ID y texto.
- Panel de carga y SLA para coordinadores, con permisos propios.
- Modo offline cifrado y con cola de sincronizacion, solo tras un analisis de riesgos especifico.

Cada ampliacion debe comprobar primero permisos y contrato de la API real, mantener GLPI como fuente de verdad y evitar convertir la interfaz movil en una replica sobrecargada de GLPI.
