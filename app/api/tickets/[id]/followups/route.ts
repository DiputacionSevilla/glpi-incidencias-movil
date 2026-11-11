import { assertSameOrigin, errorResponse, json } from "@/lib/auth/request";
import { getSession } from "@/lib/auth/session";
import { addFollowup } from "@/lib/glpi/tickets";
import { followupSchema, ticketIdSchema } from "@/lib/validation/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    const id = ticketIdSchema.parse((await context.params).id);
    const body = followupSchema.parse(await request.json());
    return json(await addFollowup(session, id, body.content), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
