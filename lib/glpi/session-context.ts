import { AppError } from "./errors";

export function getGlpiUserId(session: Record<string, unknown>) {
  const userId = Number(session.glpiID);
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new AppError("INVALID_RESPONSE", "GLPI no devolvio el usuario activo", 502);
  return userId;
}
