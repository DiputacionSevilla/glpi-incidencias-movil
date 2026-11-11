import { assertSameOrigin, errorResponse, json } from "@/lib/auth/request";
import { getSession } from "@/lib/auth/session";
import { getTicket, updateTicket } from "@/lib/glpi/tickets";
import { ticketIdSchema, updateTicketSchema } from "@/lib/validation/schemas";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const id = ticketIdSchema.parse((await context.params).id);
    return json(await getTicket(session, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    const id = ticketIdSchema.parse((await context.params).id);
    return json(await updateTicket(session, id, updateTicketSchema.parse(await request.json())));
  } catch (error) {
    return errorResponse(error);
  }
}
