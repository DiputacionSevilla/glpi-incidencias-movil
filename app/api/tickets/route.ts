import { assertSameOrigin, errorResponse, json } from "@/lib/auth/request";
import { getSession } from "@/lib/auth/session";
import { createTicket, listTickets, searchUsers } from "@/lib/glpi/tickets";
import {
  createTicketSchema,
  paginationSchema,
  ticketFiltersSchema,
  userSearchSchema,
} from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams);
    const session = await getSession();
    if (url.searchParams.has("users")) {
      const { query: userQuery } = userSearchSchema.parse({ query: query.query });
      return json({ users: await searchUsers(session, userQuery) });
    }
    const paging = paginationSchema.parse(query);
    const filters = ticketFiltersSchema.parse({
      status: query.status || undefined,
      priority: query.priority || undefined,
      openedFrom: query.openedFrom || undefined,
      openedTo: query.openedTo || undefined,
      query: query.query,
    });
    return json(await listTickets(session, paging.start, paging.size, filters));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    return json(await createTicket(session, createTicketSchema.parse(await request.json())), {
      status: 201,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
