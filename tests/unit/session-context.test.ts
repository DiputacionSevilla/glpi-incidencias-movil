import { describe, expect, it } from "vitest";
import { getGlpiUserId } from "@/lib/glpi/session-context";

describe("GLPI session context", () => {
  it("uses glpiID instead of the PHP valid_id session identifier", () => {
    expect(getGlpiUserId({ glpiID: 42, valid_id: "opaque-session-id" })).toBe(42);
  });

  it("rejects a session without a numeric GLPI user", () => {
    expect(() => getGlpiUserId({ valid_id: "opaque-session-id" })).toThrow(
      "GLPI no devolvio el usuario activo",
    );
  });
});
