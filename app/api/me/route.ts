import { errorResponse, json } from "@/lib/auth/request";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();
    return json({
      displayName: session.displayName,
      profileName: session.profileName,
      entityName: session.entityName,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
