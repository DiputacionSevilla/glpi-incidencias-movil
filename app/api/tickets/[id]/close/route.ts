import { assertSameOrigin, errorResponse, json } from "@/lib/auth/request";
import { getSession } from "@/lib/auth/session";
import { completeTicket } from "@/lib/glpi/tickets";
import { closeSchema, ticketIdSchema } from "@/lib/validation/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    const id = ticketIdSchema.parse((await context.params).id);
    const body = closeSchema.parse(await request.json());
    return json(await completeTicket(session, id, body.solution));
  } catch (error) {
    return errorResponse(error);
  }
}
