import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
const fileEnv = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [
        line.slice(0, separator).trim(),
        line
          .slice(separator + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ];
    }),
);

const env = { ...fileEnv, ...process.env };
for (const name of ["GLPI_BASE_URL", "GLPI_USER", "GLPI_PASS"]) {
  if (!env[name]) throw new Error(`Falta ${name}`);
}

const api = `${env.GLPI_BASE_URL.replace(/\/$/, "")}/apirest.php`;
const appHeaders = env.GLPI_APP_TOKEN ? { "App-Token": env.GLPI_APP_TOKEN } : {};
let token;

async function request(endpoint, options = {}) {
  const response = await fetch(`${api}/${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...appHeaders,
      ...(token ? { "Session-Token": token } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  return { body, headers: response.headers };
}

function shape(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

try {
  const basic = Buffer.from(`${env.GLPI_USER}:${env.GLPI_PASS}`, "utf8").toString("base64");
  const init = await request("initSession", { headers: { Authorization: `Basic ${basic}` } });
  token = init.body.session_token;
  if (!token) throw new Error("initSession no devolvio session_token");

  const [{ body: full }, { body: rawOptions }] = await Promise.all([
    request("getFullSession"),
    request("listSearchOptions/Ticket"),
  ]);
  const session = full.session ?? full;
  const safeSession = Object.fromEntries(
    Object.entries(session)
      .filter(([key]) =>
        /^(glpiID|glpi(active|current)|glpiactiveprofile|glpiactiveentities)/i.test(key),
      )
      .map(([key, value]) => [key, shape(value)]),
  );
  const profile = session.glpiactiveprofile;
  const profileShape =
    profile && typeof profile === "object"
      ? Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, shape(value)]))
      : shape(profile);

  const options = Object.entries(rawOptions)
    .filter(([, value]) => value && typeof value === "object")
    .map(([id, value]) => ({
      id,
      field: value.field ?? null,
      name: value.name ?? null,
      table: value.table ?? null,
      datatype: value.datatype ?? null,
    }));
  const relevant = options.filter((option) =>
    /(^id$|name|status|priority|date|modified|user|location|assign|request)/i.test(
      `${option.field} ${option.name} ${option.table}`,
    ),
  );

  const findOption = (test) => options.find(test)?.id;
  const searchMap = {
    id: findOption((option) => option.table === "glpi_tickets" && option.field === "id"),
    title: findOption((option) => option.table === "glpi_tickets" && option.field === "name"),
    priority: findOption(
      (option) => option.table === "glpi_tickets" && option.field === "priority",
    ),
    requester: findOption(
      (option) =>
        option.table === "glpi_users" &&
        option.field === "name" &&
        /solicitante/i.test(option.name ?? ""),
    ),
    technician: findOption(
      (option) =>
        option.table === "glpi_users" &&
        option.field === "name" &&
        /^t[eé]cnico$/i.test(option.name ?? ""),
    ),
    status: findOption((option) => option.table === "glpi_tickets" && option.field === "status"),
    opened: findOption((option) => option.table === "glpi_tickets" && option.field === "date"),
    updated: findOption((option) => option.table === "glpi_tickets" && option.field === "date_mod"),
    location: findOption(
      (option) => option.table === "glpi_locations" && option.field === "completename",
    ),
  };
  if (Object.values(searchMap).some((value) => !value)) {
    throw new Error("No se pudieron resolver todas las opciones obligatorias");
  }

  const assignedParams = new URLSearchParams({
    range: "0-4",
    sort: searchMap.opened,
    order: "ASC",
  });
  assignedParams.set("criteria[0][field]", searchMap.technician);
  assignedParams.set("criteria[0][searchtype]", "equals");
  assignedParams.set("criteria[0][value]", String(session.glpiID));
  assignedParams.set("criteria[1][link]", "AND");
  ["1", "2", "3", "4"].forEach((status, index) => {
    const prefix = `criteria[1][criteria][${index}]`;
    if (index) assignedParams.set(`${prefix}[link]`, "OR");
    assignedParams.set(`${prefix}[field]`, searchMap.status);
    assignedParams.set(`${prefix}[searchtype]`, "equals");
    assignedParams.set(`${prefix}[value]`, status);
  });
  Object.values(searchMap).forEach((field, index) =>
    assignedParams.append(`forcedisplay[${index}]`, field),
  );

  const search = await request("search/Ticket?range=0-0");
  const assignedSearch = await request(`search/Ticket?${assignedParams}`);
  const assignedRows = Array.isArray(assignedSearch.body.data) ? assignedSearch.body.data : [];
  const assignedDates = assignedRows.map((row) => String(row[searchMap.opened]));
  const first = Array.isArray(search.body.data) ? search.body.data[0] : undefined;
  let ticketShape = null;
  let followupShape = null;
  let ticketUserShape = null;
  if (first?.[2]) {
    const detail = await request(`Ticket/${encodeURIComponent(String(first[2]))}`);
    ticketShape = Object.fromEntries(
      Object.entries(detail.body).map(([key, value]) => [key, shape(value)]),
    );
    const followups = await request(`Ticket/${encodeURIComponent(String(first[2]))}/ITILFollowup`);
    const item = Array.isArray(followups.body) ? followups.body[0] : undefined;
    followupShape = item
      ? Object.fromEntries(Object.entries(item).map(([key, value]) => [key, shape(value)]))
      : { response: shape(followups.body) };
    const ticketUsers = await request(`Ticket/${encodeURIComponent(String(first[2]))}/Ticket_User`);
    const ticketUser = Array.isArray(ticketUsers.body) ? ticketUsers.body[0] : undefined;
    ticketUserShape = ticketUser
      ? Object.fromEntries(Object.entries(ticketUser).map(([key, value]) => [key, shape(value)]))
      : { response: shape(ticketUsers.body) };
  }

  console.log(
    JSON.stringify(
      {
        authenticated: true,
        sessionShape: safeSession,
        profileShape,
        searchOptionCount: options.length,
        relevantSearchOptions: relevant,
        resolvedSearchMap: searchMap,
        assignedOpenSearch: {
          accepted: true,
          totalcount: Number(assignedSearch.body.totalcount ?? 0),
          returned: assignedRows.length,
          oldestFirst: assignedDates.every(
            (value, index) => index === 0 || assignedDates[index - 1].localeCompare(value) <= 0,
          ),
          contentRangePresent: Boolean(assignedSearch.headers.get("content-range")),
        },
        searchShape: {
          keys: Object.keys(search.body),
          totalcount: shape(search.body.totalcount),
          count: shape(search.body.count),
          dataRow: first
            ? Object.fromEntries(Object.entries(first).map(([key, value]) => [key, shape(value)]))
            : null,
          contentRangePresent: Boolean(search.headers.get("content-range")),
        },
        ticketShape,
        followupShape,
        ticketUserShape,
      },
      null,
      2,
    ),
  );
} finally {
  if (token) await request("killSession").catch(() => undefined);
}
